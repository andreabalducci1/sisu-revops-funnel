# Funnel strategy

> The angle, the promise, the mechanism.

## Promise

Score your RevOps setup and see where revenue quietly leaks. Five questions, an instant
score, and a personalized read on the three fixes that matter most.

## Lead magnet type

Interactive quiz plus a Claude-generated report.

## Angle

Most RevOps content is generic advice. This gives a number that is specific to you, then
explains what that number means for your setup. A RevOps engineer built it, not a marketer.

## Conversion path

1. **Landing plus quiz**: hook with the score promise, run the 5 question quiz inline.
2. **Teaser**: show the band and one revealed dimension, lock the rest.
3. **Email gate**: trade the email to unlock the full report.
4. **Report**: deliver the personalized analysis on screen, email a copy.
5. **Book**: convert the interest into a 25 minute mini-Audit call.
6. **Thanks**: confirm and frame the next steps.

## Gate mechanism

Gate the reveal, not the quiz. The visitor invests effort answering first, sees a real
number, and only then hits the email ask. The score is already computed and free at that
point, so the ask feels like unlocking something they earned rather than paying upfront.

## Desire mechanism toward the call

The report names three ranked fixes but stays at the "what", not the "how". The call is
positioned as turning those three fixes into a concrete 90 day plan.

## Cost and abuse control

The public /api/analyze endpoint recomputes the score server-side (never trusts the client
number), is idempotent per lead via the Airtable Report field, caps max_tokens, and is
rate limited. One paid Claude call per lead, one email per lead.
