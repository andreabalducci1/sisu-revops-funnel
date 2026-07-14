/**
 * Resend — sends the personalized maturity report by email.
 *
 * If RESEND_API_KEY / RESEND_FROM_EMAIL are not set, isResendConfigured()
 * returns false and sending is skipped (demo mode). Add the keys in .env to
 * go live. No em-dashes in the email body.
 */

import config from "@/config";
import type { Report } from "@/lib/schemas";
import type { ScoreResult } from "@/lib/scoring";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

export function isResendConfigured(): boolean {
  return Boolean(RESEND_API_KEY && RESEND_FROM_EMAIL);
}

function reportEmailHtml(report: Report, score: ScoreResult, firstName?: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const bookUrl = `${siteUrl}/book`;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const priorities = report.priorities
    .map((p) => `<li style="margin-bottom:8px;">${p}</li>`)
    .join("");
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1c1c;background:#f4f1ec;padding:32px 24px;">
    <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#5a88b8;margin:0 0 8px;">RevOps maturity report</p>
    <h1 style="font-size:26px;margin:0 0 4px;color:#1c1c1c;">${score.overall} / 100</h1>
    <p style="margin:0 0 20px;color:#474747;">${score.band}</p>
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 20px;line-height:1.6;">${report.summary}</p>
    <p style="font-weight:600;margin:0 0 8px;">Fix these first:</p>
    <ol style="margin:0 0 24px;padding-left:20px;line-height:1.5;">${priorities}</ol>
    <p style="margin:24px 0;">
      <a href="${bookUrl}"
         style="background:#1c1c1c;color:#f4f1ec;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:600;display:inline-block;">
        Book a call
      </a>
    </p>
    <p style="color:#474747;font-size:14px;margin-top:24px;">${report.nextStep}</p>
    <p style="color:#474747;font-size:13px;margin-top:24px;">${config.legal.companyName}</p>
  </div>`;
}

export async function sendReportEmail(input: {
  to: string;
  firstName?: string;
  report: Report;
  score: ScoreResult;
}): Promise<{ emailed: boolean; reason?: string }> {
  if (!isResendConfigured()) {
    return { emailed: false, reason: "resend_not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: input.to,
        subject: `Your RevOps maturity score: ${input.score.overall}/100`,
        html: reportEmailHtml(input.report, input.score, input.firstName),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { emailed: false, reason: `resend_error_${res.status}: ${text.slice(0, 120)}` };
    }
    return { emailed: true };
  } catch (err) {
    return { emailed: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
