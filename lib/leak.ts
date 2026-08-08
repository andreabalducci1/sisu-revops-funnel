/**
 * Euro leak model.
 *
 * This multiplies up to four user-supplied numbers, so it compounds fast and
 * can produce a figure that is arithmetically correct and commercially
 * absurd. Three guards, in order of importance:
 *   1. Always use the low end of a benchmark range (see benchmarks.ts:
 *      RESPONSE_BUCKETS ships a deliberately narrow leadToOpp spread, and
 *      loadedHourly ships the real, current, verified figure, not a flattered
 *      one).
 *   2. Always report modelled bookings alongside the leak, as a ratio.
 *   3. Clamp the displayed total at 35% of modelled bookings.
 * A leak larger than a third of revenue is not credible from a triage-level
 * self-report and costs more trust than it wins.
 *
 * Where an input is missing, the dependent line is omitted. It is never
 * rendered as zero, and it is never estimated. An implausible input (a value
 * outside a sane real-world range, such as a winRate of 500) is treated the
 * same as a missing one: the line is omitted, never silently clamped and
 * re-presented as if the user had actually supplied it.
 *
 * Pure module: no side effects, no module-level mutable state, no imports
 * beyond ./benchmarks. Every euro figure traces back to a Benchmark object
 * (see LeakLine.sources) so a later report view can cite it, caveat and all.
 */
import {
  leadToOppRate,
  BENCHMARKS,
  WEEKS_PER_YEAR,
  RESPONSE_BUCKETS,
  type Benchmark,
} from "./benchmarks";

export interface LeakInputs {
  acv?: number;
  winRate?: number;
  inboundPerMonth?: number;
  /** Must exactly match one of RESPONSE_BUCKETS' ids to be treated as
   * present. An empty string, a whitespace-only string, or a value that
   * matches no known bucket id is treated as absent, so the speed line is
   * omitted rather than defaulting to a bucket the user never selected
   * (see computeLeak's hasSpeedInputs check). */
  responseBucket?: string;
  headcount?: number;
}

export interface LeakLine {
  id: "speed" | "drag";
  label: string;
  /** Each string is one printed line of arithmetic. */
  workings: string[];
  amount: number;
  /**
   * The dated, cited Benchmark objects this line's arithmetic relied on.
   * Every euro figure on the public report must trace to a source: a line
   * with no traceable source is exactly what this design exists to avoid.
   */
  sources: Benchmark[];
}

export interface LeakResult {
  modelledBookings: number;
  lines: LeakLine[];
  total: number;
  /** Total as a share of modelled bookings, 0 to 1. */
  ratio: number;
  capped: boolean;
  disclaimer: string;
}

const CAP_RATIO = 0.35;
const BEST_BUCKET = "under_5min";
const DISCLAIMER =
  "A directional estimate from self-reported inputs, not a measurement.";

/** Win rate is a percentage: anything above 100 cannot be real and is most
 * likely a raw count typed into a percentage field. */
const MAX_WIN_RATE_PERCENT = 100;

/** Implausible ceiling on a single deal's ACV in EUR. Guards against a
 * self-report typo, such as a value entered in cents. */
const MAX_ACV_EUR = 10_000_000;

/** Implausible ceiling on monthly inbound lead volume. Guards against, for
 * example, a yearly figure typed into a monthly field. */
const MAX_INBOUND_PER_MONTH = 1_000_000;

/** Implausible ceiling on revenue-team headcount. Guards against, for
 * example, whole-company headcount typed into a revenue-team-only field. */
const MAX_HEADCOUNT = 10_000;

/**
 * Hours per week of manual admin drag assumed reclaimable at the lowest
 * possible automation score (0/100), scaling down linearly to 0 at a perfect
 * score. This is a model assumption, not a cited benchmark: it is not sourced
 * from BENCHMARKS because no dated, publishable figure for "reclaimable hours
 * from automating revenue admin" exists to cite. Kept modest (roughly an hour
 * a day) in the same conservative spirit as guard 1.
 */
const MAX_RECLAIMABLE_HOURS_PER_WEEK = 5.2;

const eur = (n: number) => `EUR ${Math.round(n).toLocaleString("en-US")}`;

/** Same currency formatting as eur(), but keeps two decimal places instead of
 * rounding to the nearest euro. Used only inside `workings` strings, and only
 * for figures (like the hourly rate) whose real value has cents that eur()'s
 * whole-euro rounding would otherwise hide, letting someone hand-recompute
 * the printed line and land on a different answer than the printed total.
 * Never used for a line's overall amount: totals keep whole-euro rounding. */
const eurPrecise = (n: number) =>
  `EUR ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function positive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * A stricter positive(): also rejects a value above `max`. Self-reported
 * numbers that clear an implausible ceiling (a winRate of 500, an ACV typed
 * in cents) are rejected outright rather than clamped, because a clamped
 * number would still be presented as if the user had supplied it.
 */
function plausible(n: unknown, max: number): n is number {
  return positive(n) && n <= max;
}

/** True only for a non-empty, non-whitespace string that exactly matches one
 * of RESPONSE_BUCKETS' ids. Anything else (undefined, "", "   ", or a value
 * that matches no known bucket) is treated as absent, not guessed at. */
function isKnownResponseBucket(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    RESPONSE_BUCKETS.some((b) => b.id === value)
  );
}

/** Keeps a corrupted or out-of-range automation score from producing negative
 * or inflated reclaimable hours. The score is documented elsewhere as 0-100,
 * but nothing enforces that at this function's boundary, so it is enforced
 * here instead. */
function clampScore(score: number): number {
  if (!Number.isFinite(score)) return NaN;
  return Math.min(100, Math.max(0, score));
}

export function computeLeak(
  inputs: LeakInputs,
  automationScore: number
): LeakResult | null {
  const lines: LeakLine[] = [];

  const hasSpeedInputs =
    plausible(inputs.acv, MAX_ACV_EUR) &&
    plausible(inputs.winRate, MAX_WIN_RATE_PERCENT) &&
    plausible(inputs.inboundPerMonth, MAX_INBOUND_PER_MONTH) &&
    isKnownResponseBucket(inputs.responseBucket);

  let modelledBookings = 0;

  if (hasSpeedInputs) {
    const leadsPerYear = inputs.inboundPerMonth! * 12;
    const win = inputs.winRate! / 100;
    const current = leadToOppRate(inputs.responseBucket!);
    const best = leadToOppRate(BEST_BUCKET);
    modelledBookings = leadsPerYear * current * win * inputs.acv!;

    const lift = Math.max(0, best - current);
    if (lift > 0) {
      const amount = leadsPerYear * lift * win * inputs.acv!;
      lines.push({
        id: "speed",
        label: "Slow first response",
        workings: [
          `${inputs.inboundPerMonth!.toLocaleString("en-US")} inbound/mo x 12 = ${leadsPerYear.toLocaleString("en-US")}/yr`,
          `Lead to opportunity now ${(current * 100).toFixed(0)}%, at under ${BENCHMARKS.speedToLead.value} minutes ${(best * 100).toFixed(0)}%`,
          `${leadsPerYear.toLocaleString("en-US")} x ${(lift * 100).toFixed(0)}pt x ${inputs.winRate!}% win x ${eur(inputs.acv!)} ACV = ${eur(amount)}/yr`,
        ],
        amount,
        sources: [BENCHMARKS.speedToLead],
      });
    }
  }

  // Reclaimable hours scale with how unautomated the setup is.
  const clampedScore = clampScore(automationScore);
  const reclaimablePerWeek = Number.isFinite(clampedScore)
    ? (MAX_RECLAIMABLE_HOURS_PER_WEEK * (100 - clampedScore)) / 100
    : 0;
  if (plausible(inputs.headcount, MAX_HEADCOUNT) && reclaimablePerWeek > 0) {
    const rate = BENCHMARKS.loadedHourly.value;
    const amount = inputs.headcount! * reclaimablePerWeek * WEEKS_PER_YEAR * rate;
    lines.push({
      id: "drag",
      label: "Manual admin drag",
      workings: [
        `${inputs.headcount} revenue staff x ${reclaimablePerWeek.toFixed(1)} h/wk reclaimable (automation score ${clampedScore}/100)`,
        // Belgian whole-economy figure, not role-specific: stated plainly here
        // rather than papered over, per benchmarks.ts's caveat on this value.
        // Printed at full precision (not eur()'s whole-euro rounding) so the
        // stated arithmetic actually reconciles with the printed total below.
        `x ${WEEKS_PER_YEAR} wks x ${eurPrecise(rate)} Belgian whole-economy loaded hourly (not role-specific) = ${eur(amount)}/yr`,
      ],
      amount,
      sources: [BENCHMARKS.loadedHourly],
    });
  }

  if (lines.length === 0) return null;

  const raw = lines.reduce((s, l) => s + l.amount, 0);
  const ceiling = modelledBookings > 0 ? modelledBookings * CAP_RATIO : Infinity;
  const capped = raw > ceiling;
  const total = capped ? ceiling : raw;

  return {
    modelledBookings,
    lines,
    total,
    ratio: modelledBookings > 0 ? total / modelledBookings : 0,
    capped,
    disclaimer: capped
      ? `${DISCLAIMER} Capped for conservatism at ${CAP_RATIO * 100}% of modelled bookings.`
      : DISCLAIMER,
  };
}
