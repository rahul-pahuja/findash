import type { Entry, RangeKey } from "../lib/types";
import { ASSET_KEYS } from "./config";
import { getRangeCutoff } from "./period";
export { getRangeCutoff, selectPeriod } from "./period";

export interface SnapshotTotals {
  netWorth: number;
  hardCapital: number;
  unrealizedGain: number;
  marketValue: number;
  liquidBuffer: number;
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

export function getEffectiveMonthlyAmount(history: Array<{ from: string; monthlyAmount: number }>, date: string) {
  return [...history].sort((a, b) => a.from.localeCompare(b.from)).filter((item) => item.from <= date).at(-1)?.monthlyAmount ?? null;
}

export function getRegularCapitalPace(entries: Entry[], months = 6) {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered.at(-1);
  if (!latest || ordered.length < 2) return null;
  const range: RangeKey = months <= 6 ? "6M" : months <= 12 ? "1Y" : months <= 36 ? "3Y" : "ALL";
  const cutoff = range === "ALL" ? null : getRangeCutoff(latest.date, range);
  const anchor = (cutoff ? [...ordered].reverse().find((entry) => entry.date <= cutoff) : null) ?? ordered[0];
  if (anchor.id === latest.id) return null;
  const elapsedDays = (Date.parse(`${latest.date}T00:00:00Z`) - Date.parse(`${anchor.date}T00:00:00Z`)) / 86_400_000;
  if (elapsedDays < 30) return null;
  const oneOffAdjustment = ordered.filter((entry) => entry.date > anchor.date && entry.date <= latest.date)
    .flatMap((entry) => entry.oneOffs ?? [])
    .reduce((sum, item) => sum + (item.type === "inflow" ? item.amount : -item.amount), 0);
  const regularChange = getSnapshotTotals(latest).hardCapital - getSnapshotTotals(anchor).hardCapital - oneOffAdjustment;
  return { amountPerMonth: regularChange / (elapsedDays / 30.4375), regularChange, anchor, latest, elapsedDays, oneOffAdjustment };
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
