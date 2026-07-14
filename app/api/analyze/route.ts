import { NextRequest, after } from "next/server";
import { analyzeSchema, type Report } from "@/lib/schemas";
import { success, errors } from "@/lib/api-response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { scoreQuiz } from "@/lib/scoring";
import { generateReport } from "@/lib/anthropic";
import { getLeadById, updateLead, isAirtableConfigured } from "@/lib/airtable";
import { sendReportEmail, isResendConfigured } from "@/lib/resend";
import config from "@/config";

const RATE_LIMIT = { limit: 5, windowSeconds: 60 };

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    if (!checkRateLimit(`analyze:${ip}`, RATE_LIMIT).allowed) {
      return errors.tooManyRequests(config.ui.rateLimited);
    }

    const parsed = analyzeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || config.ui.genericError);
    }
    const { leadId, email, firstName, company, answers } = parsed.data;

    // Recompute the score server-side. Never trust a client number.
    const score = scoreQuiz(answers, config.quiz);

    // Idempotency: if this lead already has a report, return it. No LLM call, no email.
    if (isAirtableConfigured() && leadId) {
      const existing = await getLeadById(leadId);
      const stored = existing?.fields?.["Report"];
      if (typeof stored === "string" && stored.length > 0) {
        try {
          return success({ report: JSON.parse(stored) as Report, score, cached: true });
        } catch {
          // corrupt stored value -> fall through and regenerate
        }
      }
    }

    const report = await generateReport({ firstName, company, score, answers });

    // Persist the report + send the email once, non-blocking. Real leads only.
    if (isAirtableConfigured() && leadId) {
      after(async () => {
        try {
          const lead = await getLeadById(leadId);
          const alreadyEmailed = Boolean(lead?.fields?.["Report Emailed At"]);
          const update: Record<string, unknown> = {
            Report: JSON.stringify(report),
            "Report Generated At": new Date().toISOString(),
          };
          if (isResendConfigured() && !alreadyEmailed) {
            const res = await sendReportEmail({ to: email, firstName, report, score });
            if (res.emailed) update["Report Emailed At"] = new Date().toISOString();
            else console.error(`[analyze] report email failed (${email}):`, res.reason);
          }
          await updateLead(leadId, update);
        } catch (e) {
          console.error("[analyze] persist/email failed:", e instanceof Error ? e.message : e);
        }
      });
    }

    return success({ report, score });
  } catch (err) {
    console.error("[/api/analyze] error:", err instanceof Error ? err.message : err);
    return errors.internal(config.ui.genericError);
  }
}
