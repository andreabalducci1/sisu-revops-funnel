---
description: Run the local dev server to see the funnel, with Next.js cache cleanup.
---
# Preview, local server

See the funnel in the browser locally.

## Workflow

1. Clear the cache if things look stale: delete `.next`.
2. Check dependencies are installed (`node_modules` present, otherwise `npm install`).
3. Run `npm run dev` (port 3000 by default).
4. URLs to check:
   - Landing plus quiz: http://localhost:3000
   - Report: http://localhost:3000/report (requires having completed the opt-in)
   - Book: http://localhost:3000/book
   - Thanks: http://localhost:3000/thanks
   - Admin: http://localhost:3000/admin
5. Walk the funnel and note anything to adjust (`/copy`, `/design`).

## Notes

- `/report` and `/thanks` are cookie-gated by `middleware.ts`. To see them, go through the
  real flow: quiz -> teaser -> email -> report -> book -> thanks. Navigating directly
  bounces you to `/`.
- Locally the DemoBanner WILL render and list unconfigured integrations. That is expected:
  it is gated to non-production on purpose and never appears on the live site.
- Without `ANTHROPIC_API_KEY` the report falls back to a canned version, so the flow still
  renders end to end with no keys at all.
