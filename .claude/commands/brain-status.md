---
description: Show full project status: configuration, funnel, connected tools, and next actions.
---
# Brain status, project overview

Give a fast overall picture.

## Workflow

1. Read `memory/brain.md` plus the identity and funnel files.
2. Check which env keys are present (presence only, never values): Anthropic, Airtable,
   Resend, PostHog, ADMIN_SECRET. Cal.com lives in `config.ts`, not `.env`.
3. Print:
   ```
   === SiSu RevOps Funnel ===

   BUSINESS : Andrea Balducci, SiSu RevOps
   MAGNET   : RevOps maturity quiz + Claude report

   SETUP :
   - Copy      : [ok / default]
   - Design    : [SiSu brand / default]

   TOOLS :
   - Anthropic : [connected / missing]
   - Airtable  : [connected / missing]
   - Resend    : [connected / missing]
   - Cal.com   : [configured / missing]
   - PostHog   : [connected / deferred]

   DEPLOYMENT : [live (URL) / local only]

   NEXT ACTIONS :
   1. ...
   ```
4. Suggest the most logical next step.

## Rules
- Never print key values.
- PostHog missing is expected, not an error. Flag it as optional and note that `/analytics`
  and `/admin` stay dark without it.
