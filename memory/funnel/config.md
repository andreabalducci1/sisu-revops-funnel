# Operational config

> Tool IDs and identifiers. Secrets live in .env and Vercel, never here.

## Live URLs

- **Funnel**: https://check.sisurevops.com
- **Main site**: https://sisurevops.com (separate Vercel project, andrea-canvas)

## Airtable

- **Base ID**: appFKYUcURrO7jMrf
- **Table**: Leads (AIRTABLE_TABLE_ID=Leads)
- Fields include Email, Prenom, Company, Statut, Maturity Score, Maturity Band, the five
  per-dimension scores, Quiz Answers, Report, Report Generated At, Report Emailed At, UTMs.

## Anthropic

- **Model**: claude-sonnet-5 (ANTHROPIC_MODEL, pinned)
- Used only after the email is captured, idempotent per lead.

## Resend

- **From**: SiSu RevOps <report@sisurevops.com>
- **Domain**: sisurevops.com, verified
- DNS at Namecheap: TXT resend._domainkey (DKIM), TXT send (SPF), MX send (priority 10,
  feedback-smtp.eu-west-1.amazonses.com)

## Cal.com

- **Username**: balducci
- **Event slug**: 25-min-chat-linkedin ("RevOps mini-Audit")

## PostHog

- Not configured. Optional. Without it /admin has no data and /analytics cannot run.

## Vercel

- **Project**: sisu-revops-funnel (andreabalducci90-gmailcoms-projects)
- **Domain**: check.sisurevops.com, A record 76.76.21.21 at Namecheap
- Deploys via Vercel CLI (npx vercel --prod). Note the two-GitHub-account wall documented
  in the project memory: repo access and Vercel account differ.
