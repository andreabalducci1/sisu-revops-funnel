import { test } from "node:test";
import assert from "node:assert/strict";
import { rankFixes } from "./fixes";

// --- Brief's test list (verbatim) ---

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

// --- Additional coverage beyond the brief's floor ---

test("both dimensions at 100 leaves nothing to fix", () => {
  const r = rankFixes(score(100, 100), dims);
  assert.deepEqual(r, []);
});

test("a dimension missing from the score is treated as fully unaddressed", () => {
  // Defensive: a config/score schema mismatch should read as "needs
  // everything" rather than silently disappearing from the plan.
  const onlyDim = [{ id: "missing", label: "Missing dimension", weight: 20, effort: 2 as const }];
  const s = { ...score(0, 0), dimensions: [] };
  const r = rankFixes(s, onlyDim);
  assert.equal(r.length, 1);
  assert.equal(r[0].impact, 20);
  assert.equal(r[0].ratio, 10);
});

test("when ratio and effort are both tied, the dimension listed first in the input wins", () => {
  const first = [
    { id: "z", label: "Z", weight: 20, effort: 2 as const },
    { id: "y", label: "Y", weight: 20, effort: 2 as const },
  ];
  const s = {
    ...score(0, 0),
    dimensions: [
      { id: "z", label: "Z", score: 0, unknownCount: 0 },
      { id: "y", label: "Y", score: 0, unknownCount: 0 },
    ],
  };
  assert.equal(rankFixes(s, first)[0].id, "z");

  // Reverse the input order with an otherwise identical tie: the winner
  // flips too, proving the tiebreak is an explicit rule (input position),
  // not an accident of engine sort stability.
  const reversed = [first[1], first[0]];
  assert.equal(rankFixes(s, reversed)[0].id, "y");
});

test("whyThisPosition is plain, non-empty, and never uses an em-dash", () => {
  const threeEfforts = [
    { id: "low", label: "Low effort dim", weight: 10, effort: 1 as const },
    { id: "mid", label: "Moderate effort dim", weight: 10, effort: 2 as const },
    { id: "big", label: "Big effort dim", weight: 10, effort: 3 as const },
  ];
  const s = {
    ...score(0, 0),
    dimensions: [
      { id: "low", label: "Low effort dim", score: 0, unknownCount: 0 },
      { id: "mid", label: "Moderate effort dim", score: 0, unknownCount: 0 },
      { id: "big", label: "Big effort dim", score: 0, unknownCount: 0 },
    ],
  };
  const r = rankFixes(s, threeEfforts);
  assert.equal(r.length, 3);
  for (const fix of r) {
    assert.ok(fix.whyThisPosition.length > 0);
    // U+2014 is the em-dash code point, written as an escape sequence so
    // this source file contains no literal em-dash character itself.
    const EM_DASH = "\u2014";
    assert.ok(!fix.whyThisPosition.includes(EM_DASH), `em-dash found in: ${fix.whyThisPosition}`);
    assert.ok(fix.whyThisPosition.includes("10"), "should reference the dimension's weight");
  }
});

test("an unknownCount on a dimension does not affect ranking or crash it", () => {
  const s = {
    ...score(0, 0),
    dimensions: [
      { id: "data", label: "Data hygiene", score: 0, unknownCount: 5 },
      { id: "ai", label: "AI readiness", score: 0, unknownCount: 0 },
    ],
  };
  const r = rankFixes(s, dims);
  assert.equal(r[0].id, "ai");
  assert.equal(r[1].id, "data");
});

// --- Worked example with the real config weights and efforts (see
// task-6-report.md for the hand-computed arithmetic this mirrors) ---

test("real config weights/efforts produce the documented worked-example order", () => {
  const real = [
    { id: "data", label: "Data hygiene", weight: 25, effort: 3 as const },
    { id: "pipeline", label: "Pipeline process", weight: 20, effort: 2 as const },
    { id: "reporting", label: "Reporting and attribution", weight: 20, effort: 2 as const },
    { id: "automation", label: "Automation and handoffs", weight: 15, effort: 2 as const },
    { id: "stack", label: "Tech stack", weight: 10, effort: 3 as const },
    { id: "ai", label: "AI readiness", weight: 10, effort: 1 as const },
  ];
  const s = {
    overall: 0,
    band: "",
    bandTeaser: "",
    unknownCount: 0,
    dimensions: [
      { id: "data", label: "Data hygiene", score: 20, unknownCount: 0 },
      { id: "pipeline", label: "Pipeline process", score: 60, unknownCount: 0 },
      { id: "reporting", label: "Reporting and attribution", score: 40, unknownCount: 0 },
      { id: "automation", label: "Automation and handoffs", score: 70, unknownCount: 0 },
      { id: "stack", label: "Tech stack", score: 50, unknownCount: 0 },
      { id: "ai", label: "AI readiness", score: 80, unknownCount: 0 },
    ],
  };
  const r = rankFixes(s, real);
  assert.deepEqual(
    r.map((f) => f.id),
    ["data", "reporting", "pipeline", "automation", "ai", "stack"]
  );
  assert.deepEqual(
    r.map((f) => f.order),
    [1, 2, 3, 4, 5, 6]
  );
  assert.equal(r[0].impact, 20);
  assert.equal(r[0].ratio, 6.7);
});
