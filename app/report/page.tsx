import config from "@/config";
import { ReportViewer } from "@/components/funnel/ReportViewer";
import { PageView } from "@/components/funnel/PageView";
import { FUNNEL_EVENTS } from "@/lib/events";

export default function ReportPage() {
  const { resource } = config;

  return (
    <main className="paper-grain" style={{ minHeight: "100vh" }}>
      <PageView event={FUNNEL_EVENTS.RESOURCE_VIEW} />

      <section
        className="container-tight"
        style={{ paddingTop: "4.5rem", paddingBottom: "5rem", maxWidth: "52rem" }}
      >
        <header style={{ textAlign: "center", marginBottom: "2.6rem" }}>
          <span className="eyebrow reveal reveal-1">{resource.eyebrow}</span>
          <h1
            className="reveal reveal-2"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", margin: "1rem 0 0.8rem" }}
          >
            {resource.title}
          </h1>
          <p
            className="reveal reveal-2"
            style={{
              fontSize: "1.1rem",
              color: "var(--color-ink-soft)",
              maxWidth: "46ch",
              margin: "0 auto",
            }}
          >
            {resource.description}
          </p>
        </header>

        <div className="reveal reveal-3">
          <ReportViewer />
        </div>
      </section>
    </main>
  );
}
