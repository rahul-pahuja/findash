import test from "node:test";
import assert from "node:assert/strict";
import { formatDateRangeLabel } from "./format.ts";

test("date range keeps month-day only within one year", () => {
  assert.equal(formatDateRangeLabel("2025-01-31", "2025-03-31"), "31 Jan – 31 Mar");
});

test("date range includes the year on both ends across years", () => {
  assert.equal(formatDateRangeLabel("2025-01-31", "2026-03-31"), "31 Jan 2025 – 31 Mar 2026");
});

test("single-date range shows the full date once", () => {
  assert.equal(formatDateRangeLabel("2026-03-31", "2026-03-31"), "31 Mar 2026");
});
