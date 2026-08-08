# Funnel copy (source of truth)

> Mirrors config.ts. Change config.ts and this file together, never one alone.

## Landing (/)

- **Eyebrow**: Free RevOps maturity check
- **Headline**: Score your RevOps setup.
- **Headline (italic second line)**: See where revenue quietly leaks.
- **Subhead**: Answer five quick questions and get an instant maturity score, plus a
  personalized read on the three fixes that move the needle first.
- **Bullets**:
  1. A clear score across five revenue-ops dimensions
  2. The gaps costing you pipeline, ranked
  3. What to fix first, specific to your setup
- **CTA**: Get my score
- **Form label**: Your best email
- **Social proof**: Free. About a minute. No pitch.
- **Preview card**: "Sample result", 72 / 100, "RevOps maturity score", with three lines
  (five dimensions; a personalized report not a generic PDF; built by a RevOps engineer
  not a marketer)

## Quiz

Five questions, one per dimension, four options each scored 0 / 33 / 66 / 100.
Question ids: q_data, q_pipeline, q_automation, q_reporting, q_stack.
Bands: Foundational 0-39, Developing 40-69, Operational 70-89, Optimized 90-100.

## Report (/report)

The body is generated per lead by Claude, so there is no fixed copy here. The shape is
fixed by lib/schemas.ts > reportSchema: a summary, five per-dimension verdicts with
recommendations, three ranked priorities, and a next step that points at the call.
Tone rules: problem-first, plain, no em-dashes, no invented proof.

## Book (/book)

- **Eyebrow**: Last step
- **Headline**: Book your call
- **Description**: Pick a time that works. We will look at your score together and map
  the fastest wins.
- Cal.com embed, email and name prefilled from the captured lead.

## Thanks (/thanks)

- **Eyebrow**: Confirmed
- **Headline**: Your call is booked.
- **Body**: You will get a confirmation email shortly. Talk soon.
- **Next steps**:
  1. Add the meeting to your calendar
  2. Bring the one number you most want to move
  3. Keep an eye on your inbox
