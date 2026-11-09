import type { Entry, RangeKey } from "../lib/types";
import type { AnalyticsPeriod } from "./router";

const RANGE_MONTHS: Partial<Record<RangeKey, number>> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60 };

export interface PeriodSelection {
  entries: Entry[];
  anchor: Entry | null;
  latest: Entry | null;
  cutoff: string | null;
}

export function getRangeCutoff(latestDate: string, range: RangeKey): string | null {
  const months = RANGE_MONTHS[range];
  if (!months) return null;
  const [year, month, day] = latestDate.split("-").map(Number);
  const targetMonth = new Date(Date.UTC(year, month - 1 - months, 1));
  const targetYear = targetMonth.getUTCFullYear();
  const targetMonthIndex = targetMonth.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function selectPeriod(entries: Entry[], selection: AnalyticsPeriod | RangeKey): PeriodSelection {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const period: AnalyticsPeriod = typeof selection === "string" ? { kind: "preset", range: selection } : selection;
  if (period.kind === "custom") {
    const visible = ordered.filter((entry) => entry.date >= period.from && entry.date <= period.to);
    const anchor = [...ordered].reverse().find((entry) => entry.date < period.from) ?? visible[0] ?? null;
    const latest = visible.at(-1) ?? null;
    if (!latest) return { entries: [], anchor, latest: null, cutoff: period.from };
    const withAnchor = anchor && !visible.some((entry) => entry.id === anchor.id) ? [anchor, ...visible] : visible;
    return { entries: withAnchor, anchor, latest, cutoff: period.from };
  }
  const latest = ordered.at(-1) ?? null;
  if (!latest) return { entries: [], anchor: null, latest: null, cutoff: null };
  const cutoff = getRangeCutoff(latest.date, period.range);
  if (!cutoff) return { entries: ordered, anchor: ordered[0] ?? null, latest, cutoff: null };
  const visible = ordered.filter((entry) => entry.date >= cutoff);
  const anchor = [...ordered].reverse().find((entry) => entry.date <= cutoff) ?? visible[0] ?? ordered[0] ?? null;
  const withAnchor = anchor && !visible.some((entry) => entry.id === anchor.id) ? [anchor, ...visible] : visible;
  return { entries: withAnchor, anchor, latest, cutoff };
}
