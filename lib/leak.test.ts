import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLeak } from "./leak";
import { BENCHMARKS, WEEKS_PER_YEAR } from "./benchmarks";

const full = {
  acv: 18000,
  winRate: 22,
  inboundPerMonth: 420,
  responseBucket: "under_hour",
  headcount: 6,
};

// --- Brief's test list (verbatim except where noted) ---

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

// NOTE ON THIS TEST: the brief's literal scenario was
// `{ ...full, acv: 200000, headcount: 200 }`. Under the real, Task-1-verified
// benchmarks (a deliberately narrow 0.08-0.13 leadToOpp spread, not the
// study's headline multiples the brief's prose assumed) that scenario does
// NOT breach the cap: the speed line's share of modelled bookings is a
// constant lift/current ratio (~18%) independent of acv, and the drag line
// does not scale with acv at all, so inflating acv alongside headcount
// actually dilutes the ratio rather than blowing it up. Verified by hand:
// modelledBookings = 24,393,600; raw = speed(4,435,200) + drag(2,305,888) =
// 6,741,088 < ceiling(8,537,760). capped would be false, contradicting the
// assertion below. The fix is a test-data adjustment (drop the acv override
// so drag isn't diluted by a proportionally larger bookings base), not a
// formula change: this keeps the guard's intent (extreme combined inputs get
// clamped) while being consistent with the real benchmark numbers.
test("total is clamped to 35% of modelled bookings", () => {
  const r = computeLeak({ ...full, headcount: 200 }, 0);
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

// --- Additional edge cases beyond the brief's floor ---

test("no line is ever rendered with a hardcoded benchmark: sources trace to the real BENCHMARKS objects", () => {
  const r = computeLeak(full, 33);
  assert.ok(r);
  const speed = r.lines.find((l) => l.id === "speed");
  const drag = r.lines.find((l) => l.id === "drag");
  assert.ok(speed);
  assert.ok(drag);
  assert.deepEqual(speed.sources, [BENCHMARKS.speedToLead]);
  assert.deepEqual(drag.sources, [BENCHMARKS.loadedHourly]);
  // Reference equality too: these must be the actual shared objects, not copies
  // that could drift from the source of truth.
  assert.equal(speed.sources[0], BENCHMARKS.speedToLead);
  assert.equal(drag.sources[0], BENCHMARKS.loadedHourly);
});

test("the drag line's caveat is not stripped: Task 10 needs it to render honestly", () => {
  const r = computeLeak({ headcount: 6 }, 0);
  assert.ok(r);
  const drag = r.lines.find((l) => l.id === "drag");
  assert.ok(drag);
  assert.ok(
    typeof drag.sources[0].caveat === "string" && drag.sources[0].caveat.length > 0,
    "loadedHourly's caveat must survive into the line's sources"
  );
});

test("missing just one of the four speed inputs omits the speed line, not only when all are missing", () => {
  // winRate alone is missing; acv, inboundPerMonth, responseBucket, headcount present.
  const r = computeLeak(
    { acv: 18000, inboundPerMonth: 420, responseBucket: "under_hour", headcount: 6 },
    33
  );
  assert.ok(r);
  assert.equal(r.lines.find((l) => l.id === "speed"), undefined);
  assert.ok(r.lines.find((l) => l.id === "drag"));
});

test("automation score above 100 is clamped, not treated as negative reclaimable hours", () => {
  const at100 = computeLeak({ headcount: 6 }, 100);
  const above100 = computeLeak({ headcount: 6 }, 150);
  assert.equal(at100, null);
  assert.equal(above100, null);
});

test("automation score below 0 is clamped to the same result as 0, not an inflated one", () => {
  const atZero = computeLeak({ headcount: 6 }, 0);
  const belowZero = computeLeak({ headcount: 6 }, -50);
  assert.ok(atZero);
  assert.ok(belowZero);
  const dragZero = atZero.lines.find((l) => l.id === "drag");
  const dragBelow = belowZero.lines.find((l) => l.id === "drag");
  assert.ok(dragZero);
  assert.ok(dragBelow);
  assert.equal(dragZero.amount, dragBelow.amount);
});

test("a non-finite automation score never crashes and never produces a leak out of nowhere", () => {
  const r = computeLeak({ headcount: 6 }, NaN);
  assert.equal(r, null);
});

test("a large ACV alone does not trigger the cap: it inflates modelled bookings by the same factor as the speed leak, and dilutes the acv-independent drag leak", () => {
  const r = computeLeak({ ...full, acv: 5_000_000 }, 33);
  assert.ok(r);
  assert.equal(r.capped, false);
  // Ratio should sit close to the pure lift/current bound (0.02 / 0.11 ~ 0.1818)
  // as acv dominates and the drag line's contribution shrinks toward zero.
  assert.ok(r.ratio > 0.15 && r.ratio < 0.19, `ratio out of expected band: ${r.ratio}`);
});

test("hand-verified arithmetic for a realistic worked example (full inputs, automation score 33)", () => {
  const r = computeLeak(full, 33);
  assert.ok(r);

  // modelledBookings = 420*12 leads/yr x 0.11 current lead->opp x 0.22 win x 18000 ACV
  assert.ok(Math.abs(r.modelledBookings - 2_195_424) < 1);

  const speed = r.lines.find((l) => l.id === "speed");
  assert.ok(speed);
  // speed = 5040 leads/yr x (0.13 - 0.11) lift x 0.22 win x 18000 ACV
  assert.ok(Math.abs(speed.amount - 399_168) < 1);

  const drag = r.lines.find((l) => l.id === "drag");
  assert.ok(drag);
  // drag = 6 headcount x (5.2 x 67/100) h/wk x 46 wks x 48.2 EUR/h
  assert.ok(Math.abs(drag.amount - 46_348.3488) < 1);

  assert.equal(r.capped, false);
  assert.ok(Math.abs(r.total - 445_516.3488) < 1);
  assert.ok(Math.abs(r.ratio - 0.202977) < 0.001);
});

test("workings and disclaimer never contain an em-dash, in an uncapped and a capped scenario", () => {
  const scenarios = [
    computeLeak(full, 33),
    computeLeak({ ...full, headcount: 200 }, 0),
    computeLeak({ headcount: 6 }, 0),
  ];
  // Unicode escape, not a literal character: the project's no-em-dash rule
  // applies to this file too, so the character being checked for is never
  // typed directly into the source.
  const EM_DASH = "\u2014";
  for (const r of scenarios) {
    assert.ok(r);
    assert.ok(!r.disclaimer.includes(EM_DASH), "disclaimer contains an em-dash");
    for (const line of r.lines) {
      assert.ok(!line.label.includes(EM_DASH), `${line.id} label contains an em-dash`);
      for (const w of line.workings) {
        assert.ok(!w.includes(EM_DASH), `${line.id} workings contain an em-dash: ${w}`);
      }
    }
  }
});

// NOTE ON THIS TEST: originally this asserted that an unrecognised response
// bucket falls back to the slowest bucket (same amount as "over_day"),
// mirroring benchmarks.ts's leadToOppRate fallback. Task 4 review (Finding 1)
// identified that as a defect at the computeLeak boundary: silently
// defaulting to a bucket the user never selected prices a speed line from an
// input the user never actually gave, contradicting this module's own
// documented rule that a missing input omits its line rather than being
// estimated. leadToOppRate's internal "unknown falls back to slowest" logic
// in benchmarks.ts is unchanged and still correct for its own purpose (it is
// only ever called here with an already-validated, known bucket id now); the
// fix is that computeLeak itself validates responseBucket against
// RESPONSE_BUCKETS before treating it as present at all. Updated to assert
// the corrected behaviour.
test("an unrecognised response bucket omits the speed line rather than silently defaulting to the slowest one", () => {
  const r = computeLeak({ ...full, responseBucket: "not_a_real_bucket" }, 33);
  assert.ok(r);
  assert.equal(r.lines.find((l) => l.id === "speed"), undefined);
  assert.ok(r.lines.find((l) => l.id === "drag"));
});

test("an empty responseBucket omits the speed line rather than being treated as present", () => {
  const r = computeLeak({ ...full, responseBucket: "" }, 33);
  assert.ok(r);
  assert.equal(r.lines.find((l) => l.id === "speed"), undefined);
  assert.ok(r.lines.find((l) => l.id === "drag"));
});

test("a whitespace-only responseBucket omits the speed line rather than being treated as present", () => {
  const r = computeLeak({ ...full, responseBucket: "   " }, 33);
  assert.ok(r);
  assert.equal(r.lines.find((l) => l.id === "speed"), undefined);
  assert.ok(r.lines.find((l) => l.id === "drag"));
});

test("modelledBookings and ratio are always reported alongside the leak (guard b), even when the leak line list is drag-only", () => {
  const r = computeLeak({ headcount: 6 }, 0);
  assert.ok(r);
  assert.equal(r.modelledBookings, 0);
  assert.equal(r.ratio, 0);
  assert.equal(r.capped, false);
});

test("WEEKS_PER_YEAR from benchmarks.ts drives the drag line, not a private literal", () => {
  const r = computeLeak({ headcount: 6 }, 0);
  assert.ok(r);
  const drag = r.lines.find((l) => l.id === "drag");
  assert.ok(drag);
  assert.ok(drag.workings.some((w) => w.includes(String(WEEKS_PER_YEAR))));
});

// --- Finding 2: implausible self-reported values are rejected, not clamped ---

test("a winRate of 500 (an impossible percentage) omits the speed line rather than being clamped and priced anyway", () => {
  const r = computeLeak({ ...full, winRate: 500 }, 33);
  assert.ok(r);
  assert.equal(r.lines.find((l) => l.id === "speed"), undefined);
  assert.ok(r.lines.find((l) => l.id === "drag"));
});

test("an acv of 0 omits the speed line: not a plausible deal size", () => {
  const r = computeLeak({ ...full, acv: 0 }, 33);
  assert.ok(r);
  assert.equal(r.lines.find((l) => l.id === "speed"), undefined);
  assert.ok(r.lines.find((l) => l.id === "drag"));
});

test("a headcount of 50,000 omits the drag line: not a plausible revenue-team size, while the speed line (unaffected by this bound) still renders", () => {
  const r = computeLeak({ ...full, headcount: 50_000 }, 33);
  assert.ok(r);
  assert.ok(r.lines.find((l) => l.id === "speed"));
  assert.equal(r.lines.find((l) => l.id === "drag"), undefined);
});

// --- Finding 3: the drag line's workings print the hourly rate at real precision ---

test("the drag line's workings print the hourly rate at real precision, not eur()'s whole-euro rounding", () => {
  const r = computeLeak({ headcount: 6 }, 0);
  assert.ok(r);
  const drag = r.lines.find((l) => l.id === "drag");
  assert.ok(drag);

  const rate = BENCHMARKS.loadedHourly.value; // 48.2, sourced from BENCHMARKS, not hardcoded
  const preciseRate = `EUR ${rate.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`; // "EUR 48.20"
  // Matches the old, wrong printing ("EUR 48") without also matching the
  // correct one ("EUR 48.20"), whose "48" is followed by a decimal point.
  const roundedRatePattern = new RegExp(`EUR ${Math.round(rate)}(?!\\.\\d)`);

  const rateWorking = drag.workings.find((w) => w.includes("loaded hourly"));
  assert.ok(rateWorking, "no working line mentions the loaded hourly rate");
  assert.ok(
    rateWorking!.includes(preciseRate),
    `expected the rate to print at full precision (${preciseRate}), got: ${rateWorking}`
  );
  assert.ok(
    !roundedRatePattern.test(rateWorking!),
    "the hourly rate is printed rounded to a whole euro, which no longer reconciles with the printed total"
  );

  // The line's overall amount still uses whole-euro rounding: this fix only
  // changes how the rate is printed, never any computed value.
  const roundedTotal = `EUR ${Math.round(drag.amount).toLocaleString("en-US")}`;
  assert.ok(drag.workings.some((w) => w.includes(roundedTotal)));
});
