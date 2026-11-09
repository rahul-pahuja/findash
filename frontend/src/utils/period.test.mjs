import test from "node:test";
import assert from "node:assert/strict";
import { getRangeCutoff, selectPeriod } from "./period.ts";

const records = ["2025-01-31", "2025-02-28", "2025-03-31", "2025-04-30"].map((date) => ({ id: date, date }));

test("uses an exact clamped calendar cutoff and the prior snapshot as comparison anchor", () => {
  assert.equal(getRangeCutoff("2025-03-31", "1M"), "2025-02-28");
  const selection = selectPeriod(records, "1M");
  assert.deepEqual(selection.entries.map((entry) => entry.id), ["2025-02-28", "2025-03-31", "2025-04-30"]);
  assert.equal(selection.anchor?.id, "2025-02-28");
  assert.equal(selection.latest?.id, "2025-04-30");
});

test("custom ranges include the nearest starting comparison point and return empty with no in-range snapshot", () => {
  const selection = selectPeriod(records, { kind: "custom", from: "2025-02-10", to: "2025-03-31" });
  assert.deepEqual(selection.entries.map((entry) => entry.id), ["2025-01-31", "2025-02-28", "2025-03-31"]);
  assert.equal(selection.anchor?.id, "2025-01-31");
  assert.equal(selection.latest?.id, "2025-03-31");
  const empty = selectPeriod(records, { kind: "custom", from: "2024-01-01", to: "2024-12-31" });
  assert.deepEqual(empty.entries, []);
  assert.equal(empty.latest, null);
});
