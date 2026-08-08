---
description: Tune the AI-generated maturity report and the Resend email that delivers it.
---
# Report, the lead magnet

The magnet is a Claude-written RevOps maturity report, generated per lead after the email
is captured. There is no static asset to configure.

## How it works

1. `lib/scoring.ts` computes a deterministic 0 to 100 score across five dimensions. Pure,
   dependency-free, runs on the client (instant teaser) and again on the server (never
   trust the client's number). No LLM, no cost.
2. `app/api/analyze/route.ts` recomputes the score, then checks Airtable for an existing
   `Report` on that lead. If present it returns it with no Claude call.
3. `lib/anthropic.ts` calls Claude to write the narrative, validates it against
   `reportSchema`, falls back to a templated report on parse failure, and strips
   em-dashes in post-processing.
4. `after()` persists the report and sends the email once, guarded by `Report Emailed At`.

## To change the report

- **Tone, structure, instructions**: the prompt in `lib/anthropic.ts`.
- **Shape**: `reportSchema` in `lib/schemas.ts` (summary, per-dimension verdicts,
  three ranked priorities, next step). Changing this means updating `ReportViewer.tsx`.
- **Model or token cap**: `ANTHROPIC_MODEL` (pinned to `claude-sonnet-5`) and the
  `max_tokens` cap in `lib/anthropic.ts`.
- **Email body**: `reportEmailHtml` in `lib/resend.ts`.
- **On-screen rendering**: `components/funnel/ReportViewer.tsx`.

## Rules

- **Never remove the idempotency guard.** It is what stops a public endpoint from
  charging twice and emailing twice for one lead.
- **Never remove the em-dash stripper** in `lib/anthropic.ts`. The system prompt asks for
  no em-dashes, but the regex is the guarantee.
- Keep the fallback path working so the funnel renders with no Anthropic key.
- After changing the prompt, generate a real report and read it end to end before shipping.
  Check that it references the actual answers rather than sounding generic.
