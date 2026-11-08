import type { DataResponse, Dataset, DerivedMetric, RangeKey, SyncMetadata, SummaryMetric, Entry } from "../lib/types";
import { ASSET_KEYS } from "./config";

function normalizeRange(range: RangeKey): RangeKey {
  return range;
}

function getCleanedEntries(entries: Entry[]): Entry[] {
  if (entries.length === 0) return [];

  return [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

function filterEntries(uniqueEntries: Entry[], range: RangeKey) {
  if (range === "ALL" || uniqueEntries.length === 0) {
    return uniqueEntries;
  }

  const counts: Record<Exclude<RangeKey, "ALL">, number> = {
    "1M": 1,
    "3M": 3,
    "6M": 6,
    "1Y": 12,
    "3Y": 36,
    "5Y": 60
  };

  const monthsToLookBack = counts[range as Exclude<RangeKey, "ALL">];
  const lastEntry = uniqueEntries[uniqueEntries.length - 1];
  const lastDate = new Date(lastEntry.date);
  
  // Calculate the cutoff date (N months ago)
  const cutoffDate = new Date(lastDate);
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsToLookBack);

  return uniqueEntries.filter((entry) => new Date(entry.date) >= cutoffDate);
}

export function buildLocalDataResponse(dataset: Dataset, range: RangeKey, sync: SyncMetadata | null): DataResponse {
  const cleanEntries = getCleanedEntries(dataset.entries);
  const visibleEntries = filterEntries(cleanEntries, range);
  
  const cleanDataset: Dataset = {
    ...dataset,
    entries: cleanEntries
  };

  const derived: Record<string, DerivedMetric> = {};
  let previousNetWorth: number | null = null;
  let previousLiquid = 0;
  let previousEntry: Entry | null = null;

  for (const entry of cleanEntries) {
    const baseCapital = entry.liquid.bank + entry.liquid.sodexo + entry.hard_assets.fd + entry.hard_assets.stocks_wallet;
    const liquidBuffer = entry.liquid.bank + entry.liquid.sodexo;
    let hardCapital = baseCapital;
    let marketExposure = 0;
    const allocationByAsset: Record<string, number> = {};
    const sipByAsset: Record<string, number> = {};
    const contributionDelta: Record<string, number> = {};

    for (const asset of ASSET_KEYS) {
      const market = entry.market_assets[asset];
      hardCapital += market.invested;
      marketExposure += market.current;
    }
    const currentNetWorth = baseCapital + ASSET_KEYS.reduce((sum, asset) => sum + entry.market_assets[asset].current, 0);

    for (const asset of ASSET_KEYS) {
      allocationByAsset[asset] = currentNetWorth > 0 ? entry.market_assets[asset].current / currentNetWorth : 0;
      const sip = entry.sip?.[asset] ?? 0;
      sipByAsset[asset] = sip ?? 0;
      const previousInvested = previousEntry ? previousEntry.market_assets[asset].invested : 0;
      contributionDelta[asset] = entry.market_assets[asset].invested - previousInvested - (sip ?? 0);
    }
    allocationByAsset.liquid = currentNetWorth > 0 ? liquidBuffer / currentNetWorth : 0;
    allocationByAsset.fd = currentNetWorth > 0 ? entry.hard_assets.fd / currentNetWorth : 0;
    allocationByAsset.stocks_wallet = currentNetWorth > 0 ? entry.hard_assets.stocks_wallet / currentNetWorth : 0;

    const totalSip = Object.values(sipByAsset).reduce((sum, value) => sum + value, 0);
    const netWorthAddition = previousNetWorth === null ? null : currentNetWorth - previousNetWorth;
    const liquidBufferRatio = entry.income.in_hand ? liquidBuffer / entry.income.in_hand : null;
    const capitalAddedRate = entry.income.in_hand ? (totalSip + Math.max(liquidBuffer - previousLiquid, 0)) / entry.income.in_hand : null;
    const investmentVelocity = entry.income.in_hand ? totalSip / entry.income.in_hand : null;

    derived[entry.id] = {
      hardCapital,
      currentNetWorth,
      unrealizedGain: currentNetWorth - hardCapital,
      liquidBuffer,
      marketExposure,
      netWorthAddition,
      liquidBufferRatio,
      capitalAddedRate,
      investmentVelocity,
      incomeEstimated: entry.income.in_hand === null,
      totalSip,
      sipByAsset,
      contributionDelta,
      allocationByAsset,
      monthLabel: entry.id
    };

    previousNetWorth = currentNetWorth;
    previousLiquid = liquidBuffer;
    previousEntry = entry;
  }

  const latestVisibleId = visibleEntries[visibleEntries.length - 1]?.id;
  const latestVisible = latestVisibleId ? derived[latestVisibleId] : null;
  const latestVisibleEntry = latestVisibleId ? dataset.entries.find((entry) => entry.id === latestVisibleId) ?? null : null;
  const summary: SummaryMetric = {
    rangeKey: range,
    entryCount: visibleEntries.length,
    latestMonth: latestVisibleId ?? "",
    latestNetWorth: latestVisible?.currentNetWorth ?? 0,
    latestHardCapital: latestVisible?.hardCapital ?? 0,
    latestLiquidBuffer: latestVisible?.liquidBuffer ?? 0,
    latestIncome: latestVisibleEntry?.income.in_hand ?? null,
    allocationByAsset: latestVisible?.allocationByAsset ?? {},
    totalUnrealized: latestVisible?.unrealizedGain ?? 0
  };

  return {
    dataset: cleanDataset,
    derived,
    visibleEntryIds: visibleEntries.map((entry) => entry.id),
    summary,
    range: { key: range, label: range === "ALL" ? "All Time" : `Last ${range}` },
    sync: sync ?? { fileExists: false, fileUpdated: "", fileCurrency: dataset.meta.currency }
  };
}
