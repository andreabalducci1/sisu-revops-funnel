"use client";

import { useState } from "react";
import config from "@/config";
import { track } from "@/lib/posthog-client";
import { FUNNEL_EVENTS } from "@/lib/events";
import { setFunnelCookie, FUNNEL_COOKIES } from "@/lib/funnel";
import type { Answers } from "@/lib/scoring";

function getUtm() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    utmSource: p.get("utm_source") || undefined,
    utmMedium: p.get("utm_medium") || undefined,
    utmCampaign: p.get("utm_campaign") || undefined,
  };
}

export interface CapturePayload {
  email: string;
  firstName?: string;
  company?: string;
  answers?: Answers;
}

/**
 * Single code path for lead capture: POST /api/lead, set the opt-in cookie,
 * fire the signup event. Returns the lead id on success, null on failure.
 * On success `loading` stays true so the caller can redirect without a flicker.
 */
export function useLeadCapture() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function capture(payload: CapturePayload): Promise<string | null> {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...getUtm() }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || config.ui.genericError);
        setLoading(false);
        return null;
      }
      const id: string = json.data.id || "1";
      track(FUNNEL_EVENTS.LEAD_SIGNUP, { email_domain: payload.email.split("@")[1] });
      setFunnelCookie(FUNNEL_COOKIES.OPTIN, id);
      return id;
    } catch {
      setError(config.ui.networkError);
      setLoading(false);
      return null;
    }
  }

  return { capture, loading, error };
}
