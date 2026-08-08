import { test } from "node:test";
import assert from "node:assert/strict";
import { BENCHMARKS, leadToOppRate, RESPONSE_BUCKETS } from "./benchmarks";

test("every benchmark carries a source and a year", () => {
  for (const [key, b] of Object.entries(BENCHMARKS)) {
    assert.ok(b.source.length > 0, `${key} has no source`);
    assert.ok(b.url.startsWith("https://"), `${key} has no url`);
    // A blanket "recent years only" bar would reject a seminal primary study
    // (e.g. speedToLead's 2011 HBR source) in favor of a newer secondary
    // source that merely repeats the same figure without re-deriving it. A
    // transparently dated original is preferred over that, so the floor here
    // only rules out truly ancient or placeholder years, not genuine age.
    assert.ok(b.year >= 2010, `${key} is stale: ${b.year}`);
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

// --- Important 8: the printed "Lead to opportunity now X%, at under 5
// minutes Y%" figures come from RESPONSE_BUCKETS, a directional modelling
// assumption (see this file's header), not from the cited HBR study itself.
// The line was citing BENCHMARKS.speedToLead (a real, dated source) next to
// numbers that source does not publish. The caveat must say so plainly
// rather than let the citation imply the percentages are HBR's. ---

test("speedToLead's caveat distinguishes the cited study's threshold from the report's own conversion-rate assumption", () => {
  const caveat = BENCHMARKS.speedToLead.caveat ?? "";
  assert.ok(caveat.length > 0, "speedToLead must carry a caveat");
  assert.ok(
    /assumption/i.test(caveat),
    "caveat must plainly call the specific conversion rates an assumption, not a cited figure"
  );
  assert.ok(
    /not published/i.test(caveat) || /not.{0,20}find/i.test(caveat),
    "caveat must state the percentages are not something a reader will find in the cited source"
  );
});

test("no unreplaced placeholder survives into a shipped benchmark", () => {
  // The scaffold below ships with REPLACE_WITH_* markers on purpose. This test
  // is the thing that stops them reaching a public page, so it must fail until
  // Step 1's verification has actually been done.
  for (const [key, b] of Object.entries(BENCHMARKS)) {
    assert.ok(!/REPLACE_WITH/.test(b.source), `${key} still has a placeholder source`);
    assert.ok(!/REPLACE_WITH/.test(b.url), `${key} still has a placeholder url`);
    assert.equal(b.verified, true, `${key} is not verified`);
  }
});
