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

export const ASSET_KEYS = ["mutualFunds", "nps", "stockMarket", "crypto"] as const;

export const ASSET_LABELS: Record<string, string> = {
  mutualFunds: "Mutual funds",
  nps: "NPS",
  stockMarket: "Stocks",
  crypto: "Crypto",
  liquid: "Liquid",
  fd: "FD",
  stocksWallet: "Stocks Wallet"
};

export const ASSET_COLORS: Record<string, string> = {
  mutualFunds: "#2447F5",
  stockMarket: "#FF6A3D",
  nps: "#B58CFF",
  crypto: "#E24C8B",
  liquid: "#1FB5A8",
  other: "#9A968C"
};

export const DARK_ASSET_COLORS: Record<string, string> = {
  mutualFunds: "#91A3FF",
  stockMarket: "#FF9A78",
  nps: "#D0B6FF",
  crypto: "#FF83B5",
  liquid: "#69D1C1",
  other: "#AAA69C"
};

const LIQUIDITY_COLORS = {
  bank: "#1FB5A8",
  sodexo: "#CFF1EE",
  fd: "#0E7A71",
  stocksWallet: "#8ADDD5"
};

const DARK_LIQUIDITY_COLORS = {
  bank: "#69D1C1",
  sodexo: "#3B615D",
  fd: "#5BBEB0",
  stocksWallet: "#467D75"
};

export function getAssetPalette(theme: "light" | "dark") {
  return theme === "dark" ? DARK_ASSET_COLORS : ASSET_COLORS;
}

export function getLiquidityPalette(theme: "light" | "dark") {
  return theme === "dark" ? DARK_LIQUIDITY_COLORS : LIQUIDITY_COLORS;
}
