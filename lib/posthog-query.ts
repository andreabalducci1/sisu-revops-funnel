/**
 * HogQL queries against PostHog, for the admin dashboard.
 * Requires POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID (server side).
 */

/**
 * The query API lives on the APP host (eu.posthog.com), not the ingestion edge
 * (eu.i.posthog.com) that the browser SDK posts events to. Using the ingestion
 * host here made every /admin query fail even with a valid personal API key.
 * Derive the app host from the ingestion host by dropping the "i." segment,
 * so a single NEXT_PUBLIC_POSTHOG_HOST keeps working for both. Override with
 * POSTHOG_API_HOST if PostHog ever changes this mapping.
 */
function resolveApiHost(): string {
  const explicit = process.env.POSTHOG_API_HOST;
  if (explicit) return explicit.replace(/\/+$/, "");

  const ingestion = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!ingestion) return "https://eu.posthog.com";

  return ingestion.replace(/\/+$/, "").replace(/^(https?:\/\/)([a-z]+)\.i\./i, "$1$2.");
}

const POSTHOG_API_HOST = resolveApiHost();

interface HogQLResult {
  results: Array<Array<string | number | null>>;
  columns: string[];
  error?: string | null;
}

export function isPostHogQueryConfigured(): boolean {
  return Boolean(process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID);
}

/** Excludes dev and preview traffic from the analytics counts. */
const PROD_HOST_FILTER = `
  AND properties.$host NOT LIKE '%localhost%'
  AND properties.$host NOT LIKE '%127.0.0.1%'
  AND properties.$host NOT LIKE '%vercel.app%'
`;

async function queryHogQL(sql: string): Promise<HogQLResult> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY!;
  const projectId = process.env.POSTHOG_PROJECT_ID!;

  const res = await fetch(`${POSTHOG_API_HOST}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error: ${res.status} ${text.slice(0, 200)}`);
  }

  const json: HogQLResult = await res.json();
  if (json.error) throw new Error(`PostHog HogQL error: ${json.error}`);
  return json;
}

/** Counts occurrences of an event over the last `days` days. */
export async function countEvent(eventName: string, days: number): Promise<number> {
  const safeEvent = eventName.replace(/'/g, "''");
  const sql = `
    SELECT count() AS c
    FROM events
    WHERE event = '${safeEvent}'
      AND timestamp > now() - INTERVAL ${days} DAY
      ${PROD_HOST_FILTER}
  `;
  const result = await queryHogQL(sql);
  const value = result.results?.[0]?.[0];
  return typeof value === "number" ? value : 0;
}
