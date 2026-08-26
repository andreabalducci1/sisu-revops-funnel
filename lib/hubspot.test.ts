import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quizHeat,
  contactProperties,
  coreProperties,
  QUIZ_SIGNAL,
  type QuizCapture,
} from "./hubspot";
import type { ScoreResult } from "./scoring";

function score(overall: number): ScoreResult {
  return {
    overall,
    band: "Works until it doesn't",
    bandTeaser: "",
    unknownCount: 0,
    dimensions: [
      { id: "data", label: "Data", score: 30, unknownCount: 0 },
      { id: "pipeline", label: "Pipeline", score: 40, unknownCount: 0 },
      { id: "reporting", label: "Reporting", score: 50, unknownCount: 0 },
      { id: "automation", label: "Automation", score: 60, unknownCount: 0 },
      { id: "stack", label: "Stack", score: 70, unknownCount: 0 },
      { id: "ai", label: "AI", score: 80, unknownCount: 0 },
    ],
  };
}

const capture: QuizCapture = { email: "a@b.com", firstName: "Ada", company: "Acme" };

test("every quiz completion outranks the hottest Rodz signal", () => {
  // Rodz tops out at 70 in the live table. Someone who finished a 12-question
  // quiz and then chose to hand over an email has asked to be contacted.
  for (const o of [0, 34, 35, 59, 60, 79, 80, 100]) {
    assert.ok(quizHeat(o) > 70, `overall ${o} scored ${quizHeat(o)}, must beat 70`);
  }
});

test("worse maturity scores hotter: the offer fits them best", () => {
  assert.ok(quizHeat(20) > quizHeat(50));
  assert.ok(quizHeat(50) > quizHeat(70));
  assert.ok(quizHeat(70) > quizHeat(90));
});

test("heat is banded on the same boundaries as the report", () => {
  assert.equal(quizHeat(34), quizHeat(0));
  assert.notEqual(quizHeat(34), quizHeat(35));
  assert.equal(quizHeat(59), quizHeat(35));
  assert.notEqual(quizHeat(59), quizHeat(60));
});

test("last_signal carries the fragment the outbound sync matches on", () => {
  // scripts/sync.py signal_type() maps last_signal -> signal type by substring.
  // Break this and quiz leads land in HubSpot but never reach Origami.
  const p = contactProperties(capture, score(40));
  assert.ok(p.last_signal.toLowerCase().includes("maturity check"));
  assert.ok(p.last_signal.startsWith(QUIZ_SIGNAL));
});

test("signal date is an ISO day, which is what signal_age_days parses", () => {
  const p = contactProperties(capture, score(40), new Date("2026-08-25T14:03:00Z"));
  assert.equal(p.last_signal_date, "2026-08-25");
});

test("heat rides as a string, matching how HubSpot returns it", () => {
  const p = contactProperties(capture, score(20));
  assert.equal(p.signal_heat_score, String(quizHeat(20)));
});

test("all six dimension scores are carried", () => {
  const p = contactProperties(capture, score(40));
  assert.equal(p.revops_score_data, "30");
  assert.equal(p.revops_score_pipeline, "40");
  assert.equal(p.revops_score_reporting, "50");
  assert.equal(p.revops_score_automation, "60");
  assert.equal(p.revops_score_stack, "70");
  assert.equal(p.revops_score_ai, "80");
  assert.equal(p.revops_maturity_score, "40");
});

test("absent optional fields are omitted, never written as empty strings", () => {
  const p = contactProperties({ email: "a@b.com" }, score(40));
  assert.equal(p.email, "a@b.com");
  assert.ok(!("firstname" in p));
  assert.ok(!("company" in p));
});

test("email is lowercased and trimmed so it matches the Origami upsert key", () => {
  const p = contactProperties({ email: "  Ada@ACME.com " }, score(40));
  assert.equal(p.email, "ada@acme.com");
});

test("a capture with no score still produces a valid signal contact", () => {
  const p = contactProperties(capture, null);
  assert.equal(p.last_signal, QUIZ_SIGNAL, "an unscored capture has no summary to append");
  assert.ok(!("revops_maturity_score" in p));
  assert.ok(p.signal_heat_score, "an unscored capture is still an intent signal");
});

test("the score summary rides inside last_signal, not only in custom properties", () => {
  // last_signal flows verbatim into Origami's signal-details cell, which is
  // what a human reads before approving a draft. The custom revops_* fields
  // may not exist in the portal yet; this text always survives.
  const p = contactProperties(capture, score(40));
  assert.match(p.last_signal, /40/);
  assert.match(p.last_signal, /Works until it doesn't/);
});

test("core properties carry the signal but none of the custom score fields", () => {
  // If the revops_* properties are not defined in the portal, HubSpot rejects
  // the whole write. The core set uses only properties Rodz already writes,
  // so the fallback can never lose the signal itself.
  const core = coreProperties(capture, score(40));
  assert.ok(core.last_signal.startsWith(QUIZ_SIGNAL));
  assert.ok(core.signal_heat_score);
  assert.ok(core.email);
  for (const k of Object.keys(core)) {
    assert.ok(!k.startsWith("revops_"), `core must not contain ${k}`);
  }
});

test("core is a strict subset of the full property bag", () => {
  const full = contactProperties(capture, score(40));
  const core = coreProperties(capture, score(40));
  for (const [k, v] of Object.entries(core)) {
    assert.equal(full[k], v, `${k} disagrees between core and full`);
  }
});
