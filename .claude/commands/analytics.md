---
description: Show funnel performance from PostHog. Conversion rate per step plus recommendations.
---
# Analytics, funnel performance

Read the funnel's conversion stats.

## Prerequisites
PostHog configured (`NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`).
Not configured yet on this project. If missing, say so plainly and stop. Do not invent numbers.

## Workflow

1. Pull the funnel event counts (via `lib/posthog-query.ts`, the `/api/funnel/stats`
   endpoint, or the PostHog MCP):
   `landing_view -> quiz_start -> quiz_complete -> analysis_teaser_shown -> lead_signup -> analysis_revealed -> booking_click -> booking_completed`.
2. Compute the conversion rate between each step.
3. Print a clear table:
   ```
   Step                | Volume | Conv. vs previous
   Landing view        | ...    | n/a
   Quiz started        | ...    | ...%
   Quiz completed      | ...    | ...%
   Teaser shown        | ...    | ...%
   Email unlocked      | ...    | ...%
   Report revealed     | ...    | ...%
   Booking clicked     | ...    | ...%
   Call booked         | ...    | ...%
   ```
4. Identify the weakest step (the bottleneck).
5. Recommend one or two concrete actions. Offer `/optimize` to act on it.
6. Log the snapshot in `memory/synthesis/conversion-log.md`.

## Rules
- The visual dashboard also lives at `/admin` (protected by ADMIN_SECRET).
- Exclude localhost and preview traffic (already handled in the HogQL query).
- No PostHog means no data. Say that clearly rather than estimating.
- Watch `analysis_error` separately: it signals report generation failures, not a
  conversion problem.
