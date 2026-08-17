"use client";

import posthog from "posthog-js";
import type { FunnelEvent } from "@/lib/events";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

let initialized = false;

export function isPostHogConfigured(): boolean {
  return Boolean(POSTHOG_KEY);
}

/**
 * Which homepage A/B arm sent this visitor, from the `utm_content=variant-a|b`
 * the site stamps on every link into the funnel.
 */
function abVariantFromUrl(): "a" | "b" | null {
  const content = new URLSearchParams(window.location.search).get("utm_content");
  const match = content && /^variant-([ab])$/.exec(content);
  return match ? (match[1] as "a" | "b") : null;
}

export function initPostHog(): void {
  if (initialized || typeof window === "undefined" || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    person_profiles: "always",
  });

  // Stamp the homepage A/B arm on every event for the rest of the session.
  //
  // Variant B's whole thesis is that the quiz is the better first step: its own
  // copy says "book it straight from your report". That booking happens here,
  // not on the homepage, so it never reaches the homepage's GA property, and
  // the test was scoring B on a path B was not built to use. register() (not
  // capture()) because the UTM only exists on the first URL, while the booking
  // happens two pages later.
  const variant = abVariantFromUrl();
  if (variant) posthog.register({ ab_variant: variant });

  initialized = true;
}

/**
 * Capture a funnel event. No-op when PostHog is not configured (demo mode).
 *
 * Calls initPostHog() first on purpose. React runs effects bottom-up, so a
 * child's mount effect (PageView -> track) fires BEFORE the PostHogProvider
 * parent's effect that used to be the only initializer. posthog-js drops
 * captures made before init() instead of queueing them, which silently lost
 * landing_view on every cold page load in production. initPostHog() is
 * idempotent, so this is cheap.
 */
export function track(event: FunnelEvent, props?: Record<string, unknown>): void {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  initPostHog();
  posthog.capture(event, props);
}
