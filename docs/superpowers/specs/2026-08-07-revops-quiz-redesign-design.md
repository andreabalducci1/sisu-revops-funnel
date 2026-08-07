# RevOps maturity quiz redesign

Date: 2026-08-07
Status: approved design, not yet implemented
Supersedes: the 5-question quiz in `config.ts`

## Why

The current instrument asks 5 questions, one per dimension, each with 4 ordered
options scored 0/33/66/100, then gates the report behind an email.

A report generated from 5 single-select answers can only restate those 5
answers. The trade on offer is therefore "give me your email and I will read
your own inputs back to you". Concretely:

- **One item per dimension** means `Data hygiene: 66` is a relabelling of click
  one, not a measurement. Verified live: five mid answers return 66/66/66/66/66.
- **No numbers are asked**, so the output is an opinion about an opinion.
- **The gate hides four values the user's own clicks already determined.**
- **Options are transparently ordered**, so scores inflate and cluster.
- **Weights are all 0.2**, asserting tech stack matters exactly as much as data
  hygiene. The weighting mechanism is dead code.
- **No cohort.** A score with no stated comparison cohort is not a score.
- **Band names** (Foundational / Developing / Optimized) collide almost exactly
  with competitor Prometheus.

Research base: 58 competitor and reference sources reviewed (RAOS, Artemis,
Florian Negre, CRM Health Scanner, RevPartners, Flexera, HubSpot graders,
G-Squared, Desert West, Prometheus, Scorecard Marketing, Starr Conspiracy).

## Decisions taken

| Decision | Choice |
|---|---|
| Conversion goal | Booked calls. Drop the gate. |
| Measurement | Behaviour-anchored questions + optional numbers block |
| Length | 12 core questions + optional numbers |
| Benchmarks | Cited third-party now, own cohort after ~100 completions |
| Dimensions | Existing five plus AI readiness |
| Scoring | Weighted composite spine, euro leak overlay when numbers given |

## The instrument

### Calibration (before question 1)

Two selects, used to label the result and select the benchmark set:

- Headcount band: `1-9 / 10-49 / 50-249 / 250+`
- GTM motion: `inbound-led / outbound-led / mixed / product-led`

Result header then reads: *"Calibrated for B2B, 10-49 employees, outbound-led."*

### Dimensions and weights

Weights are published on the results page and must be defensible.

| id | Dimension | Weight | Rationale |
|---|---|---|---|
| `data` | Data hygiene | 25 | Everything downstream inherits its errors |
| `pipeline` | Pipeline process | 20 | Determines whether forecasting is possible |
| `reporting` | Reporting and attribution | 20 | Where spend decisions get made |
| `automation` | Automation and handoffs | 15 | Recoverable time, but only once data is trusted |
| `stack` | Tech stack | 10 | Usually a symptom, rarely a root cause |
| `ai` | AI readiness | 10 | Second revenue pillar, and a multiplier on the rest |

### Questions

Every option describes an observable behaviour. No adjectives, no self-rating.
Each question carries a one-line rationale rendered under it, so value starts at
question one. Every question ends with a "Not sure" option (see scoring).

**Data hygiene**

1. *When a rep opens a company record, what do they usually find?*
   - Duplicates, or fields that contradict each other (0)
   - Core fields present, much of it stale or blank (33)
   - Reliable for the fields we actually use (67)
   - Complete and current, audited on a schedule (100)
   - Not sure (0, `unknown`)
   <br>Rationale: this surfaces data quality problems faster than any audit.

2. *When did you last run a deduplication or data audit?*
   - Never done a formal one (0)
   - Once, at some point (33)
   - Ad hoc, when something breaks (67)
   - On a schedule, with a named owner (100)
   - Not sure (0, `unknown`)

**Pipeline process**

3. *What has to be true for a deal to move to the next stage?*
   - It depends who you ask (0)
   - Stages are written down, nobody enforces them (33)
   - Clear criteria, followed most of the time (67)
   - Defined exit criteria, enforced in the CRM (100)
   - Not sure (0, `unknown`)

4. *How far off was your last quarter's forecast?*
   - We do not forecast formally (0)
   - More than 25% out (33)
   - Within 25% (67)
   - Within 10% (100)
   - Not sure (0, `unknown`)
   <br>Rationale: not whether a forecast exists, whether it was right.

**Reporting and attribution**

5. *Can you name which channel produced your last 10 closed-won deals?*
   - No (0)
   - Roughly, from memory or manual digging (33)
   - Yes for most, from a dashboard (67)
   - Yes end to end, including multi-touch (100)
   - Not sure (0, `unknown`)

6. *Someone asks why you missed or hit last month. How long to answer with data?*
   - We debate it, we do not resolve it (0)
   - Days of manual work (33)
   - Hours (67)
   - It is already on a dashboard (100)
   - Not sure (0, `unknown`)

**Automation and handoffs**

7. *How long does a new inbound lead wait for first human contact?*
   - More than a day (0)
   - Same day (33)
   - Within an hour (67)
   - Under 5 minutes (100)
   - We do not measure it (0, `unknown`)
   <br>Rationale: the most direct lever in revenue operations.

8. *What happens between "demo booked" and "deal created"?*
   - Manual, someone retypes things (0)
   - Partly automated, with manual cleanup (33)
   - Automated, occasional silent failures (67)
   - Automated, monitored, alerts on failure (100)
   - Not sure (0, `unknown`)

**Tech stack**

9. *How many tools touch your revenue data, and do they agree?*
   - Many, and they disagree (0)
   - A few, syncing is patchy (33)
   - Integrated, mostly consistent (67)
   - Lean and consistent, one source of truth (100)
   - Not sure (0, `unknown`)

10. *What share of the revenue team uses the CRM daily as intended?*
    - A minority (0)
    - About half (33)
    - Most (67)
    - Everyone, it is how work happens (100)
    - Not sure (0, `unknown`)

**AI readiness**

11. *Where does your team's institutional knowledge live?*
    - In people's heads (0)
    - Scattered docs, mostly outdated (33)
    - Documented and findable, partly current (67)
    - Documented, current, already feeding a tool (100)
    - Not sure (0, `unknown`)

12. *Have you tried to automate or AI-assist a revenue workflow?*
    - No (0)
    - Tried, it did not stick (33)
    - One or two live, unmonitored (67)
    - Several live, measured, owned (100)
    - Not sure (0, `unknown`)

### Optional numbers block

Rendered after question 12, explicitly skippable, labelled as what unlocks the
euro figure. Five fields:

| Field | Unit | Used by |
|---|---|---|
| Average contract value | EUR | speed-to-lead line |
| Win rate | % | speed-to-lead line |
| New inbound leads per month | count | speed-to-lead line |
| Median first-response time | select, not free text | speed-to-lead line |
| Revenue-team headcount | count | manual-drag line |

First-response time is a select with the same buckets as question 7
(`>1 day / same day / <1h / <5min`), so the two can be cross-checked against
each other and a mismatch feeds the contradiction table. Every field is
individually optional: the euro overlay renders whichever lines it has complete
inputs for, and silently omits the rest rather than showing a partial or
zero-valued line.

## Scoring

### Composite

- Option values: 0 / 33 / 67 / 100.
- **"Not sure" scores 0** and is tagged `unknown`. Defence: if you cannot answer
  "how fast do we respond to inbound", you are not managing it. The tag lets the
  narrative say "you do not measure this" rather than "you are bad at this",
  but it costs the same points. This also removes the upward-guess escape hatch.
- Dimension score = mean of its two items, rounded.
- Overall = sum(dimension x weight) / 100, rounded.
- Recomputed server-side on every submit. The client number is never trusted.
  This discipline already exists and is retained.

### Bands

Named for operating condition rather than capability, and deliberately distinct
from every competitor set found.

| Range | Band | Meaning |
|---|---|---|
| 0-34 | Held together by people | Works because individuals compensate. Does not survive them leaving. |
| 35-59 | Works until it doesn't | Fine at today's volume. Breaks when you add reps or spend. |
| 60-79 | Predictable | You can forecast it and defend decisions from it. |
| 80-100 | Compounding | The system makes next quarter easier, not harder. |

Distribution is tuned so a typical Belgian scaleup lands in **Works until it
doesn't**. If everyone scores high the scorecard has confirmed they do not need
Andrea; if everyone scores low they feel unready to hire him.

### Euro overlay

Runs only when the optional block is completed. Every line prints its own
arithmetic. Worked example:

```
Modelled current bookings
  420 inbound/mo x 12 = 5,040/yr x 11% lead-to-opp x 22% win x EUR 18,000
  = EUR 2,195,424/yr

Slow first response
  Lead-to-opp at >1h response ~11%, at <5min ~13% (conservative)  [cited]
  5,040 x 2pt x 22% win rate x EUR 18,000 ACV = EUR 399,168/yr

Manual admin drag
  6 revenue staff x 5.2 h/wk reclaimable (from automation score 33/100)
  x 46 wks x EUR 65 loaded hourly = EUR 93,288/yr
                                       -----------------
                          Directional total  EUR 492,456/yr
                          = 22% of modelled bookings
```

Rules:

1. Every line shows its working. Showing the arithmetic is more persuasive than
   the conclusion.
2. The total is labelled **"a directional estimate, not a measurement"**.
   Explicit hedging raises credibility and this number gets defended on a call.
3. **Where a figure cannot be computed honestly, no figure is invented.**
   Attribution gaps produce a qualitative finding, never a fabricated euro
   amount.
4. Benchmarks live in `lib/benchmarks.ts` as cited, dated constants. **Every
   citation must be verified against its primary source before shipping.** Any
   benchmark that cannot be stood behind is dropped, not approximated.
5. **Conservatism guards.** The model multiplies four user-supplied numbers, so
   it compounds fast and can produce a figure that is arithmetically correct but
   commercially absurd. Three guards:
   - Always use the **low end** of a benchmark range for the lift (2pt, not the
     4pt the range would permit).
   - Always print **modelled current bookings** alongside the leak, and express
     the leak as a **share of that figure**. A number that stands alone invites
     disbelief; a ratio is self-limiting and is what Artemis does.
   - If the computed leak exceeds **35% of modelled bookings**, clamp the
     displayed total to 35% and add "capped for conservatism". A leak larger
     than a third of revenue is not credible in a triage-level self-report and
     costs more trust than it wins.

## Report

### Skeleton

Three mandatory fields per finding:

- **What's happening**: the mechanism, in the respondent's own words
- **What it's costing**: the consequence, loss-framed
- **Quietly capping**: which other dimensions this one ceilings

### Contradiction flagging

Detected **deterministically in code**, never by the LLM. An LLM asked to find
contradictions will invent them. The rules table detects; the LLM only writes
prose around a detection that already happened.

| Claim A | Claim B | Output |
|---|---|---|
| Forecast within 10% | CRM stale or duplicated | You cannot forecast to 10% on data you just told me you do not trust |
| Attribution end to end | Does not measure response time | Attribution blind to first-touch latency is missing its most actionable variable |
| Several AI workflows live | Knowledge in people's heads | Automation on undocumented process encodes the undocumented process |
| Under 5 min response | Manual handoffs, someone retypes | A sub-5-minute response that then waits on manual entry is not a sub-5-minute process |

### Ordering and framing

- Fixes ranked by **impact / effort**, not impact alone, and each states why it
  holds that position. Both terms are defined so the ranking is reproducible
  rather than a matter of LLM taste:
  - `impact = dimension weight x (100 - dimension score) / 100`
  - `effort` is a fixed 1-3 constant per dimension declared in `config.ts`
    (data 3, pipeline 2, reporting 2, automation 2, stack 3, ai 1), reflecting
    how much work the fix typically is, not how bad the score is.
  - Ties break toward the lower `effort`, so the first item is always something
    that can plausibly ship inside a first sprint.
- Inputs read back before conclusions are drawn.
- Explicit limits: "self-reported, triage-level, not validated evidence".
- Closing CTA **varies by band** rather than being a constant line.

### Schema

```ts
{
  version: 2,
  calibration: string,
  readback: string,
  headline: string,
  leak?: { lines: LeakLine[], total: number, disclaimer: string },
  findings: { dimension, whatsHappening, whatItsCosting, quietlyCapping }[],
  contradictions: { claimA, claimB, whyItMatters }[],
  fixes: { order, title, whyThisPosition, effort, expectedGain }[],
  limits: string,
  nextStep: string,
}
```

## Flow

```
landing -> calibrate (2) -> 12 questions -> optional numbers -> FULL RESULT
                                                                 |- Cal.com booking inline
                                                                 |- "email me a copy" (optional)
                                                                 |- print / PDF
```

Everything unlocks. Email becomes an optional post-value capture, so Airtable
still fills when someone wants a copy, but nobody is blocked from the diagnosis.

## Code changes

**New, pure, unit-tested**

- `lib/leak.ts`: euro model
- `lib/contradictions.ts`: deterministic rules table
- `lib/benchmarks.ts`: cited, dated constants

**Extended**

- `lib/scoring.ts`: 6 dimensions, real weights, `unknown` tagging

**Rewritten**

- `config.ts` quiz block, `lib/schemas.ts` report schema,
  `lib/anthropic.ts` prompt, `components/funnel/MaturityQuiz.tsx`,
  `components/funnel/ReportViewer.tsx`

**Loosened**

- `app/api/analyze/route.ts`: no longer requires `leadId`
- `app/api/lead/route.ts`: optional capture rather than a gate

**Critical**

- `middleware.ts` currently redirects `/report` to `/` unless the
  `tunnel_optin` cookie is set. With no email step that cookie is never set, so
  the results page would bounce every visitor. **This must change in the same
  commit or the redesign is dead on arrival.**

**Airtable**

New columns: cohort headcount, cohort motion, the five optional figures, leak
total, and `Score AI Readiness` (6th dimension).

## Migration

The stored `Report` JSON changes shape. Old cached reports would crash the new
viewer, so the payload carries `version: 2` and anything without it regenerates.
The answers-hash guard added in commit `951d224` already forces regeneration on
mismatch, so this rides along with it.

## Analytics

Gate events are replaced. New events: `calibration_complete`,
`numbers_provided`, `numbers_skipped`, `result_view`, `copy_requested`,
`booking_click`. `lead_signup` survives but now fires only on optional capture,
so historical comparisons must not treat it as the same metric.

## Testing

- `lib/scoring.test.ts` extended: weights, `unknown` handling, band boundaries.
- `lib/leak.test.ts` new: arithmetic, missing-input fallbacks, no NaN or
  negative leaks.
- `lib/contradictions.test.ts` new: each rule fires only on its pair.
- End-to-end: complete the quiz twice with different answers and confirm the
  result differs and no gate appears.

## Explicitly out of scope

- Own-cohort peer benchmarking (needs ~100 completions first; the schema stores
  what is required to enable it later).
- CRM read-only OAuth scanning, which the research rates as the strongest
  variant but is a separate product.
- Multi-language. English only, matching the current site.
