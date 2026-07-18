"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/posthog-client";
import type { FunnelEvent } from "@/lib/events";

/**
 * Capture a page-view event on mount.
 *
 * firedRef guards against React StrictMode double-invoking effects in dev,
 * which would otherwise count every page view twice locally. Same pattern as
 * startedRef / teaserFiredRef in MaturityQuiz.
 */
export function PageView({ event }: { event: FunnelEvent }) {
  const firedRef = useRef<FunnelEvent | null>(null);

  useEffect(() => {
    if (firedRef.current === event) return;
    firedRef.current = event;
    track(event);
  }, [event]);

  return null;
}
