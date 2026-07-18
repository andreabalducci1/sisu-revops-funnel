"use client";

import { useEffect, useState } from "react";

interface Step {
  key: string;
  label: string;
  count: number;
}

type Source = "posthog" | "airtable" | "none";

/** Explains which backend answered, so a 3-step funnel is never mistaken for a broken 7-step one. */
const SOURCE_NOTE: Record<Source, string> = {
  posthog: "Full funnel, from PostHog.",
  airtable:
    "From Airtable. Shows the stages after the email gate only. Add a PostHog key for landing, quiz and booking steps.",
  none: "No analytics source configured. Add Airtable or PostHog keys.",
};

export function FunnelDashboard() {
  const [secret, setSecret] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [days, setDays] = useState(30);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Prefills the secret from the URL (?secret=...) for direct access.
    const fromUrl = new URLSearchParams(window.location.search).get("secret");
    if (fromUrl) {
      setSecret(fromUrl);
      setSubmitted(true);
    }
  }, []);

  useEffect(() => {
    if (!submitted || !secret) return;
    setLoading(true);
    setError(null);
    fetch(`/api/funnel/stats?secret=${encodeURIComponent(secret)}&days=${days}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) {
          setError(json.error?.message || "Something went wrong");
          setSteps(null);
          setSource(null);
        } else {
          setSteps(json.data.steps);
          setSource(json.data.source ?? null);
        }
      })
      .catch(() => setError("Could not connect"))
      .finally(() => setLoading(false));
  }, [submitted, secret, days]);

  if (!submitted) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
        className="surface-card"
        style={{ padding: "2rem", maxWidth: "26rem", margin: "0 auto", display: "grid", gap: "1rem" }}
      >
        <label style={{ fontWeight: 600, fontSize: "0.9rem" }}>Secret admin</label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ADMIN_SECRET"
          style={{
            padding: "0.85rem 1rem",
            borderRadius: 10,
            border: "1.5px solid var(--color-line)",
            fontSize: "1rem",
          }}
        />
        <button type="submit" className="btn-primary">
          Access dashboard
        </button>
      </form>
    );
  }

  // Scale bars to the largest step, not the first one. Using steps[0] rendered
  // every bar at 0% width whenever the top-of-funnel step happened to be 0.
  const top = steps?.length ? Math.max(...steps.map((s) => s.count)) : 0;

  return (
    <div style={{ display: "grid", gap: "1.6rem" }}>
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--color-ink-soft)" }}>Period:</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={d === days ? "btn-primary" : "btn-outline"}
            style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
          >
            {d} days
          </button>
        ))}
      </div>

      {source && !loading && !error && (
        <p style={{ fontSize: "0.85rem", color: "var(--color-ink-soft)", margin: 0 }}>
          {SOURCE_NOTE[source]}
        </p>
      )}

      {loading && <p style={{ color: "var(--color-ink-soft)" }}>Loading…</p>}
      {error && (
        <div className="surface-card" style={{ padding: "1.4rem", color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {steps && (
        <div style={{ display: "grid", gap: "0.9rem" }}>
          {steps.map((step, i) => {
            const pctOfTop = top > 0 ? Math.round((step.count / top) * 100) : 0;
            const prev = i > 0 ? steps[i - 1].count : null;
            const conv = prev && prev > 0 ? Math.round((step.count / prev) * 100) : null;
            return (
              <div key={step.key} className="surface-card" style={{ padding: "1.2rem 1.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                  <span style={{ fontWeight: 600 }}>{step.label}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem" }}>
                    {step.count.toLocaleString("en-US")}
                    {conv !== null && (
                      <span style={{ fontSize: "0.8rem", color: "var(--color-accent)", marginLeft: 8 }}>
                        {conv}%
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ height: 8, background: "var(--color-bg-soft)", borderRadius: 999 }}>
                  <div
                    style={{
                      width: `${pctOfTop}%`,
                      height: "100%",
                      background: "var(--color-primary)",
                      borderRadius: 999,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
