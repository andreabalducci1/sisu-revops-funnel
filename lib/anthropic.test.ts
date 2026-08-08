import { test } from "node:test";
import assert from "node:assert/strict";
import { cannedReport, generateReport, isAnthropicConfigured } from "./anthropic";
import { reportSchema } from "./schemas";
import { scoreQuiz } from "./scoring";
import { detectContradictions } from "./contradictions";
import { rankFixes } from "./fixes";
import { computeLeak } from "./leak";
import config from "../config";

// U+2014 / U+2013 written as escapes so this source file contains no literal
// em-dash or en-dash character itself (project rule: no em-dashes anywhere).
const EM_DASH = "\u2014";
const EN_DASH = "\u2013";
const noDash = (s: string) => !s.includes(EM_DASH) && !s.includes(EN_DASH);

// A realistic, low-maturity set of answers using real config.ts question and
// option ids. Chosen so at least one contradiction rule fires (forecast_vs_data:
// a tight forecast claimed on data the same answers say is untrusted).
const answers: Record<string, string> = {
  q_data_records: "a",
  q_data_audit: "b",
  q_pipeline_criteria: "b",
  q_pipeline_forecast: "d",
  q_reporting_channels: "b",
  q_reporting_speed: "b",
  q_automation_speed: "same_day",
  q_automation_handoff: "b",
  q_stack_tools: "b",
  q_stack_adoption: "b",
  q_ai_knowledge: "b",
  q_ai_attempts: "b",
};

const numbers = {
  acv: 18000,
  winRate: 22,
  inboundPerMonth: 420,
  responseBucket: "under_hour",
  headcount: 6,
};

function buildDeterministicInputs() {
  const score = scoreQuiz(answers, config.quiz);
  const contradictions = detectContradictions(answers, numbers);
  const fixes = rankFixes(score, config.quiz.dimensions);
  const automationScore = score.dimensions.find((d) => d.id === "automation")?.score ?? 0;
  const leak = computeLeak(numbers, automationScore);
  return { score, contradictions, fixes, leak };
}

// --- cannedReport must always validate against reportSchema: it is the
// fallback for a missing API key AND for a model-output parse failure, so a
// bug here turns a graceful degrade into a 500. ---

test("cannedReport validates against reportSchema (with contradictions and a leak model)", () => {
  const { score, contradictions, fixes, leak } = buildDeterministicInputs();
  assert.ok(contradictions.length > 0, "fixture should trigger at least one contradiction");
  assert.ok(leak, "fixture should produce a leak model");

  const report = cannedReport(score, contradictions, fixes, leak, "Andrea");
  const parsed = reportSchema.safeParse(report);
  assert.equal(parsed.success, true, parsed.success ? undefined : JSON.stringify(parsed.error.issues));
  assert.equal(report.version, 2);
});

test("cannedReport validates against reportSchema with no contradictions, no leak, no name", () => {
  const score = scoreQuiz({}, config.quiz);
  const contradictions = detectContradictions({});
  const fixes = rankFixes(score, config.quiz.dimensions);
  const leak = computeLeak({}, 0);

  const report = cannedReport(score, contradictions, fixes, leak, undefined);
  const parsed = reportSchema.safeParse(report);
  assert.equal(parsed.success, true);
  assert.deepEqual(report.contradictions, []);
});

test("cannedReport produces one finding per dimension, in the score's dimension order", () => {
  const { score, contradictions, fixes, leak } = buildDeterministicInputs();
  const report = cannedReport(score, contradictions, fixes, leak, undefined);
  assert.deepEqual(
    report.findings.map((f) => f.dimension),
    score.dimensions.map((d) => d.id)
  );
});

// --- The central principle: cannedReport never derives a fact, it only
// copies what the deterministic modules already decided. ---

test("cannedReport's contradictions are exact copies of the deterministic input, not rewritten", () => {
  const { score, contradictions, fixes, leak } = buildDeterministicInputs();
  const report = cannedReport(score, contradictions, fixes, leak, undefined);
  assert.deepEqual(
    report.contradictions,
    contradictions.map((c) => ({ claimA: c.claimA, claimB: c.claimB, whyItMatters: c.whyItMatters }))
  );
});

test("cannedReport's fixes keep the deterministic order and whyThisPosition untouched", () => {
  const { score, contradictions, fixes, leak } = buildDeterministicInputs();
  const report = cannedReport(score, contradictions, fixes, leak, undefined);
  assert.deepEqual(
    report.fixes.map((f) => f.order),
    fixes.map((f) => f.order)
  );
  assert.deepEqual(
    report.fixes.map((f) => f.whyThisPosition),
    fixes.map((f) => f.whyThisPosition)
  );
});

test("cannedReport never mentions a euro figure when no leak model is supplied", () => {
  const { score, contradictions, fixes } = buildDeterministicInputs();
  const report = cannedReport(score, contradictions, fixes, null, undefined);
  for (const f of report.findings) {
    assert.ok(!f.whatItsCosting.includes("EUR"), `unexpected euro figure: ${f.whatItsCosting}`);
  }
});

test("cannedReport never contains an em-dash or en-dash", () => {
  const { score, contradictions, fixes, leak } = buildDeterministicInputs();
  const report = cannedReport(score, contradictions, fixes, leak, "Andrea");
  const strings = [
    report.readback,
    report.headline,
    report.limits,
    report.nextStep,
    ...report.findings.flatMap((f) => [f.whatsHappening, f.whatItsCosting, f.quietlyCapping, f.label]),
    ...report.contradictions.flatMap((c) => [c.claimA, c.claimB, c.whyItMatters]),
    ...report.fixes.flatMap((f) => [f.title, f.whyThisPosition, f.firstStep]),
  ];
  for (const s of strings) {
    assert.ok(noDash(s), `em/en dash found in: ${s}`);
  }
});

test("cannedReport's nextStep varies by band", () => {
  const low = scoreQuiz({}, config.quiz); // all unanswered -> lowest band
  const lowReport = cannedReport(low, [], [], null, undefined);

  const perfectAnswers: Record<string, string> = {};
  for (const q of config.quiz.questions) {
    const best = q.options.reduce((a, b) => (b.score > a.score ? b : a));
    perfectAnswers[q.id] = best.id;
  }
  const high = scoreQuiz(perfectAnswers, config.quiz);
  const highReport = cannedReport(high, [], [], null, undefined);

  assert.notEqual(lowReport.nextStep, highReport.nextStep);
});

// --- generateReport's demo-mode path (no ANTHROPIC_API_KEY) must degrade to
// the same guaranteed-valid canned report, never throw. ---

test("generateReport falls back to a valid canned report when no API key is configured", async () => {
  if (isAnthropicConfigured()) {
    // A live key is present in this environment; skip rather than spend a
    // real call in a unit test.
    return;
  }
  const score = scoreQuiz(answers, config.quiz);
  const report = await generateReport({ firstName: "Andrea", score, answers, numbers });
  const parsed = reportSchema.safeParse(report);
  assert.equal(parsed.success, true);
});
