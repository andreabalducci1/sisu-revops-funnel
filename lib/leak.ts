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
 * rendered as zero, and it is never estimated.
 *
 * Pure module: no side effects, no module-level mutable state, no imports
 * beyond ./benchmarks. Every euro figure traces back to a Benchmark object
 * (see LeakLine.sources) so a later report view can cite it, caveat and all.
 */
import { leadToOppRate, BENCHMARKS, WEEKS_PER_YEAR, type Benchmark } from "./benchmarks";

export interface LeakInputs {
  acv?: number;
  winRate?: number;
  inboundPerMonth?: number;
  /** Any string is accepted; an unrecognised value falls back to the slowest
   * bucket via leadToOppRate, same as benchmarks.ts does for "unknown". */
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

function positive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
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
    positive(inputs.acv) &&
    positive(inputs.winRate) &&
    positive(inputs.inboundPerMonth) &&
    typeof inputs.responseBucket === "string";

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
  if (positive(inputs.headcount) && reclaimablePerWeek > 0) {
    const rate = BENCHMARKS.loadedHourly.value;
    const amount = inputs.headcount! * reclaimablePerWeek * WEEKS_PER_YEAR * rate;
    lines.push({
      id: "drag",
      label: "Manual admin drag",
      workings: [
        `${inputs.headcount} revenue staff x ${reclaimablePerWeek.toFixed(1)} h/wk reclaimable (automation score ${clampedScore}/100)`,
        // Belgian whole-economy figure, not role-specific: stated plainly here
        // rather than papered over, per benchmarks.ts's caveat on this value.
        `x ${WEEKS_PER_YEAR} wks x ${eur(rate)} Belgian whole-economy loaded hourly (not role-specific) = ${eur(amount)}/yr`,
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
