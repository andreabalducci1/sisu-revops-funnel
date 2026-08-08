# SiSu RevOps Funnel, memory index

> Read at the start of every session. Fast context, then jump to the detail files.

## What this project is

A 4-step conversion funnel for SiSu RevOps. Cold or warm traffic lands on a RevOps
maturity quiz, gets an instant score, trades an email for a Claude-written personalized
report, and books a call.

```
Landing + quiz  ->  Report  ->  Book  ->  Thanks
      /            /report     /book    /thanks
```

## Status

- [x] Business and offer captured (identity/business.md, identity/offer.md)
- [x] Brand defined (identity/brand.md)
- [x] Copy written for all 4 steps (funnel/copy.md)
- [x] Airtable connected (lead CRM, base appFKYUcURrO7jMrf)
- [x] Anthropic connected (report generation, claude-sonnet-5)
- [x] Resend connected (report email, domain verified)
- [x] Cal.com configured (balducci / 25-min-chat-linkedin)
- [x] Deployed and live at https://check.sisurevops.com
- [ ] PostHog (deliberately deferred, optional analytics, /admin stays dark without it)

## Memory files

| File | Status |
|---|---|
| identity/business.md | Done |
| identity/offer.md | Done, final offer still to lock |
| identity/brand.md | Done, mirrors config.ts > brand |
| funnel/strategy.md | Done |
| funnel/copy.md | Done, mirrors config.ts |
| funnel/config.md | Done, live IDs and URLs |
| knowledge/frameworks.md | Reference, pre-filled |
| knowledge/lessons.md | Accumulating |

## Fast context

Andrea Balducci, RevOps engineer based in Belgium, trading as SiSu RevOps.
Sells RevOps consulting and automation to B2B sales teams. The funnel's lead magnet is a
free RevOps maturity score plus a personalized report. The conversion goal is a booked
25 minute RevOps mini-Audit call. The paid offer at the end is still being finalized
(leaning a "Claude Code for RevOps" bootcamp), so the funnel is built product-agnostic:
all offer copy lives in config.ts and can change without touching components.

## Next actions

1. Lock the paid offer, then update identity/offer.md and config.ts
2. Wire PostHog if funnel analytics are wanted (unlocks /analytics and /admin)
3. Drive traffic, then run /analytics and /optimize
