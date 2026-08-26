import { test } from "node:test";
import assert from "node:assert/strict";
import { getConfig, isLocale, resolveLocale, LOCALES, DEFAULT_LOCALE } from "./locale";
import { untranslated } from "./translate";
import en from "../config";

test("the default locale resolves to the untouched English config", () => {
  // Every existing route renders without a provider and must be byte-identical.
  assert.equal(getConfig(DEFAULT_LOCALE), en);
  assert.equal(getConfig("en"), en);
});

test("unknown locales fall back rather than throwing", () => {
  assert.equal(resolveLocale("de"), DEFAULT_LOCALE);
  assert.equal(resolveLocale(undefined), DEFAULT_LOCALE);
  assert.equal(resolveLocale("fr"), "fr");
});

test("isLocale is strict", () => {
  assert.ok(isLocale("fr"));
  assert.ok(!isLocale("FR"));
  assert.ok(!isLocale("fr-BE"));
  assert.ok(!isLocale(""));
});

test("french is actually translated, not a copy of english", () => {
  const fr = getConfig("fr");
  assert.notEqual(fr.landing.headline, en.landing.headline);
  assert.notEqual(fr.quiz.intro.startCta, en.quiz.intro.startCta);
});

// --- Structural parity. These are the tests that matter.
//
// lib/scoring.ts resolves answers by question id and option id. If a
// translation renames an id, scoring silently returns wrong numbers instead of
// failing, and the report, the band and the HubSpot heat are all wrong with no
// error anywhere. Parity is a hard contract, not a nicety.

test("every locale has the same question ids in the same order", () => {
  for (const loc of LOCALES) {
    const q = getConfig(loc).quiz.questions.map((x) => x.id);
    assert.deepEqual(q, en.quiz.questions.map((x) => x.id), `question ids differ in ${loc}`);
  }
});

test("every question has the same option ids and the same scores", () => {
  for (const loc of LOCALES) {
    const cfg = getConfig(loc);
    for (const [i, q] of cfg.quiz.questions.entries()) {
      const ref = en.quiz.questions[i];
      assert.deepEqual(
        q.options.map((o) => o.id),
        ref.options.map((o) => o.id),
        `option ids differ in ${loc} on ${q.id}`
      );
      assert.deepEqual(
        q.options.map((o) => o.score),
        ref.options.map((o) => o.score),
        `option scores differ in ${loc} on ${q.id}`
      );
    }
  }
});

test("every question maps to the same dimension in every locale", () => {
  for (const loc of LOCALES) {
    const cfg = getConfig(loc);
    for (const [i, q] of cfg.quiz.questions.entries()) {
      assert.equal(q.dimension, en.quiz.questions[i].dimension, `dimension drift in ${loc} on ${q.id}`);
    }
  }
});

test("dimension ids and weights are identical across locales", () => {
  for (const loc of LOCALES) {
    const d = getConfig(loc).quiz.dimensions;
    assert.deepEqual(d.map((x) => x.id), en.quiz.dimensions.map((x) => x.id), `dimension ids differ in ${loc}`);
    assert.deepEqual(d.map((x) => x.weight), en.quiz.dimensions.map((x) => x.weight), `weights differ in ${loc}`);
  }
});

test("band boundaries are identical across locales", () => {
  for (const loc of LOCALES) {
    const b = getConfig(loc).quiz.bands;
    assert.deepEqual(
      b.map((x) => [x.min, x.max]),
      en.quiz.bands.map((x) => [x.min, x.max]),
      `band boundaries differ in ${loc}`
    );
  }
});

test("the same answers score identically in every locale", () => {
  // The end-to-end guarantee the parity tests exist to protect.
  const answers: Record<string, string> = {};
  for (const q of en.quiz.questions) answers[q.id] = q.options[0].id;
  const scores = LOCALES.map((loc) => {
    const cfg = getConfig(loc);
    return require("./scoring").scoreQuiz(answers, cfg.quiz).overall;
  });
  assert.equal(new Set(scores).size, 1, `locales disagree on score: ${scores.join(", ")}`);
});

/** The surface a French visitor sees between landing and submitting answers. */
const QUIZ_FLOW = /^(landing|ui|quiz\.(intro|calibration|cohort|dimensions|questions|bands))/;

test("the whole landing-to-answers flow is translated", () => {
  // A half-translated quiz is worse than none: the language mismatch is the
  // exact thing /fr exists to remove.
  const gaps = untranslated(en, getConfig("fr")).filter((p) => QUIZ_FLOW.test(p));
  assert.deepEqual(gaps, [], `untranslated in the quiz flow: ${gaps.join(", ")}`);
});

test("the untranslated surface beyond the quiz flow is known, not a surprise", () => {
  // These are why /fr has no route yet: a French quiz that hands over to an
  // English report reintroduces the mismatch. Recorded so the number cannot
  // grow quietly, and so nobody claims /fr is done while it is not.
  const rest = untranslated(en, getConfig("fr")).filter((p) => !QUIZ_FLOW.test(p));
  const roots = [...new Set(rest.map((p) => p.split(/[.[]/)[0]))].sort();
  assert.deepEqual(roots, ["business", "booking", "resource", "thankyou"].sort());
});
