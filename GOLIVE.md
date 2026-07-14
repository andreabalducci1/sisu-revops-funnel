# Go-live runbook (demo -> 100% functioning on sisurevops.com)

Do these after the deploy is green. Each is a Vercel-dashboard / account action
(the parts I cannot automate). Ping me at any step and I verify it live.

## Step 2 - Flip out of demo mode (real reports + saved leads)

All of this is env vars. Vercel -> project **sisu-revops-funnel** -> Settings ->
Environment Variables -> add each (Production), then **Redeploy**.

| Variable | Value / where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | your existing Anthropic key (console.anthropic.com/settings/keys) |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` |
| `RESEND_API_KEY` | your existing Resend key (resend.com/api-keys) |
| `RESEND_FROM_EMAIL` | e.g. `hey@sisurevops.com` (must be a verified domain/sender in Resend) |
| `AIRTABLE_API_KEY` | Airtable PAT (airtable.com/create/tokens; scopes: data.records:read+write, schema.bases:read+write) |
| `AIRTABLE_BASE_ID` | from your base URL: airtable.com/**appXXXX**/... |
| `AIRTABLE_TABLE_ID` | `Leads` |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key (`phc_...`), EU region |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` |
| `POSTHOG_PERSONAL_API_KEY` | PostHog -> personal API key (for the /admin dashboard) |
| `POSTHOG_PROJECT_ID` | PostHog project id |
| `ADMIN_SECRET` | any random string (protects /admin) |
| `NEXT_PUBLIC_SITE_URL` | `https://check.sisurevops.com` |

### Airtable base (one-time)
Create a base, add a table named **`Leads`** with these fields (exact names):

- `Email` (Single line text) - make this the primary field
- `Prenom` (Single line text)
- `Company` (Single line text)
- `Statut` (Single select: optin, resource_viewed, booking, client, perdu)
- `Source` (Single line text)
- `Maturity Score` (Number, integer)
- `Maturity Band` (Single select: Foundational, Developing, Operational, Optimized)
- `Score Data Hygiene` (Number) · `Score Pipeline` (Number) · `Score Automation` (Number) · `Score Reporting` (Number) · `Score Stack` (Number)
- `Quiz Answers` (Long text)
- `Report` (Long text)
- `Report Generated At` (Single line text) · `Report Emailed At` (Single line text)
- `UTM Source` · `UTM Medium` · `UTM Campaign` (Single line text)
- `Created At` (Single line text)

Field names must match exactly (the app writes to them by name). If a lead ever
fails to save, it is a field-name mismatch; send me the Vercel runtime log line
and I fix it in a minute.

### PostHog (one-time)
Sign up EU region (eu.posthog.com). Grab the project API key (Settings ->
Project API Key), a personal API key (Settings -> user API keys), and the
numeric project id. That is all four PostHog vars.

## Step 3 - Domain
Vercel -> project -> Settings -> Domains -> add `check.sisurevops.com` -> add the
one CNAME record Vercel shows you, wherever sisurevops.com DNS is managed. A
subdomain, so it never touches your apex/www site.

## Step 4 - Homepage
`homepage-hero.html` in this repo is the drop-in central hero for sisurevops.com
(primary CTA = the quiz, "book a call" demoted to a small link). Paste it as the
first hero block, or share your site repo and I wire it in and match your styling.

## Verify (I do this)
Once the env vars are in and it is redeployed, I click through check.sisurevops.com
end to end: quiz -> gate -> a REAL Claude report -> the lead appears in Airtable ->
one report email -> events in PostHog. Then it is genuinely live and functioning.
