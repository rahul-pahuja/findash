import test from "node:test";
import assert from "node:assert/strict";
import { analyticsPeriodLabel, parseAnalyticsPeriod, resolveRoute, serializeAnalyticsPeriod } from "./router.ts";

test("resolves the main routes and redirects the legacy analytics path", () => {
  assert.equal(resolveRoute("/").page, "dashboard");
  assert.equal(resolveRoute("/snapshots").page, "snapshots");
  assert.equal(resolveRoute("/analytics/overview").page, "analytics-overview");
  assert.equal(resolveRoute("/analytics/investments").page, "analytics-investments");
  assert.deepEqual(resolveRoute("/analytics").redirect, "/analytics/overview");
  assert.equal(resolveRoute("/plan").page, "plan");
  assert.equal(resolveRoute("/settings").page, "settings");
});

test("parses, labels, and serializes analytics presets and custom dates", () => {
  const preset = parseAnalyticsPeriod("?range=1y");
  assert.deepEqual(preset, { kind: "preset", range: "1Y" });
  assert.equal(serializeAnalyticsPeriod(preset), "range=1y");
  const custom = parseAnalyticsPeriod("?from=2026-01-31&to=2026-10-31");
  assert.deepEqual(custom, { kind: "custom", from: "2026-01-31", to: "2026-10-31" });
  assert.equal(serializeAnalyticsPeriod(custom), "from=2026-01-31&to=2026-10-31");
  assert.equal(analyticsPeriodLabel(custom), "31 Jan 2026 – 31 Oct 2026");
});

test("rejects invalid dates and reversed custom ranges", () => {
  assert.deepEqual(parseAnalyticsPeriod("?from=2026-02-30&to=2026-03-01"), { kind: "preset", range: "ALL" });
  assert.deepEqual(parseAnalyticsPeriod("?from=2026-04-01&to=2026-03-01"), { kind: "preset", range: "ALL" });
  assert.deepEqual(parseAnalyticsPeriod("?range=decade"), { kind: "preset", range: "ALL" });
});
