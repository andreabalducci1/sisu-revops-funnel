/**
 * One-time Airtable base setup for the SiSu RevOps funnel.
 *
 * Creates the "Leads" table (and any missing fields) that lib/airtable.ts writes to,
 * via the Airtable metadata API. Idempotent: re-running only adds what is missing.
 *
 * Dry-run by default (prints the plan and exits). Pass --apply to actually write.
 *
 *   # 1. Create an empty base in Airtable, copy its ID (appXXXXXXXXXXXXXX from the URL)
 *   # 2. Create a token at airtable.com/create/tokens with scopes:
 *   #      schema.bases:read, schema.bases:write, data.records:read, data.records:write
 *   #    and grant it access to that base.
 *   # 3. Put both in .env (AIRTABLE_API_KEY, AIRTABLE_BASE_ID), then:
 *
 *   npx tsx scripts/setup-airtable.ts            # dry-run: shows what it would create
 *   npx tsx scripts/setup-airtable.ts --apply    # creates the table + fields
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// --- Minimal .env loader (no dependency). Reads .env then .env.local (local wins). ---
function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, "");
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  }
}
loadEnv();

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_ID || "Leads";
const APPLY = process.argv.includes("--apply");

if (!API_KEY || !BASE_ID) {
  console.error(
    "Missing AIRTABLE_API_KEY and/or AIRTABLE_BASE_ID (set them in .env or the environment)."
  );
  process.exit(1);
}

// Field set mirrors LeadFields in lib/airtable.ts. Timestamps are singleLineText:
// the code writes ISO 8601 strings, which sort chronologically as text and avoid
// dateTime option pitfalls. Selects are singleLineText because createLead() does
// not pass typecast, so a fixed-choice field would reject unseen values.
const num = { type: "number", options: { precision: 0 } } as const;
const FIELDS: Array<{ name: string; type: string; options?: unknown }> = [
  { name: "Email", type: "singleLineText" }, // primary field (must be first)
  { name: "Prenom", type: "singleLineText" },
  { name: "Company", type: "singleLineText" },
  { name: "Statut", type: "singleLineText" },
  { name: "Source", type: "singleLineText" },
  { name: "Maturity Score", ...num },
  { name: "Maturity Band", type: "singleLineText" },
  { name: "Score Data Hygiene", ...num },
  { name: "Score Pipeline", ...num },
  { name: "Score Automation", ...num },
  { name: "Score Reporting", ...num },
  { name: "Score Stack", ...num },
  { name: "Quiz Answers", type: "multilineText" },
  { name: "Report", type: "multilineText" },
  { name: "Report Generated At", type: "singleLineText" },
  { name: "Report Emailed At", type: "singleLineText" },
  { name: "Created At", type: "singleLineText" },
  { name: "UTM Source", type: "singleLineText" },
  { name: "UTM Medium", type: "singleLineText" },
  { name: "UTM Campaign", type: "singleLineText" },
];

const META = `https://api.airtable.com/v0/meta/bases/${BASE_ID}`;
const authHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${META}${path}`, { ...init, headers: authHeaders });
  const text = await res.text();
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  console.log(`Base: ${BASE_ID}  Table: "${TABLE_NAME}"  Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const { tables } = await api("/tables");
  const existing = tables.find(
    (t: { name: string }) => t.name.toLowerCase() === TABLE_NAME.toLowerCase()
  );

  if (!existing) {
    console.log(`\nWould create table "${TABLE_NAME}" with ${FIELDS.length} fields:`);
    FIELDS.forEach((f, i) => console.log(`  ${i === 0 ? "*" : " "} ${f.name} (${f.type})${i === 0 ? "  [primary]" : ""}`));
    if (!APPLY) return console.log(`\nDry-run only. Re-run with --apply to create it.`);
    const created = await api("/tables", {
      method: "POST",
      body: JSON.stringify({ name: TABLE_NAME, fields: FIELDS }),
    });
    return console.log(`\nCreated table "${TABLE_NAME}" (${created.id}) with all fields.`);
  }

  // Table exists: add only the missing fields.
  const have = new Set(existing.fields.map((f: { name: string }) => f.name));
  const missing = FIELDS.filter((f) => !have.has(f.name));
  if (missing.length === 0) return console.log(`\nTable "${TABLE_NAME}" already has all ${FIELDS.length} fields. Nothing to do.`);

  console.log(`\nTable exists (${existing.id}). Missing ${missing.length} field(s):`);
  missing.forEach((f) => console.log(`   ${f.name} (${f.type})`));
  if (!APPLY) return console.log(`\nDry-run only. Re-run with --apply to add them.`);

  for (const f of missing) {
    await api(`/tables/${existing.id}/fields`, { method: "POST", body: JSON.stringify(f) });
    console.log(`  + added ${f.name}`);
  }
  console.log(`\nDone.`);
}

main().catch((e) => {
  console.error(`\nFailed: ${e.message}`);
  process.exit(1);
});
