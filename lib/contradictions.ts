/**
 * Deterministic contradiction detection.
 *
 * The research found nobody in this category flags contradictions, which makes
 * it the cheapest credibility win available. It is done in code rather than by
 * the LLM on purpose: a model asked to "find contradictions" will invent them,
 * and an invented contradiction shown to a prospect is worse than showing none.
 * Code decides here; a later task has the LLM write prose only around a
 * detection that already happened. That boundary is absolute: this module
 * must never guess.
 *
 * Pure module: no side effects, no module-level mutable state.
 */
import type { Answers } from "./scoring";
import type { LeakInputs } from "./leak";
import { isKnownResponseBucket } from "./benchmarks";

export interface Contradiction {
  id: string;
  claimA: string;
  claimB: string;
  whyItMatters: string;
}

interface Rule {
  id: string;
  /** Returns true only when both claims are genuinely present together and in conflict. */
  when: (a: Answers, n?: LeakInputs) => boolean;
  claimA: string;
  claimB: string;
  whyItMatters: string;
}

// Both sides of the speed_self_conflict rule route through the shared
// isKnownResponseBucket (lib/benchmarks.ts) check:
// - the numbers block's responseBucket: an empty, whitespace-only, or
//   unrecognised value means the field was left blank, not that it holds a
//   slow answer.
// - the quiz's q_automation_speed answer, where "x" ("We do not measure it")
//   is the unknown option, not a real speed.
// Either side failing this check means the datum is absent, so the rule below
// treats it as missing data and does not fire. Missing data is never treated
// as a contradiction.

const RULES: Rule[] = [
  {
    id: "forecast_vs_data",
    // config.ts: q_pipeline_forecast option "d" ("Within 10%"),
    // q_data_records option "a" ("Duplicates, or fields that contradict each
    // other") or "b" ("Core fields present, much of it stale or blank").
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
    // config.ts: q_reporting_channels option "d" ("Yes end to end, including
    // multi-touch"), q_automation_speed option "x" ("We do not measure it").
    when: (a) => a.q_reporting_channels === "d" && a.q_automation_speed === "x",
    claimA: "You have end to end attribution",
    claimB: "You do not measure time to first contact",
    whyItMatters:
      "Attribution that cannot see how fast a lead was contacted is missing a variable that strongly affects the outcome it is attributing. Two channels can look different in performance when the real difference was response time, not source quality.",
  },
  {
    id: "ai_vs_knowledge",
    // config.ts: q_ai_attempts option "d" ("Several live, measured, owned"),
    // q_ai_knowledge option "a" ("In people's heads") or "b" ("Scattered
    // docs, mostly outdated").
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
    // config.ts: q_automation_speed option "under_5min" ("Under 5 minutes"),
    // q_automation_handoff option "a" ("Manual, someone retypes things").
    when: (a) =>
      a.q_automation_speed === "under_5min" && a.q_automation_handoff === "a",
    claimA: "Inbound gets a reply in under 5 minutes",
    claimB: "The demo to deal handoff is manual retyping",
    whyItMatters:
      "A sub-5-minute first touch that then waits on manual data entry is not a sub-5-minute process. The speed you paid for is spent in the handoff.",
  },
  {
    id: "speed_self_conflict",
    // config.ts: q_automation_speed's option ids are the RESPONSE_BUCKETS ids
    // from lib/benchmarks.ts (over_day, same_day, under_hour, under_5min),
    // the same vocabulary the numbers block's responseBucket field uses. Only
    // fires when both sides are present, recognised, and different: see
    // isKnownResponseBucket above for why blank or unknown values do not
    // count as a conflict.
    when: (a, n) => {
      if (!n) return false;
      return (
        isKnownResponseBucket(n.responseBucket) &&
        isKnownResponseBucket(a.q_automation_speed) &&
        n.responseBucket !== a.q_automation_speed
      );
    },
    claimA: "The speed you selected in the questions",
    claimB: "The speed you entered in the numbers block",
    whyItMatters:
      "These two do not match. Worth resolving before either figure gets used, because the euro estimate is built on the second one.",
  },
];

export interface ConfigRef {
  questionId: string;
  optionId: string;
}

/**
 * Every (questionId, optionId) pair the RULES above compare an answer
 * against as a bare string literal from config.ts. Plain data, kept right
 * beside RULES so it is obvious it must gain an entry whenever a rule gains
 * one: a rule that references a new config.ts id without adding it here is
 * exactly the drift this list exists to catch (see contradictions.test.ts,
 * which looks each pair up against the real config.ts).
 *
 * This module still does not import config.ts itself: the pairs below are
 * just strings, checked against the real config only by the test.
 *
 * speed_self_conflict is intentionally absent: it does not compare against a
 * fixed config.ts option literal, it compares two live values against each
 * other, each validated separately against RESPONSE_BUCKETS in
 * lib/benchmarks.ts via isKnownResponseBucket. Its question id,
 * q_automation_speed, is still covered below via the other rules that do
 * reference it (attribution_vs_speed, speed_vs_handoff).
 */
export const RULE_CONFIG_REFS: ReadonlyArray<ConfigRef> = [
  { questionId: "q_pipeline_forecast", optionId: "d" },
  { questionId: "q_data_records", optionId: "a" },
  { questionId: "q_data_records", optionId: "b" },
  { questionId: "q_reporting_channels", optionId: "d" },
  { questionId: "q_automation_speed", optionId: "x" },
  { questionId: "q_ai_attempts", optionId: "d" },
  { questionId: "q_ai_knowledge", optionId: "a" },
  { questionId: "q_ai_knowledge", optionId: "b" },
  { questionId: "q_automation_speed", optionId: "under_5min" },
  { questionId: "q_automation_handoff", optionId: "a" },
];

export function detectContradictions(
  answers: Answers,
  numbers?: LeakInputs
): Contradiction[] {
  return RULES.filter((r) => r.when(answers, numbers)).map(
    ({ id, claimA, claimB, whyItMatters }) => ({ id, claimA, claimB, whyItMatters })
  );
}
