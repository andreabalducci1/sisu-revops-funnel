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
  ...utmFields,
});

export type OptinInput = z.infer<typeof optinSchema>;

/** Request body for /api/analyze. Answers are required (we recompute the score). */
export const analyzeSchema = z.object({
  leadId: z.string().max(60).optional(),
  email: emailField,
  firstName: z.string().max(50).optional(),
  company: z.string().max(100).optional(),
  answers: z.record(z.string(), z.string()),
});

export type AnalyzeInput = z.infer<typeof analyzeSchema>;

/** Shape of the AI-generated maturity report (also the structured-output schema). */
export const reportSchema = z.object({
  summary: z.string(),
  dimensions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      verdict: z.string(),
      recommendation: z.string(),
    })
  ),
  priorities: z.array(z.string()),
  nextStep: z.string(),
});

export type Report = z.infer<typeof reportSchema>;
