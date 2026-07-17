/**
 * Banner shown when the funnel runs in demo mode (missing keys).
 * Server Component: reads env vars at render time.
 *
 * This is a developer affordance for local + preview builds. It never renders
 * on the live production site: real visitors should not see internal wiring
 * status. PostHog is optional analytics and does not gate the funnel, so it is
 * flagged softly and never blocks.
 */

export function DemoBanner() {
  // Never surface internal status to real visitors on the production site.
  if (process.env.VERCEL_ENV === "production") return null;

  const anthropicOk = Boolean(process.env.ANTHROPIC_API_KEY);
  const airtableOk = Boolean(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
  const posthogOk = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  const resendOk = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

  // Core integrations power the funnel; PostHog (analytics) is optional.
  const coreOk = anthropicOk && airtableOk && resendOk;
  if (coreOk && posthogOk) return null;

  const missing: string[] = [];
  if (!anthropicOk) missing.push("Anthropic");
  if (!airtableOk) missing.push("Airtable");
  if (!resendOk) missing.push("Resend");
  if (!posthogOk) missing.push("PostHog (optional)");

  return (
    <div
      style={{
        background: "var(--color-ink)",
        color: "var(--color-bg)",
        fontSize: "13px",
        textAlign: "center",
        padding: "8px 16px",
        fontFamily: "var(--font-body)",
      }}
    >
      Demo mode. Not wired up yet: <strong>{missing.join(", ")}</strong>. Add your keys in .env to go live.
    </div>
  );
}
