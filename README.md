# SiSu RevOps Funnel

A conversion funnel that turns cold and warm traffic into booked calls, built around a free "RevOps maturity score" AI check.

```
Landing (maturity quiz)  ->  Report (personalized, AI-generated)  ->  Book a call (Cal.com)  ->  Thanks
      /                          /report                                /book                    /thanks
```

The visitor answers five quick questions, sees an instant teaser score, enters their email to unlock a personalized report written by Claude, then books a call. Leads and scores land in Airtable; every step is measured in PostHog.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Anthropic (Claude) · Airtable · Resend · Cal.com · PostHog · Vercel.

All copy, colors, and links live in **`config.ts`** (single source of truth). Pages never hardcode text or color.

## Getting started

```bash
npm install
npm run dev   # runs in demo mode, no keys required
```

Open http://localhost:3000. A "Demo mode" banner lists what is not wired up yet. Copy `.env.example` to `.env` and fill in keys as you go; each integration degrades gracefully when its key is missing, so you can build and preview the whole funnel before wiring anything.

## Structure

```
app/            Funnel pages (/, /report, /book, /thanks) + /admin + API routes
components/     funnel (quiz, booking), admin (dashboard), common (banner, analytics)
lib/            anthropic, airtable, resend, posthog, scoring, schemas, events
config.ts       Central configuration (copy, colors, links, quiz)
memory/         Project brain for Claude Code
.claude/        Claude Code slash commands
```

## Provenance

Adapted from the open template [`PierreEvrard/claude-tunnel-os`](https://github.com/PierreEvrard/claude-tunnel-os) (upstream commit `ba316744`), which the author distributes free to clone and build your own funnel. This version has diverged substantially: English throughout, the SiSu RevOps brand, an AI maturity-quiz lead magnet (net-new), and renamed routes.
