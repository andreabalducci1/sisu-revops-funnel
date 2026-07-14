import { cookies } from "next/headers";
import { success, errors } from "@/lib/api-response";
import { getLeadById, isAirtableConfigured } from "@/lib/airtable";
import { FUNNEL_COOKIES } from "@/lib/funnel";
import { type Report } from "@/lib/schemas";
import config from "@/config";

/** Airtable score column per dimension id. */
const DIM_FIELD: Record<string, string> = {
  data: "Score Data Hygiene",
  pipeline: "Score Pipeline",
  automation: "Score Automation",
  reporting: "Score Reporting",
  stack: "Score Stack",
};

/**
 * Fallback for /report when sessionStorage is empty (hard refresh, new tab).
 * Reads the opt-in cookie (the lead record id) and returns the stored report.
 * Demo mode (no Airtable) has nothing stored, so this 404s and the client
 * falls back to a graceful empty state.
 */
export async function GET() {
  if (!isAirtableConfigured()) return errors.notFound("No stored report");

  const store = await cookies();
  const id = store.get(FUNNEL_COOKIES.OPTIN)?.value;
  if (!id) return errors.notFound("No stored report");

  try {
    const rec = await getLeadById(id);
    const stored = rec?.fields?.["Report"];
    if (typeof stored !== "string" || !stored) return errors.notFound("No stored report");

    const report = JSON.parse(stored) as Report;
    const score = {
      overall: Number(rec?.fields?.["Maturity Score"] ?? 0),
      band: String(rec?.fields?.["Maturity Band"] ?? ""),
      bandTeaser: "",
      dimensions: config.quiz.dimensions.map((d) => ({
        id: d.id,
        label: d.label,
        score: Number(rec?.fields?.[DIM_FIELD[d.id]] ?? 0),
      })),
    };
    return success({ report, score });
  } catch (e) {
    console.error("[/api/report] error:", e instanceof Error ? e.message : e);
    return errors.notFound("No stored report");
  }
}
