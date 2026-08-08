---
description: Wire or re-wire the funnel's integrations (Anthropic, Airtable, Resend, Cal.com, PostHog) and verify each one live.
---
# Onboarding, wire the integrations

The business context and the funnel itself are already built. This command is for
connecting or reconnecting the tools, for example on a fresh clone, after a key rotation,
or when handing the project to someone else.

For business context, read `memory/identity/` rather than re-interviewing Andrea.

## Ground rules

- Ask for one key at a time, with the direct link. **Claude writes it**, Andrea never
  edits a file.
- For production, write to Vercel (`npx vercel env add NAME production`), not just `.env`.
- Never print a key back. Confirm with "Anthropic: OK" and move on.
- Anything optional can be skipped. Demo mode handles absence gracefully.

## The integrations

**1. Anthropic (required for real reports)**
```
Key from https://platform.claude.com/settings/keys (starts with "sk-ant-")
```
Write `ANTHROPIC_API_KEY`. Also set `ANTHROPIC_MODEL=claude-sonnet-5`.
Verify: a live call returning 200, not just that the variable exists.
Without it the report falls back to a canned version.

**2. Airtable (required for lead capture)**
```
Token from https://airtable.com/create/tokens
Scopes: data.records:read, data.records:write, schema.bases:read
```
Write `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` (`appFKYUcURrO7jMrf`), `AIRTABLE_TABLE_ID=Leads`.
Verify with a real insert, then delete the test row.

**3. Resend (required for the report email)**
```
Key from https://resend.com/api-keys (starts with "re_")
```
Write `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (`SiSu RevOps <report@sisurevops.com>`).
The sending domain must be verified in Resend, which needs three DNS records at Namecheap
(DKIM `resend._domainkey`, SPF `send`, MX `send`) AND a press of the
"Verify DNS Records" button. A sending-scoped key cannot verify a domain via API.

**4. Cal.com (booking)**
Lives in `config.ts > booking`, not `.env`, because it is public.
Currently `balducci` / `25-min-chat-linkedin`.

**5. Admin secret**
Generate a random value, write `ADMIN_SECRET`. Protects `/admin`.

**6. PostHog (optional, currently deferred)**
```
Project API key (phc_...), personal API key, project ID. EU region preferred.
```
Write `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`.
Without it, `/analytics` and `/admin` have no data. Nothing else breaks.

## Verify, do not assume

A variable being present does not mean the integration works. Prove each one:

- Anthropic: a real API call returns 200.
- Airtable: `POST /api/lead` creates a record.
- Anthropic plus Airtable: `POST /api/analyze` returns a report, and a repeat call
  returns `cached: true`.
- Resend: check runtime logs for `[analyze] report email failed`. A 403 means the domain
  is not verified.
- Cal.com: the event URL resolves.

## Wrap up

Update `memory/funnel/config.md` and `memory/brain.md`, then report which tools are live
and which were skipped.
