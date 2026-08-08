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
