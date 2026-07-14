/**
 * Anthropic (Claude) — writes the qualitative maturity report.
 *
 * Uses the official SDK (per Anthropic's own guidance) with structured outputs
 * (output_config.format = json_schema) so the model returns valid JSON, which
 * we then validate with the Zod v3 reportSchema. The deterministic score is
 * computed elsewhere (lib/scoring); this only writes the narrative.
 *
 * Demo mode: if ANTHROPIC_API_KEY is missing, generateReport() returns a
 * plausible canned report so the whole funnel renders without a key. Any API
 * error or invalid output also degrades to the canned report (never break).
 *
 * No em-dashes: instructed in the system prompt AND stripped in post-process.
 */

import Anthropic from "@anthropic-ai/sdk";
import config from "@/config";
import { reportSchema, type Report } from "@/lib/schemas";
import type { ScoreResult, Answers } from "@/lib/scoring";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Sonnet-class is the approved default: quality report, cost-sensitive public endpoint.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export function isAnthropicConfigured(): boolean {
  return Boolean(ANTHROPIC_API_KEY);
}

// JSON Schema for structured output. Matches reportSchema. Structured outputs
// require additionalProperties:false and every property listed in required.
const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    dimensions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          verdict: { type: "string" },
          recommendation: { type: "string" },
        },
        required: ["id", "label", "verdict", "recommendation"],
      },
    },
    priorities: { type: "array", items: { type: "string" } },
    nextStep: { type: "string" },
  },
  required: ["summary", "dimensions", "priorities", "nextStep"],
};

const SYSTEM_PROMPT = `You are a senior RevOps engineer writing a short, candid maturity report for a prospect who just finished a five-question self-assessment of their revenue operations.

Write in plain, direct English at an 8th-grade reading level. Be specific and honest, not flattering. No fluff, no hype. Never use the words supercharge, unleash, game-changer, leverage, synergy, or 10x. Never use em-dashes or en-dashes; use commas, colons, or a single hyphen.

You receive an overall score (0-100), a band, per-dimension scores, and the prospect's answers. Produce:
- summary: 2 to 3 sentences on where they stand overall, band-aware and honest.
- dimensions: one entry per dimension. Keep the exact id and label you are given. Add a one-line verdict and one concrete recommendation.
- priorities: the three fixes that move the needle first, ordered most impactful first, drawn from the weakest dimensions.
- nextStep: one sentence bridging to a short call with a fractional RevOps engineer, without being pushy.

Address the reader as "you". Keep every field tight.`;

function buildUserPrompt(input: {
  firstName?: string;
  company?: string;
  score: ScoreResult;
  answers: Answers;
}): string {
  const who = `${input.firstName || "The prospect"}${input.company ? ` at ${input.company}` : ""}`;
  const dims = input.score.dimensions
    .map((d) => `- ${d.label} (id: ${d.id}): ${d.score}/100`)
    .join("\n");
  const qa = config.quiz.questions
    .map((q) => {
      const opt = q.options.find((o) => o.id === input.answers[q.id]);
      return `- ${q.prompt} -> ${opt ? opt.label : "no answer"}`;
    })
    .join("\n");
  return `${who}\nOverall score: ${input.score.overall}/100 (${input.score.band})\n\nDimension scores:\n${dims}\n\nAnswers:\n${qa}`;
}

/** Belt-and-suspenders: strip any em/en dash from every string in the report. */
function stripDashes(report: Report): Report {
  const fix = (s: string) => s.replace(/[–—]/g, "-");
  return {
    summary: fix(report.summary),
    dimensions: report.dimensions.map((d) => ({
      id: d.id,
      label: d.label,
      verdict: fix(d.verdict),
      recommendation: fix(d.recommendation),
    })),
    priorities: report.priorities.map(fix),
    nextStep: fix(report.nextStep),
  };
}

function verdictFor(score: number): string {
  if (score < 40) return "A weak spot that is likely costing you pipeline.";
  if (score < 70) return "Partly there, but real gaps remain.";
  if (score < 90) return "Solid, with room to tighten.";
  return "A genuine strength.";
}

const CANNED_RECS: Record<string, string> = {
  data: "Pick one source of truth and give it a weekly owner to keep it clean.",
  pipeline: "Write exit criteria for each stage and hold the team to them.",
  automation: "Automate the two handoffs that break most often, then document them.",
  reporting: "Stand up one dashboard that ties revenue back to its source.",
  stack: "Cut one tool nobody adopts and integrate what is left.",
};

/** A plausible, score-shaped report for demo mode and error fallback. */
export function cannedReport(score: ScoreResult, firstName?: string): Report {
  const lead = firstName ? `${firstName}, ` : "";
  const weakest = [...score.dimensions].sort((a, b) => a.score - b.score).slice(0, 3);
  return {
    summary: `${lead}your RevOps setup scores ${score.overall} out of 100 (${score.band}). ${score.bandTeaser}`,
    dimensions: score.dimensions.map((d) => ({
      id: d.id,
      label: d.label,
      verdict: verdictFor(d.score),
      recommendation: CANNED_RECS[d.id] || "Tighten this before you scale spend.",
    })),
    priorities: weakest.map(
      (d) => `${d.label}: ${CANNED_RECS[d.id] || "fix this first."}`
    ),
    nextStep:
      "If you want a hand turning this into a plan, book a short call and we will map the fastest wins for your setup.",
  };
}

export async function generateReport(input: {
  firstName?: string;
  company?: string;
  score: ScoreResult;
  answers: Answers;
}): Promise<Report> {
  if (!isAnthropicConfigured()) {
    return cannedReport(input.score, input.firstName);
  }

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: config.quiz.report.maxTokens,
      thinking: { type: "disabled" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
      output_config: {
        format: { type: "json_schema", schema: REPORT_JSON_SCHEMA },
      },
    });

    let raw = "";
    for (const block of response.content) {
      if (block.type === "text") raw += block.text;
    }

    const parsed = reportSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return cannedReport(input.score, input.firstName);
    return stripDashes(parsed.data);
  } catch (err) {
    console.error("[anthropic] generateReport failed:", err instanceof Error ? err.message : err);
    return cannedReport(input.score, input.firstName);
  }
}
