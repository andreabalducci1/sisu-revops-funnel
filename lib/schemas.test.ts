import { test } from "node:test";
import assert from "node:assert/strict";
import { numbersSchema, analyzeSchema } from "./schemas";
import { computeLeak } from "./leak";

// --- Critical 1: a truthful 0 (or an implausible out-of-range value) in the
// numbers block must never fail validation. The whole diagnosis used to
// 400 over one honest "0 leads this month" answer; lib/leak.ts's plausible()
// already has a graceful path (omit the dependent line) for exactly this
// case, but it was unreachable because numbersSchema rejected the request
// before leak.ts ever saw it. These tests close the loop end to end:
// schema accepts it, then computeLeak degrades gracefully rather than the
// request being rejected outright. ---

const validNumbersExceptOneField = {
  acv: 18000,
  winRate: 22,
  inboundPerMonth: 420,
  responseBucket: "under_hour",
  headcount: 6,
};

test("numbersSchema accepts acv: 0 rather than rejecting the request", () => {
  const parsed = numbersSchema.safeParse({ ...validNumbersExceptOneField, acv: 0 });
  assert.equal(parsed.success, true);
});

test("numbersSchema accepts winRate: 0 rather than rejecting the request", () => {
  const parsed = numbersSchema.safeParse({ ...validNumbersExceptOneField, winRate: 0 });
  assert.equal(parsed.success, true);
});

test("numbersSchema accepts inboundPerMonth: 0 rather than rejecting the request", () => {
  const parsed = numbersSchema.safeParse({ ...validNumbersExceptOneField, inboundPerMonth: 0 });
  assert.equal(parsed.success, true);
});

test("numbersSchema accepts headcount: 0 rather than rejecting the request", () => {
  const parsed = numbersSchema.safeParse({ ...validNumbersExceptOneField, headcount: 0 });
  assert.equal(parsed.success, true);
});

test("numbersSchema accepts an acv far above the old 10,000,000 ceiling rather than rejecting the request", () => {
  const parsed = numbersSchema.safeParse({ ...validNumbersExceptOneField, acv: 50_000_000 });
  assert.equal(parsed.success, true);
});

test("numbersSchema still rejects a negative number: nonnegative, not unbounded", () => {
  const parsed = numbersSchema.safeParse({ ...validNumbersExceptOneField, acv: -100 });
  assert.equal(parsed.success, false);
});

const answers: Record<string, string> = { q_data_records: "a" };

test("analyzeSchema accepts a full request carrying acv: 0, and the leak model still produces a report (speed line omitted, drag line kept)", () => {
  const numbers = { ...validNumbersExceptOneField, acv: 0 };
  const parsed = analyzeSchema.safeParse({ answers, numbers });
  assert.equal(parsed.success, true, "the request must not be rejected");
  if (!parsed.success) return;

  const leak = computeLeak(parsed.data.numbers ?? {}, 33);
  assert.ok(leak, "a report's euro block still computes (drag line survives)");
  assert.equal(leak.lines.find((l) => l.id === "speed"), undefined, "acv 0 omits only the speed line");
  assert.ok(leak.lines.find((l) => l.id === "drag"), "drag line is unaffected by acv");
});

test("analyzeSchema accepts a full request carrying winRate: 0, and the leak model degrades gracefully", () => {
  const numbers = { ...validNumbersExceptOneField, winRate: 0 };
  const parsed = analyzeSchema.safeParse({ answers, numbers });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const leak = computeLeak(parsed.data.numbers ?? {}, 33);
  assert.ok(leak);
  assert.equal(leak.lines.find((l) => l.id === "speed"), undefined);
  assert.ok(leak.lines.find((l) => l.id === "drag"));
});

test("analyzeSchema accepts a full request carrying inboundPerMonth: 0, and the leak model degrades gracefully", () => {
  const numbers = { ...validNumbersExceptOneField, inboundPerMonth: 0 };
  const parsed = analyzeSchema.safeParse({ answers, numbers });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const leak = computeLeak(parsed.data.numbers ?? {}, 33);
  assert.ok(leak);
  assert.equal(leak.lines.find((l) => l.id === "speed"), undefined);
  assert.ok(leak.lines.find((l) => l.id === "drag"));
});

test("analyzeSchema accepts a full request carrying headcount: 0, and the leak model degrades gracefully (drag line omitted, speed line kept)", () => {
  const numbers = { ...validNumbersExceptOneField, headcount: 0 };
  const parsed = analyzeSchema.safeParse({ answers, numbers });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const leak = computeLeak(parsed.data.numbers ?? {}, 33);
  assert.ok(leak, "speed line still computes even though headcount is 0");
  assert.ok(leak.lines.find((l) => l.id === "speed"));
  assert.equal(leak.lines.find((l) => l.id === "drag"), undefined, "headcount 0 omits only the drag line");
});

test("analyzeSchema accepts an over-max acv, and the leak model omits the speed line rather than the request being rejected", () => {
  const numbers = { ...validNumbersExceptOneField, acv: 50_000_000 };
  const parsed = analyzeSchema.safeParse({ answers, numbers });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const leak = computeLeak(parsed.data.numbers ?? {}, 33);
  assert.ok(leak);
  assert.equal(leak.lines.find((l) => l.id === "speed"), undefined, "an implausible acv omits the speed line");
  assert.ok(leak.lines.find((l) => l.id === "drag"));
});

test("analyzeSchema accepts a request with no numbers block at all (skipped entirely)", () => {
  const parsed = analyzeSchema.safeParse({ answers });
  assert.equal(parsed.success, true);
});
