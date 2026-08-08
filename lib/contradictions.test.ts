import { test } from "node:test";
import assert from "node:assert/strict";
import { detectContradictions, RULE_CONFIG_REFS } from "./contradictions";
import config from "../config";

// --- Brief's test list (verbatim) ---

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

// --- forecast_vs_data: brief's positive case also covers option "b" ---

test("tight forecast on stale-but-present data is also flagged", () => {
  const c = detectContradictions({ q_pipeline_forecast: "d", q_data_records: "b" });
  assert.ok(c.some((x) => x.id === "forecast_vs_data"));
});

test("loose forecast on untrusted data is not a contradiction", () => {
  const c = detectContradictions({ q_pipeline_forecast: "a", q_data_records: "a" });
  assert.deepEqual(c, []);
});

// --- attribution_vs_speed: not covered by the brief's list, added here ---

test("full attribution claimed without measuring first-contact speed is flagged", () => {
  const c = detectContradictions({ q_reporting_channels: "d", q_automation_speed: "x" });
  assert.equal(c.length, 1);
  assert.equal(c[0].id, "attribution_vs_speed");
});

test("full attribution paired with a measured speed is not flagged", () => {
  const c = detectContradictions({ q_reporting_channels: "d", q_automation_speed: "under_5min" });
  assert.deepEqual(c, []);
});

test("unmeasured speed alone, without the attribution claim, is not flagged", () => {
  const c = detectContradictions({ q_reporting_channels: "a", q_automation_speed: "x" });
  assert.deepEqual(c, []);
});

// --- ai_vs_knowledge: not covered by the brief's list, added here ---

test("several AI workflows claimed while knowledge lives in people's heads is flagged", () => {
  const c = detectContradictions({ q_ai_attempts: "d", q_ai_knowledge: "a" });
  assert.equal(c.length, 1);
  assert.equal(c[0].id, "ai_vs_knowledge");
});

test("several AI workflows claimed on top of stale scattered docs is also flagged", () => {
  const c = detectContradictions({ q_ai_attempts: "d", q_ai_knowledge: "b" });
  assert.ok(c.some((x) => x.id === "ai_vs_knowledge"));
});

test("AI workflows claim backed by documented current knowledge is not flagged", () => {
  const c = detectContradictions({ q_ai_attempts: "d", q_ai_knowledge: "d" });
  assert.deepEqual(c, []);
});

// --- speed_vs_handoff: not covered by the brief's list, added here ---

test("sub-5-minute first response with a manual retyped handoff is flagged", () => {
  const c = detectContradictions({ q_automation_speed: "under_5min", q_automation_handoff: "a" });
  assert.equal(c.length, 1);
  assert.equal(c[0].id, "speed_vs_handoff");
});

test("sub-5-minute first response with an automated handoff is not flagged", () => {
  const c = detectContradictions({ q_automation_speed: "under_5min", q_automation_handoff: "d" });
  assert.deepEqual(c, []);
});

// --- speed_self_conflict: missing-data cases (context note 4) ---
// An empty, whitespace-only or unrecognised responseBucket, or the quiz's
// unknown option "x", means the field is ABSENT, not a contradiction.

test("no numbers block at all means the speed rule cannot fire", () => {
  const c = detectContradictions({ q_automation_speed: "under_5min" });
  assert.deepEqual(c, []);
});

test("an empty responseBucket string is absent, not a contradiction", () => {
  const c = detectContradictions(
    { q_automation_speed: "under_5min" },
    { responseBucket: "" }
  );
  assert.deepEqual(c, []);
});

test("a whitespace-only responseBucket is absent, not a contradiction", () => {
  const c = detectContradictions(
    { q_automation_speed: "under_5min" },
    { responseBucket: "   " }
  );
  assert.deepEqual(c, []);
});

test("an unrecognised responseBucket value is absent, not a contradiction", () => {
  const c = detectContradictions(
    { q_automation_speed: "under_5min" },
    { responseBucket: "sometime-next-week" }
  );
  assert.deepEqual(c, []);
});

test("the quiz's unknown option x never conflicts with a filled-in numbers block", () => {
  const c = detectContradictions(
    { q_automation_speed: "x" },
    { responseBucket: "over_day" }
  );
  assert.deepEqual(c, []);
});

test("matching speed values on both sides are not a conflict", () => {
  const c = detectContradictions(
    { q_automation_speed: "same_day" },
    { responseBucket: "same_day" }
  );
  assert.deepEqual(c, []);
});

test("an unrecognised quiz-side speed value never conflicts (defensive)", () => {
  const c = detectContradictions(
    { q_automation_speed: "banana" },
    { responseBucket: "under_5min" }
  );
  assert.deepEqual(c, []);
});

test("genuinely present and recognised speeds that differ produce exactly one flag", () => {
  const c = detectContradictions(
    { q_automation_speed: "under_5min" },
    { responseBucket: "over_day" }
  );
  assert.equal(c.length, 1);
  assert.equal(c[0].id, "speed_self_conflict");
  assert.ok(c[0].whyItMatters.length > 0);
});

// --- config drift guard ---
// Every rule references question ids and option ids from config.ts as bare
// string literals. If config.ts is edited and an id changes or a typo is
// introduced into RULE_CONFIG_REFS, the affected rule would silently stop
// firing forever: no type error, no other test failure. This test looks up
// every pair contradictions.ts claims to depend on against the real
// config.ts, so that drift (or a typo in a newly added rule) fails loudly
// here instead.

test("every rule's config.ts (questionId, optionId) reference still exists", () => {
  assert.ok(RULE_CONFIG_REFS.length > 0);
  for (const { questionId, optionId } of RULE_CONFIG_REFS) {
    const question = config.quiz.questions.find((q) => q.id === questionId);
    assert.ok(question, `question id "${questionId}" not found in config.ts`);
    const option = question?.options.find((o) => o.id === optionId);
    assert.ok(
      option,
      `option id "${optionId}" not found on question "${questionId}" in config.ts`
    );
  }
});
