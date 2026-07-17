# SiSu RevOps Funnel - Claude Code brain

## What this is

A 4-step conversion funnel for SiSu RevOps. Cold or warm traffic lands on a **RevOps maturity quiz**, gets a teaser score, trades an email for a personalized Claude-generated report, and books a call.

```
Landing (quiz)  ->  Report  ->  Book (Cal.com)  ->  Thanks
   /                /report      /book             /thanks
```

The offer at the end (leaning a "Claude Code for RevOps" bootcamp) is still being finalized. The funnel is built **product-agnostic**: all offer copy lives in `config.ts` and can change without touching components.

## Architecture

- **`config.ts` is the single source of truth.** All copy, colors, links, and the quiz definition live here. Pages and components contain no hardcoded text or color. When you change the funnel, change `config.ts`.
- **Routes:** `app/page.tsx` (landing + quiz), `app/report/`, `app/book/`, `app/thanks/`, plus `app/admin/` and API routes under `app/api/`.
- **Integrations are plain `fetch` wrappers** in `lib/` with an `isXConfigured()` guard each, so a missing key degrades to demo mode rather than an error.
- **Funnel gating:** `middleware.ts` requires the `tunnel_optin` cookie for `/report` and `tunnel_booking` for `/thanks`. This is a UX gate, not security.

## The maturity quiz (the centerpiece)

- `lib/scoring.ts` computes a deterministic 0-100 score across five dimensions (Data Hygiene, Pipeline, Automation, Reporting, Stack). Instant and free. Runs on client (teaser) and server (recompute, never trust the client number).
- `lib/anthropic.ts` calls Claude to write the qualitative report only after the email is captured. Idempotent per lead (never charges or emails twice). Falls back to a canned report when `ANTHROPIC_API_KEY` is missing.
- Gate-the-reveal flow: quiz -> teaser -> email -> `/api/lead` (create lead with score) -> `/api/analyze` (generate report) -> `/report`.

## Tools

| Tool | Role | Env |
|---|---|---|
| Anthropic (Claude) | Writes the maturity report | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| Airtable | Lead CRM (email, score, report) | `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` |
| Resend | Report email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
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

- The build runs in phases (P0-P8). The plan lives at `~/.claude/plans/new-project-adapt-this-validated-comet.md`.
- Preferred flow: build in demo mode with no paid keys, verify each phase in the browser, then wire live keys (Airtable + PostHog need creating; Anthropic, Resend, Cal.com, Vercel, GitHub already exist).
- The `.claude/` slash commands are inherited from the upstream template and are still French; they get localized in P8.
- Deploy target: a `sisurevops.com` subdomain (apex vs subdomain confirmed at deploy).
