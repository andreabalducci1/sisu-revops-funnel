---
description: Orchestrator that regenerates the funnel's four steps, applying copy and design into config.ts.
---
# Funnel, regenerate the funnel

Regenerate the four steps (Landing plus quiz, Report, Book, Thanks) coherently.

## Prerequisites
Read `memory/identity/business.md`, `memory/identity/offer.md`,
`memory/funnel/strategy.md`, `memory/funnel/copy.md`, `memory/identity/brand.md`.

## Workflow

1. **Copy**: if validated copy is missing or stale in `copy.md`, run `/copy` first.
2. **Design**: only if a visual change is actually wanted, run `/design`.
3. **Apply into `config.ts`**: write every section (`business`, `brand`, `landing`,
   `quiz`, `booking`, `thankyou`, `ui`, `legal`) from memory.
   - config.ts is the ONLY source. Never hardcode text in pages.
4. **Verify** the pages still read from `config.ts`. Do not rewrite JSX unless the
   structure genuinely needs to change.
5. **Preview**: run `/preview` and check the flow in the browser.

## Rules
- Always confirm before overwriting a customized `config.ts`.
- Keep `config.ts` and `memory/funnel/copy.md` in sync.
- Do not break demo mode. Leave the `isXConfigured()` fallbacks intact.
- Changing the quiz (`config.quiz`) changes scoring. If weights, options, or bands move,
  re-check `lib/scoring.ts` expectations and hand-verify a couple of answer sets.
