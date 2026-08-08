/**
 * SiSu RevOps - homepage lead-magnet hero for sisurevops.com (andrea-canvas)
 * --------------------------------------------------------------------------
 * React/TSX version of homepage-hero.html, for the Vite + React homepage.
 *
 * Why this file exists: sisurevops.com is a Vite/React SPA, so the static
 * HTML snippet cannot be dropped in as-is. This is the same hero as a
 * component.
 *
 * Deliberately self-contained:
 *   - inline styles + one scoped <style> block, so it needs no Tailwind,
 *     no shadcn, and no design-system imports. It drops into any React site.
 *   - fonts (DM Serif Display / DM Sans) are already loaded by the homepage,
 *     with serif/sans fallbacks if not.
 *
 * Usage:
 *   import { RevOpsCheckHero } from "./RevOpsCheckHero";
 *   ...
 *   <RevOpsCheckHero />          // place as the FIRST block on the homepage
 *
 * Primary CTA = the maturity quiz (email-first lead magnet).
 * "Book a call" is intentionally a small secondary link, per the GTM.
 */

const BRAND = {
  bg: "#F4F1EC", // Warm Ivory
  ink: "#1C1C1C", // Deep Charcoal
  inkSoft: "#474747",
  eyebrow: "#5A88B8", // Dusty Blue-Grey
  surface: "#F8F6F1",
  line: "#DDD6CB",
  sage: "#7E8F83", // Muted Sage
} as const;

const QUIZ_URL = "https://check.sisurevops.com";
const BOOK_URL = "https://check.sisurevops.com/book";

const BULLETS = [
  "Five dimensions: data, pipeline, automation, reporting, stack",
  "A personalized report, not a generic PDF",
  "Built by a RevOps engineer, not a marketer",
];

export function RevOpsCheckHero() {
  return (
    <section
      style={{
        background: BRAND.bg,
        color: BRAND.ink,
        padding: "6rem 1.5rem",
        fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Scoped: inline styles cannot express media queries or hover. */}
      <style>{`
        .sisu-check-hero {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
          gap: 3.5rem;
          align-items: center;
        }
        .sisu-check-hero__cta {
          transition: background 0.18s ease;
        }
        .sisu-check-hero__cta:hover {
          background: #2A2A2A;
        }
        @media (max-width: 860px) {
          .sisu-check-hero {
            grid-template-columns: 1fr;
            gap: 2.5rem;
          }
          .sisu-check-hero__card {
            order: -1;
          }
        }
      `}</style>

      <div className="sisu-check-hero">
        {/* Copy */}
        <div>
          <p
            style={{
              fontSize: "0.75rem",
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: BRAND.eyebrow,
              margin: "0 0 1.1rem",
            }}
          >
            Free RevOps maturity check
          </p>

          <h1
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontWeight: 400,
              fontSize: "clamp(2.4rem, 5vw, 3.9rem)",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              margin: "0 0 1.1rem",
            }}
          >
            Score your RevOps setup.
            <br />
            <span style={{ fontStyle: "italic" }}>
              See where revenue quietly leaks.
            </span>
          </h1>

          <p
            style={{
              fontSize: "1.15rem",
              lineHeight: 1.6,
              color: BRAND.inkSoft,
              maxWidth: "42ch",
              margin: "0 0 2rem",
            }}
          >
            Answer five quick questions and get an instant maturity score, plus a
            personalized read on the three fixes that move the needle first. No
            call required.
          </p>

          <a
            className="sisu-check-hero__cta"
            href={QUIZ_URL}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: BRAND.ink,
              color: BRAND.bg,
              fontWeight: 500,
              fontSize: "1.02rem",
              padding: "0.95rem 1.7rem",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            Get my score
            <span aria-hidden="true">&rarr;</span>
          </a>

          <p style={{ margin: "0.9rem 0 0", fontSize: "0.85rem", color: BRAND.inkSoft }}>
            Free. About a minute. No pitch. &nbsp;&middot;&nbsp;
            <a href={BOOK_URL} style={{ color: BRAND.eyebrow, textDecoration: "underline" }}>
              or book a 25-min call
            </a>
          </p>
        </div>

        {/* Result preview card */}
        <aside className="sisu-check-hero__card" style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              background: BRAND.surface,
              border: `1px solid ${BRAND.line}`,
              borderRadius: "8px",
              padding: "2.2rem",
              width: "100%",
            }}
          >
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: BRAND.eyebrow,
                margin: 0,
              }}
            >
              Sample result
            </p>

            <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginTop: "0.8rem" }}>
              <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "4.2rem", lineHeight: 1 }}>
                72
              </span>
              <span style={{ fontSize: "1.1rem", color: BRAND.inkSoft }}>/ 100</span>
            </div>

            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "1.35rem", marginTop: "0.4rem" }}>
              RevOps maturity score
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "1.4rem 0 0", display: "grid", gap: "0.7rem" }}>
              {BULLETS.map((text) => (
                <li
                  key={text}
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    alignItems: "flex-start",
                    fontSize: "0.95rem",
                    color: BRAND.inkSoft,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      marginTop: 8,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: BRAND.sage,
                    }}
                  />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default RevOpsCheckHero;
