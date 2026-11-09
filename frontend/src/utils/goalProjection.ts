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

export function pickNextGoal(goals: Goal[], netWorth: number) {
  const pending = goals.filter((goal) => goal.targetAmount > netWorth);
  const dated = pending
    .filter((goal): goal is Goal & { targetDate: string } => Boolean(goal.targetDate))
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  if (dated.length) return dated[0];
  return [...pending].sort((a, b) => a.targetAmount - b.targetAmount)[0] ?? null;
}
