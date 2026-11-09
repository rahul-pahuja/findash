import type { DataResponse, Dataset, DerivedMetric, RangeKey, SyncMetadata, SummaryMetric, Entry } from "../lib/types";
import { ASSET_KEYS } from "./config";
import { selectPeriod } from "./insights";

export function buildLocalDataResponse(dataset: Dataset, range: RangeKey, sync: SyncMetadata | null): DataResponse {
  const entries = [...dataset.entries].sort((a, b) => a.date.localeCompare(b.date));
  const period = selectPeriod(entries, { kind: "preset", range });
  const derived: Record<string, DerivedMetric> = {};
  let previousNetWorth: number | null = null;

  for (const entry of entries) {
    const liquidBuffer = entry.liquid.bank + entry.liquid.sodexo;
    const hardBalances = liquidBuffer + entry.hard_assets.fd + entry.hard_assets.stocks_wallet;
    const invested = ASSET_KEYS.reduce((sum, asset) => sum + (entry.market_assets[asset]?.invested ?? 0), 0);
    const marketExposure = ASSET_KEYS.reduce((sum, asset) => sum + (entry.market_assets[asset]?.current ?? 0), 0);
    const currentNetWorth = hardBalances + marketExposure;
    const hardCapital = hardBalances + invested;
    const allocationByAsset: Record<string, number> = {};
    for (const asset of ASSET_KEYS) allocationByAsset[asset] = currentNetWorth > 0 ? (entry.market_assets[asset]?.current ?? 0) / currentNetWorth : 0;
    allocationByAsset.liquid = currentNetWorth > 0 ? liquidBuffer / currentNetWorth : 0;
    allocationByAsset.fd = currentNetWorth > 0 ? entry.hard_assets.fd / currentNetWorth : 0;
    allocationByAsset.stocks_wallet = currentNetWorth > 0 ? entry.hard_assets.stocks_wallet / currentNetWorth : 0;
    derived[entry.id] = {
      hardCapital,
      currentNetWorth,
      unrealizedGain: currentNetWorth - hardCapital,
      liquidBuffer,
      marketExposure,
      netWorthAddition: previousNetWorth === null ? null : currentNetWorth - previousNetWorth,
      allocationByAsset,
      monthLabel: entry.date
    };
    previousNetWorth = currentNetWorth;
  }

  const latest = period.latest;
  const metric = latest ? derived[latest.id] : null;
  const summary: SummaryMetric = {
    rangeKey: range,
    entryCount: period.entries.length,
    latestMonth: latest?.id ?? "",
    latestNetWorth: metric?.currentNetWorth ?? 0,
    latestHardCapital: metric?.hardCapital ?? 0,
    latestLiquidBuffer: metric?.liquidBuffer ?? 0,
    allocationByAsset: metric?.allocationByAsset ?? {},
    totalUnrealized: metric?.unrealizedGain ?? 0
  };
  return {
    dataset: { ...dataset, entries },
    derived,
    visibleEntryIds: period.entries.map((entry) => entry.id),
    summary,
    range: { key: range, label: range === "ALL" ? "All time" : `Last ${range}` },
    sync: sync ?? { fileExists: false, fileUpdated: "", fileCurrency: dataset.meta.currency }
  };
}
