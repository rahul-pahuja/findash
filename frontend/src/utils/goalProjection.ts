import type { Goal } from "../lib/types";

export function projectedMonths(current: number, target: number, monthly: number, annualRate: number) {
  if (target <= current) return 0;
  if (monthly <= 0 || annualRate <= -1) return null;
  const rate = Math.pow(1 + annualRate, 1 / 12) - 1;
  let value = current;
  for (let month = 1; month <= 1200; month += 1) {
    value = value * (1 + rate) + monthly;
    if (value >= target) return month;
  }
  return null;
}

export function estimateDate(latestDate: string, months: number | null) {
  if (months === null) return null;
  const [year, month, day] = latestDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + months, day));
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(next);
}

export function estimateMonthYear(latestDate: string, months: number | null) {
  if (months === null) return null;
  const [year, month, day] = latestDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + months, day));
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(next);
}

/**
 * Monthly contribution needed so that current capital, growing at the expected
 * annual return, reaches the target on the target date:
 *   required = (target − current × (1 + r)^t) / annuityFactor(r, t)
 * with r the expected annual return, t the years to the target date and
 * annuityFactor(r, t) the future value of ₹1 a month over t years.
 * Returns null when there is no target date in the future to solve for.
 */
export function requiredMonthlyAmount(current: number, target: number, annualRate: number, fromDate: string, targetDate: string): number | null {
  if (annualRate <= -1) return null;
  const days = (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0) return null;
  const months = days / 30.4375 * 12;
  const monthlyRate = annualRate === 0 ? 0 : Math.pow(1 + annualRate, 1 / 12) - 1;
  const growth = Math.pow(1 + monthlyRate, months);
  const annuityFactor = monthlyRate === 0 ? months : (growth - 1) / monthlyRate;
  if (annuityFactor <= 0) return null;
  return (target - current * growth) / annuityFactor;
}

export type GoalStatusKind = "behind" | "on-track" | "ahead";
export interface GoalStatus { kind: GoalStatusKind; months: number; label: string }

/**
 * Compares the projected crossing with the target date in whole calendar
 * months. On track when the projected date lands on the target month; ahead
 * or behind by the month difference otherwise.
 */
export function goalStatus(projectedMonths: number, targetDate: string, latestDate: string): GoalStatus {
  const [targetYear, targetMonth] = targetDate.split("-").map(Number);
  const [latestYear, latestMonth] = latestDate.split("-").map(Number);
  const projectedTotal = latestYear * 12 + (latestMonth - 1) + Math.round(projectedMonths);
  const projectedYear = Math.floor(projectedTotal / 12);
  const projectedMonth = (projectedTotal % 12) + 1;
  const diff = (targetYear - projectedYear) * 12 + (targetMonth - projectedMonth);
  if (diff > 0) return { kind: "ahead", months: diff, label: `Ahead · ${diff} month${diff === 1 ? "" : "s"}` };
  if (diff < 0) return { kind: "behind", months: -diff, label: `Behind · ${-diff} month${diff === -1 ? "" : "s"}` };
  return { kind: "on-track", months: 0, label: "On track" };
}

export function pickNextGoal(goals: Goal[], netWorth: number) {
  const pending = goals.filter((goal) => goal.targetAmount > netWorth);
  const dated = pending
    .filter((goal): goal is Goal & { targetDate: string } => Boolean(goal.targetDate))
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  if (dated.length) return dated[0];
  return [...pending].sort((a, b) => a.targetAmount - b.targetAmount)[0] ?? null;
}
