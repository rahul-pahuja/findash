import type { RangeKey } from "../lib/types";

export const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "3Y", label: "3Y" },
  { key: "5Y", label: "5Y" },
  { key: "ALL", label: "All" }
];

export const ASSET_KEYS = ["mutual_funds", "nps", "stock_market", "crypto"] as const;

export const ASSET_LABELS: Record<string, string> = {
  mutual_funds: "Mutual Funds",
  nps: "NPS",
  stock_market: "Stocks",
  crypto: "Crypto",
  liquid: "Liquid",
  fd: "FD",
  stocks_wallet: "Stocks Wallet"
};
