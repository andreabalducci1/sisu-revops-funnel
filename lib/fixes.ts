/**
 * Deterministic fix ranking.
 *
 * A prospect only has room to start one thing first. Ranking dimensions by
 * impact alone would just point at whichever one scores worst, which is
 * often also the most expensive fix: a multi-quarter project, not a first
 * sprint. Dividing impact by effort surfaces the dimension that is both
 * worth fixing and small enough to actually start on.
 *
 * Both terms, and the tie break, are defined here so the order is
 * reproducible instead of a matter of taste: the same score run through
 * this function always produces the same list, in the same order, so a
 * later task's LLM can write the prose for each item without being able to
 * reorder or re-rank them.
 *
 * Pure module: no side effects, no module state, no import of config. The
 * dimensions (id, label, weight, effort) are passed in as an argument, so
 * this file has no opinion on what the quiz's actual dimensions are.
 */
import type { ScoreResult } from "./scoring";

export interface RankedFix {
  id: string;
  label: string;
  /** 1-based rank. 1 is the fix to make first. */
  order: number;
  /** weight x (100 - score) / 100, one decimal: how much of that dimension's
   * share of the overall score is still on the table. */
  impact: number;
  effort: 1 | 2 | 3;
  /** impact / effort, one decimal. This is what the ranking actually sorts
   * on, so it is the number a reader would need to sanity-check the order. */
  ratio: number;
  /** Plain-English reason for this position. Safe to render as-is. */
  whyThisPosition: string;
}

/**
 * The shape rankFixes needs from a dimension. config.ts's DimensionConfig
 * satisfies this structurally, so config.quiz.dimensions can be passed
 * straight in without this file importing config.ts.
 */
export interface DimensionLike {
  id: string;
  label: string;
  weight: number;
  effort: 1 | 2 | 3;
}

const EFFORT_WORD: Record<1 | 2 | 3, string> = {
  1: "low effort",
  2: "moderate effort",
  3: "a bigger piece of work",
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Rank a quiz's dimensions into an ordered fix list.
 *
 * impact = weight x (100 - score) / 100. A dimension with no matching entry
 * in `score.dimensions` (a config/score mismatch) is treated as fully
 * unaddressed (gap of 1) rather than silently dropped, so a data problem
 * surfaces as "needs everything," not as a missing row.
 *
 * A perfect dimension (impact 0) is never proposed as a fix: there is
 * nothing left to do there.
 *
 * ratio = impact / effort is what decides the order, so the first item is
 * the best return for the work, not just the biggest gap.
 *
 * Ties on ratio break toward the lower effort: a smaller fix with the same
 * return should come first, since it can ship sooner. If ratio and effort
 * are both tied, the dimension listed earlier in `dimensions` wins. That
 * last rule is written out explicitly (as an index comparison), rather than
 * left to rely on the sort being stable, so the order can never depend on
 * a JS engine's internals: the same respondent retaking the quiz, or this
 * function running on a different runtime, always gets the same plan.
 */
export function rankFixes(
  score: ScoreResult,
  dimensions: readonly DimensionLike[]
): RankedFix[] {
  return dimensions
    .map((dim, index) => {
      const dimScore = score.dimensions.find((d) => d.id === dim.id);
      const gap = dimScore ? (100 - dimScore.score) / 100 : 1;
      const impact = dim.weight * gap;
      return { dim, index, impact, ratio: impact / dim.effort };
    })
    .filter((candidate) => candidate.impact > 0)
    .sort(
      (a, b) =>
        b.ratio - a.ratio || a.dim.effort - b.dim.effort || a.index - b.index
    )
    .map((candidate, i) => ({
      id: candidate.dim.id,
      label: candidate.dim.label,
      order: i + 1,
      impact: round1(candidate.impact),
      effort: candidate.dim.effort,
      ratio: round1(candidate.ratio),
      whyThisPosition: `Weighted ${candidate.dim.weight} of 100 in the overall score, and ${EFFORT_WORD[candidate.dim.effort]} to fix.`,
    }));
}
