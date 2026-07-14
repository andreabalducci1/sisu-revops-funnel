"use client";

import { useState, useEffect, useRef, type FormEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Lock } from "lucide-react";
import config from "@/config";
import { track } from "@/lib/posthog-client";
import { FUNNEL_EVENTS } from "@/lib/events";
import { useLeadCapture } from "@/components/funnel/useLeadCapture";
import { scoreQuiz, type Answers, type ScoreResult } from "@/lib/scoring";

type Step = "intro" | "answering" | "teaser" | "analyzing";

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

/**
 * The maturity quiz: intro -> question stepper -> teaser (gate the reveal).
 * The score is deterministic (lib/scoring). The teaser reveals one dimension
 * free; unlocking captures the lead and sends them to /report.
 */
export function MaturityQuiz() {
  const { landing, quiz } = config;
  const router = useRouter();

  const [step, setStep] = useState<Step>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [company, setCompany] = useState("");
  const { capture, loading, error } = useLeadCapture();

  const startedRef = useRef(false);
  const teaserFiredRef = useRef(false);

  const questions = quiz.questions;
  const total = questions.length;
  const current = questions[index];

  useEffect(() => {
    if (step === "teaser" && !teaserFiredRef.current) {
      teaserFiredRef.current = true;
      const s = scoreQuiz(answers, quiz);
      track(FUNNEL_EVENTS.ANALYSIS_TEASER, { score: s.overall, band: s.band });
    }
  }, [step, answers, quiz]);

  function startQuiz() {
    if (!startedRef.current) {
      track(FUNNEL_EVENTS.QUIZ_START);
      startedRef.current = true;
    }
    setStep("answering");
    setIndex(0);
  }

  function choose(optionId: string) {
    const finalAnswers = { ...answers, [current.id]: optionId };
    setAnswers(finalAnswers);
    if (index + 1 < total) {
      setIndex(index + 1);
    } else {
      const s = scoreQuiz(finalAnswers, quiz);
      track(FUNNEL_EVENTS.QUIZ_COMPLETE, { score: s.overall, band: s.band });
      setStep("teaser");
    }
  }

  function back() {
    if (step === "teaser") {
      setStep("answering");
      setIndex(total - 1);
      return;
    }
    if (index > 0) setIndex(index - 1);
    else setStep("intro");
  }

  async function submitGate(e: FormEvent) {
    e.preventDefault();
    const id = await capture({
      email,
      firstName: firstName || undefined,
      company: company || undefined,
      answers,
    });
    if (!id) return;

    setStep("analyzing");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: id,
          email,
          firstName: firstName || undefined,
          company: company || undefined,
          answers,
        }),
      });
      const json = await res.json();
      if (json.ok && json.data?.report) {
        sessionStorage.setItem(
          "sisu_report_v1",
          JSON.stringify({
            report: json.data.report,
            score: json.data.score,
            firstName: firstName || undefined,
          })
        );
      }
    } catch {
      // fall through: /report shows a graceful fallback
    }
    router.push("/report");
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
            <button
              type="button"
              onClick={back}
              className="link-underline"
              style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.85rem" }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          </div>

          <div style={{ height: 4, background: "var(--color-line)", borderRadius: 999, overflow: "hidden", marginBottom: "2rem" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "var(--color-accent)", transition: "width 0.3s ease" }} />
          </div>

          <h2 key={current.id} className="reveal reveal-1" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.3rem)", marginBottom: "1.6rem" }}>
            {current.prompt}
          </h2>

          <div style={{ display: "grid", gap: "0.7rem" }}>
            {current.options.map((opt) => {
              const selected = answers[current.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => choose(opt.id)}
                  style={{
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
                  }}
                >
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

  // ── ANALYZING: brief wait while the report generates ──
  if (step === "analyzing") {
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

  // ── TEASER: score + one revealed dimension, gate the rest ──
  const result: ScoreResult = scoreQuiz(answers, quiz);
  const revealedId = quiz.gate.revealDimensionId;

  return (
    <section
      className="container-tight"
      style={{ maxWidth: "44rem", minHeight: "100vh", display: "grid", placeItems: "center", paddingTop: "4rem", paddingBottom: "4rem" }}
    >
      <div style={{ width: "100%" }} className="reveal reveal-1">
        <span className="eyebrow">Your maturity score</span>

        <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", margin: "0.8rem 0 0.2rem" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(3.5rem, 9vw, 5.5rem)", lineHeight: 1 }}>
            {result.overall}
          </span>
          <span style={{ fontSize: "1.4rem", color: "var(--color-ink-soft)" }}>/ 100</span>
          <span
            style={{ marginLeft: "auto", alignSelf: "center", padding: "0.35rem 0.9rem", borderRadius: 999, background: "var(--color-bg-soft)", border: "1px solid var(--color-line)", fontSize: "0.85rem" }}
          >
            {result.band}
          </span>
        </div>

        <div style={{ height: 8, background: "var(--color-line)", borderRadius: 999, overflow: "hidden", margin: "1rem 0 1.4rem" }}>
          <div style={{ height: "100%", width: `${result.overall}%`, background: "var(--color-accent)" }} />
        </div>

        <p style={{ fontSize: "1.1rem", color: "var(--color-ink-soft)", marginBottom: "2rem" }}>{result.bandTeaser}</p>

        <div style={{ display: "grid", gap: "0.8rem" }}>
          {result.dimensions.map((d) => {
            const shown = d.id === revealedId;
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ width: "11rem", flexShrink: 0, fontSize: "0.95rem" }}>{d.label}</span>
                <div style={{ flex: 1, height: 6, background: "var(--color-line)", borderRadius: 999, overflow: "hidden" }}>
                  {shown && <div style={{ height: "100%", width: `${d.score}%`, background: "var(--color-accent)" }} />}
                </div>
                <span style={{ width: "2.6rem", textAlign: "right", fontSize: "0.9rem", color: "var(--color-ink-soft)" }}>
                  {shown ? d.score : <Lock size={14} style={{ display: "inline" }} />}
                </span>
              </div>
            );
          })}
        </div>

        <form onSubmit={submitGate} className="surface-card" style={{ marginTop: "2rem", padding: "1.8rem" }}>
          <h3 style={{ fontSize: "1.3rem", marginBottom: "0.3rem", textAlign: "center" }}>{quiz.gate.unlockHeadline}</h3>
          <p style={{ color: "var(--color-ink-soft)", fontSize: "0.98rem", marginBottom: "1.4rem", textAlign: "center", maxWidth: "42ch", marginInline: "auto" }}>
            {quiz.gate.unlockSubhead}
          </p>
          <div style={{ display: "grid", gap: "0.7rem", maxWidth: "26rem", margin: "0 auto" }}>
            {quiz.gate.fields.firstName && (
              <input type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
            )}
            {quiz.gate.fields.company && (
              <input type="text" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} style={inputStyle} />
            )}
            <input type="email" required placeholder="Your best email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: "center" }}>
              {loading ? config.ui.submitting : quiz.gate.unlockCta}
              {!loading && <ArrowRight size={18} />}
            </button>
            {error && <p style={{ color: "#b91c1c", fontSize: "0.85rem", textAlign: "center" }}>{error}</p>}
            <p style={{ fontSize: "0.78rem", color: "var(--color-ink-soft)", textAlign: "center" }}>
              No spam. Your report, then a booking option. That is it.
            </p>
          </div>
        </form>

        <div style={{ marginTop: "1.6rem" }}>
          <button
            type="button"
            onClick={back}
            className="link-underline"
            style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.85rem" }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </div>
    </section>
  );
}
