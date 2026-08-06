import { ArrowLeft } from "lucide-react";
import config from "@/config";

/**
 * Way out of the funnel. The quiz lives on its own subdomain with no site nav,
 * so without this a visitor who wants to look around has only the browser back
 * button. Deliberately quiet: it is an escape hatch, not a competing CTA.
 */
export function BackToSite() {
  const { siteUrl, backLabel } = config.business;

  return (
    <a
      href={siteUrl}
      style={{
        position: "relative",
        zIndex: 1,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.45rem",
        padding: "0.5rem 0.85rem 0.5rem 0.6rem",
        margin: "1.4rem 0 0 1.4rem",
        borderRadius: 999,
        border: "1px solid var(--color-line)",
        background: "var(--color-bg-soft)",
        color: "var(--color-ink-soft)",
        fontSize: "0.85rem",
        textDecoration: "none",
        lineHeight: 1,
      }}
    >
      <ArrowLeft size={15} aria-hidden />
      {backLabel}
    </a>
  );
}
