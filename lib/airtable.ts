/**
 * Airtable — the funnel's lead CRM.
 *
 * If the env vars are not set, isAirtableConfigured() returns false and the
 * funnel runs in demo mode (the lead is logged, not stored). Add the Airtable
 * keys in .env to go live.
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || "Leads";

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
  AIRTABLE_TABLE_ID
)}`;

export function isAirtableConfigured(): boolean {
  return Boolean(AIRTABLE_API_KEY && AIRTABLE_BASE_ID);
}

function headers() {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
}

export interface LeadFields {
  Email: string;
  Prenom?: string;
  Company?: string;
  Statut?: string;
  Source?: string;
  "Maturity Score"?: number;
  "Maturity Band"?: string;
  "Score Data Hygiene"?: number;
  "Score Pipeline"?: number;
  "Score Automation"?: number;
  "Score Reporting"?: number;
  "Score Stack"?: number;
  "Quiz Answers"?: string;
  Report?: string;
  "Report Generated At"?: string;
  "Report Emailed At"?: string;
  "UTM Source"?: string;
  "UTM Medium"?: string;
  "UTM Campaign"?: string;
}

export async function findLeadByEmail(
  email: string
): Promise<AirtableRecord | null> {
  const safeEmail = email.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const formula = encodeURIComponent(`{Email} = "${safeEmail}"`);
  const res = await fetch(`${BASE_URL}?filterByFormula=${formula}&maxRecords=1`, {
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Airtable findLeadByEmail failed: ${res.status}`);
  }

  const data: AirtableResponse = await res.json();
  return data.records[0] || null;
}

export async function getLeadById(recordId: string): Promise<AirtableRecord | null> {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    headers: headers(),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Airtable getLeadById failed: ${res.status}`);
  }
  return (await res.json()) as AirtableRecord;
}

export async function createLead(fields: LeadFields): Promise<AirtableRecord> {
  const allFields: Record<string, unknown> = {
    ...fields,
    Statut: fields.Statut ?? "optin",
    "Created At": new Date().toISOString(),
  };

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ records: [{ fields: allFields }] }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Airtable] createLead failed", { status: res.status, body: text });
    throw new Error(`Airtable createLead failed: ${res.status}`);
  }

  const data: AirtableResponse = await res.json();
  return data.records[0];
}

export async function updateLead(
  recordId: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  const res = await fetch(BASE_URL, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ records: [{ id: recordId, fields }] }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Airtable] updateLead failed", { status: res.status, body: text });
    throw new Error(`Airtable updateLead failed: ${res.status}`);
  }

  const data: AirtableResponse = await res.json();
  return data.records[0];
}
