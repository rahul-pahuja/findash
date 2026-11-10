import test from "node:test";
import assert from "node:assert/strict";
import { formatDateRangeLabel, formatLakhsPerMonth, formatNextDueLabel, formatSignedPercent } from "./format.ts";

test("date range keeps month-day only within one year", () => {
  assert.equal(formatDateRangeLabel("2025-01-31", "2025-03-31"), "31 Jan – 31 Mar");
});

test("date range includes the year on both ends across years", () => {
  assert.equal(formatDateRangeLabel("2025-01-31", "2026-03-31"), "31 Jan 2025 – 31 Mar 2026");
});

test("single-date range shows the full date once", () => {
  assert.equal(formatDateRangeLabel("2026-03-31", "2026-03-31"), "31 Mar 2026");
});

test("signed percentages use the minus sign (U+2212), not a hyphen", () => {
  const label = formatSignedPercent(-0.221, false);
  assert.equal(label, "−22.1%");
  assert.ok(label.startsWith("\u2212"), "must start with U+2212");
  assert.ok(!label.includes("-"), "must not contain a hyphen-minus");
});

test("signed percentages keep the plus sign, masking and N/A", () => {
  assert.equal(formatSignedPercent(0.221, false), "+22.1%");
  assert.equal(formatSignedPercent(-0.221, true), "••%");
  assert.equal(formatSignedPercent(null, false), "N/A");
});

test("lakhs per month round to one decimal", () => {
  assert.equal(formatLakhsPerMonth(372_345), "₹3.7\u202fL");
  assert.equal(formatLakhsPerMonth(-50_000), "−₹0.5\u202fL");
  assert.equal(formatLakhsPerMonth(null), "N/A");
  assert.equal(formatLakhsPerMonth(123_456, true), "₹ ••••");
});

test("next due date is the first reminder day after the latest snapshot", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  assert.equal(formatNextDueLabel("2026-11-08", 1, now), "1 Dec");
  assert.equal(formatNextDueLabel("2026-11-08", 9, now), "9 Nov");
  assert.equal(formatNextDueLabel("2026-11-08", 8, now), "8 Dec");
});

test("next due date adds the year when it is not the current one", () => {
  assert.equal(formatNextDueLabel("2026-12-20", 15, new Date("2026-12-25T00:00:00Z")), "15 Jan 2027");
});

test("next due date clamps to the end of short months", () => {
  assert.equal(formatNextDueLabel("2026-01-31", 31, new Date("2026-02-01T00:00:00Z")), "28 Feb");
});
