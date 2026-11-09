import test from "node:test";
import assert from "node:assert/strict";
import { pickNextGoal } from "./goalProjection.ts";

const goal = (id, { amount, date, type = "milestone" }) => ({
  id,
  name: id,
  type,
  targetAmount: amount,
  targetDate: date,
  createdAt: "2025-01-31",
  updatedAt: "2025-01-31"
});

test("picks the earliest-dated pending goal regardless of type", () => {
  const netWorth = 700000;
  const picked = pickNextGoal([
    goal("trip", { amount: 800000, date: "2027-03-31", type: "long-term" }),
    goal("car", { amount: 900000, date: "2027-01-31" })
  ], netWorth);
  assert.equal(picked.id, "car");
});

test("a dated goal wins over a smaller undated one", () => {
  const netWorth = 700000;
  const picked = pickNextGoal([
    goal("small-undated", { amount: 800000 }),
    goal("dated", { amount: 2000000, date: "2030-06-30", type: "long-term" })
  ], netWorth);
  assert.equal(picked.id, "dated");
});

test("falls back to the smallest amount when no pending goal has a date", () => {
  const netWorth = 700000;
  const picked = pickNextGoal([
    goal("big", { amount: 1500000, type: "long-term" }),
    goal("small", { amount: 900000 })
  ], netWorth);
  assert.equal(picked.id, "small");
});

test("skips achieved goals and returns null when everything is achieved", () => {
  const netWorth = 700000;
  const picked = pickNextGoal([
    goal("done-small", { amount: 300000 }),
    goal("done-dated", { amount: 650000, date: "2026-06-30" })
  ], netWorth);
  assert.equal(picked, null);
});
