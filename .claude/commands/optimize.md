---
description: Improve the weakest converting step of the funnel, based on PostHog data.
---
# Optimize, conversion improvement

Fix the weakest link in the funnel.

## Prerequisites
Read `memory/knowledge/frameworks.md` (CRO rules) and
`memory/synthesis/conversion-log.md`. Ideally PostHog data. Without it, optimize from
best practice and say plainly that it is not data-driven.

## Workflow

1. Run `/analytics` (or reuse recent numbers) to find the weakest step.
2. Diagnose the likely cause for that specific step:
   - **Landing to quiz start**: headline is not landing, promise too vague, the quiz is
     not visibly short or free.
   - **Quiz start to complete**: too many questions, option wording is confusing, or the
     progress is unclear. Drop-off mid-quiz is a wording problem more often than a length one.
   - **Complete to email unlock**: the teaser did not feel valuable enough to pay an email
     for. Reveal a more meaningful slice, or make the locked part more concrete.
   - **Unlock to report revealed**: technical, not persuasion. Check `analysis_error`,
     the Anthropic key, and the report page's fallback chain.
   - **Report to booking click**: the report is satisfying but not creating desire. It may
     be answering the "how" and removing the reason to talk.
   - **Booking click to booked**: calendar friction, unclear duration, no availability.
3. Propose one concrete variant (new headline, new CTA, reworked teaser, simpler step).
4. Apply in `config.ts` and `memory/funnel/copy.md` after sign-off.
5. Log the change and the hypothesis in `memory/synthesis/conversion-log.md`.
6. Let it run, then re-measure with `/analytics`.

## Rules
- One hypothesis at a time, otherwise you learn nothing.
- Lean on the frameworks, not intuition alone.
- Document every test (date, change, expected result).
- Distinguish persuasion problems from technical failures before rewriting copy.
