# SiSu RevOps Funnel - Claude Code brain

## What this is

A 4-step conversion funnel for SiSu RevOps. Cold or warm traffic lands on a **RevOps maturity quiz**, gets the full personalized diagnostic immediately (no email required), and books a call.

```
Landing (quiz)  ->  Report  ->  Book (Cal.com)  ->  Thanks
   /                /report      /book             /thanks
```

The offer at the end is a SiSu RevOps consulting/audit engagement (confirmed 2026-08-13; see `PRODUCT.md`). The funnel is built **product-agnostic**: all offer copy lives in `config.ts` and can change without touching components.

## Architecture

- **`config.ts` is the single source of truth.** All copy, colors, links, and the quiz definition live here. Pages and components contain no hardcoded text or color. When you change the funnel, change `config.ts`.
- **Routes:** `app/page.tsx` (landing + quiz), `app/report/`, `app/book/`, `app/thanks/`, plus `app/admin/` and API routes under `app/api/`.
- **Integrations are plain `fetch` wrappers** in `lib/` with an `isXConfigured()` guard each, so a missing key degrades to demo mode rather than an error.
- **Funnel gating:** `middleware.ts` requires the `tunnel_booking` cookie for `/thanks`. `/report` is deliberately ungated: the diagnosis is the product now, and the booking is the conversion, so bouncing every visitor at a cookie check would defeat the point. This is a UX gate, not security.

## The maturity quiz (the centerpiece)

- 12 behaviour-anchored questions across six weighted dimensions: Data Hygiene (25), Pipeline (20), Reporting (20), Automation (15), Stack (10), AI Readiness (10). Two cohort calibration selects (headcount, deal motion) run first and shape report framing, not the score.
- An optional five-field numbers block (ACV, win rate, inbound leads/month, response time, revenue headcount) follows the quiz. Skipping it still returns a full diagnosis, just without the euro figure.
- `lib/scoring.ts` computes the deterministic 0-100 score. Instant and free. Runs on client (teaser) and server (recompute, never trust the client number).
- **The rule that matters most:** `lib/scoring.ts`, `lib/leak.ts`, `lib/contradictions.ts`, `lib/fixes.ts` and `lib/benchmarks.ts` compute everything factual, in code. `lib/anthropic.ts` only writes prose. The model is never asked to compute a number, find a contradiction, or reorder a fix, and `finalizeReport()` in `lib/anthropic.ts` overwrites those fields with the deterministic values even when the model tries to answer differently.
- The euro leak model (`lib/leak.ts`) leans conservative on purpose, with three guards in order of importance: always use the low end of a benchmark range, always show modelled bookings alongside the leak as a ratio, and clamp the displayed total at 35% of modelled bookings.
- Benchmarks (`lib/benchmarks.ts`) are cited and dated. `loadedHourly` carries an explicit caveat: it is a Belgian whole-economy figure, not role-specific. A benchmark that cannot be verified against a primary source is dropped rather than approximated; a `verified: false` entry must never render on the public report.
- The report shape is versioned (`version: 2`). A stored report of any other version is never rendered; it regenerates instead.
- Falls back to a canned report when `ANTHROPIC_API_KEY` is missing, so the funnel works end to end with no paid key.

Full design spec: `docs/superpowers/specs/2026-08-07-revops-quiz-redesign-design.md`.

## Tools

| Tool | Role | Env |
|---|---|---|
| Anthropic (Claude) | Writes the report's prose only; every fact comes from the deterministic modules above | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| Airtable | Lead CRM (email, score, report), used when a visitor opts into "email me a copy" | `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` |
| Resend | Sends that optional report copy | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Cal.com | Booking (email prefilled) | `config.ts > booking` |
| PostHog | Funnel analytics + `/admin` | `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` |
| Vercel + GitHub | Deploy | via MCP |

Demo mode: missing keys degrade gracefully and a `DemoBanner` announces what is unwired. Check with `isAirtableConfigured()`, `isResendConfigured()`, `isPostHogConfigured()`, `isAnthropicConfigured()`.

## Rules

1. `config.ts` is the source of truth. No hardcoded copy or color in components.
2. **No em-dashes anywhere** (copy, code, or the generated report). Use commas, colons, parentheses, or a single hyphen.
3. Language is **English**. Brand is **SiSu RevOps** (Warm Ivory bg, Deep Charcoal text, Muted Sage + Dusty Blue-Grey accents, DM Serif Display + DM Sans).
4. Voice: problem-first, plain, radically candid. No fake testimonials or invented social proof. Avoid "supercharge", "unleash", "game-changer", "leverage", "synergy", "10x".
5. The AI endpoint is public: recompute the score server-side, keep it idempotent per lead, cap tokens.
6. Verify in the browser (demo mode first) after any change that renders.

## Working with Claude Code

- Full design spec: `docs/superpowers/specs/2026-08-07-revops-quiz-redesign-design.md`. Read it before changing the quiz, scoring, leak model, or report shape.
- Preferred flow: build and verify in demo mode with no paid keys, check the browser, then wire live keys. Airtable, Resend, Anthropic, PostHog, Cal.com, Vercel and GitHub all already exist for this project.
- Deploy target: `check.sisurevops.com`, live in production.
