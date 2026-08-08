/**
 * Deterministic RevOps maturity scoring.
 *
 * Pure and dependency-free so it can run on the client (instant teaser) and on
 * the server (recompute; never trust the client's number). No LLM here: the
 * number is cheap and instant, the narrative report is the only paid step.
 */

export interface QuizOption {
  id: string;
  score: number;
  /** Marks a "Not sure" style answer. Scores 0 but is reported as unmeasured. */
  unknown?: boolean;
}
export interface QuizQuestion {
  id: string;
  dimension: string;
  options: readonly QuizOption[];
}
export interface QuizDimension {
  id: string;
  label: string;
  weight: number;
}
export interface QuizBand {
  min: number;
  max: number;
  label: string;
  teaser: string;
}
export interface QuizModel {
  dimensions: readonly QuizDimension[];
  questions: readonly QuizQuestion[];
  bands: readonly QuizBand[];
}

/** questionId -> optionId */
export type Answers = Record<string, string>;

export interface DimensionScore {
  id: string;
  label: string;
  score: number;
  /** Count of "Not sure" answers in this dimension. Unmeasured, not bad. */
  unknownCount: number;
}
export interface ScoreResult {
  overall: number;
  band: string;
  bandTeaser: string;
  dimensions: DimensionScore[];
  /** Total "Not sure" answers across all dimensions. */
  unknownCount: number;
}

function chosenOption(question: QuizQuestion, answers: Answers): QuizOption | undefined {
  return question.options.find((o) => o.id === answers[question.id]);
}

/**
 * Score a set of answers against a quiz model.
 * Dimension score = average of its questions' chosen option scores.
 * Overall = weighted average of dimension scores (weights normalized, so
 * integer weights that sum to 100, or to anything else, work the same way).
 * "Not sure" answers score 0 like any unanswered question, but are also
 * counted separately so the report can say "unmeasured" rather than "bad".
 */
export function scoreQuiz(answers: Answers, quiz: QuizModel): ScoreResult {
  const dimensions: DimensionScore[] = quiz.dimensions.map((dim) => {
    const questions = quiz.questions.filter((q) => q.dimension === dim.id);
    let sum = 0;
    let unknownCount = 0;
    for (const q of questions) {
      const opt = chosenOption(q, answers);
      // An unanswered or unrecognised question scores 0, same as "Not sure".
      sum += opt ? opt.score : 0;
      if (opt?.unknown) unknownCount += 1;
    }
    const avg = questions.length === 0 ? 0 : sum / questions.length;
    return { id: dim.id, label: dim.label, score: Math.round(avg), unknownCount };
  });

  const totalWeight = quiz.dimensions.reduce((s, d) => s + d.weight, 0) || 1;
  const weighted = quiz.dimensions.reduce((sum, dim) => {
    const ds = dimensions.find((d) => d.id === dim.id);
    return sum + (ds ? ds.score * dim.weight : 0);
  }, 0);
  const overall = Math.round(weighted / totalWeight);

  const band =
    quiz.bands.find((b) => overall >= b.min && overall <= b.max) ??
    quiz.bands[quiz.bands.length - 1];

  return {
    overall,
    band: band ? band.label : "",
    bandTeaser: band ? band.teaser : "",
    dimensions,
    unknownCount: dimensions.reduce((s, d) => s + d.unknownCount, 0),
  };
}
