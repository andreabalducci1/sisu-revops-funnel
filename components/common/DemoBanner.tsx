/**
 * Banner shown when the funnel runs in demo mode (missing keys).
 * Server Component: reads env vars at render time.
 */

export function DemoBanner() {
  const anthropicOk = Boolean(process.env.ANTHROPIC_API_KEY);
  const airtableOk = Boolean(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
  const posthogOk = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  const resendOk = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

  const allOk = anthropicOk && airtableOk && posthogOk && resendOk;
  if (allOk) return null;

  const missing: string[] = [];
  if (!anthropicOk) missing.push("Anthropic");
  if (!airtableOk) missing.push("Airtable");
  if (!posthogOk) missing.push("PostHog");
  if (!resendOk) missing.push("Resend");

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
