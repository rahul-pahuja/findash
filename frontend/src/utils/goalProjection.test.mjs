import test from "node:test";
import assert from "node:assert/strict";
import { goalStatus, pickNextGoal, reachedGoalStatus, requiredMonthlyAmount } from "./goalProjection.ts";

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

test("required monthly amount at 0% is the plain shortfall divided by months", () => {
  // 10 years apart (2026-01-01 → 2036-01-01), no growth: ₹12,00,000 over ~120 months.
  const required = requiredMonthlyAmount(0, 1_200_000, 0, "2026-01-01", "2036-01-01");
  assert.ok(required !== null);
  assert.equal(Math.round(required), Math.round(1_200_000 / ((Date.parse("2036-01-01") - Date.parse("2026-01-01")) / 86_400_000 / 30.4375)));
});

test("required monthly amount matches the closed-form formula at a positive return", () => {
  // Hand-computed: ₹10 L today, ₹20 L on 31 Dec 2029 from 10 Nov 2026 at 8% a year.
  const days = (Date.parse("2029-12-31") - Date.parse("2026-11-10")) / 86_400_000;
  const months = days / 30.4375;
  const monthlyRate = Math.pow(1.08, 1 / 12) - 1;
  const expected = (2_000_000 - 1_000_000 * Math.pow(1 + monthlyRate, months)) / ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  const required = requiredMonthlyAmount(1_000_000, 2_000_000, 0.08, "2026-11-10", "2029-12-31");
  assert.ok(required !== null);
  assert.ok(Math.abs(required - expected) < 1);
  // Sanity: at 8% the required saving is far below the 0% saving.
  const atZero = requiredMonthlyAmount(1_000_000, 2_000_000, 0, "2026-11-10", "2029-12-31");
  assert.ok(required < atZero);
});

test("required monthly amount correctly computes required saving when pace is below target", () => {
  // From 31 Mar 2026 to 15 Jul 2027 (15.5 months), ₹7.79 L to ₹15 L at 7.7% annual return.
  const required = requiredMonthlyAmount(779_000, 1_500_000, 0.077, "2026-03-31", "2027-07-15");
  assert.ok(required !== null);
  assert.ok(required > 38_000 && required < 42_000);
});

test("required monthly amount is not positive when growth alone reaches the target", () => {
  const required = requiredMonthlyAmount(1_900_000, 2_000_000, 0.08, "2026-11-10", "2036-12-31");
  assert.ok(required !== null && required <= 0);
});

test("required monthly amount needs a future target date", () => {
  assert.equal(requiredMonthlyAmount(1_000_000, 2_000_000, 0.08, "2026-11-10", "2026-01-01"), null);
});

test("status is on track when the projected date is on or before the target date", () => {
  // Projected 37 months after 10 Nov 2026 = Dec 2029, the target month.
  assert.equal(goalStatus(37, "2029-12-31", "2026-11-10").kind, "on-track");
  // Projected 30 months after 10 Nov 2026 = May 2029, before the target.
  assert.equal(goalStatus(30, "2029-12-31", "2026-11-10").kind, "ahead");
  assert.ok(goalStatus(30, "2029-12-31", "2026-11-10").months > 0);
});

test("status counts the months behind between projection and target", () => {
  // Projected Feb 2031 against a 31 Dec 2029 target → 14 months behind.
  const status = goalStatus(51, "2029-12-31", "2026-11-10");
  assert.equal(status.kind, "behind");
  assert.equal(status.months, 14);
  assert.equal(status.label, "Behind · 14 months");
});

test("status labels ahead months and the singular month", () => {
  assert.equal(goalStatus(30, "2029-12-31", "2026-11-10").label, "Ahead · 7 months");
  // One month behind: projected Jan 2030 vs Dec 2029 target.
  assert.equal(goalStatus(38, "2029-12-31", "2026-11-10").label, "Behind · 1 month");
});

test("reached goal status calculates early, late, on time and undated differences", () => {
  // Reached Mar 2026 vs Dec 2026 target -> 9 months early
  const early9 = reachedGoalStatus("2026-03-31", "2026-12-31");
  assert.equal(early9.kind, "ahead");
  assert.equal(early9.months, 9);
  assert.equal(early9.label, "Reached · 9 months early");

  // Reached Mar 2026 vs Jun 2026 target -> 3 months early
  const early3 = reachedGoalStatus("2026-03-31", "2026-06-30");
  assert.equal(early3.kind, "ahead");
  assert.equal(early3.months, 3);
  assert.equal(early3.label, "Reached · 3 months early");

  // Singular early month
  const early1 = reachedGoalStatus("2026-03-31", "2026-04-30");
  assert.equal(early1.label, "Reached · 1 month early");

  // Reached Mar 2026 vs Dec 2025 target -> 3 months late
  const late3 = reachedGoalStatus("2026-03-31", "2025-12-31");
  assert.equal(late3.kind, "behind");
  assert.equal(late3.months, 3);
  assert.equal(late3.label, "Reached · 3 months late");

  // Singular late month
  const late1 = reachedGoalStatus("2026-03-31", "2026-02-28");
  assert.equal(late1.label, "Reached · 1 month late");

  // Same month -> on time
  const onTime = reachedGoalStatus("2026-03-31", "2026-03-15");
  assert.equal(onTime.kind, "ahead");
  assert.equal(onTime.months, 0);
  assert.equal(onTime.label, "Reached · on time");

  // Undated target -> plain Reached
  const undated = reachedGoalStatus("2026-03-31");
  assert.equal(undated.kind, "ahead");
  assert.equal(undated.label, "Reached");
});

