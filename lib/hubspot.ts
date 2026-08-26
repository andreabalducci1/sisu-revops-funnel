/**
 * HubSpot - the bridge from a quiz completion to the outbound pipeline.
 *
 * The funnel already stores leads in Airtable, but Airtable is a dead end:
 * nothing downstream reads it. The outbound control room
 * (~/projects/sisu-outbound-command) drives everything off HubSpot contacts
 * that carry a Rodz-shaped signal, so a quiz completion only becomes a lead if
 * it lands in HubSpot looking like one.
 *
 * That shape is a hard cross-repo contract:
 *   - `last_signal`        scripts/sync.py signal_type() matches on a substring
 *   - `last_signal_date`   read as an ISO day by signal_age_days()
 *   - `signal_heat_score`  parsed by lib/screens.parse_heat() for release order
 *
 * If the env vars are not set, isHubSpotConfigured() returns false and the
 * funnel behaves exactly as before. A HubSpot failure must NEVER break lead
 * capture: every function here swallows its errors and reports them upward as
 * data, never as a throw.
 */
import type { ScoreResult } from "./scoring";

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const BASE = process.env.HUBSPOT_BASE_URL || "https://api.hubapi.com";

/**
 * Date-versioned as of the 2026-03 API. The older /crm/v3/objects/contacts
 * paths still work, but new integrations should pin the dated one.
 */
const UPSERT_PATH = "/crm/objects/2026-03/contacts/batch/upsert";

/** Must contain a fragment scripts/sync.py maps to a signal type. */
export const QUIZ_SIGNAL_PREFIX = "RevOps maturity check completed";
export const QUIZ_SIGNAL = QUIZ_SIGNAL_PREFIX;

export interface QuizCapture {
  email: string;
  firstName?: string;
  company?: string;
}

export function isHubSpotConfigured(): boolean {
  return Boolean(HUBSPOT_TOKEN);
}

/**
 * Intent heat for a completed quiz, on the same 0-100 scale Rodz uses.
 *
 * Two facts set the floor. Rodz tops out at 70 in the live table, and this
 * person answered twelve questions and then chose to hand over an email on the
 * results page, where the email gate is optional. That is the strongest intent
 * signal in the system, so every band outranks every Rodz score.
 *
 * Within that, a worse maturity score is hotter: the offer is a RevOps fix, so
 * the people with the most gaps are the best fit. Banded on the same
 * boundaries the report uses, so heat and the report never disagree.
 */
export function quizHeat(overall: number): number {
  if (overall <= 34) return 95;
  if (overall <= 59) return 90;
  if (overall <= 79) return 80;
  return 75;
}

const DIMENSION_PROPERTY: Record<string, string> = {
  data: "revops_score_data",
  pipeline: "revops_score_pipeline",
  reporting: "revops_score_reporting",
  automation: "revops_score_automation",
  stack: "revops_score_stack",
  ai: "revops_score_ai",
};

function isoDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The weakest dimension, which is the honest premise for a follow-up. */
function weakest(score: ScoreResult): { label: string; value: number } | null {
  if (!score.dimensions?.length) return null;
  const w = [...score.dimensions].sort((a, b) => a.score - b.score)[0];
  return w ? { label: w.label, value: w.score } : null;
}

function signalText(score: ScoreResult | null): string {
  if (!score) return QUIZ_SIGNAL_PREFIX;
  const w = weakest(score);
  const tail = w ? `, weakest: ${w.label} ${w.value}` : "";
  return `${QUIZ_SIGNAL_PREFIX}: ${score.overall}/100 (${score.band})${tail}`;
}

/**
 * Properties that exist in the portal already, because Rodz writes them.
 * The fallback path when the custom revops_* properties are not defined.
 */
export function coreProperties(
  capture: QuizCapture,
  score: ScoreResult | null,
  now: Date = new Date()
): Record<string, string> {
  const props: Record<string, string> = {
    email: capture.email.trim().toLowerCase(),
    last_signal: signalText(score),
    last_signal_date: isoDay(now),
    // An unscored capture is still an intent signal: someone gave an email on
    // the results page. Score it as the middle band rather than dropping it.
    signal_heat_score: String(score ? quizHeat(score.overall) : 90),
  };
  if (capture.firstName?.trim()) props.firstname = capture.firstName.trim();
  if (capture.company?.trim()) props.company = capture.company.trim();
  return props;
}

/**
 * Core plus the six dimension scores as custom properties. Tried first; if the
 * portal has not defined revops_*, HubSpot rejects the whole write and the
 * sender retries with coreProperties instead.
 */
export function contactProperties(
  capture: QuizCapture,
  score: ScoreResult | null,
  now: Date = new Date()
): Record<string, string> {
  const props = coreProperties(capture, score, now);
  if (!score) return props;
  props.revops_maturity_score = String(score.overall);
  props.revops_maturity_band = score.band;
  for (const d of score.dimensions ?? []) {
    const key = DIMENSION_PROPERTY[d.id];
    if (key) props[key] = String(d.score);
  }
  return props;
}

export interface UpsertOutcome {
  ok: boolean;
  /** True when the custom score properties were rejected and core was used. */
  degraded?: boolean;
  skipped?: boolean;
  error?: string;
}

async function upsert(properties: Record<string, string>): Promise<Response> {
  return fetch(`${BASE}${UPSERT_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    // Upserting by email does NOT support partial updates, so every call sends
    // the complete property set it wants set.
    body: JSON.stringify({
      inputs: [{ id: properties.email, idProperty: "email", properties }],
    }),
  });
}

/**
 * Push a quiz completion into HubSpot as a signal-carrying contact.
 *
 * Never throws. Never blocks the caller's own success path: a HubSpot outage
 * must not cost the funnel a lead it already stored in Airtable.
 */
export async function upsertQuizContact(
  capture: QuizCapture,
  score: ScoreResult | null
): Promise<UpsertOutcome> {
  if (!isHubSpotConfigured()) return { ok: false, skipped: true };
  try {
    let res = await upsert(contactProperties(capture, score));
    let degraded = false;
    if (res.status === 400) {
      // Almost always an undefined revops_* property. Retry with the fields
      // Rodz already writes so the signal itself is never lost.
      res = await upsert(coreProperties(capture, score));
      degraded = true;
    }
    if (!res.ok) {
      return { ok: false, error: `HubSpot ${res.status}: ${await res.text()}` };
    }
    return { ok: true, ...(degraded && { degraded }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
