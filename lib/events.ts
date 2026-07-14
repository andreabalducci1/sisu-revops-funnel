/**
 * PostHog funnel event names — single source of truth.
 * Used on the client (tracking) and server (admin / funnel stats).
 */
export const FUNNEL_EVENTS = {
  LANDING_VIEW: "landing_view",
  QUIZ_START: "quiz_start",
  QUIZ_COMPLETE: "quiz_complete",
  ANALYSIS_TEASER: "analysis_teaser_shown",
  LEAD_SIGNUP: "lead_signup",
  ANALYSIS_REVEALED: "analysis_revealed",
  ANALYSIS_ERROR: "analysis_error",
  RESOURCE_VIEW: "resource_view",
  RESOURCE_ENGAGED: "resource_engaged",
  BOOKING_CLICK: "booking_click",
  BOOKING_VIEW: "booking_view",
  BOOKING_COMPLETED: "booking_completed",
} as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];

/** Ordered funnel steps for the admin dashboard. */
export const FUNNEL_STEPS: ReadonlyArray<{ key: string; label: string; event: FunnelEvent }> = [
  { key: "landing", label: "Landing view", event: FUNNEL_EVENTS.LANDING_VIEW },
  { key: "quiz_start", label: "Quiz started", event: FUNNEL_EVENTS.QUIZ_START },
  { key: "quiz_complete", label: "Quiz completed", event: FUNNEL_EVENTS.QUIZ_COMPLETE },
  { key: "lead", label: "Email unlock", event: FUNNEL_EVENTS.LEAD_SIGNUP },
  { key: "analysis", label: "Report revealed", event: FUNNEL_EVENTS.ANALYSIS_REVEALED },
  { key: "booking_click", label: "Booking click", event: FUNNEL_EVENTS.BOOKING_CLICK },
  { key: "booking", label: "Call booked", event: FUNNEL_EVENTS.BOOKING_COMPLETED },
];
