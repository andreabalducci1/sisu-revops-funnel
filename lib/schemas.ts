import { z } from "zod";
import config from "@/config";

/** Email réutilisable : blocklist jetables, format strict, lowercase. */
const emailField = z
  .string()
  .email(config.ui.emailInvalid)
  .max(255)
  .regex(
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    config.ui.emailInvalid
  )
  .refine(
    (email) => {
      const domain = email.split("@")[1];
      if (!domain) return false;
      const disposable = [
        "yopmail.com",
        "tempmail.com",
        "guerrillamail.com",
        "mailinator.com",
        "throwaway.email",
      ];
      return !disposable.includes(domain.toLowerCase());
    },
    { message: config.ui.emailDisposable }
  )
  .transform((v) => v.trim().toLowerCase());

const utmFields = {
  utmSource: z.string().max(255).optional(),
  utmMedium: z.string().max(255).optional(),
  utmCampaign: z.string().max(255).optional(),
};

/**
 * Optional numbers block for the euro leak model (lib/leak.ts). Every field
 * is individually optional: a visitor can skip the whole block and still get
 * the full diagnosis, or fill in only some of it.
 *
 * This schema is deliberately permissive: it only enforces "a real number,
 * not negative" (nonnegative, so 0 is accepted; a truthful "0 leads this
 * month" answer must never fail validation and take the whole request down
 * with it). It does NOT enforce an upper bound. Implausibility ceilings
 * (MAX_WIN_RATE_PERCENT, MAX_ACV_EUR, MAX_INBOUND_PER_MONTH, MAX_HEADCOUNT)
 * live only in lib/leak.ts's plausible(), which omits the dependent line for
 * an out-of-range value instead of rejecting the request. Rejecting here
 * would make that graceful downstream path unreachable: the whole diagnosis
 * would 400 over one implausible field instead of just dropping that field's
 * euro line.
 */
export const numbersSchema = z.object({
  acv: z.number().nonnegative().optional(),
  winRate: z.number().nonnegative().optional(),
  inboundPerMonth: z.number().nonnegative().optional(),
  responseBucket: z.string().optional(),
  headcount: z.number().nonnegative().optional(),
});

export type NumbersInput = z.infer<typeof numbersSchema>;

/** Opt-in schema (funnel step 1). Email + optional first name + UTM. */
export const optinSchema = z.object({
  email: emailField,
  firstName: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "First name contains invalid characters")
    .trim()
    .optional(),
  company: z.string().max(100).trim().optional(),
  answers: z.record(z.string(), z.string()).optional(),
  /** Cohort question id -> chosen option id (config.quiz.cohort). */
  cohort: z.record(z.string(), z.string()).optional(),
  numbers: numbersSchema.optional(),
  ...utmFields,
});

export type OptinInput = z.infer<typeof optinSchema>;

/**
 * Request body for /api/analyze. Answers are required (we recompute the
 * score). leadId and email are both optional: the email gate is gone, so a
 * visitor gets the full diagnosis without identifying themselves. email
 * stays validated (format, disposable-domain blocklist) when it IS present,
 * for the optional capture that now lives on the results page.
 */
export const analyzeSchema = z.object({
  leadId: z.string().max(60).optional(),
  email: emailField.optional(),
  firstName: z.string().max(50).optional(),
  company: z.string().max(100).optional(),
  answers: z.record(z.string(), z.string()),
  cohort: z.record(z.string(), z.string()).optional(),
  numbers: numbersSchema.optional(),
});

export type AnalyzeInput = z.infer<typeof analyzeSchema>;

/**
 * Shape of the AI-generated maturity report (v2; also the structured-output
 * schema). `version` is a discriminant literal: a later task rejects any
 * stored report lacking it, so a report cached under the old (v1) shape
 * regenerates instead of crashing the viewer.
 *
 * The model only ever writes prose into this shape. Every fact it carries
 * (which dimension, which contradiction, which fix and in what order) is
 * decided by a deterministic module (lib/scoring.ts, lib/contradictions.ts,
 * lib/fixes.ts) before the model ever sees it; see lib/anthropic.ts.
 */
export const reportSchema = z.object({
  version: z.literal(2),
  /** One or two sentences restating the visitor's inputs before concluding
   * anything, so they can catch a wrong entry. */
  readback: z.string(),
  headline: z.string(),
  findings: z.array(
    z.object({
      dimension: z.string(),
      label: z.string(),
      /** The mechanism: what is actually happening, echoing their own answer. */
      whatsHappening: z.string(),
      /** The consequence, loss-framed. */
      whatItsCosting: z.string(),
      /** Which OTHER dimension this one quietly ceilings. */
      quietlyCapping: z.string(),
    })
  ),
  /** Copied from lib/contradictions.ts's output. The model never invents or
   * rewrites one of these; see lib/anthropic.ts's SYSTEM prompt. */
  contradictions: z.array(
    z.object({ claimA: z.string(), claimB: z.string(), whyItMatters: z.string() })
  ),
  /** Order and whyThisPosition are copied from lib/fixes.ts's ranking; only
   * firstStep is the model's own prose. */
  fixes: z.array(
    z.object({
      order: z.number(),
      title: z.string(),
      whyThisPosition: z.string(),
      firstStep: z.string(),
    })
  ),
  /** Plainly states this is self-reported and triage-level, not validated evidence. */
  limits: z.string(),
  nextStep: z.string(),
});

export type Report = z.infer<typeof reportSchema>;
