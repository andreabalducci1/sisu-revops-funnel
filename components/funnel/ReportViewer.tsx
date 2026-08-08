"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Printer } from "lucide-react";
import config from "@/config";
import { track } from "@/lib/posthog-client";
import { FUNNEL_EVENTS } from "@/lib/events";
import type { Report } from "@/lib/schemas";
import type { Answers, ScoreResult } from "@/lib/scoring";
import type { LeakInputs, LeakResult } from "@/lib/leak";
import { CalEmbed } from "@/components/funnel/CalEmbed";
import { useLeadCapture } from "@/components/funnel/useLeadCapture";

/**
 * Bumped from v1 to v2 with the quiz redesign (see MaturityQuiz.tsx, which
 * writes this stash). A payload written under the old "sisu_report_v1" key
 * is simply never read again: this file only ever looks at this key, and
 * even a value found under it is still checked with isV2() below before
 * it is trusted.
 */
const STASH_KEY = "sisu_report_v2";

interface Stashed {
  report: Report;
  score: ScoreResult;
  /**
   * Present on the sessionStorage fast path (written by MaturityQuiz right
   * after /api/analyze). Absent, not null, on the /api/report fallback: that
   * route only stores and returns { report, score }, so a hard refresh in a
   * new tab shows the full narrative report without the euro block. That is
   * a graceful degradation, not a bug: no leak model means no money is
   * mentioned anywhere, which is the same rule this page applies whenever
   * the visitor never filled in the numbers block at all.
   */
  leak?: LeakResult | null;
  /** Cohort question id -> chosen option id (config.quiz.cohort). Same
   * fallback-path caveat as leak. */
  cohort?: Record<string, string>;
  firstName?: string;
  /**
   * Raw quiz answers and numbers-block input, present only on the
   * sessionStorage fast path (MaturityQuiz stashes them alongside the
   * generated report). Absent on the /api/report fallback, which never
   * stored them. requestCopy below uses these to email a copy of the report
   * through the existing /api/analyze pipeline; when absent, it skips
   * emailing rather than sending nothing useful.
   */
  answers?: Answers;
  numbers?: LeakInputs;
}

type State = "loading" | "ready" | "empty";

/**
 * True only when the parsed value is a Stashed payload whose report carries
 * the current (v2) shape. Anything else, including a stale v1 report a
 * returning visitor might still be holding, is rejected outright rather than
 * rendered: the v1 Report shape does not have the fields this page reads
 * (findings, contradictions, fixes, limits, nextStep), and rendering it
 * would crash the page instead of degrading to the empty state.
 */
function isV2(value: unknown): value is Stashed {
  if (!value || typeof value !== "object") return false;
  const report = (value as { report?: { version?: number } }).report;
  return report?.version === 2;
}

const eur = (n: number) => `EUR ${Math.round(n).toLocaleString("en-US")}`;

const inputStyle: CSSProperties = {
  padding: "0.75rem 1rem",
  borderRadius: "var(--radius)",
  border: "1.5px solid var(--color-line)",
  background: "var(--color-bg)",
  fontSize: "0.95rem",
  color: "var(--color-ink)",
  outline: "none",
  width: "100%",
};

/**
 * Builds "Calibrated for B2B, 10 to 49 employees, outbound led." from the two
 * cohort answers (config.quiz.cohort). Returns null when the cohort is
 * missing (the /api/report fallback path never carries it) or an answer no
 * longer matches a known option, rather than rendering a broken half
 * sentence.
 */
function cohortLabel(cohort: Record<string, string> | undefined): string | null {
  if (!cohort) return null;
  const headcountQ = config.quiz.cohort.find((c) => c.id === "headcount");
  const motionQ = config.quiz.cohort.find((c) => c.id === "motion");
  const headcountOpt = headcountQ?.options.find((o) => o.id === cohort.headcount);
  const motionOpt = motionQ?.options.find((o) => o.id === cohort.motion);
  if (!headcountOpt || !motionOpt) return null;
  const motion = motionOpt.label.charAt(0).toLowerCase() + motionOpt.label.slice(1);
  return `Calibrated for B2B, ${headcountOpt.label} employees, ${motion}.`;
}

export function ReportViewer() {
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<Stashed | null>(null);

  // Fire-once guard: React StrictMode double-invokes effects in dev, which
  // would otherwise count the same view twice.
  const viewedRef = useRef(false);

  /**
   * RESULT_VIEW fires only when the report actually rendered with data, as
   * opposed to RESOURCE_VIEW, which PageView fires unconditionally on every
   * mount of app/report/page.tsx (including when the stash turns out to be
   * empty). RESULT_VIEW is the one FUNNEL_STEPS uses for the admin funnel.
   */
  function markViewed(score: ScoreResult) {
    if (viewedRef.current) return;
    viewedRef.current = true;
    track(FUNNEL_EVENTS.RESULT_VIEW, { score: score.overall, band: score.band });
  }

  useEffect(() => {
    // 1. sessionStorage fast path (the normal flow right after the quiz).
    try {
      const raw = sessionStorage.getItem(STASH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (isV2(parsed)) {
          setData(parsed);
          setState("ready");
          markViewed(parsed.score);
          return;
        }
      }
    } catch {
      /* ignore malformed stash, fall through to the fetch fallback below */
    }

    // 2. Fetch-by-cookie fallback (hard refresh / new tab). No client-side
    // cookie check here: /api/report reads the opt-in cookie server side and
    // 404s when it, or Airtable, is not configured, so there is nothing for
    // this component to gate on beforehand.
    fetch("/api/report")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && isV2(json.data)) {
          setData(json.data);
          setState("ready");
          markViewed(json.data.score);
        } else {
          setState("empty");
        }
      })
      .catch(() => setState("empty"));
  }, []);

  const { capture, loading: copyLoading, error: copyError } = useLeadCapture();
  const [copyEmail, setCopyEmail] = useState("");
  const [copySent, setCopySent] = useState(false);

  async function requestCopy(e: FormEvent) {
    e.preventDefault();
    if (!copyEmail) return;
    const email = copyEmail;

    // capture() fires LEAD_SIGNUP as the broader "we now have this email"
    // signal. COPY_REQUESTED is the finer-grained "they used the copy form
    // specifically" one, fired only once capture actually succeeds.
    const id = await capture({ email, firstName: data?.firstName, answers: data?.answers });
    if (!id) return;

    track(FUNNEL_EVENTS.COPY_REQUESTED);
    setCopySent(true);
    setCopyEmail("");

    // Actually send the copy. /api/analyze already does this correctly
    // (idempotent per lead via "Report Emailed At", gated behind
    // isResendConfigured, no-op without Airtable): calling it here with the
    // now-known leadId and email is the same request the initial quiz
    // completion would have made had an email already been on file. Only
    // the sessionStorage fast path carries the raw answers this needs; the
    // /api/report fallback (hard refresh, new tab) never has them, so there
    // is no report to send and this is skipped rather than sending nothing
    // useful.
    if (!data?.answers) return;
    try {
      await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: id,
          email,
          firstName: data.firstName,
          answers: data.answers,
          cohort: data.cohort,
          numbers: data.numbers,
        }),
      });
    } catch {
      // Best effort: the lead is already captured either way. If this
      // fails, the report is simply not emailed; nothing else in the funnel
      // depends on it.
    }
  }

  if (state === "loading") {
    return (
      <div className="surface-card" style={{ padding: "2.5rem", textAlign: "center", color: "var(--color-ink-soft)" }}>
        Loading your report...
      </div>
    );
  }

  if (state === "empty" || !data) {
    return (
      <div className="surface-card" style={{ padding: "2.5rem", textAlign: "center" }}>
        <p style={{ color: "var(--color-ink-soft)", marginBottom: "1.2rem" }}>
          Your report has moved on. Retake the check to see it again.
        </p>
        <a href="/" className="btn-primary" style={{ textDecoration: "none" }}>
          Retake the check
        </a>
      </div>
    );
  }

  const { report, score, leak } = data;
  const cohortText = cohortLabel(data.cohort);
  const maxDimScore =
    score.dimensions.length > 0 ? Math.max(...score.dimensions.map((d) => d.score)) : 0;

  return (
    <div style={{ display: "grid", gap: "1.6rem" }}>
      {/* 1-2. Cohort label, score, band, band teaser */}
      <div className="surface-card" style={{ padding: "2rem" }}>
        {cohortText && (
          <p style={{ color: "var(--color-ink-soft)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            {cohortText}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(3rem, 7vw, 4.5rem)", lineHeight: 1 }}>
            {score.overall}
          </span>
          <span style={{ fontSize: "1.3rem", color: "var(--color-ink-soft)" }}>/ 100</span>
          <span
            style={{
              marginLeft: "auto",
              alignSelf: "center",
              padding: "0.35rem 0.9rem",
              borderRadius: 999,
              background: "var(--color-bg-soft)",
              border: "1px solid var(--color-line)",
              fontSize: "0.85rem",
            }}
          >
            {score.band}
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: "var(--color-line)",
            borderRadius: 999,
            overflow: "hidden",
            margin: "1rem 0 1.4rem",
          }}
        >
          <div style={{ height: "100%", width: `${score.overall}%`, background: "var(--color-accent)" }} />
        </div>
        <p style={{ fontSize: "1.1rem", lineHeight: 1.6, margin: 0 }}>{score.bandTeaser}</p>
      </div>

      {/* 3. All six dimension bars, every one unlocked */}
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <h2 style={{ fontSize: "1.5rem" }}>By dimension</h2>
        {score.dimensions.map((d) => {
          // Scale to the largest dimension score, not the first dimension's
          // score: scaling by d[0] would render every bar at 0% width
          // whenever the first dimension happened to score 0.
          const width = maxDimScore > 0 ? Math.round((d.score / maxDimScore) * 100) : 0;
          return (
            <div key={d.id} className="surface-card" style={{ padding: "1.2rem 1.6rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontWeight: 500, flex: 1 }}>{d.label}</span>
                <div
                  style={{
                    width: "40%",
                    height: 6,
                    background: "var(--color-line)",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ height: "100%", width: `${width}%`, background: "var(--color-accent)" }} />
                </div>
                <span style={{ width: "2.6rem", textAlign: "right", fontSize: "0.9rem", color: "var(--color-ink-soft)" }}>
                  {d.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Euro block, only when a leak model was actually computed. Never
          fabricate or recompute a euro figure here: everything printed below
          is copied verbatim from `leak`. */}
      {leak && (
        <div className="surface-card print-keep" style={{ padding: "2rem" }}>
          <span className="eyebrow">Priced from your numbers</span>
          <h2 style={{ fontSize: "1.4rem", margin: "0.6rem 0 1.4rem" }}>What this is costing</h2>
          <div style={{ display: "grid", gap: "1.6rem" }}>
            {leak.lines.map((line) => (
              <div key={line.id}>
                <h3 style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>{line.label}</h3>
                <ul style={{ listStyle: "none", margin: "0 0 0.7rem", padding: 0, display: "grid", gap: "0.3rem" }}>
                  {line.workings.map((w, i) => (
                    <li key={i} style={{ fontSize: "0.92rem", color: "var(--color-ink-soft)" }}>
                      {w}
                    </li>
                  ))}
                </ul>
                <div style={{ display: "grid", gap: "0.3rem" }}>
                  {line.sources.map((s) => (
                    <p key={s.url} style={{ fontSize: "0.8rem", color: "var(--color-ink-soft)", margin: 0 }}>
                      Source: {s.source}, {s.year}.{" "}
                      <a href={s.url} className="link-underline" target="_blank" rel="noreferrer">
                        {s.url}
                      </a>
                      {s.caveat && (
                        <>
                          <br />
                          {s.caveat}
                        </>
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "1.6rem",
              paddingTop: "1.4rem",
              borderTop: "1px solid var(--color-line)",
              display: "grid",
              gap: "0.5rem",
            }}
          >
            <p style={{ margin: 0, color: "var(--color-ink-soft)", fontSize: "0.95rem" }}>
              Modelled bookings: {eur(leak.modelledBookings)}/yr
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.7rem", margin: 0 }}>
              {eur(leak.total)}/yr
              {leak.capped && (
                <span style={{ fontSize: "0.9rem", color: "var(--color-ink-soft)", marginLeft: "0.6rem" }}>
                  (capped for conservatism)
                </span>
              )}
            </p>
            <p style={{ margin: 0, color: "var(--color-ink-soft)", fontSize: "0.95rem" }}>
              Ratio to modelled bookings: {Math.round(leak.ratio * 100)}%
            </p>
            <p style={{ fontStyle: "italic", color: "var(--color-ink-soft)", fontSize: "0.9rem", margin: 0 }}>
              {leak.disclaimer}
            </p>
          </div>
        </div>
      )}

      {/* 5. Readback */}
      <div className="surface-card" style={{ padding: "1.8rem 2rem" }}>
        <p style={{ fontSize: "1.05rem", lineHeight: 1.6, margin: 0 }}>{report.readback}</p>
      </div>

      {/* 6. Findings: all three fields, every dimension */}
      <div style={{ display: "grid", gap: "1rem" }}>
        <h2 style={{ fontSize: "1.5rem" }}>What is actually happening</h2>
        {report.findings.map((f) => (
          <div key={f.dimension} className="surface-card print-keep" style={{ padding: "1.6rem 1.8rem" }}>
            <h3 style={{ fontSize: "1.15rem", marginBottom: "0.8rem" }}>{f.label}</h3>
            <p style={{ marginBottom: "0.6rem" }}>
              <span style={{ color: "var(--color-eyebrow)", fontWeight: 500 }}>What is happening: </span>
              {f.whatsHappening}
            </p>
            <p style={{ marginBottom: "0.6rem" }}>
              <span style={{ color: "var(--color-eyebrow)", fontWeight: 500 }}>What it is costing: </span>
              {f.whatItsCosting}
            </p>
            <p style={{ margin: 0 }}>
              <span style={{ color: "var(--color-eyebrow)", fontWeight: 500 }}>Quietly capping: </span>
              {f.quietlyCapping}
            </p>
          </div>
        ))}
      </div>

      {/* 7. Contradictions, when any */}
      {report.contradictions.length > 0 && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <h2 style={{ fontSize: "1.5rem" }}>Where your answers do not line up</h2>
          {report.contradictions.map((c, i) => (
            <div
              key={i}
              className="surface-card print-keep"
              style={{ padding: "1.6rem 1.8rem", borderLeft: "3px solid var(--color-eyebrow)" }}
            >
              <p style={{ marginBottom: "0.3rem" }}>{c.claimA}</p>
              <p style={{ marginBottom: "0.7rem", color: "var(--color-ink-soft)" }}>versus: {c.claimB}</p>
              <p style={{ margin: 0 }}>{c.whyItMatters}</p>
            </div>
          ))}
        </div>
      )}

      {/* 8. Fixes, in the order the report already ranked them */}
      <div className="surface-card" style={{ padding: "1.8rem 2rem" }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: "1.2rem" }}>Fix these first</h2>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "1.3rem" }}>
          {report.fixes.map((f) => (
            <li key={f.order} className="print-keep" style={{ display: "flex", alignItems: "flex-start", gap: "0.9rem" }}>
              <span
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--color-primary)",
                  color: "var(--color-bg)",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {f.order}
              </span>
              <div>
                <p style={{ fontWeight: 500, margin: "0 0 0.3rem" }}>{f.title}</p>
                <p style={{ color: "var(--color-ink-soft)", fontSize: "0.95rem", margin: "0 0 0.4rem" }}>
                  {f.whyThisPosition}
                </p>
                <p style={{ fontSize: "0.95rem", margin: 0 }}>
                  <span style={{ color: "var(--color-eyebrow)", fontWeight: 500 }}>First step: </span>
                  {f.firstStep}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* 9. Limits */}
      <p style={{ color: "var(--color-ink-soft)", fontSize: "0.95rem", fontStyle: "italic" }}>{report.limits}</p>

      {/* 10. Booking CTA, nextStep as the heading */}
      <div className="no-print" style={{ display: "grid", gap: "1.1rem" }}>
        <h2 style={{ fontSize: "1.4rem" }}>{report.nextStep}</h2>
        <CalEmbed />
      </div>

      {/* 11. Secondary: email me a copy. Never blocks the report above. */}
      <div className="no-print surface-card" style={{ padding: "1.4rem 1.6rem" }}>
        <form onSubmit={requestCopy} style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 220px", display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--color-ink-soft)" }}>Email me a copy</span>
            <input
              type="email"
              required
              value={copyEmail}
              onChange={(e) => setCopyEmail(e.target.value)}
              placeholder="you@company.com"
              style={inputStyle}
            />
          </label>
          <button
            type="submit"
            className="btn-outline"
            disabled={copyLoading}
            style={{ padding: "0.75rem 1.3rem", fontSize: "0.9rem" }}
          >
            {copyLoading ? config.ui.submitting : "Send copy"}
          </button>
        </form>
        {copySent && (
          <p style={{ color: "var(--color-accent)", fontSize: "0.85rem", marginTop: "0.6rem", marginBottom: 0 }}>
            Sent. Check your inbox.
          </p>
        )}
        {copyError && (
          <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: "0.6rem", marginBottom: 0 }}>{copyError}</p>
        )}
      </div>

      {/* 12. Print or save as PDF */}
      <div className="no-print" style={{ textAlign: "center" }}>
        <button type="button" className="btn-outline" onClick={() => window.print()}>
          <Printer size={16} />
          Print or save as PDF
        </button>
      </div>
    </div>
  );
}
