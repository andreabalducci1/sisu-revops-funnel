import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

/**
 * Guards the linchpin of this redesign: /report must never be gated behind
 * a cookie again. The whole point of the ungated funnel is that a visitor
 * gets their full result without identifying themselves first; a future
 * edit to middleware.ts that reintroduces a check for /report would bounce
 * every visitor straight back to a dead end, silently, since nothing else
 * in the app would catch it. /thanks staying gated on the booking cookie is
 * asserted in the same file so a regression in either direction shows up
 * here.
 */

test("/report with no cookies is not redirected", () => {
  const req = new NextRequest(new URL("https://example.com/report"));
  const res = middleware(req);
  assert.equal(res.headers.get("location"), null);
  assert.equal(res.status, 200);
});

test("/thanks without the booking cookie is redirected to /book", () => {
  const req = new NextRequest(new URL("https://example.com/thanks"));
  const res = middleware(req);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get("location"), "https://example.com/book");
});

test("/thanks with the booking cookie is not redirected", () => {
  const req = new NextRequest(new URL("https://example.com/thanks"), {
    headers: { cookie: "tunnel_booking=1" },
  });
  const res = middleware(req);
  assert.equal(res.headers.get("location"), null);
  assert.equal(res.status, 200);
});
