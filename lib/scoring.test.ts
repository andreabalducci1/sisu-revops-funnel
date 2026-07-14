import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreQuiz, type QuizModel, type Answers } from "./scoring";

// Inline mock so the test is independent of the real config content.
const quiz: QuizModel = {
  dimensions: [
    { id: "a", label: "A", weight: 0.5 },
    { id: "b", label: "B", weight: 0.5 },
  ],
  questions: [
    { id: "qa", dimension: "a", options: [{ id: "lo", score: 0 }, { id: "hi", score: 100 }] },
    { id: "qb1", dimension: "b", options: [{ id: "lo", score: 0 }, { id: "hi", score: 100 }] },
    { id: "qb2", dimension: "b", options: [{ id: "lo", score: 0 }, { id: "hi", score: 100 }] },
  ],
  bands: [
    { min: 0, max: 49, label: "Low", teaser: "low" },
    { min: 50, max: 100, label: "High", teaser: "high" },
  ],
};

test("all lowest answers -> 0, lowest band", () => {
  const a: Answers = { qa: "lo", qb1: "lo", qb2: "lo" };
  const r = scoreQuiz(a, quiz);
  assert.equal(r.overall, 0);
  assert.equal(r.band, "Low");
  assert.deepEqual(
    r.dimensions.map((d) => d.score),
    [0, 0]
  );
});

test("all highest answers -> 100, highest band", () => {
  const a: Answers = { qa: "hi", qb1: "hi", qb2: "hi" };
  const r = scoreQuiz(a, quiz);
  assert.equal(r.overall, 100);
  assert.equal(r.band, "High");
});

test("averages multiple questions in one dimension", () => {
  // dim A = 100; dim B = avg(100, 0) = 50; overall = 0.5*100 + 0.5*50 = 75
  const a: Answers = { qa: "hi", qb1: "hi", qb2: "lo" };
  const r = scoreQuiz(a, quiz);
  assert.equal(r.dimensions.find((d) => d.id === "b")?.score, 50);
  assert.equal(r.overall, 75);
  assert.equal(r.band, "High");
});

test("a missing answer counts as 0", () => {
  const a: Answers = { qa: "hi" }; // qb1 + qb2 unanswered
  const r = scoreQuiz(a, quiz);
  // dim A = 100, dim B = 0 -> overall = 50
  assert.equal(r.overall, 50);
});
