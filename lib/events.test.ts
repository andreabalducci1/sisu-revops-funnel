import { test } from "node:test";
import assert from "node:assert/strict";
import { FUNNEL_EVENTS, FUNNEL_STEPS } from "./events";

// --- Important 7: booking_click used to be a funnel step nothing could ever
// fire (its only emitter, BookingCta, lost its last caller once the booking
// widget moved onto /report directly). The chosen fix is to keep firing it,
// now from ReportViewer's booking container instead of a CTA click (see
// components/funnel/ReportViewer.tsx's bookingSeenRef), rather than deleting
// the step. This test is the guard against that decision silently reverting:
// if booking_click is ever removed from FUNNEL_STEPS again, whoever does it
// should have to consciously update this test, not do it by accident. ---

test("FUNNEL_STEPS still includes booking_click as a real, ordered stage between result_view and booking_completed", () => {
  const keys = FUNNEL_STEPS.map((s) => s.key);
  assert.ok(keys.includes("booking_click"), "booking_click must remain a funnel step");

  const resultIdx = keys.indexOf("result_view");
  const clickIdx = keys.indexOf("booking_click");
  const bookedIdx = keys.indexOf("booking");
  assert.ok(resultIdx >= 0 && clickIdx >= 0 && bookedIdx >= 0);
  assert.ok(resultIdx < clickIdx && clickIdx < bookedIdx, "booking_click must sit between result_view and booking");

  const step = FUNNEL_STEPS.find((s) => s.key === "booking_click");
  assert.equal(step?.event, FUNNEL_EVENTS.BOOKING_CLICK);
});
