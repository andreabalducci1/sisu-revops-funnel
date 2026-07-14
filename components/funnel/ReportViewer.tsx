"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/posthog-client";
import { FUNNEL_EVENTS } from "@/lib/events";
import { getFunnelCookie, FUNNEL_COOKIES } from "@/lib/funnel";
import type { Report } from "@/lib/schemas";
import type { ScoreResult } from "@/lib/scoring";

const STASH_KEY = "sisu_report_v1";

interface Stashed {
  report: Report;
  score: ScoreResult;
  firstName?: string;
}

type State = "loading" | "ready" | "empty";

export function ReportViewer() {
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<Stashed | null>(null);

  useEffect(() => {
    // 1. sessionStorage fast path (the normal flow after the quiz).
    try {
      const raw = sessionStorage.getItem(STASH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Stashed;
        setData(parsed);
        setState("ready");
        track(FUNNEL_EVENTS.ANALYSIS_REVEALED, {
          score: parsed.score?.overall,
          band: parsed.score?.band,
        });
        return;
      }
    } catch {
      /* ignore malformed stash */
    }

    // 2. Fetch-by-cookie fallback (hard refresh / new tab, live mode only).
    if (!getFunnelCookie(FUNNEL_COOKIES.OPTIN)) {
      setState("empty");
      return;
    }
    fetch("/api/report")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.data?.report) {
          setData(json.data as Stashed);
          setState("ready");
          track(FUNNEL_EVENTS.ANALYSIS_REVEALED, { score: json.data.score?.overall });
        } else {
          setState("empty");
        }
      })
      .catch(() => setState("empty"));
  }, []);

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
          Your report has moved on. Retake the 60-second check to see it again.
        </p>
        <a href="/" className="btn-primary" style={{ textDecoration: "none" }}>
          Retake the check
        </a>
      </div>
    );
  }

  const { report, score } = data;

  return (
    <div style={{ display: "grid", gap: "1.6rem" }}>
      {/* Score + summary */}
      <div className="surface-card" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(3rem, 7vw, 4.5rem)", lineHeight: 1 }}>
            {score.overall}
          </span>
          <span style={{ fontSize: "1.3rem", color: "var(--color-ink-soft)" }}>/ 100</span>
          <span
            style={{ marginLeft: "auto", alignSelf: "center", padding: "0.35rem 0.9rem", borderRadius: 999, background: "var(--color-bg-soft)", border: "1px solid var(--color-line)", fontSize: "0.85rem" }}
          >
            {score.band}
          </span>
        </div>
        <div style={{ height: 8, background: "var(--color-line)", borderRadius: 999, overflow: "hidden", margin: "1rem 0 1.4rem" }}>
          <div style={{ height: "100%", width: `${score.overall}%`, background: "var(--color-accent)" }} />
        </div>
        <p style={{ fontSize: "1.1rem", lineHeight: 1.6 }}>{report.summary}</p>
      </div>

      {/* By dimension */}
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <h2 style={{ fontSize: "1.5rem" }}>By dimension</h2>
        {report.dimensions.map((d) => {
          const s = score.dimensions.find((x) => x.id === d.id)?.score ?? 0;
          return (
            <div key={d.id} className="surface-card" style={{ padding: "1.4rem 1.6rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.7rem" }}>
                <span style={{ fontWeight: 500, flex: 1 }}>{d.label}</span>
                <div style={{ width: "40%", height: 6, background: "var(--color-line)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s}%`, background: "var(--color-accent)" }} />
                </div>
                <span style={{ width: "2.6rem", textAlign: "right", fontSize: "0.9rem", color: "var(--color-ink-soft)" }}>{s}</span>
              </div>
              <p style={{ marginBottom: "0.4rem" }}>{d.verdict}</p>
              <p style={{ color: "var(--color-ink-soft)", fontSize: "0.95rem" }}>
                <span style={{ color: "var(--color-eyebrow)", fontWeight: 500 }}>Fix: </span>
                {d.recommendation}
              </p>
            </div>
          );
        })}
      </div>

      {/* Priorities */}
      <div className="surface-card" style={{ padding: "1.8rem 2rem" }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: "1rem" }}>Fix these first</h2>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.9rem" }}>
          {report.priorities.map((p, i) => (
            <li key={p} style={{ display: "flex", alignItems: "flex-start", gap: "0.8rem" }}>
              <span
                style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "var(--color-primary)", color: "var(--color-bg)", fontSize: "0.8rem", fontWeight: 700, display: "grid", placeItems: "center" }}
              >
                {i + 1}
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </div>

      <p style={{ color: "var(--color-ink-soft)", fontSize: "1.02rem" }}>{report.nextStep}</p>
    </div>
  );
}
