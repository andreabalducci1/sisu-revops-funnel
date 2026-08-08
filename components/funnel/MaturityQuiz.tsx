"use client";

import { useState, useRef, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";
import config from "@/config";
import { track } from "@/lib/posthog-client";
import { FUNNEL_EVENTS } from "@/lib/events";
import { scoreQuiz, type Answers } from "@/lib/scoring";
import type { LeakInputs } from "@/lib/leak";
import { RESPONSE_BUCKETS } from "@/lib/benchmarks";

type Step = "intro" | "cohort" | "answering" | "numbers" | "analyzing";

/**
 * Just the fields this component reads off a config.quiz.questions entry.
 * config.ts's own questions array is a big `as const` literal union (each
 * question a distinct literal type, `rationale` present on some and absent
 * on others), so indexing it with a variable index produces a union that
 * only exposes properties common to every member. Widening to this local,
 * read-only shape lets `current.rationale` compile for every question
 * without loosening config.ts's own exported types.
 */
interface QuestionView {
  readonly id: string;
  readonly prompt: string;
  readonly rationale?: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
}

/** questionId -> raw form string, one per config.quiz.numbers.fields entry. */
type NumbersForm = Record<string, string>;

/** Stash key for /report. Bumped from v1 to v2 with this redesign: a stale v1
 * stash left over from a returning visitor's earlier session must never be
 * read as a v2 payload, so this key never reuses the old one. */
const STASH_KEY = "sisu_report_v2";

const inputStyle: CSSProperties = {
  padding: "0.85rem 1.1rem",
  borderRadius: "var(--radius)",
  border: "1.5px solid var(--color-line)",
  background: "var(--color-bg)",
  fontSize: "1rem",
  color: "var(--color-ink)",
  outline: "none",
  width: "100%",
};

const optionButtonStyle = (selected: boolean): CSSProperties => ({
  textAlign: "left",
  padding: "1rem 1.2rem",
  cursor: "pointer",
  borderRadius: "var(--radius)",
  border: selected ? "1.5px solid var(--color-ink)" : "1px solid var(--color-line)",
  background: selected ? "var(--color-bg-soft)" : "var(--color-surface)",
  fontSize: "1rem",
  color: "var(--color-ink)",
  display: "flex",
  alignItems: "center",
  gap: "0.8rem",
  transition: "border 0.15s ease, background 0.15s ease",
});

const backButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: "0.85rem",
};

/** Reads a numeric field out of the raw form strings, dropping anything
 * blank or unparsable so an empty input never becomes a stray 0 or NaN in
 * the payload. lib/leak.ts already treats missing keys as "the visitor did
 * not answer", which is exactly what an empty input means. */
function readNumber(form: NumbersForm, id: string): number | undefined {
  const raw = form[id];
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Builds the optional numbers payload from the five form fields. An unfilled
 * select (responseBucket) or a blank number input is omitted entirely rather
 * than sent as "" or 0: lib/leak.ts and lib/contradictions.ts both treat an
 * absent key as "not answered", but an empty string would read as a real,
 * slow answer. Returns undefined when nothing was filled in, so the numbers
 * key is left out of the request body altogether.
 */
function buildNumbersPayload(form: NumbersForm): LeakInputs | undefined {
  const payload: LeakInputs = {};
  let hasAny = false;

  const acv = readNumber(form, "acv");
  if (acv !== undefined) {
    payload.acv = acv;
    hasAny = true;
  }
  const winRate = readNumber(form, "winRate");
  if (winRate !== undefined) {
    payload.winRate = winRate;
    hasAny = true;
  }
  const inboundPerMonth = readNumber(form, "inboundPerMonth");
  if (inboundPerMonth !== undefined) {
    payload.inboundPerMonth = inboundPerMonth;
    hasAny = true;
  }
  const headcount = readNumber(form, "headcount");
  if (headcount !== undefined) {
    payload.headcount = headcount;
    hasAny = true;
  }
  const responseBucket = form.responseBucket;
  if (responseBucket) {
    payload.responseBucket = responseBucket;
    hasAny = true;
  }

  return hasAny ? payload : undefined;
}

/**
 * The maturity quiz: intro -> calibration (cohort) -> 12 questions -> optional
 * numbers -> analyzing -> /report. There is no email gate and no teaser: a
 * visitor reaches their full results without identifying themselves. Email
 * capture, when it happens at all, now lives on the results page.
 */
export function MaturityQuiz() {
  const { landing, quiz } = config;
  const router = useRouter();

  const [step, setStep] = useState<Step>("intro");
  const [cohortIndex, setCohortIndex] = useState(0);
  const [cohort, setCohort] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [numbersForm, setNumbersForm] = useState<NumbersForm>({});

  // Fire-once guards. React StrictMode double-invokes effects (and a fast
  // double click can double-fire a handler); each event this component sends
  // to PostHog gets its own ref so it is never counted twice.
  const startedRef = useRef(false);
  const calibrationCompleteRef = useRef(false);
  const quizCompleteRef = useRef(false);
  const numbersResolvedRef = useRef(false);

  // Set only when /api/analyze fails (network error, non-2xx, or an ok:false
  // body). Rendered on the numbers step so the visitor's answers are never
  // lost and they can just retry, instead of being routed to /report as if
  // the call had actually succeeded.
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const cohortQuestions = quiz.cohort;
  const currentCohort = cohortQuestions[cohortIndex];

  const questions: readonly QuestionView[] = quiz.questions;
  const total = questions.length;
  const current = questions[index];

  function startQuiz() {
    if (!startedRef.current) {
      startedRef.current = true;
      track(FUNNEL_EVENTS.QUIZ_START);
    }
    setStep("cohort");
    setCohortIndex(0);
  }

  function chooseCohort(optionId: string) {
    const nextCohort = { ...cohort, [currentCohort.id]: optionId };
    setCohort(nextCohort);
    if (cohortIndex + 1 < cohortQuestions.length) {
      setCohortIndex(cohortIndex + 1);
      return;
    }
    if (!calibrationCompleteRef.current) {
      calibrationCompleteRef.current = true;
      track(FUNNEL_EVENTS.CALIBRATION_COMPLETE, { cohort: nextCohort });
    }
    setStep("answering");
    setIndex(0);
  }

  function choose(optionId: string) {
    const finalAnswers = { ...answers, [current.id]: optionId };
    setAnswers(finalAnswers);
    if (index + 1 < total) {
      setIndex(index + 1);
      return;
    }
    if (!quizCompleteRef.current) {
      quizCompleteRef.current = true;
      const s = scoreQuiz(finalAnswers, quiz);
      track(FUNNEL_EVENTS.QUIZ_COMPLETE, { score: s.overall, band: s.band });
    }
    setStep("numbers");
  }

  function back() {
    if (step === "cohort") {
      if (cohortIndex > 0) {
        setCohortIndex(cohortIndex - 1);
      } else {
        setStep("intro");
      }
      return;
    }
    if (step === "answering") {
      if (index > 0) {
        setIndex(index - 1);
      } else {
        setStep("cohort");
        setCohortIndex(cohortQuestions.length - 1);
      }
      return;
    }
    if (step === "numbers") {
      setStep("answering");
      setIndex(total - 1);
    }
  }

  /**
   * Calls /api/analyze and only ever navigates to /report on a genuine
   * success. A validation failure (400), a server error (500), or a network
   * exception must never look like a completed diagnosis: previously this
   * function pushed to /report unconditionally, so a rejected request (for
   * example the numbers-schema bug that used to reject a truthful 0) landed
   * the visitor on /report's empty state ("Your report has moved on"), which
   * reads as if their answers were lost. Now a failure keeps them on the
   * numbers step, with their answers and numbers form intact, and an inline
   * message so they can just retry.
   */
  async function runAnalysis(numbers: LeakInputs | undefined) {
    setStep("analyzing");
    setAnalysisError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, cohort, numbers }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.data?.report) {
        track(FUNNEL_EVENTS.ANALYSIS_ERROR);
        setAnalysisError(json?.error?.message || config.ui.genericError);
        setStep("numbers");
        return;
      }
      sessionStorage.setItem(
        STASH_KEY,
        JSON.stringify({
          report: json.data.report,
          score: json.data.score,
          leak: json.data.leak ?? null,
          contradictions: json.data.contradictions ?? [],
          fixes: json.data.fixes ?? [],
          cohort,
          firstName: undefined,
          // Raw inputs, not returned by /api/analyze itself. Kept so the
          // results page can regenerate and email a copy of this same
          // report later without asking the visitor to redo the quiz; see
          // ReportViewer's requestCopy.
          answers,
          numbers,
        })
      );
      router.push("/report");
    } catch {
      track(FUNNEL_EVENTS.ANALYSIS_ERROR);
      setAnalysisError(config.ui.networkError);
      setStep("numbers");
    }
  }

  function skipNumbers() {
    if (!numbersResolvedRef.current) {
      numbersResolvedRef.current = true;
      track(FUNNEL_EVENTS.NUMBERS_SKIPPED);
    }
    void runAnalysis(undefined);
  }

  function submitNumbers() {
    if (!numbersResolvedRef.current) {
      numbersResolvedRef.current = true;
      track(FUNNEL_EVENTS.NUMBERS_PROVIDED);
    }
    void runAnalysis(buildNumbersPayload(numbersForm));
  }

  // ── INTRO: two-column hero ──────────────────────────────
  if (step === "intro") {
    return (
      <section
        className="container-tight funnel-grid"
        style={{ minHeight: "100vh", paddingTop: "5rem", paddingBottom: "5rem" }}
      >
        <div>
          <span className="eyebrow reveal reveal-1">{landing.eyebrow}</span>

          <h1
            className="reveal reveal-2"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.9rem)", margin: "1.2rem 0 1.1rem" }}
          >
            {landing.headline}
            <br />
            <span className="headline-counter">{landing.headlineItalic}</span>
          </h1>

          <p
            className="reveal reveal-2"
            style={{ fontSize: "1.15rem", color: "var(--color-ink-soft)", maxWidth: "42ch", marginBottom: "2rem" }}
          >
            {landing.subhead}
          </p>

          <ul
            className="reveal reveal-3"
            style={{ listStyle: "none", padding: 0, margin: "0 0 2.4rem", display: "grid", gap: "0.7rem" }}
          >
            {landing.bullets.map((b) => (
              <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem" }}>
                <span
                  aria-hidden
                  style={{ flexShrink: 0, marginTop: 4, width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--color-accent)", display: "grid", placeItems: "center" }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)" }} />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="reveal reveal-3">
            <button type="button" className="btn-primary" onClick={startQuiz} style={{ fontSize: "1.02rem" }}>
              {quiz.intro.startCta}
              <ArrowRight size={18} />
            </button>
            <p style={{ marginTop: "0.9rem", fontSize: "0.85rem", color: "var(--color-ink-soft)" }}>
              {quiz.intro.note}
            </p>
          </div>
        </div>

        <aside className="reveal reveal-4" style={{ alignSelf: "stretch", display: "flex", alignItems: "center" }}>
          <div className="surface-card" style={{ padding: "2.2rem", width: "100%" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-eyebrow)" }}>
              {landing.previewCard.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginTop: "0.8rem" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "4.2rem", lineHeight: 1, color: "var(--color-ink)" }}>
                {landing.previewCard.score}
              </span>
              <span style={{ fontSize: "1.1rem", color: "var(--color-ink-soft)" }}>{landing.previewCard.scoreUnit}</span>
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", marginTop: "0.4rem" }}>
              {landing.previewCard.title}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "1.4rem 0 0", display: "grid", gap: "0.7rem" }}>
              {landing.previewCard.lines.map((line) => (
                <li key={line} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", fontSize: "0.95rem", color: "var(--color-ink-soft)" }}>
                  <span aria-hidden style={{ flexShrink: 0, marginTop: 8, width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent)" }} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    );
  }

  // ── COHORT: two calibration selects, one at a time ──────
  if (step === "cohort") {
    return (
      <section
        className="container-tight"
        style={{ maxWidth: "44rem", minHeight: "100vh", display: "grid", placeItems: "center", paddingTop: "4rem", paddingBottom: "4rem" }}
      >
        <div style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
            <span className="eyebrow">
              {quiz.calibration.eyebrow} {cohortIndex + 1} of {cohortQuestions.length}
            </span>
            <button type="button" onClick={back} className="link-underline" style={backButtonStyle}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>

          <div style={{ height: 4, background: "var(--color-line)", borderRadius: 999, overflow: "hidden", marginBottom: "2rem" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.round((cohortIndex / cohortQuestions.length) * 100)}%`,
                background: "var(--color-accent)",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <h2 key={currentCohort.id} className="reveal reveal-1" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.3rem)", marginBottom: "1.6rem" }}>
            {currentCohort.label}
          </h2>

          <div style={{ display: "grid", gap: "0.7rem" }}>
            {currentCohort.options.map((opt) => {
              const selected = cohort[currentCohort.id] === opt.id;
              return (
                <button key={opt.id} type="button" onClick={() => chooseCohort(opt.id)} style={optionButtonStyle(selected)}>
                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--color-accent)", display: "grid", placeItems: "center" }}>
                    {selected && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--color-accent)" }} />}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // ── ANSWERING: question stepper ─────────────────────────
  if (step === "answering") {
    const progress = Math.round((index / total) * 100);
    return (
      <section
        className="container-tight"
        style={{ maxWidth: "44rem", minHeight: "100vh", display: "grid", placeItems: "center", paddingTop: "4rem", paddingBottom: "4rem" }}
      >
        <div style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
            <span className="eyebrow">Question {index + 1} of {total}</span>
            <button type="button" onClick={back} className="link-underline" style={backButtonStyle}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>

          <div style={{ height: 4, background: "var(--color-line)", borderRadius: 999, overflow: "hidden", marginBottom: "2rem" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "var(--color-accent)", transition: "width 0.3s ease" }} />
          </div>

          <h2 key={current.id} className="reveal reveal-1" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.3rem)", marginBottom: current.rationale ? "0.6rem" : "1.6rem" }}>
            {current.prompt}
          </h2>

          {current.rationale && (
            <p style={{ color: "var(--color-ink-soft)", fontSize: "0.95rem", marginBottom: "1.6rem" }}>{current.rationale}</p>
          )}

          <div style={{ display: "grid", gap: "0.7rem" }}>
            {current.options.map((opt) => {
              const selected = answers[current.id] === opt.id;
              return (
                <button key={opt.id} type="button" onClick={() => choose(opt.id)} style={optionButtonStyle(selected)}>
                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--color-accent)", display: "grid", placeItems: "center" }}>
                    {selected && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--color-accent)" }} />}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // ── NUMBERS: optional, skippable, five fields ───────────
  if (step === "numbers") {
    return (
      <section
        className="container-tight"
        style={{ maxWidth: "44rem", minHeight: "100vh", display: "grid", placeItems: "center", paddingTop: "4rem", paddingBottom: "4rem" }}
      >
        <div style={{ width: "100%" }} className="reveal reveal-1">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
            <span className="eyebrow">{quiz.numbers.eyebrow}</span>
            <button type="button" onClick={back} className="link-underline" style={backButtonStyle}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>

          <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.1rem)", marginBottom: "0.6rem" }}>{quiz.numbers.title}</h2>
          <p style={{ color: "var(--color-ink-soft)", fontSize: "1rem", marginBottom: "2rem", maxWidth: "48ch" }}>{quiz.numbers.note}</p>

          <div className="surface-card" style={{ padding: "1.8rem", display: "grid", gap: "1.1rem" }}>
            {quiz.numbers.fields.map((field) => (
              <label key={field.id} style={{ display: "grid", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--color-ink-soft)" }}>
                  {field.label}
                  {field.unit ? ` (${field.unit})` : ""}
                </span>
                {field.type === "select" ? (
                  <select
                    value={numbersForm[field.id] ?? ""}
                    onChange={(e) => setNumbersForm({ ...numbersForm, [field.id]: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">{field.placeholder}</option>
                    {RESPONSE_BUCKETS.map((bucket) => (
                      <option key={bucket.id} value={bucket.id}>
                        {bucket.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={0}
                    value={numbersForm[field.id] ?? ""}
                    onChange={(e) => setNumbersForm({ ...numbersForm, [field.id]: e.target.value })}
                    style={inputStyle}
                  />
                )}
              </label>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.8rem", marginTop: "1.6rem", flexWrap: "wrap" }}>
            <button type="button" className="btn-primary" onClick={submitNumbers}>
              {quiz.numbers.submitCta}
              <ArrowRight size={18} />
            </button>
            <button type="button" className="btn-outline" onClick={skipNumbers}>
              {quiz.numbers.skipCta}
            </button>
          </div>

          {analysisError && (
            <p style={{ color: "#b91c1c", fontSize: "0.9rem", marginTop: "1rem" }}>
              {analysisError} Your answers are still here, so you can just try again.
            </p>
          )}
        </div>
      </section>
    );
  }

  // ── ANALYZING: brief wait while the report generates ──
  return (
    <section
      className="container-tight"
      style={{ maxWidth: "44rem", minHeight: "100vh", display: "grid", placeItems: "center", paddingTop: "4rem", paddingBottom: "4rem" }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          aria-hidden
          style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid var(--color-line)", borderTopColor: "var(--color-accent)", margin: "0 auto 1.4rem", animation: "spin 0.8s linear infinite" }}
        />
        <h2 style={{ fontSize: "1.6rem", marginBottom: "0.5rem" }}>Reading your answers</h2>
        <p style={{ color: "var(--color-ink-soft)" }}>
          Writing your personalized report. This takes a few seconds.
        </p>
      </div>
    </section>
  );
}
