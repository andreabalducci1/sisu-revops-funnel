import { NextRequest } from "next/server";
import { success, errors } from "@/lib/api-response";
import { countEvent, isPostHogQueryConfigured } from "@/lib/posthog-query";
import { isAirtableConfigured, listLeads } from "@/lib/airtable";
import { FUNNEL_STEPS } from "@/lib/events";

type Source = "posthog" | "airtable" | "none";

interface Step {
  key: string;
  label: string;
  count: number;
}

/** Clamps the ?days= param. parseInt can return NaN, which used to reach HogQL as "INTERVAL NaN DAY". */
function parseDays(raw: string | null): number {
  const parsed = parseInt(raw || "", 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(parsed, 1), 90);
}

/** PostHog is the richer source: it sees the whole funnel, including pre-email traffic. */
async function stepsFromPostHog(days: number): Promise<Step[]> {
  const counts = await Promise.all(FUNNEL_STEPS.map((s) => countEvent(s.event, days)));
  return FUNNEL_STEPS.map((s, i) => ({
    key: s.key,
    label: s.label,
    count: counts[i] ?? 0,
  }));
}

/**
 * Airtable fallback, so /admin still works with no PostHog key.
 *
 * Only three stages are genuinely recorded in Airtable. Everything earlier in
 * the funnel (landing view, quiz start, teaser) happens before /api/lead is
 * ever called, and booking completion is client-side only with no Cal.com
 * webhook, so neither can be reconstructed here. Timestamps are stored as
 * ISO-8601 strings in singleLineText columns, which compare correctly with a
 * plain string comparison.
 */
async function stepsFromAirtable(days: number): Promise<Step[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const records = await listLeads([
    "Created At",
    "Report Generated At",
    "Report Emailed At",
  ]);

  const inRange = (value: unknown): boolean =>
    typeof value === "string" && value !== "" && value >= since;

  let leads = 0;
  let generated = 0;
  let emailed = 0;

  for (const { fields } of records) {
    if (inRange(fields["Created At"])) leads += 1;
    if (inRange(fields["Report Generated At"])) generated += 1;
    if (inRange(fields["Report Emailed At"])) emailed += 1;
  }

  return [
    { key: "lead", label: "Email unlock", count: leads },
    { key: "analysis", label: "Report generated", count: generated },
    { key: "emailed", label: "Report emailed", count: emailed },
  ];
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || secret !== adminSecret) {
    return errors.unauthorized("Invalid secret");
  }

  const days = parseDays(req.nextUrl.searchParams.get("days"));

  try {
    let source: Source = "none";
    let steps: Step[] = [];

    if (isPostHogQueryConfigured()) {
      source = "posthog";
      steps = await stepsFromPostHog(days);
    } else if (isAirtableConfigured()) {
      source = "airtable";
      steps = await stepsFromAirtable(days);
    }

    // A missing optional integration is a config state, not a server error.
    return success({ days, source, steps });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[funnel/stats] error:", message);
    return errors.internal(message);
  }
}
