# Lessons

> What was learned building and shipping this funnel.

## 2026-07-19, go-live

- **Namecheap sessions expire fast and fail silently.** Saving a DNS record against a
  stale session returns "Failed to save record. Please try again" with no hint that the
  session is the cause. If a save fails twice, reload the page before debugging anything
  else.
- **Namecheap splits DNS by record type.** MX records are not in the Host Records
  dropdown at all; they live in the separate Mail Settings section. Looking for MX in the
  Host Records type list is a dead end.
- **Namecheap Host field takes the subdomain only.** Enter `send` and `resend._domainkey`,
  not the fully qualified name. Namecheap appends the domain itself.
- **Resend does not auto-verify a domain in "Not Started" state.** Correct DNS is not
  enough; the "Verify DNS Records" button has to be pressed once to kick off the check.
  Until then every send returns 403 with "domain is not verified".
- **A Resend sending key cannot verify a domain.** A key restricted to sending returns
  401 restricted_api_key on both GET /domains and POST /domains/{id}/verify. Only the
  dashboard or a full-access key can trigger verification.
- **Vercel env pull returns blank values for Encrypted vars.** Do not use it to read back
  secrets; it silently yields empty strings and produces misleading "key is invalid"
  results. Verify configuration through the app's own behavior instead.
- **Next.js App Router ignores leading-underscore folders.** `app/api/_thing/route.ts` is
  treated as a private folder and 404s. Name diagnostic routes without the underscore.
- **The DemoBanner should never render in production.** Showing "Demo mode. Not wired up
  yet" to real visitors on a live funnel undercuts the whole page. It is now gated to
  non-production, and PostHog no longer counts as a blocker since it is optional.

## Verification approach that worked

Testing the deployed API endpoints directly with real payloads (POST /api/lead then
POST /api/analyze) proved the whole server pipeline faster and more reliably than driving
the SPA through a flaky browser. Re-calling analyze and seeing `cached: true` is a clean
proof that the report persisted and that the idempotency guard works.
