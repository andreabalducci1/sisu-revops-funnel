import { MaturityQuiz } from "@/components/funnel/MaturityQuiz";
import { PageView } from "@/components/funnel/PageView";
import { FUNNEL_EVENTS } from "@/lib/events";

export default function LandingPage() {
  return (
    <main className="paper-grain" style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <PageView event={FUNNEL_EVENTS.LANDING_VIEW} />

      {/* Decorative background shape */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-12%",
          right: "-8%",
          width: "46vw",
          height: "46vw",
          maxWidth: 620,
          maxHeight: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 30%, var(--color-primary-light), transparent 62%)",
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />

      <MaturityQuiz />
    </main>
  );
}
