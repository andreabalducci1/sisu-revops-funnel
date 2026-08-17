# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three confirmed audiences, all funneled through the same quiz. The quiz itself does the qualifying:

- Founders and managing directors of B2B SMBs (roughly 10-200 people) who feel revenue chaos but have no RevOps function.
- Sales leaders or early RevOps hires at funded scale-ups who own the CRM and reporting.
- Mixed cold and warm traffic from Andrea's LinkedIn content; broad ICP by design.

Their situation: they suspect their revenue operation leaks money but have no neutral way to check. The job: get an honest, quantified diagnosis in minutes, without gatekeeping or a sales conversation.

## Product Purpose

A 4-step conversion funnel for SiSu RevOps: maturity quiz -> personalized report -> book a call (Cal.com) -> thanks. The diagnosis is the product; the booked call is the conversion. Success is qualified booked calls, with every funnel step measured in PostHog. Live in production at check.sisurevops.com.

## Positioning

The full personalized diagnostic is delivered immediately, with no email required. Every number on the report is computed deterministically in code (scoring, euro leak model, contradictions, fix ordering, benchmarks); the AI writes prose only and can never alter a fact. The leak model leans deliberately conservative and every benchmark is cited, dated, and verified against a primary source or dropped. A neighboring quiz funnel could not truthfully copy this no-fabrication mechanism.

## Operating Context

- Traffic arrives cold or warm, primarily via Andrea's LinkedIn content and the sisurevops.com homepage CTA.
- The quiz: 12 behaviour-anchored questions across six weighted dimensions, preceded by 2 cohort calibration selects (headcount, deal motion) that shape report framing, not the score. An optional five-field numbers block unlocks the euro figure; skipping it still returns a full diagnosis.
- Reports are generated server-side. Claude writes prose; finalizeReport() overwrites every factual field with the deterministic values.
- Optional "email me a copy" flow: lead lands in Airtable, report sent via Resend. Booking via Cal.com with email prefilled.
- Demo mode: every integration degrades gracefully when its key is missing, so the funnel runs end to end with no paid keys.

## Capabilities and Constraints

- config.ts is the single source of truth for all copy, colors, links, and the quiz definition. Components hardcode no text and no color.
- The score is recomputed server-side; the client number is never trusted. The AI endpoint is public: idempotent per lead, token-capped.
- The report shape is versioned (version: 2). A stored report of any other version regenerates instead of rendering.
- Benchmarks anchor to Belgium/Benelux B2B (confirmed 2026-08-13): euro figures and Belgian sources stay. An entry with verified: false must never render on the public report.
- The offer behind the call is confirmed as a SiSu RevOps consulting/audit engagement (confirmed 2026-08-13; earlier project docs recorded the offer as still open). The funnel stays product-agnostic: offer copy changes happen in config.ts only.
- /thanks is gated by the tunnel_booking cookie (a UX gate, not security). /report is deliberately ungated.

## Brand Commitments

- Brand: SiSu RevOps. Warm Ivory background, Deep Charcoal text, Muted Sage and Dusty Blue-Grey accents. Type: DM Serif Display + DM Sans.
- Language: English. Voice: problem-first, plain, radically candid.
- Binding prohibitions: no em-dashes anywhere (copy, code, or the generated report); no fake testimonials or invented social proof; banned vocabulary: supercharge, unleash, game-changer, leverage, synergy, 10x.

## Evidence on Hand

- Deterministic computation modules in lib/: scoring.ts, leak.ts, contradictions.ts, fixes.ts, benchmarks.ts, with cited and dated sources.
- Full design spec: docs/superpowers/specs/2026-08-07-revops-quiz-redesign-design.md.
- PostHog project 226457, wired and verified in production.
- No testimonials, case studies, or named customers on hand. Future work must state this absence rather than fabricate proof.

## Product Principles

1. The diagnosis is the product: full generosity before any ask (no email wall on the report).
2. Facts come from code, prose from the model. The model never computes a number, finds a contradiction, or reorders a fix.
3. Lean conservative on every number; credibility beats drama.
4. One source of truth: the funnel survives offer changes without touching components.
5. Radical candor in voice; no invented proof, ever.
