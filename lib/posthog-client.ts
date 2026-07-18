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

export function initPostHog(): void {
  if (initialized || typeof window === "undefined" || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    person_profiles: "always",
  });
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
