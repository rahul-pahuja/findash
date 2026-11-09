import test from "node:test";
import assert from "node:assert/strict";
import { migrateDataset } from "./migrateDataset.ts";

test("migrates legacy snapshot fields and the optional target into schema v2", () => {
  const migrated = migrateDataset({
    entries: [{ id: "2025-01-31", date: "2025-01-31", income: { in_hand: 85000 }, sip: { mutual_funds: 10000 }, liquid: { bank: 1, sodexo: 0 }, hardAssets: { stocksWallet: 0, fd: 0 }, marketAssets: {}, expensesNote: "" }],
    meta: { currency: "INR", created: "", lastUpdated: "" },
    preferences: { version: 1, shortTermGoal: { targetAmount: 500000, targetDate: "2025-12-31" }, notifications: { dismissedGapMonth: "2025-02" } }
  });
  assert.equal(migrated.schemaVersion, 2);
  assert.equal("income" in migrated.entries[0], false);
  assert.equal("sip" in migrated.entries[0], false);
  assert.deepEqual(migrated.entries[0].oneOffs, []);
  assert.equal(migrated.goals[0].targetAmount, 500000);
  assert.equal(migrated.preferences?.notifications?.dismissedGapMonth, "2025-02");
  assert.equal(migrated.settings.appearance, "auto");
});
