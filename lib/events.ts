/**
 * PostHog funnel event names - single source of truth.
 * Used on the client (tracking) and server (admin / funnel stats).
 */
export const FUNNEL_EVENTS = {
  LANDING_VIEW: "landing_view",
  QUIZ_START: "quiz_start",
  /** Fired once the two calibration (cohort) questions are both answered, before the 12 scored questions start. */
  CALIBRATION_COMPLETE: "calibration_complete",
  QUIZ_COMPLETE: "quiz_complete",
  /** Fired when the visitor submits the optional numbers block (euro leak model inputs). */
  NUMBERS_PROVIDED: "numbers_provided",
  /** Fired when the visitor skips the optional numbers block. */
  NUMBERS_SKIPPED: "numbers_skipped",
  /** Fired when /report actually renders a report, not on every page mount (see RESOURCE_VIEW). */
  RESULT_VIEW: "result_view",
  /**
   * Optional copy-request email capture on the results page. Survives from
   * the old gated funnel but no longer sits in FUNNEL_STEPS: it now measures
   * an optional extra (send me a copy), not a funnel stage, and every
   * visitor already has their full result without it. Counting it as a main
   * step would read as catastrophic drop-off after result_view.
   */
  LEAD_SIGNUP: "lead_signup",
  /** Fired specifically when the "email me a copy" form on /report succeeds, distinct from LEAD_SIGNUP's broader signal. */
  COPY_REQUESTED: "copy_requested",
  ANALYSIS_REVEALED: "analysis_revealed",
  ANALYSIS_ERROR: "analysis_error",
  RESOURCE_VIEW: "resource_view",
  RESOURCE_ENGAGED: "resource_engaged",
  BOOKING_CLICK: "booking_click",
  BOOKING_VIEW: "booking_view",
  /** Fired once by the Cal.com callback in CalEmbed. This is the authoritative booking signal. */
  BOOKING_COMPLETED: "booking_completed",
  /** Page view of /thanks. Kept separate so refreshes do not inflate BOOKING_COMPLETED. */
  THANKS_VIEW: "thanks_view",
} as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];

/**
 * Ordered funnel steps for the admin dashboard, matching the ungated funnel:
 * land, start the quiz, finish the quiz, see the result, click to book, book.
 * LEAD_SIGNUP is deliberately excluded (see its comment above): it is an
 * optional side action now, not a stage every visitor is expected to pass
 * through, so it does not belong in a chart that reads step-to-step
 * conversion as drop-off.
 */
export const FUNNEL_STEPS: ReadonlyArray<{ key: string; label: string; event: FunnelEvent }> = [
  { key: "landing", label: "Landing view", event: FUNNEL_EVENTS.LANDING_VIEW },
  { key: "quiz_start", label: "Quiz started", event: FUNNEL_EVENTS.QUIZ_START },
  { key: "quiz_complete", label: "Quiz completed", event: FUNNEL_EVENTS.QUIZ_COMPLETE },
  { key: "result_view", label: "Result viewed", event: FUNNEL_EVENTS.RESULT_VIEW },
  { key: "booking_click", label: "Booking click", event: FUNNEL_EVENTS.BOOKING_CLICK },
  { key: "booking", label: "Call booked", event: FUNNEL_EVENTS.BOOKING_COMPLETED },
];
