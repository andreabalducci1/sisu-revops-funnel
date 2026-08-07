# RevOps Quiz Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 5-question maturity quiz with a 12-question behaviour-anchored instrument across 6 dimensions, remove the email gate in favour of an inline booking, and add an optional numbers block that prices the gap in euros with printed arithmetic.

**Architecture:** All quiz content stays declarative in `config.ts`. Three new pure modules (`benchmarks.ts`, `leak.ts`, `contradictions.ts`) hold the new logic and are unit-tested with `node:test` under `tsx`. The LLM never computes or detects anything: scoring, euro modelling, contradiction detection and fix ordering all happen in deterministic code, and Claude only writes prose around values already decided.

**Tech Stack:** Next.js 15.5.20 App Router, React 19, TypeScript strict, zod, `@anthropic-ai/sdk`, `posthog-js`, `@calcom/embed-react`, `tsx --test` (node:test).

## Global Constraints

- **No em-dashes anywhere** (copy, code, comments, generated report). Use commas, colons, parentheses, or a single hyphen. This is non-negotiable and applies to every file touched.
- **Language is English.** Brand is SiSu RevOps.
- **`config.ts` is the single source of truth.** No hardcoded copy or colour in components.
- **Voice:** problem-first, plain, radically candid. Never use "supercharge", "unleash", "game-changer", "leverage", "synergy", "10x". No invented social proof.
- **The score is always recomputed server-side.** A client-sent number is never trusted.
- **TypeScript strict, no `any`** except at external API boundaries.
- Dimension ids are exactly: `data`, `pipeline`, `reporting`, `automation`, `stack`, `ai`.
- Weights are exactly: data 25, pipeline 20, reporting 20, automation 15, stack 10, ai 10. They sum to 100.
- Run `npm run build` before every commit that touches a component or route.

---

## File Structure

**Created**
- `lib/benchmarks.ts` : cited, dated benchmark constants and their source URLs
- `lib/benchmarks.test.ts`
- `lib/leak.ts` : euro leak model with conservatism guards
- `lib/leak.test.ts`
- `lib/contradictions.ts` : deterministic contradiction rules
- `lib/contradictions.test.ts`
- `lib/fixes.ts` : deterministic fix ranking (impact / effort)
- `lib/fixes.test.ts`

**Modified**
- `config.ts` : whole `quiz` block replaced
- `lib/scoring.ts` : 6 dimensions, `unknown` tagging, cohort passthrough
- `lib/scoring.test.ts` : extended
- `lib/schemas.ts` : report v2, numbers block validation
- `lib/anthropic.ts` : new prompt and canned fallback
- `lib/events.ts` : new events, `FUNNEL_STEPS` updated
- `lib/airtable.ts` : new `LeadFields` columns
- `middleware.ts` : `/report` no longer requires `tunnel_optin`
- `app/api/analyze/route.ts` : `leadId` optional
- `app/api/lead/route.ts` : optional capture, new columns
- `components/funnel/MaturityQuiz.tsx` : calibration + 12 questions + numbers, no gate
- `components/funnel/ReportViewer.tsx` : v2 report rendering
- `package.json` : test script runs all `lib/*.test.ts`
- `CLAUDE.md` : documents the new flow

---

## Task 1: Benchmarks module, with real verification

**Files:**
- Create: `lib/benchmarks.ts`
- Create: `lib/benchmarks.test.ts`
- Modify: `package.json` (test script)

**Interfaces:**
- Consumes: nothing
- Produces: `RESPONSE_BUCKETS`, `type ResponseBucket`, `BENCHMARKS`, `type Benchmark`, `leadToOppRate(bucket): number`, `LOADED_HOURLY_EUR`, `WEEKS_PER_YEAR`

- [ ] **Step 1: Verify each benchmark against a primary source**

Before writing constants, verify these three claims using WebSearch / WebFetch. Record the exact publisher, title, year and URL for each:

1. Lead-to-opportunity conversion difference between a sub-5-minute first response and a response over one hour.
2. The 5-minute speed-to-lead threshold itself.
3. A defensible loaded hourly cost for a Belgian revenue employee.

**If a claim cannot be verified against a primary source, do not approximate it.** Set its `verified: false` and the leak line that depends on it must not render (Task 4 already handles a missing benchmark by omitting the line). Record what you could not verify in the file's header comment. Shipping four cited figures beats eight plausible ones.

- [ ] **Step 2: Write the failing test**

```ts
// lib/benchmarks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { BENCHMARKS, leadToOppRate, RESPONSE_BUCKETS } from "./benchmarks";

test("every benchmark carries a source and a year", () => {
  for (const [key, b] of Object.entries(BENCHMARKS)) {
    assert.ok(b.source.length > 0, `${key} has no source`);
    assert.ok(b.url.startsWith("https://"), `${key} has no url`);
    assert.ok(b.year >= 2023, `${key} is stale: ${b.year}`);
  }
});

test("lead-to-opp rate improves monotonically as response gets faster", () => {
  const rates = RESPONSE_BUCKETS.map((b) => leadToOppRate(b.id));
  for (let i = 1; i < rates.length; i++) {
    assert.ok(rates[i] >= rates[i - 1], "rates must not decrease as speed increases");
  }
});

test("unknown bucket returns the slowest rate, never a guess upward", () => {
  assert.equal(leadToOppRate("unknown"), leadToOppRate(RESPONSE_BUCKETS[0].id));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx tsx --test lib/benchmarks.test.ts`
Expected: FAIL, cannot find module `./benchmarks`.

- [ ] **Step 4: Write the implementation**

```ts
// lib/benchmarks.ts
/**
 * Cited, dated benchmark constants.
 *
 * Every value here gets printed on a public page next to arithmetic, in front
 * of an audience that checks. Each entry therefore carries its publisher, year
 * and URL. A value that could not be verified against a primary source is
 * marked verified:false and its dependent leak line is omitted rather than
 * estimated.
 */

export interface Benchmark {
  value: number;
  label: string;
  source: string;
  year: number;
  url: string;
  verified: boolean;
}

/** Ordered slowest to fastest. Shared with quiz question q_speed. */
export const RESPONSE_BUCKETS = [
  { id: "over_day", label: "More than a day", leadToOpp: 0.08 },
  { id: "same_day", label: "Same day", leadToOpp: 0.1 },
  { id: "under_hour", label: "Within an hour", leadToOpp: 0.11 },
  { id: "under_5min", label: "Under 5 minutes", leadToOpp: 0.13 },
] as const;

export type ResponseBucket = (typeof RESPONSE_BUCKETS)[number]["id"] | "unknown";

/**
 * Conversion rate by response speed. Deliberately conservative: the spread
 * between slowest and fastest is 5 points, at the low end of what the source
 * range permits, because this figure is multiplied by three other user numbers
 * and compounds fast.
 */
export function leadToOppRate(bucket: string): number {
  const found = RESPONSE_BUCKETS.find((b) => b.id === bucket);
  // Unknown means unmeasured. Assume the slowest bucket rather than guessing up.
  return found ? found.leadToOpp : RESPONSE_BUCKETS[0].leadToOpp;
}

export const WEEKS_PER_YEAR = 46;

/** Replace source/year/url with what Step 1 actually verified. */
export const LOADED_HOURLY_EUR: Benchmark = {
  value: 65,
  label: "Loaded hourly cost, Belgian revenue employee",
  source: "REPLACE_WITH_VERIFIED_PUBLISHER",
  year: 2025,
  url: "https://REPLACE_WITH_VERIFIED_URL",
  verified: false,
};

export const BENCHMARKS: Record<string, Benchmark> = {
  speedToLead: {
    value: 5,
    label: "Minutes to first contact, above which conversion drops sharply",
    source: "REPLACE_WITH_VERIFIED_PUBLISHER",
    year: 2025,
    url: "https://REPLACE_WITH_VERIFIED_URL",
    verified: false,
  },
  loadedHourly: LOADED_HOURLY_EUR,
};
```

After Step 1's verification, replace every `REPLACE_WITH_VERIFIED_*` with the real publisher, year and URL and flip `verified` to `true`. Any entry still `verified: false` at commit time must be reported to the user, not silently shipped.

- [ ] **Step 5: Update the test script so new tests actually run**

In `package.json`, change:

```json
"test": "tsx --test lib/scoring.test.ts"
```

to:

```json
"test": "tsx --test lib/*.test.ts"
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: benchmarks tests PASS, existing scoring tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/benchmarks.ts lib/benchmarks.test.ts package.json
git commit -m "Add cited benchmark constants for the euro leak model"
```

---

## Task 2: Rewrite the quiz config

**Files:**
- Modify: `config.ts` (the whole `quiz` block)

**Interfaces:**
- Consumes: `RESPONSE_BUCKETS` from Task 1
- Produces: `config.quiz` with shape `{ intro, cohort, dimensions, questions, numbers, bands, report }`, plus exported types `DimensionId`, `QuizOptionConfig`, `QuizQuestionConfig`, `DimensionConfig`

- [ ] **Step 1: Add the types above the config object**

```ts
export type DimensionId = "data" | "pipeline" | "reporting" | "automation" | "stack" | "ai";

export interface QuizOptionConfig {
  id: string;
  label: string;
  score: number;
  /** Marks "Not sure". Scores 0 but is reported as unmeasured, not as bad. */
  unknown?: boolean;
}

export interface QuizQuestionConfig {
  id: string;
  dimension: DimensionId;
  prompt: string;
  /** One line rendered under the question so value starts at question one. */
  rationale?: string;
  options: QuizOptionConfig[];
}

export interface DimensionConfig {
  id: DimensionId;
  label: string;
  /** Published on the results page. The six weights sum to 100. */
  weight: number;
  /** 1 to 3. How much work the fix typically is. Used to rank fixes. */
  effort: 1 | 2 | 3;
}
```

- [ ] **Step 2: Replace the `quiz` block**

Replace the entire existing `quiz: { ... }` block with the following. Copy the question text verbatim from the spec at `docs/superpowers/specs/2026-08-07-revops-quiz-redesign-design.md`; the four exemplars are shown here in full and the remaining eight follow exactly the same shape.

```ts
  quiz: {
    intro: {
      startCta: "Start the check",
      note: "About 3 minutes. 12 questions. No account, no email required.",
    },

    cohort: [
      {
        id: "headcount",
        label: "How many people work at your company?",
        options: [
          { id: "1_9", label: "1 to 9" },
          { id: "10_49", label: "10 to 49" },
          { id: "50_249", label: "50 to 249" },
          { id: "250_plus", label: "250 or more" },
        ],
      },
      {
        id: "motion",
        label: "How do most deals start?",
        options: [
          { id: "inbound", label: "Inbound led" },
          { id: "outbound", label: "Outbound led" },
          { id: "mixed", label: "A mix of both" },
          { id: "plg", label: "Product led" },
        ],
      },
    ],

    dimensions: [
      { id: "data", label: "Data hygiene", weight: 25, effort: 3 },
      { id: "pipeline", label: "Pipeline process", weight: 20, effort: 2 },
      { id: "reporting", label: "Reporting and attribution", weight: 20, effort: 2 },
      { id: "automation", label: "Automation and handoffs", weight: 15, effort: 2 },
      { id: "stack", label: "Tech stack", weight: 10, effort: 3 },
      { id: "ai", label: "AI readiness", weight: 10, effort: 1 },
    ],

    questions: [
      {
        id: "q_data_records",
        dimension: "data",
        prompt: "When a rep opens a company record, what do they usually find?",
        rationale: "This surfaces data quality problems faster than any audit.",
        options: [
          { id: "a", label: "Duplicates, or fields that contradict each other", score: 0 },
          { id: "b", label: "Core fields present, much of it stale or blank", score: 33 },
          { id: "c", label: "Reliable for the fields we actually use", score: 67 },
          { id: "d", label: "Complete and current, audited on a schedule", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_data_audit",
        dimension: "data",
        prompt: "When did you last run a deduplication or data audit?",
        options: [
          { id: "a", label: "Never done a formal one", score: 0 },
          { id: "b", label: "Once, at some point", score: 33 },
          { id: "c", label: "Ad hoc, when something breaks", score: 67 },
          { id: "d", label: "On a schedule, with a named owner", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_pipeline_criteria",
        dimension: "pipeline",
        prompt: "What has to be true for a deal to move to the next stage?",
        options: [
          { id: "a", label: "It depends who you ask", score: 0 },
          { id: "b", label: "Stages are written down, nobody enforces them", score: 33 },
          { id: "c", label: "Clear criteria, followed most of the time", score: 67 },
          { id: "d", label: "Defined exit criteria, enforced in the CRM", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_pipeline_forecast",
        dimension: "pipeline",
        prompt: "How far off was your last quarter's forecast?",
        rationale: "Not whether a forecast exists, whether it was right.",
        options: [
          { id: "a", label: "We do not forecast formally", score: 0 },
          { id: "b", label: "More than 25% out", score: 33 },
          { id: "c", label: "Within 25%", score: 67 },
          { id: "d", label: "Within 10%", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_reporting_channels",
        dimension: "reporting",
        prompt: "Can you name which channel produced your last 10 closed-won deals?",
        options: [
          { id: "a", label: "No", score: 0 },
          { id: "b", label: "Roughly, from memory or manual digging", score: 33 },
          { id: "c", label: "Yes for most, from a dashboard", score: 67 },
          { id: "d", label: "Yes end to end, including multi-touch", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_reporting_speed",
        dimension: "reporting",
        prompt: "Someone asks why you missed or hit last month. How long to answer with data?",
        options: [
          { id: "a", label: "We debate it, we do not resolve it", score: 0 },
          { id: "b", label: "Days of manual work", score: 33 },
          { id: "c", label: "Hours", score: 67 },
          { id: "d", label: "It is already on a dashboard", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        // Option ids MUST be the RESPONSE_BUCKETS ids from lib/benchmarks.ts.
        // lib/contradictions.ts compares this answer directly against the
        // numbers block's responseBucket, so the two id sets have to match.
        id: "q_automation_speed",
        dimension: "automation",
        prompt: "How long does a new inbound lead wait for first human contact?",
        rationale: "The most direct lever in revenue operations.",
        options: [
          { id: "over_day", label: "More than a day", score: 0 },
          { id: "same_day", label: "Same day", score: 33 },
          { id: "under_hour", label: "Within an hour", score: 67 },
          { id: "under_5min", label: "Under 5 minutes", score: 100 },
          { id: "x", label: "We do not measure it", score: 0, unknown: true },
        ],
      },
      {
        id: "q_automation_handoff",
        dimension: "automation",
        prompt: "What happens between \"demo booked\" and \"deal created\"?",
        options: [
          { id: "a", label: "Manual, someone retypes things", score: 0 },
          { id: "b", label: "Partly automated, with manual cleanup", score: 33 },
          { id: "c", label: "Automated, occasional silent failures", score: 67 },
          { id: "d", label: "Automated, monitored, alerts on failure", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_stack_tools",
        dimension: "stack",
        prompt: "How many tools touch your revenue data, and do they agree?",
        options: [
          { id: "a", label: "Many, and they disagree", score: 0 },
          { id: "b", label: "A few, syncing is patchy", score: 33 },
          { id: "c", label: "Integrated, mostly consistent", score: 67 },
          { id: "d", label: "Lean and consistent, one source of truth", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_stack_adoption",
        dimension: "stack",
        prompt: "What share of the revenue team uses the CRM daily as intended?",
        options: [
          { id: "a", label: "A minority", score: 0 },
          { id: "b", label: "About half", score: 33 },
          { id: "c", label: "Most", score: 67 },
          { id: "d", label: "Everyone, it is how work happens", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_ai_knowledge",
        dimension: "ai",
        prompt: "Where does your team's institutional knowledge live?",
        options: [
          { id: "a", label: "In people's heads", score: 0 },
          { id: "b", label: "Scattered docs, mostly outdated", score: 33 },
          { id: "c", label: "Documented and findable, partly current", score: 67 },
          { id: "d", label: "Documented, current, already feeding a tool", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_ai_attempts",
        dimension: "ai",
        prompt: "Have you tried to automate or AI-assist a revenue workflow?",
        options: [
          { id: "a", label: "No", score: 0 },
          { id: "b", label: "Tried, it did not stick", score: 33 },
          { id: "c", label: "One or two live, unmonitored", score: 67 },
          { id: "d", label: "Several live, measured, owned", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
    ],

    numbers: {
      title: "Optional: put a number on it",
      note: "Skip this and you still get the full diagnosis. Fill it in and the report prices the gap in euros. Nothing is sent anywhere.",
      skipCta: "Skip, show my results",
      submitCta: "Price the gap",
      fields: [
        { id: "acv", label: "Average contract value", unit: "EUR", type: "number" },
        { id: "winRate", label: "Win rate", unit: "%", type: "number" },
        { id: "inboundPerMonth", label: "New inbound leads per month", unit: "", type: "number" },
        { id: "responseBucket", label: "Median time to first contact", unit: "", type: "select" },
        { id: "headcount", label: "People on the revenue team", unit: "", type: "number" },
      ],
    },

    bands: [
      {
        min: 0,
        max: 34,
        label: "Held together by people",
        teaser: "It works because individuals compensate. It does not survive them leaving.",
      },
      {
        min: 35,
        max: 59,
        label: "Works until it doesn't",
        teaser: "Fine at today's volume. It breaks when you add reps or spend.",
      },
      {
        min: 60,
        max: 79,
        label: "Predictable",
        teaser: "You can forecast it and defend decisions from it.",
      },
      {
        min: 80,
        max: 100,
        label: "Compounding",
        teaser: "The system makes next quarter easier, not harder.",
      },
    ],

    report: { maxTokens: 2000 },
  },
```

Delete the old `gate` block entirely. Anything still importing `config.quiz.gate` must be updated in Task 9.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: errors only in files that still reference `config.quiz.gate` (`MaturityQuiz.tsx`), which Task 9 fixes. No errors inside `config.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add config.ts
git commit -m "Replace the 5-question quiz config with the 12-question instrument"
```

---

## Task 3: Extend scoring for 6 dimensions and unknown tagging

**Files:**
- Modify: `lib/scoring.ts`
- Modify: `lib/scoring.test.ts`

**Interfaces:**
- Consumes: `config.quiz` from Task 2
- Produces: `scoreQuiz(answers, quiz): ScoreResult` where `DimensionScore` now has `unknownCount: number` and `ScoreResult` has `unknownCount: number`

- [ ] **Step 1: Write the failing tests**

Append to `lib/scoring.test.ts`:

```ts
const quizWithUnknown: QuizModel = {
  dimensions: [{ id: "a", label: "A", weight: 100 }],
  questions: [
    {
      id: "q1",
      dimension: "a",
      options: [
        { id: "hi", score: 100 },
        { id: "x", score: 0, unknown: true },
      ],
    },
    {
      id: "q2",
      dimension: "a",
      options: [
        { id: "hi", score: 100 },
        { id: "x", score: 0, unknown: true },
      ],
    },
  ],
  bands: [
    { min: 0, max: 49, label: "Low", teaser: "low" },
    { min: 50, max: 100, label: "High", teaser: "high" },
  ],
};

test("unknown scores zero and is counted", () => {
  const r = scoreQuiz({ q1: "hi", q2: "x" }, quizWithUnknown);
  assert.equal(r.overall, 50);
  assert.equal(r.unknownCount, 1);
  assert.equal(r.dimensions[0].unknownCount, 1);
});

test("weights need not be fractions and are normalised", () => {
  const q: QuizModel = {
    dimensions: [
      { id: "a", label: "A", weight: 75 },
      { id: "b", label: "B", weight: 25 },
    ],
    questions: [
      { id: "qa", dimension: "a", options: [{ id: "hi", score: 100 }] },
      { id: "qb", dimension: "b", options: [{ id: "lo", score: 0 }] },
    ],
    bands: [{ min: 0, max: 100, label: "Any", teaser: "" }],
  };
  assert.equal(scoreQuiz({ qa: "hi", qb: "lo" }, q).overall, 75);
});

test("band boundaries are inclusive at both ends", () => {
  const q: QuizModel = {
    dimensions: [{ id: "a", label: "A", weight: 1 }],
    questions: [
      { id: "qa", dimension: "a", options: [{ id: "v34", score: 34 }, { id: "v35", score: 35 }] },
    ],
    bands: [
      { min: 0, max: 34, label: "Lower", teaser: "" },
      { min: 35, max: 100, label: "Upper", teaser: "" },
    ],
  };
  assert.equal(scoreQuiz({ qa: "v34" }, q).band, "Lower");
  assert.equal(scoreQuiz({ qa: "v35" }, q).band, "Upper");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, `unknownCount` is undefined.

- [ ] **Step 3: Implement**

In `lib/scoring.ts`, add `unknown?: boolean` to `QuizOption`, add `unknownCount: number` to both `DimensionScore` and `ScoreResult`, then replace `scoreQuiz` with:

```ts
function chosenOption(question: QuizQuestion, answers: Answers): QuizOption | undefined {
  return question.options.find((o) => o.id === answers[question.id]);
}

export function scoreQuiz(answers: Answers, quiz: QuizModel): ScoreResult {
  const dimensions: DimensionScore[] = quiz.dimensions.map((dim) => {
    const questions = quiz.questions.filter((q) => q.dimension === dim.id);
    let sum = 0;
    let unknownCount = 0;
    for (const q of questions) {
      const opt = chosenOption(q, answers);
      // An unanswered or unrecognised question scores 0, same as "Not sure".
      sum += opt ? opt.score : 0;
      if (opt?.unknown) unknownCount += 1;
    }
    const avg = questions.length === 0 ? 0 : sum / questions.length;
    return { id: dim.id, label: dim.label, score: Math.round(avg), unknownCount };
  });

  const totalWeight = quiz.dimensions.reduce((s, d) => s + d.weight, 0) || 1;
  const weighted = quiz.dimensions.reduce((sum, dim) => {
    const ds = dimensions.find((d) => d.id === dim.id);
    return sum + (ds ? ds.score * dim.weight : 0);
  }, 0);
  const overall = Math.round(weighted / totalWeight);

  const band =
    quiz.bands.find((b) => overall >= b.min && overall <= b.max) ??
    quiz.bands[quiz.bands.length - 1];

  return {
    overall,
    band: band ? band.label : "",
    bandTeaser: band ? band.teaser : "",
    dimensions,
    unknownCount: dimensions.reduce((s, d) => s + d.unknownCount, 0),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS, including the three pre-existing scoring tests.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/scoring.test.ts
git commit -m "Score six dimensions and count unmeasured answers separately"
```

---

## Task 4: Euro leak model

**Files:**
- Create: `lib/leak.ts`
- Create: `lib/leak.test.ts`

**Interfaces:**
- Consumes: `leadToOppRate`, `BENCHMARKS`, `WEEKS_PER_YEAR` from Task 1
- Produces: `type LeakInputs`, `type LeakLine`, `type LeakResult`, `computeLeak(inputs: LeakInputs, automationScore: number): LeakResult | null`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/leak.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLeak } from "./leak";

const full = {
  acv: 18000,
  winRate: 22,
  inboundPerMonth: 420,
  responseBucket: "under_hour",
  headcount: 6,
};

test("returns null when nothing usable was provided", () => {
  assert.equal(computeLeak({}, 33), null);
});

test("computes the speed line with visible workings", () => {
  const r = computeLeak(full, 33);
  assert.ok(r);
  const speed = r.lines.find((l) => l.id === "speed");
  assert.ok(speed, "speed line missing");
  assert.ok(speed.amount > 0);
  assert.ok(speed.workings.length >= 2, "every line must show its arithmetic");
});

test("omits the speed line when a required input is missing, rather than zeroing it", () => {
  const r = computeLeak({ headcount: 6 }, 33);
  assert.ok(r);
  assert.equal(r.lines.find((l) => l.id === "speed"), undefined);
  assert.ok(r.lines.find((l) => l.id === "drag"));
});

test("already fastest bucket produces no speed leak", () => {
  const r = computeLeak({ ...full, responseBucket: "under_5min" }, 33);
  assert.equal(r?.lines.find((l) => l.id === "speed"), undefined);
});

test("total is clamped to 35% of modelled bookings", () => {
  const r = computeLeak({ ...full, acv: 200000, headcount: 200 }, 0);
  assert.ok(r);
  assert.ok(r.total <= r.modelledBookings * 0.35 + 1);
  assert.equal(r.capped, true);
});

test("never returns NaN or a negative amount", () => {
  const r = computeLeak({ acv: 0, winRate: 0, inboundPerMonth: 0, headcount: 0 }, 50);
  if (r) {
    for (const l of r.lines) {
      assert.ok(Number.isFinite(l.amount) && l.amount >= 0, `bad amount ${l.amount}`);
    }
    assert.ok(Number.isFinite(r.total) && r.total >= 0);
  }
});

test("a perfect automation score reclaims no hours", () => {
  const r = computeLeak({ headcount: 6 }, 100);
  assert.equal(r, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test lib/leak.test.ts`
Expected: FAIL, cannot find module `./leak`.

- [ ] **Step 3: Implement**

```ts
// lib/leak.ts
/**
 * Euro leak model.
 *
 * This multiplies up to four user-supplied numbers, so it compounds fast and
 * can produce a figure that is arithmetically correct and commercially absurd.
 * Three guards, in order of importance:
 *   1. Always use the low end of a benchmark range.
 *   2. Always report modelled bookings alongside the leak, as a ratio.
 *   3. Clamp the displayed total at 35% of modelled bookings.
 * A leak larger than a third of revenue is not credible from a triage-level
 * self-report and costs more trust than it wins.
 *
 * Where an input is missing, the dependent line is omitted. It is never
 * rendered as zero, and it is never estimated.
 */
import { leadToOppRate, BENCHMARKS, WEEKS_PER_YEAR } from "./benchmarks";

export interface LeakInputs {
  acv?: number;
  winRate?: number;
  inboundPerMonth?: number;
  responseBucket?: string;
  headcount?: number;
}

export interface LeakLine {
  id: "speed" | "drag";
  label: string;
  /** Each string is one printed line of arithmetic. */
  workings: string[];
  amount: number;
}

export interface LeakResult {
  modelledBookings: number;
  lines: LeakLine[];
  total: number;
  /** Total as a share of modelled bookings, 0 to 1. */
  ratio: number;
  capped: boolean;
  disclaimer: string;
}

const CAP_RATIO = 0.35;
const BEST_BUCKET = "under_5min";
const DISCLAIMER =
  "A directional estimate from self-reported inputs, not a measurement.";

const eur = (n: number) =>
  `EUR ${Math.round(n).toLocaleString("en-US")}`;

function positive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function computeLeak(
  inputs: LeakInputs,
  automationScore: number
): LeakResult | null {
  const lines: LeakLine[] = [];

  const hasSpeedInputs =
    positive(inputs.acv) &&
    positive(inputs.winRate) &&
    positive(inputs.inboundPerMonth) &&
    typeof inputs.responseBucket === "string";

  let modelledBookings = 0;

  if (hasSpeedInputs) {
    const leadsPerYear = inputs.inboundPerMonth! * 12;
    const win = inputs.winRate! / 100;
    const current = leadToOppRate(inputs.responseBucket!);
    const best = leadToOppRate(BEST_BUCKET);
    modelledBookings = leadsPerYear * current * win * inputs.acv!;

    const lift = Math.max(0, best - current);
    if (lift > 0) {
      const amount = leadsPerYear * lift * win * inputs.acv!;
      lines.push({
        id: "speed",
        label: "Slow first response",
        workings: [
          `${inputs.inboundPerMonth!.toLocaleString("en-US")} inbound/mo x 12 = ${leadsPerYear.toLocaleString("en-US")}/yr`,
          `Lead to opportunity now ${(current * 100).toFixed(0)}%, at under ${BENCHMARKS.speedToLead.value} minutes ${(best * 100).toFixed(0)}%`,
          `${leadsPerYear.toLocaleString("en-US")} x ${(lift * 100).toFixed(0)}pt x ${inputs.winRate!}% win x ${eur(inputs.acv!)} ACV = ${eur(amount)}/yr`,
        ],
        amount,
      });
    }
  }

  // Reclaimable hours scale with how unautomated the setup is.
  const reclaimablePerWeek = (5.2 * (100 - automationScore)) / 100;
  if (positive(inputs.headcount) && reclaimablePerWeek > 0) {
    const rate = BENCHMARKS.loadedHourly.value;
    const amount = inputs.headcount! * reclaimablePerWeek * WEEKS_PER_YEAR * rate;
    lines.push({
      id: "drag",
      label: "Manual admin drag",
      workings: [
        `${inputs.headcount} revenue staff x ${reclaimablePerWeek.toFixed(1)} h/wk reclaimable (automation score ${automationScore}/100)`,
        `x ${WEEKS_PER_YEAR} wks x ${eur(rate)} loaded hourly = ${eur(amount)}/yr`,
      ],
      amount,
    });
  }

  if (lines.length === 0) return null;

  const raw = lines.reduce((s, l) => s + l.amount, 0);
  const ceiling = modelledBookings > 0 ? modelledBookings * CAP_RATIO : Infinity;
  const capped = raw > ceiling;
  const total = capped ? ceiling : raw;

  return {
    modelledBookings,
    lines,
    total,
    ratio: modelledBookings > 0 ? total / modelledBookings : 0,
    capped,
    disclaimer: capped
      ? `${DISCLAIMER} Capped for conservatism at ${CAP_RATIO * 100}% of modelled bookings.`
      : DISCLAIMER,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/leak.ts lib/leak.test.ts
git commit -m "Add euro leak model with conservatism guards"
```

---

## Task 5: Deterministic contradiction detection

**Files:**
- Create: `lib/contradictions.ts`
- Create: `lib/contradictions.test.ts`

**Interfaces:**
- Consumes: `Answers` from `lib/scoring`
- Produces: `type Contradiction`, `detectContradictions(answers: Answers, numbers?: LeakInputs): Contradiction[]`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/contradictions.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectContradictions } from "./contradictions";

test("no contradictions on a blank sheet", () => {
  assert.deepEqual(detectContradictions({}), []);
});

test("tight forecast on untrusted data is flagged", () => {
  const c = detectContradictions({ q_pipeline_forecast: "d", q_data_records: "a" });
  assert.equal(c.length, 1);
  assert.equal(c[0].id, "forecast_vs_data");
  assert.ok(c[0].whyItMatters.length > 0);
});

test("consistent answers are not flagged", () => {
  const c = detectContradictions({ q_pipeline_forecast: "d", q_data_records: "d" });
  assert.deepEqual(c, []);
});

test("stated response speed conflicting with the numbers block is flagged", () => {
  const c = detectContradictions(
    { q_automation_speed: "under_5min" },
    { responseBucket: "over_day" }
  );
  assert.ok(c.some((x) => x.id === "speed_self_conflict"));
});

test("each rule fires at most once", () => {
  const c = detectContradictions({
    q_pipeline_forecast: "d",
    q_data_records: "a",
    q_ai_attempts: "d",
    q_ai_knowledge: "a",
  });
  const ids = c.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test lib/contradictions.test.ts`
Expected: FAIL, cannot find module `./contradictions`.

- [ ] **Step 3: Implement**

```ts
// lib/contradictions.ts
/**
 * Deterministic contradiction detection.
 *
 * The research found nobody in this category flags contradictions, which makes
 * it the cheapest credibility win available. It is done in code rather than by
 * the LLM on purpose: a model asked to "find contradictions" will invent them,
 * and an invented contradiction is worse than none. Code decides; the LLM only
 * writes prose around a detection that already happened.
 */
import type { Answers } from "./scoring";
import type { LeakInputs } from "./leak";

export interface Contradiction {
  id: string;
  claimA: string;
  claimB: string;
  whyItMatters: string;
}

interface Rule {
  id: string;
  /** Returns true when both claims are present together. */
  when: (a: Answers, n?: LeakInputs) => boolean;
  claimA: string;
  claimB: string;
  whyItMatters: string;
}

const RULES: Rule[] = [
  {
    id: "forecast_vs_data",
    when: (a) =>
      a.q_pipeline_forecast === "d" &&
      (a.q_data_records === "a" || a.q_data_records === "b"),
    claimA: "Your forecast lands within 10%",
    claimB: "Your CRM records are stale, duplicated or contradictory",
    whyItMatters:
      "You cannot forecast to 10% on data you just told me you do not trust. Either the forecast is being corrected by hand outside the CRM, which does not scale, or the accuracy is luck.",
  },
  {
    id: "attribution_vs_speed",
    when: (a) =>
      a.q_reporting_channels === "d" && a.q_automation_speed === "x",
    claimA: "You have end to end attribution",
    claimB: "You do not measure time to first contact",
    whyItMatters:
      "Attribution blind to first-touch latency is missing its most actionable variable. You can see which channel produced a deal but not why the others did not.",
  },
  {
    id: "ai_vs_knowledge",
    when: (a) =>
      a.q_ai_attempts === "d" &&
      (a.q_ai_knowledge === "a" || a.q_ai_knowledge === "b"),
    claimA: "Several AI workflows are live, measured and owned",
    claimB: "Institutional knowledge lives in people's heads or in stale docs",
    whyItMatters:
      "Automation built on undocumented process encodes the undocumented process. It gets faster at doing the thing nobody agreed on.",
  },
  {
    id: "speed_vs_handoff",
    when: (a) =>
      a.q_automation_speed === "under_5min" && a.q_automation_handoff === "a",
    claimA: "Inbound gets a reply in under 5 minutes",
    claimB: "The demo to deal handoff is manual retyping",
    whyItMatters:
      "A sub-5-minute first touch that then waits on manual data entry is not a sub-5-minute process. The speed you paid for is spent in the handoff.",
  },
  {
    id: "speed_self_conflict",
    when: (a, n) =>
      typeof n?.responseBucket === "string" &&
      typeof a.q_automation_speed === "string" &&
      n.responseBucket !== a.q_automation_speed,
    claimA: "The speed you selected in the questions",
    claimB: "The speed you entered in the numbers block",
    whyItMatters:
      "These two do not match. Worth resolving before either figure gets used, because the euro estimate is built on the second one.",
  },
];

export function detectContradictions(
  answers: Answers,
  numbers?: LeakInputs
): Contradiction[] {
  return RULES.filter((r) => r.when(answers, numbers)).map(
    ({ id, claimA, claimB, whyItMatters }) => ({ id, claimA, claimB, whyItMatters })
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/contradictions.ts lib/contradictions.test.ts
git commit -m "Detect answer contradictions deterministically in code"
```

---

## Task 6: Deterministic fix ranking

**Files:**
- Create: `lib/fixes.ts`
- Create: `lib/fixes.test.ts`

**Interfaces:**
- Consumes: `ScoreResult` from Task 3, `DimensionConfig` from Task 2
- Produces: `type RankedFix`, `rankFixes(score: ScoreResult, dimensions: DimensionConfig[]): RankedFix[]`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/fixes.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { rankFixes } from "./fixes";

const dims = [
  { id: "data", label: "Data hygiene", weight: 25, effort: 3 as const },
  { id: "ai", label: "AI readiness", weight: 10, effort: 1 as const },
];

const score = (data: number, ai: number) => ({
  overall: 0,
  band: "",
  bandTeaser: "",
  unknownCount: 0,
  dimensions: [
    { id: "data", label: "Data hygiene", score: data, unknownCount: 0 },
    { id: "ai", label: "AI readiness", score: ai, unknownCount: 0 },
  ],
});

test("a perfect dimension is never proposed as a fix", () => {
  const r = rankFixes(score(100, 0), dims);
  assert.equal(r.find((f) => f.id === "data"), undefined);
});

test("ranking divides impact by effort, not impact alone", () => {
  // data: 25 * 1.0 / 3 = 8.33   ai: 10 * 1.0 / 1 = 10  -> ai first
  const r = rankFixes(score(0, 0), dims);
  assert.equal(r[0].id, "ai");
  assert.equal(r[1].id, "data");
});

test("order field is 1-based and sequential", () => {
  const r = rankFixes(score(0, 0), dims);
  assert.deepEqual(r.map((f) => f.order), [1, 2]);
});

test("ties break toward the lower effort", () => {
  const tie = [
    { id: "a", label: "A", weight: 30, effort: 3 as const },
    { id: "b", label: "B", weight: 10, effort: 1 as const },
  ];
  const s = {
    ...score(0, 0),
    dimensions: [
      { id: "a", label: "A", score: 0, unknownCount: 0 },
      { id: "b", label: "B", score: 0, unknownCount: 0 },
    ],
  };
  // both score 10 -> lower effort wins
  assert.equal(rankFixes(s, tie)[0].id, "b");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test lib/fixes.test.ts`
Expected: FAIL, cannot find module `./fixes`.

- [ ] **Step 3: Implement**

```ts
// lib/fixes.ts
/**
 * Deterministic fix ranking.
 *
 * Ranked by impact divided by effort rather than impact alone, so the first
 * item is something that can plausibly ship in a first sprint rather than the
 * biggest number on the page. Both terms are defined here so the ordering is
 * reproducible instead of a matter of LLM taste.
 */
import type { ScoreResult } from "./scoring";

export interface RankedFix {
  id: string;
  label: string;
  order: number;
  impact: number;
  effort: number;
  ratio: number;
  whyThisPosition: string;
}

interface DimensionLike {
  id: string;
  label: string;
  weight: number;
  effort: 1 | 2 | 3;
}

const EFFORT_WORD: Record<number, string> = {
  1: "low effort",
  2: "moderate effort",
  3: "a bigger piece of work",
};

export function rankFixes(
  score: ScoreResult,
  dimensions: DimensionLike[]
): RankedFix[] {
  return dimensions
    .map((dim) => {
      const ds = score.dimensions.find((d) => d.id === dim.id);
      const gap = ds ? (100 - ds.score) / 100 : 1;
      const impact = dim.weight * gap;
      return { dim, impact, ratio: impact / dim.effort };
    })
    .filter((x) => x.impact > 0)
    .sort((a, b) => b.ratio - a.ratio || a.dim.effort - b.dim.effort)
    .map((x, i) => ({
      id: x.dim.id,
      label: x.dim.label,
      order: i + 1,
      impact: Math.round(x.impact * 10) / 10,
      effort: x.dim.effort,
      ratio: Math.round(x.ratio * 10) / 10,
      whyThisPosition: `Weighted ${x.dim.weight} of 100, and ${EFFORT_WORD[x.dim.effort]}.`,
    }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fixes.ts lib/fixes.test.ts
git commit -m "Rank fixes by impact over effort, deterministically"
```

---

## Task 7: Report schema v2 and the Anthropic prompt

**Files:**
- Modify: `lib/schemas.ts`
- Modify: `lib/anthropic.ts`

**Interfaces:**
- Consumes: `LeakResult` (Task 4), `Contradiction` (Task 5), `RankedFix` (Task 6), `ScoreResult` (Task 3)
- Produces: `reportSchema` (v2), `type Report`, `numbersSchema`, `generateReport(input): Promise<Report>`

- [ ] **Step 1: Replace `reportSchema` in `lib/schemas.ts`**

```ts
export const reportSchema = z.object({
  version: z.literal(2),
  readback: z.string(),
  headline: z.string(),
  findings: z.array(
    z.object({
      dimension: z.string(),
      label: z.string(),
      whatsHappening: z.string(),
      whatItsCosting: z.string(),
      quietlyCapping: z.string(),
    })
  ),
  contradictions: z.array(
    z.object({ claimA: z.string(), claimB: z.string(), whyItMatters: z.string() })
  ),
  fixes: z.array(
    z.object({
      order: z.number(),
      title: z.string(),
      whyThisPosition: z.string(),
      firstStep: z.string(),
    })
  ),
  limits: z.string(),
  nextStep: z.string(),
});

export type Report = z.infer<typeof reportSchema>;

/** Optional numbers block. Every field is individually optional. */
export const numbersSchema = z.object({
  acv: z.number().positive().max(10_000_000).optional(),
  winRate: z.number().positive().max(100).optional(),
  inboundPerMonth: z.number().positive().max(1_000_000).optional(),
  responseBucket: z.string().optional(),
  headcount: z.number().positive().max(10_000).optional(),
});
```

Also add `cohort: z.record(z.string(), z.string()).optional()` and `numbers: numbersSchema.optional()` to both `optinSchema` and `analyzeSchema`, and make `leadId` optional in `analyzeSchema`.

- [ ] **Step 2: Rewrite the prompt in `lib/anthropic.ts`**

Replace the system prompt with the following, and pass the precomputed values into the user message so the model never derives them:

```ts
const SYSTEM = `You write a RevOps diagnostic for a specific company from a completed assessment.

You receive: a cohort, an overall score and band, six dimension scores, the raw answers, a list of contradictions ALREADY DETECTED IN CODE, a fix order ALREADY DECIDED IN CODE, and optionally a euro leak model.

Rules:
- Never invent a contradiction. Write only about the ones supplied. If the list is empty, return an empty array.
- Never reorder or re-rank the fixes. Use the supplied order and write the prose for each.
- Never invent or recompute a euro figure. If no leak model is supplied, do not mention money at all.
- Every finding needs three distinct fields: whatsHappening (the mechanism, echoing their own answer), whatItsCosting (the consequence, loss framed), quietlyCapping (which OTHER dimension this one ceilings).
- readback: one or two sentences restating their inputs before you conclude anything, so they can catch a wrong entry.
- limits: state plainly that this is self-reported and triage-level, not validated evidence.
- nextStep: vary by band. Do not write the same closing line for a struggling setup and a strong one.

Voice: problem-first, plain, radically candid. Belgian B2B audience. Never use supercharge, unleash, game-changer, leverage, synergy, or 10x. NEVER use an em-dash character; use commas, colons, parentheses or a single hyphen.`;
```

- [ ] **Step 3: Update `cannedReport` to return the v2 shape**

It must return `version: 2` and populate every required field from the deterministic inputs alone, with no LLM call. This is the fallback when `ANTHROPIC_API_KEY` is missing and when parsing fails, so it must always validate against `reportSchema`.

- [ ] **Step 4: Verify it compiles and the fallback validates**

Run: `npx tsc --noEmit`
Expected: errors only in `MaturityQuiz.tsx` / `ReportViewer.tsx`, fixed in Tasks 9 and 10.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas.ts lib/anthropic.ts
git commit -m "Move the report to v2 and stop the model deriving its own facts"
```

---

## Task 8: Unblock the results page (middleware and routes)

This is the task that decides whether the redesign works at all. Without it every visitor is redirected away from their own results.

**Files:**
- Modify: `middleware.ts`
- Modify: `app/api/analyze/route.ts`
- Modify: `app/api/lead/route.ts`

- [ ] **Step 1: Remove the `/report` gate from `middleware.ts`**

`/report` must be reachable with no cookie. Keep the `/thanks` booking gate, which is still meaningful.

```ts
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /report is deliberately ungated. The diagnosis is the product now, and the
  // booking is the conversion. Gating it here would bounce every visitor,
  // because tunnel_optin is only set by the (now optional) email capture.
  if (pathname.startsWith("/thanks")) {
    const booking = req.cookies.get("tunnel_booking");
    if (!booking?.value) {
      return NextResponse.redirect(new URL("/book", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/thanks/:path*"],
};
```

- [ ] **Step 2: Make `leadId` optional in `app/api/analyze/route.ts`**

The Airtable persist and email block is already wrapped in `if (isAirtableConfigured() && leadId)`, so it degrades correctly. Confirm the idempotency lookup is also guarded by `leadId` and that `answersKey` is still computed and stored. Add `numbers` and `cohort` to the destructured payload and pass them through to `generateReport` alongside the precomputed `leak`, `contradictions` and `fixes`.

- [ ] **Step 3: Make `app/api/lead/route.ts` an optional capture**

It keeps working exactly as it does, but it is now called only when the visitor asks for a copy. Add the new columns from Task 11 to the `extra` object. Do not change the rate limit or the `Statut` seeding logic added in commit `951d224`.

- [ ] **Step 4: Verify the results page is reachable with no cookies**

```bash
npm run build && npm run dev
```

Then, in a private window with no cookies, load `http://localhost:3000/report`.
Expected: the page renders its empty state. It must NOT redirect to `/`.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts app/api/analyze/route.ts app/api/lead/route.ts
git commit -m "Ungate the results page and make the email capture optional"
```

---

## Task 9: Rewrite the quiz component

**Files:**
- Modify: `components/funnel/MaturityQuiz.tsx`

**Interfaces:**
- Consumes: `config.quiz` (Task 2), `scoreQuiz` (Task 3), `computeLeak` (Task 4), `detectContradictions` (Task 5), `rankFixes` (Task 6)
- Produces: navigates to `/report` with a `sisu_report_v2` sessionStorage stash

- [ ] **Step 1: Replace the step machine**

```ts
type Step = "intro" | "cohort" | "answering" | "numbers" | "analyzing";
```

The `teaser` step and the whole email gate are deleted. Keep the existing `startedRef` and add a `cohortIndex` and `numbers` state. Preserve the existing styling classes and the `reveal` animation pattern already in the file; only the structure changes.

- [ ] **Step 2: Wire the flow**

- `intro` -> `cohort`: fire `QUIZ_START` once via `startedRef`.
- `cohort`: render `config.quiz.cohort` one select at a time; after the last, fire `CALIBRATION_COMPLETE` and go to `answering`.
- `answering`: unchanged mechanics, now 12 questions. Render `question.rationale` under the prompt when present. After the last answer, fire `QUIZ_COMPLETE` with the score and go to `numbers`.
- `numbers`: render the five optional fields. Two buttons: `skipCta` fires `NUMBERS_SKIPPED`, `submitCta` fires `NUMBERS_PROVIDED`. Both go to `analyzing`.
- `analyzing`: compute everything client-side for the stash, POST to `/api/analyze`, then `router.push("/report")`.

- [ ] **Step 3: Stash under the new key**

```ts
sessionStorage.setItem(
  "sisu_report_v2",
  JSON.stringify({
    report: json.data.report,
    score: json.data.score,
    leak: json.data.leak ?? null,
    contradictions: json.data.contradictions ?? [],
    fixes: json.data.fixes ?? [],
    cohort,
    firstName: undefined,
  })
);
```

Do not reuse `sisu_report_v1`. A stale v1 stash in a returning visitor's session would otherwise be read as a v2 payload and crash the viewer.

- [ ] **Step 4: Verify in the browser**

```bash
npm run build && npm run dev
```

Walk the whole quiz twice with different answers. Confirm: no email is ever requested, the numbers block can be skipped, and `/report` renders both times with different content.

- [ ] **Step 5: Commit**

```bash
git add components/funnel/MaturityQuiz.tsx
git commit -m "Rewrite the quiz: calibration, 12 questions, optional numbers, no gate"
```

---

## Task 10: Rewrite the report viewer

**Files:**
- Modify: `components/funnel/ReportViewer.tsx`

- [ ] **Step 1: Read the v2 stash and reject v1**

```ts
const STASH_KEY = "sisu_report_v2";
```

If `parsed.report?.version !== 2`, treat it as empty rather than rendering. Remove the `getFunnelCookie(FUNNEL_COOKIES.OPTIN)` early return, since there is no longer a cookie to check; keep the `/api/report` fetch fallback for visitors who did opt in.

- [ ] **Step 2: Render the v2 sections in order**

Cohort label, score and band, the six dimension bars (all unlocked, none locked), the euro block when `leak` is present (each line printing `workings` verbatim, then modelled bookings and the ratio, then `disclaimer`), `readback`, findings with the three fields, contradictions, fixes in order, `limits`, and finally the Cal.com booking CTA using `nextStep` as its heading.

Reuse the existing bar markup, and apply the `Math.max` baseline fix already present in `FunnelDashboard.tsx` so a zero top score does not flatten every bar.

- [ ] **Step 3: Add the optional copy request**

A single email field labelled "Email me a copy", posting to `/api/lead`. It must be visibly secondary to the booking CTA and must never block the report.

- [ ] **Step 4: Make the report portable**

B2B buying is a committee, so the result has to survive being forwarded. Add a "Print or save as PDF" button calling `window.print()`, plus a print stylesheet in `app/globals.css`:

```css
@media print {
  /* The booking embed, nav and the copy-request form are interactive
     furniture and print as dead space or blank iframes. */
  .no-print { display: none !important; }
  /* Findings and fixes must not split across a page break mid-item. */
  .print-keep { break-inside: avoid; }
  body { background: #fff; }
}
```

Apply `no-print` to the Cal.com embed, the copy-request form and any nav; apply `print-keep` to each finding, contradiction and fix card.

- [ ] **Step 5: Verify in the browser**

Complete the quiz with numbers, confirm the euro block shows its arithmetic. Complete it again skipping numbers, confirm no money is mentioned anywhere. Open the browser print preview and confirm the booking embed is gone and no finding is split across a page break.

- [ ] **Step 5: Commit**

```bash
git add components/funnel/ReportViewer.tsx
git commit -m "Render the v2 report with euro workings and contradictions"
```

---

## Task 11: Airtable columns and analytics events

**Files:**
- Modify: `lib/airtable.ts`
- Modify: `lib/events.ts`
- Modify: `components/admin/FunnelDashboard.tsx` (only if step labels break)

- [ ] **Step 1: Extend `LeadFields`**

```ts
  "Score AI Readiness"?: number;
  "Cohort Headcount"?: string;
  "Cohort Motion"?: string;
  "Input ACV"?: number;
  "Input Win Rate"?: number;
  "Input Inbound Per Month"?: number;
  "Input Response Bucket"?: string;
  "Input Team Headcount"?: number;
  "Leak Total"?: number;
```

Create these columns in the Airtable base before shipping. Airtable rejects writes to unknown fields, so a missing column fails the whole record write, not just that value.

- [ ] **Step 2: Update `lib/events.ts`**

Add `CALIBRATION_COMPLETE: "calibration_complete"`, `NUMBERS_PROVIDED: "numbers_provided"`, `NUMBERS_SKIPPED: "numbers_skipped"`, `RESULT_VIEW: "result_view"`, `COPY_REQUESTED: "copy_requested"`. Remove `ANALYSIS_TEASER`, which no longer has a step to fire from.

Rewrite `FUNNEL_STEPS` to the real new funnel: landing view, quiz start, quiz complete, result view, booking click, booking completed. `LEAD_SIGNUP` survives but must NOT sit in the main funnel steps, because it now measures optional copy requests and would read as catastrophic drop-off.

- [ ] **Step 3: Verify the admin dashboard still renders**

Run `npm run build`, then load `/admin?secret=$ADMIN_SECRET` and confirm the funnel renders with the new step labels and no missing-event crash.

- [ ] **Step 4: Commit**

```bash
git add lib/airtable.ts lib/events.ts components/admin/FunnelDashboard.tsx
git commit -m "Store cohort and inputs, and track the ungated funnel"
```

---

## Task 12: Update the project brain

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Correct the now-false statements**

`CLAUDE.md` currently documents the old design as intended behaviour and will actively mislead the next session. Fix each of these:

- The flow diagram and the phrase "trades an email for a personalized Claude-generated report".
- "Funnel gating: `middleware.ts` requires the `tunnel_optin` cookie for `/report`". Only `/thanks` is gated now.
- "computes a deterministic 0-100 score across five dimensions". It is six.
- "calls Claude to write the qualitative report only after the email is captured". There is no email step.
- The "Gate-the-reveal flow" line.

- [ ] **Step 2: Add a short section describing the new instrument**

Cover: 12 behaviour-anchored questions, 6 weighted dimensions, cohort calibration, the optional numbers block, the euro model's three conservatism guards, and the rule that contradictions and fix ordering are computed in code and never by the model.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Update the project brain for the ungated 12-question quiz"
```

---

## Final verification

- [ ] `npm test` passes, including all four new test files.
- [ ] `npm run build` compiles clean.
- [ ] In a private window: complete the quiz with numbers, then again skipping them. Both reach `/report` with no email requested, and the two reports differ.
- [ ] Load `/report` directly with no cookies. It shows the empty state and does not redirect.
- [ ] Confirm no `verified: false` benchmark is being rendered on a public page. If any remain, report it rather than shipping it.
- [ ] `grep -rn "$(printf '—')" config.ts lib components app CLAUDE.md` returns nothing. (Written as a codepoint so this check does not match itself.)
