import type { Entry, RangeKey } from "../lib/types";
import { ASSET_KEYS } from "./config";

const RANGE_MONTHS: Partial<Record<RangeKey, number>> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  "3Y": 36,
  "5Y": 60
};

export interface SnapshotTotals {
  netWorth: number;
  hardCapital: number;
  unrealizedGain: number;
  marketValue: number;
  liquidBuffer: number;
}

export interface PeriodSelection {
  entries: Entry[];
  anchor: Entry | null;
  latest: Entry | null;
  cutoff: string | null;
}

export function getSnapshotTotals(entry: Entry): SnapshotTotals {
  const liquidAndHard = entry.liquid.bank + entry.liquid.sodexo
    + entry.hard_assets.fd + entry.hard_assets.stocks_wallet;
  const invested = ASSET_KEYS.reduce((sum, asset) => sum + (entry.market_assets[asset]?.invested ?? 0), 0);
  const marketValue = ASSET_KEYS.reduce((sum, asset) => sum + (entry.market_assets[asset]?.current ?? 0), 0);
  const netWorth = liquidAndHard + marketValue;
  const hardCapital = liquidAndHard + invested;
  return {
    netWorth,
    hardCapital,
    unrealizedGain: netWorth - hardCapital,
    marketValue,
    liquidBuffer: entry.liquid.bank + entry.liquid.sodexo
  };
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

export function selectPeriod(entries: Entry[], range: RangeKey): PeriodSelection {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered[ordered.length - 1] ?? null;
  if (!latest) return { entries: [], anchor: null, latest: null, cutoff: null };

  const cutoff = getRangeCutoff(latest.date, range);
  if (!cutoff) return { entries: ordered, anchor: ordered[0] ?? null, latest, cutoff: null };

  const visible = ordered.filter((entry) => entry.date >= cutoff);
  const anchor = [...ordered].reverse().find((entry) => entry.date <= cutoff) ?? visible[0] ?? ordered[0] ?? null;
  const withAnchor = anchor && !visible.some((entry) => entry.id === anchor.id)
    ? [anchor, ...visible]
    : visible;
  return { entries: withAnchor, anchor, latest, cutoff };
}

export function getRecentCapitalPace(entries: Entry[]) {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered[ordered.length - 1];
  if (!latest || ordered.length < 2) return null;

  const cutoff = getRangeCutoff(latest.date, "6M");
  const anchor = cutoff
    ? [...ordered].reverse().find((entry) => entry.date <= cutoff) ?? ordered[0]
    : ordered[0];
  if (!anchor || anchor.id === latest.id) return null;

  const elapsedDays = (Date.parse(`${latest.date}T00:00:00Z`) - Date.parse(`${anchor.date}T00:00:00Z`)) / 86_400_000;
  if (elapsedDays < 30) return null;
  const hardCapitalChange = getSnapshotTotals(latest).hardCapital - getSnapshotTotals(anchor).hardCapital;
  return {
    amountPerMonth: hardCapitalChange / (elapsedDays / 30.4375),
    hardCapitalChange,
    anchor,
    latest,
    elapsedDays
  };
}

export function getPeakDrawdown(entries: Entry[]) {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered[ordered.length - 1];
  if (!latest || ordered.length < 2) return null;
  const peak = ordered.reduce((best, entry) => getSnapshotTotals(entry).netWorth > getSnapshotTotals(best).netWorth ? entry : best);
  const peakValue = getSnapshotTotals(peak).netWorth;
  const latestValue = getSnapshotTotals(latest).netWorth;
  return {
    peak,
    peakValue,
    latestValue,
    amount: latestValue - peakValue,
    percent: peakValue > 0 ? (latestValue - peakValue) / peakValue : 0
  };
}

export function getBigMoves(entries: Entry[], count = 5) {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return ordered.slice(1).map((entry, index) => {
    const previous = ordered[index];
    const previousWorth = getSnapshotTotals(previous).netWorth;
    const change = getSnapshotTotals(entry).netWorth - previousWorth;
    return {
      entry,
      previous,
      change,
      percent: previousWorth > 0 ? change / previousWorth : 0,
      magnitude: previousWorth > 0 ? Math.abs(change / previousWorth) : 0
    };
  }).sort((a, b) => b.magnitude - a.magnitude || b.entry.date.localeCompare(a.entry.date)).slice(0, count);
}

export function getMostRecentMissingMonth(entries: Entry[]) {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let latestGap: { key: string; suggestedDate: string } | null = null;
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const [previousYear, previousMonth] = previous.date.split("-").map(Number);
    const [currentYear, currentMonth] = current.date.split("-").map(Number);
    let monthSerial = previousYear * 12 + previousMonth;
    const endSerial = currentYear * 12 + currentMonth - 1;
    while (monthSerial < endSerial) {
      const year = Math.floor(monthSerial / 12);
      const month = (monthSerial % 12) + 1;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      latestGap = {
        key: `${year}-${String(month).padStart(2, "0")}`,
        suggestedDate: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      };
      monthSerial += 1;
    }
  }
  return latestGap;
}
