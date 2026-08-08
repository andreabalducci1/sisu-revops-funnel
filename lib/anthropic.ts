/**
 * Anthropic (Claude) - writes the qualitative maturity report.
 *
 * The central rule for this file: five deterministic modules already compute
 * every fact in the report (lib/scoring.ts, lib/leak.ts, lib/contradictions.ts,
 * lib/fixes.ts). The model's only job is prose. It is never asked to compute a
 * number, find a contradiction, or reorder a fix, and even when it is asked to
 * echo one of those facts back (so the structured-output JSON is self
 * contained), this file never trusts that echo: finalizeReport() below always
 * overwrites a fact-bearing field with the deterministic value, keeping only
 * the free-text prose the model actually contributed.
 *
 * Uses the official SDK (per Anthropic's own guidance) with structured outputs
 * (output_config.format = json_schema) so the model returns valid JSON, which
 * we then validate with the Zod v3 reportSchema.
 *
 * Demo mode: if ANTHROPIC_API_KEY is missing, generateReport() returns a
 * plausible canned report so the whole funnel renders without a key. Any API
 * error, invalid output, or incomplete output also degrades to the canned
 * report (never break, never show a half-written page).
 *
 * No em-dashes: instructed in the system prompt AND stripped in post-process.
 */

import Anthropic from "@anthropic-ai/sdk";
import config from "@/config";
import { reportSchema, type Report } from "@/lib/schemas";
import type { ScoreResult, DimensionScore, Answers } from "@/lib/scoring";
import { computeLeak, type LeakInputs, type LeakResult } from "@/lib/leak";
import { detectContradictions, type Contradiction } from "@/lib/contradictions";
import { rankFixes, type RankedFix } from "@/lib/fixes";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Sonnet-class is the approved default: quality report, cost-sensitive public endpoint.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export function isAnthropicConfigured(): boolean {
  return Boolean(ANTHROPIC_API_KEY);
}

// JSON Schema for structured output. Matches reportSchema. Structured outputs
// require additionalProperties:false and every property listed in required.
// The model is asked to echo contradictions/fixes' fact fields back (order,
// title, whyThisPosition, claimA, claimB, whyItMatters) so the JSON is self
// contained, but finalizeReport() below never trusts that echo: it always
// overwrites those fields with the deterministic source of truth.
const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "integer", enum: [2] },
    readback: { type: "string" },
    headline: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          dimension: { type: "string" },
          label: { type: "string" },
          whatsHappening: { type: "string" },
          whatItsCosting: { type: "string" },
          quietlyCapping: { type: "string" },
        },
        required: ["dimension", "label", "whatsHappening", "whatItsCosting", "quietlyCapping"],
      },
    },
    contradictions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          claimA: { type: "string" },
          claimB: { type: "string" },
          whyItMatters: { type: "string" },
        },
        required: ["claimA", "claimB", "whyItMatters"],
      },
    },
    fixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          order: { type: "integer" },
          title: { type: "string" },
          whyThisPosition: { type: "string" },
          firstStep: { type: "string" },
        },
        required: ["order", "title", "whyThisPosition", "firstStep"],
      },
    },
    limits: { type: "string" },
    nextStep: { type: "string" },
  },
  required: [
    "version",
    "readback",
    "headline",
    "findings",
    "contradictions",
    "fixes",
    "limits",
    "nextStep",
  ],
};

const SYSTEM = `You write a RevOps diagnostic for a specific company from a completed assessment.

You receive: a cohort, an overall score and band, six dimension scores, the raw answers, a list of contradictions ALREADY DETECTED IN CODE, a fix order ALREADY DECIDED IN CODE, and optionally a euro leak model.

Rules:
- Never invent a contradiction. Write only about the ones supplied. If the list is empty, return an empty array.
- For each supplied contradiction, copy claimA, claimB and whyItMatters exactly as given. Do not rewrite, rephrase or shorten whyItMatters: it has already been reviewed for overstatement.
- Never reorder or re-rank the fixes. Use the supplied order and write the prose for each.
- For each supplied fix, copy the order and whyThisPosition exactly as given, and use the supplied label as the title. Only firstStep (one concrete starting action) is yours to write.
- Never invent or recompute a euro figure. If no leak model is supplied, do not mention money at all. If one is supplied, you may cite its total exactly as given, never a number you derived yourself.
- Every finding needs three distinct fields: whatsHappening (the mechanism, echoing their own answer), whatItsCosting (the consequence, loss framed), quietlyCapping (which OTHER dimension this one ceilings).
- readback: one or two sentences restating their inputs before you conclude anything, so they can catch a wrong entry.
- limits: state plainly that this is self-reported and triage-level, not validated evidence.
- nextStep: vary by band. Do not write the same closing line for a struggling setup and a strong one.

Voice: problem-first, plain, radically candid. Belgian B2B audience. Never use supercharge, unleash, game-changer, leverage, synergy, or 10x. NEVER use an em-dash character; use commas, colons, parentheses or a single hyphen.`;

const eur = (n: number) => `EUR ${Math.round(n).toLocaleString("en-US")}`;

function formatCohort(cohort?: Record<string, string>): string {
  if (!cohort || Object.keys(cohort).length === 0) return "Not supplied.";
  return Object.entries(cohort)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
}

function formatDimensions(score: ScoreResult): string {
  return score.dimensions
    .map((d) => {
      const unknown = d.unknownCount > 0 ? `, ${d.unknownCount} "not sure" answer(s)` : "";
      return `- ${d.label} (id: ${d.id}): ${d.score}/100${unknown}`;
    })
    .join("\n");
}

function formatAnswers(answers: Answers): string {
  return config.quiz.questions
    .map((q) => {
      const opt = q.options.find((o) => o.id === answers[q.id]);
      return `- ${q.prompt} -> ${opt ? opt.label : "no answer"}`;
    })
    .join("\n");
}

function formatContradictions(contradictions: Contradiction[]): string {
  if (contradictions.length === 0) {
    return "None detected. Return an empty contradictions array.";
  }
  return contradictions
    .map(
      (c, i) =>
        `${i + 1}. claimA: "${c.claimA}"\n   claimB: "${c.claimB}"\n   whyItMatters (copy exactly): "${c.whyItMatters}"`
    )
    .join("\n");
}

function formatFixes(fixes: RankedFix[]): string {
  return fixes
    .map(
      (f) =>
        `${f.order}. label (use as title): "${f.label}". whyThisPosition (copy exactly): "${f.whyThisPosition}"`
    )
    .join("\n");
}

function formatLeak(leak: LeakResult | null): string {
  if (!leak) {
    return "No leak model supplied. Do not mention a euro figure anywhere in the report.";
  }
  const lines = leak.lines.map((l) => `  - ${l.label}: ${eur(l.amount)}/yr`).join("\n");
  return [
    `Modelled annual bookings: ${eur(leak.modelledBookings)}`,
    "Leak lines:",
    lines,
    `Total leak: ${eur(leak.total)}/yr (${(leak.ratio * 100).toFixed(0)}% of modelled bookings)${leak.capped ? ", capped for conservatism" : ""}`,
    `Disclaimer to respect if you mention this figure: "${leak.disclaimer}"`,
    `If you cite this figure, copy ${eur(leak.total)} exactly. Never compute your own number.`,
  ].join("\n");
}

function buildUserPrompt(input: {
  firstName?: string;
  company?: string;
  cohort?: Record<string, string>;
  score: ScoreResult;
  answers: Answers;
  contradictions: Contradiction[];
  fixes: RankedFix[];
  leak: LeakResult | null;
}): string {
  const who = `${input.firstName || "The prospect"}${input.company ? ` at ${input.company}` : ""}`;
  return [
    who,
    "",
    `Overall score: ${input.score.overall}/100 (${input.score.band})`,
    input.score.bandTeaser,
    "",
    "Cohort:",
    formatCohort(input.cohort),
    "",
    "Dimension scores:",
    formatDimensions(input.score),
    "",
    "Answers:",
    formatAnswers(input.answers),
    "",
    "Contradictions ALREADY DETECTED IN CODE:",
    formatContradictions(input.contradictions),
    "",
    "Fix order ALREADY DECIDED IN CODE:",
    formatFixes(input.fixes),
    "",
    "Euro leak model:",
    formatLeak(input.leak),
  ].join("\n");
}

/** Belt-and-suspenders: strip any em/en dash from every string in the report.
 * Written as unicode escapes, not literal characters, so this source file
 * itself contains no em-dash (project rule: no em-dashes anywhere). */
function stripDashes(report: Report): Report {
  const fix = (s: string) => s.replace(/[\u2013\u2014]/g, "-");
  return {
    version: 2,
    readback: fix(report.readback),
    headline: fix(report.headline),
    findings: report.findings.map((f) => ({
      dimension: f.dimension,
      label: f.label,
      whatsHappening: fix(f.whatsHappening),
      whatItsCosting: fix(f.whatItsCosting),
      quietlyCapping: fix(f.quietlyCapping),
    })),
    contradictions: report.contradictions.map((c) => ({
      claimA: fix(c.claimA),
      claimB: fix(c.claimB),
      whyItMatters: fix(c.whyItMatters),
    })),
    fixes: report.fixes.map((f) => ({
      order: f.order,
      title: fix(f.title),
      whyThisPosition: fix(f.whyThisPosition),
      firstStep: fix(f.firstStep),
    })),
    limits: fix(report.limits),
    nextStep: fix(report.nextStep),
  };
}

/**
 * Belt-and-suspenders enforcement of the central rule at the top of this
 * file: the model never gets the last word on a fact a deterministic module
 * already decided. Contradictions and each fix's order/title/whyThisPosition
 * always come from the supplied ground truth, discarding whatever the model
 * echoed back for those fields. Only genuine prose (readback, headline, each
 * finding's three prose fields, each fix's firstStep, limits, nextStep) is
 * kept from the model's output.
 */
function finalizeReport(
  modelReport: Report,
  score: ScoreResult,
  contradictions: Contradiction[],
  fixes: RankedFix[]
): Report {
  const findingByDim = new Map(modelReport.findings.map((f) => [f.dimension, f]));
  const fixByOrder = new Map(modelReport.fixes.map((f) => [f.order, f]));

  return {
    version: 2,
    readback: modelReport.readback,
    headline: modelReport.headline,
    findings: score.dimensions.map((d) => {
      const m = findingByDim.get(d.id);
      return {
        dimension: d.id,
        label: d.label,
        whatsHappening: m?.whatsHappening ?? "",
        whatItsCosting: m?.whatItsCosting ?? "",
        quietlyCapping: m?.quietlyCapping ?? "",
      };
    }),
    contradictions: contradictions.map((c) => ({
      claimA: c.claimA,
      claimB: c.claimB,
      whyItMatters: c.whyItMatters,
    })),
    fixes: fixes.map((f) => ({
      order: f.order,
      title: f.label,
      whyThisPosition: f.whyThisPosition,
      // Matched by the fix's order number, not array position: even if the
      // model's array comes back in a different sequence than supplied, its
      // firstStep still lands on the fix it was actually written for.
      firstStep: fixByOrder.get(f.order)?.firstStep ?? "",
    })),
    limits: modelReport.limits,
    nextStep: modelReport.nextStep,
  };
}

/** True only when every prose field the model was responsible for actually
 * has content. Guards against a structurally-valid but semantically broken
 * response (for example, a finding whose dimension id did not match any real
 * dimension, leaving finalizeReport() to fill it with an empty string). */
function hasCompleteProse(report: Report): boolean {
  const strings = [
    report.readback,
    report.headline,
    report.limits,
    report.nextStep,
    ...report.findings.flatMap((f) => [f.whatsHappening, f.whatItsCosting, f.quietlyCapping]),
    ...report.fixes.map((f) => f.firstStep),
  ];
  return strings.every((s) => s.trim().length > 0);
}

function verdictFor(score: number): string {
  if (score < 35) return "This is likely costing you pipeline right now.";
  if (score < 60) return "Real gaps remain here, and they show up downstream.";
  if (score < 80) return "Mostly solid, but the remaining gap still has a cost.";
  return "This is not costing you much right now.";
}

function happeningFor(d: DimensionScore): string {
  const unknown =
    d.unknownCount > 0
      ? ` (${d.unknownCount} "not sure" answer${d.unknownCount > 1 ? "s" : ""})`
      : "";
  return `Scored ${d.score}/100${unknown}.`;
}

const CANNED_FIRST_STEP: Record<string, string> = {
  data: "Pick one source of truth and give it a weekly owner to keep it clean.",
  pipeline: "Write exit criteria for each stage and hold the team to them.",
  automation: "Automate the two handoffs that break most often, then document them.",
  reporting: "Stand up one dashboard that ties revenue back to its source.",
  stack: "Cut one tool nobody adopts and integrate what is left.",
  ai: "Write down the one workflow you would automate first, then automate just that one.",
};

const CANNED_CEILING =
  "A gap here can put a ceiling on what a fix elsewhere is able to achieve.";

const CANNED_LIMITS =
  "This is a self-reported, triage-level read, not validated evidence. Treat it as a starting point for a conversation, not an audit.";

/** Mirrors config.quiz.bands' four boundaries (0-34, 35-59, 60-79, 80-100)
 * without importing the band labels themselves, so this closing line varies
 * by band the way the live prompt is instructed to. */
function cannedNextStep(score: ScoreResult): string {
  if (score.overall < 35) {
    return "If you want a hand, book a short call. The fastest wins here are less about tools and more about a handful of habits.";
  }
  if (score.overall < 60) {
    return "If you want a hand turning this into a plan, book a short call and we will map the fastest wins for your setup.";
  }
  if (score.overall < 80) {
    return "You are close to predictable. Book a short call and we will find what is still leaking before it costs you a quarter.";
  }
  return "You are ahead of most of the market. Book a short call if you want a second pair of eyes on what compounds next.";
}

/**
 * A plausible, score-shaped report for demo mode and error fallback. No LLM
 * call: every field is built from the deterministic inputs alone (score,
 * contradictions, fixes, leak), so it always validates against reportSchema.
 */
export function cannedReport(
  score: ScoreResult,
  contradictions: Contradiction[],
  fixes: RankedFix[],
  leak: LeakResult | null,
  firstName?: string
): Report {
  const lead = firstName ? `${firstName}, ` : "";
  return {
    version: 2,
    readback: `${lead}you scored ${score.overall}/100 (${score.band}). ${score.bandTeaser}`,
    headline: score.band,
    findings: score.dimensions.map((d) => ({
      dimension: d.id,
      label: d.label,
      whatsHappening: happeningFor(d),
      whatItsCosting:
        d.id === "automation" && leak
          ? `${verdictFor(d.score)} Modelled at roughly ${eur(leak.total)} a year across your funnel.`
          : verdictFor(d.score),
      quietlyCapping: CANNED_CEILING,
    })),
    contradictions: contradictions.map((c) => ({
      claimA: c.claimA,
      claimB: c.claimB,
      whyItMatters: c.whyItMatters,
    })),
    fixes: fixes.map((f) => ({
      order: f.order,
      title: f.label,
      whyThisPosition: f.whyThisPosition,
      firstStep: CANNED_FIRST_STEP[f.id] || "Tighten this before you scale spend.",
    })),
    limits: CANNED_LIMITS,
    nextStep: cannedNextStep(score),
  };
}

export async function generateReport(input: {
  firstName?: string;
  company?: string;
  /** Cohort question id -> chosen option id (config.quiz.cohort). */
  cohort?: Record<string, string>;
  score: ScoreResult;
  answers: Answers;
  numbers?: LeakInputs;
}): Promise<Report> {
  // Compute every fact up front, once, from the deterministic modules. The
  // model (if called at all) only ever sees this data as already-decided
  // input; it never derives it.
  const automationScore =
    input.score.dimensions.find((d) => d.id === "automation")?.score ?? 0;
  const leak = computeLeak(input.numbers ?? {}, automationScore);
  const contradictions = detectContradictions(input.answers, input.numbers);
  const fixes = rankFixes(input.score, config.quiz.dimensions);

  if (!isAnthropicConfigured()) {
    return cannedReport(input.score, contradictions, fixes, leak, input.firstName);
  }

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: config.quiz.report.maxTokens,
      thinking: { type: "disabled" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: buildUserPrompt({ ...input, contradictions, fixes, leak }),
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: REPORT_JSON_SCHEMA },
      },
    });

    let raw = "";
    for (const block of response.content) {
      if (block.type === "text") raw += block.text;
    }

    const parsed = reportSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return cannedReport(input.score, contradictions, fixes, leak, input.firstName);
    }

    const finalized = finalizeReport(parsed.data, input.score, contradictions, fixes);
    if (!hasCompleteProse(finalized)) {
      return cannedReport(input.score, contradictions, fixes, leak, input.firstName);
    }
    return stripDashes(finalized);
  } catch (err) {
    console.error("[anthropic] generateReport failed:", err instanceof Error ? err.message : err);
    return cannedReport(input.score, contradictions, fixes, leak, input.firstName);
  }
}
