# Go-Live Runbook: SiSu RevOps Funnel

Single reference for taking the funnel from "deployed in demo mode" to "live and 100% functioning on `check.sisurevops.com`".

## Current state (verified 2026-07-15)

- **Deployed and live** (Vercel, project `sisu-revops-funnel`): https://sisu-revops-funnel.vercel.app
- **Verified end-to-end on the live deploy**: landing renders, quiz runs, deterministic score + gate-reveal correct (66/100 "Developing", one dimension shown, four locked), email gate submits, `/report` renders a personalized report, `/book` loads the real Cal.com calendar.
- **Booking wired**: `config.booking` -> `balducci/25-min-chat-linkedin` (no secret needed, done).
- **Env vars set** (production): `NEXT_PUBLIC_SITE_URL`, `ANTHROPIC_MODEL` (`claude-sonnet-5`), `ADMIN_SECRET`.
- **Subdomain attached**: `check.sisurevops.com` is added to the project, pending one DNS record.
- **Decision**: subdomain + keep the existing homepage. The apex/`www` site (`andrea-canvas`) is untouched.
- **Demo mode** for: Anthropic (canned report), Airtable (lead not stored), Resend (no email), PostHog (deferred).

## Step 1: DNS (makes `check.sisurevops.com` resolve)

At **Namecheap -> Domain List -> sisurevops.com -> Manage -> Advanced DNS -> Add New Record**:

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `check` | `76.76.21.21` | Automatic |

Vercel auto-verifies and issues SSL within minutes. Check status:

```bash
npx vercel domains inspect check.sisurevops.com
curl -sL -o /dev/null -w "%{http_code}\n" https://check.sisurevops.com
```

## Step 2: Wire live keys

Set each secret in Vercel production (value piped via stdin so it is never echoed):

```bash
cd ~/Projects/sisu-revops-funnel

# Anthropic: real personalized report
printf "sk-ant-..."   | npx vercel env add ANTHROPIC_API_KEY production

# Resend: emails the report to the lead
printf "re_..."                | npx vercel env add RESEND_API_KEY production
printf "report@sisurevops.com" | npx vercel env add RESEND_FROM_EMAIL production

# Airtable: stores every lead + score + report
printf "pat..."          | npx vercel env add AIRTABLE_API_KEY production
printf "appXXXXXXXXXXXX" | npx vercel env add AIRTABLE_BASE_ID production
```

**Airtable table setup is automated.** Create an empty base, then put `AIRTABLE_API_KEY`
+ `AIRTABLE_BASE_ID` in `.env` locally and run:

```bash
npx tsx scripts/setup-airtable.ts           # dry-run: shows the plan
npx tsx scripts/setup-airtable.ts --apply    # creates the Leads table + all fields
```

Token scopes: `schema.bases:read`, `schema.bases:write`, `data.records:read`, `data.records:write`, with access to the base. The script is idempotent (re-running only adds missing fields) and is the source of truth for the exact field set the app writes.

**Resend note**: the from-address domain must be verified in Resend. If `sisurevops.com`
is not yet verified, add the SPF/DKIM records Resend provides (at Namecheap) before mail sends.

### Optional / deferred: PostHog analytics + `/admin` dashboard

Not required for launch. To enable later, add (Production) and redeploy:
`NEXT_PUBLIC_POSTHOG_KEY` (`phc_...`), `NEXT_PUBLIC_POSTHOG_HOST` (`https://eu.i.posthog.com`),
`POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`. The `/admin` page is already gated by `ADMIN_SECRET`.

## Step 3: Redeploy and verify

```bash
npx vercel --prod --yes
```

Then confirm on `https://check.sisurevops.com`:

- Loads with no "Demo mode" banner.
- Run the quiz + unlock: the report reads like Claude wrote it (not the canned copy) and arrives by email.
- A row appears in the Airtable `Leads` table with score, band, per-dimension scores, and the report.
- `/book` books a real slot and lands on `/thanks`.

If a lead ever fails to save, it is almost always an Airtable field-name mismatch:
send me the Vercel runtime log line and re-running `setup-airtable.ts --apply` reconciles it.

## Optional: make the quiz central on the homepage

The homepage (`andrea-canvas`, a separate Vite project) stays as-is. A ready-to-paste hero is in
**`homepage-hero.html`**: self-contained (inline styles, SiSu palette + fonts), primary CTA
"Get my score" -> `https://check.sisurevops.com`, with "book a 25-min call" demoted to a small
secondary link. Drop it in as the first/central homepage block (React notes are in the file
header). Editing the live homepage needs the `andrea-canvas` repo; share it and I wire it in.

## Rollback

The funnel is additive and reversible:

- Remove the subdomain: `npx vercel domains rm check.sisurevops.com` (homepage `www.sisurevops.com` is a separate project, untouched).
- Revert any integration to demo mode: `npx vercel env rm <NAME> production`, then redeploy.
