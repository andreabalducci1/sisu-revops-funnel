import { NextRequest, after } from "next/server";
import { analyzeSchema, type Report } from "@/lib/schemas";
import { success, errors } from "@/lib/api-response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { scoreQuiz } from "@/lib/scoring";
import { computeLeak, type LeakResult } from "@/lib/leak";
import { detectContradictions, type Contradiction } from "@/lib/contradictions";
import { rankFixes, type RankedFix } from "@/lib/fixes";
import { generateReport } from "@/lib/anthropic";
import { getLeadById, updateLead, isAirtableConfigured } from "@/lib/airtable";
import { sendReportEmail, isResendConfigured } from "@/lib/resend";
import config from "@/config";

const RATE_LIMIT = { limit: 5, windowSeconds: 60 };

/** Stable key for a set of answers, independent of property order. */
function answersKey(answers: Record<string, string>): string {
  return Object.keys(answers)
    .sort()
    .map((id) => `${id}=${answers[id]}`)
    .join("&");
}

/**
 * Stored report payloads carry the answers that produced them. Rows written
 * before that hold a bare Report, so their answers are unknown and the report
 * has to be regenerated once before it can be trusted again. A stored report
 * whose version is not 2 (pre-redesign shape) is treated the same way: it
 * cannot be rendered by the current viewer, so it is discarded rather than
 * handed back as if it were still valid.
 */
function parseStoredReport(raw: string): { report: Report; answersKey?: string } | null {
  try {
    const value = JSON.parse(raw);
    const envelope =
      value && typeof value === "object" && "report" in value
        ? (value as { report: Report; answersKey?: string })
        : { report: value as Report };
    if (!envelope.report || envelope.report.version !== 2) return null;
    return envelope;
  } catch {
    return null;
  }
}

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
    const { leadId, email, firstName, company, answers, cohort, numbers } = parsed.data;

    // Recompute the score server-side. Never trust a client number.
    const score = scoreQuiz(answers, config.quiz);

    // Leak, contradictions and fixes are pure, cheap and deterministic:
    // compute them here, from the server-recomputed score, BEFORE the
    // idempotency check below, so the cached path returns them too instead of
    // storing (and risking staleness against) a copy in Airtable.
    const automationScore = score.dimensions.find((d) => d.id === "automation")?.score ?? 0;
    const leak: LeakResult | null = computeLeak(numbers ?? {}, automationScore);
    const contradictions: Contradiction[] = detectContradictions(answers, numbers);
    const fixes: RankedFix[] = rankFixes(score, config.quiz.dimensions);

    // Idempotency: reuse the stored report only when the same answers produced
    // it. Returning any cached report next to a freshly recomputed score made a
    // retake render this run's numbers with the previous run's narrative.
    const key = answersKey(answers);
    if (isAirtableConfigured() && leadId) {
      const existing = await getLeadById(leadId);
      const stored = existing?.fields?.["Report"];
      if (typeof stored === "string" && stored.length > 0) {
        const cachedEntry = parseStoredReport(stored);
        if (cachedEntry && cachedEntry.answersKey === key) {
          return success({
            report: cachedEntry.report,
            score,
            leak,
            contradictions,
            fixes,
            cached: true,
          });
        }
      }
    }

    const report = await generateReport({ firstName, company, cohort, score, answers, numbers });

    // Persist the report + send the email once, non-blocking. Real leads only.
    if (isAirtableConfigured() && leadId) {
      after(async () => {
        try {
          const lead = await getLeadById(leadId);
          const alreadyEmailed = Boolean(lead?.fields?.["Report Emailed At"]);
          const update: Record<string, unknown> = {
            Report: JSON.stringify({ report, answersKey: key }),
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

    return success({ report, score, leak, contradictions, fixes, cached: false });
  } catch (err) {
    console.error("[/api/analyze] error:", err instanceof Error ? err.message : err);
    return errors.internal(config.ui.genericError);
  }
}
