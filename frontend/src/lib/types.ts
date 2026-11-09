export type RangeKey = "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "ALL";

export type LandingPageKey = "dashboard" | "snapshots" | "analytics-overview" | "plan";
export type AppearancePreference = "light" | "dark" | "auto";
export type NumberFormatPreference = "indian" | "international";

export type NullableNumber = number | null;

export interface Dataset {
  schemaVersion: number;
  entries: Entry[];
  meta: Meta;
  incomeHistory: EffectiveDatedAmount[];
  expenseHistory: EffectiveDatedAmount[];
  goals: Goal[];
  settings: UserSettings;
  preferences?: DatasetPreferences;
}

export interface DatasetPreferences {
  version: 2;
  notifications?: {
    dismissedGoalPromptAt?: string;
    snoozedGoalPromptUntil?: string;
    dismissedGapMonth?: string;
  };
}

export interface UserSettings {
  profileName: string;
  appearance: AppearancePreference;
  numberFormat: NumberFormatPreference;
  defaultLandingPage: LandingPageKey;
  hideAmountsByDefault: boolean;
  autoHideOnBlur: boolean;
  reminderDayOfMonth: number;
  expectedMarketReturn: number | null;
  emergencyFundTargetMonths: number;
}

export interface EffectiveDatedAmount {
  from: string;
  monthlyAmount: number;
}

export interface Goal {
  id: string;
  name: string;
  type: "milestone" | "long-term";
  targetAmount: number;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OneOff {
  id: string;
  type: "inflow" | "outflow";
  amount: number;
  label: string;
}

export interface Meta {
  currency: string;
  created: string;
  last_updated: string;
}

export interface Entry {
  id: string;
  date: string;
  liquid: { bank: number; sodexo: number };
  hard_assets: { stocks_wallet: number; fd: number };
  market_assets: Record<string, MarketAsset>;
  oneOffs: OneOff[];
  expenses_note: string;
}

export interface MarketAsset {
  invested: number;
  current: number;
}

export interface DerivedMetric {
  hardCapital: number;
  currentNetWorth: number;
  unrealizedGain: number;
  liquidBuffer: number;
  marketExposure: number;
  netWorthAddition: number | null;
  allocationByAsset: Record<string, number>;
  monthLabel: string;
}

export interface SummaryMetric {
  rangeKey: RangeKey;
  entryCount: number;
  latestMonth: string;
  latestNetWorth: number;
  latestHardCapital: number;
  latestLiquidBuffer: number;
  allocationByAsset: Record<string, number>;
  totalUnrealized: number;
}

export interface SyncMetadata {
  fileExists: boolean;
  fileUpdated: string;
  fileCurrency: string;
}

export interface DataResponse {
  dataset: Dataset;
  derived: Record<string, DerivedMetric>;
  visibleEntryIds: string[];
  summary: SummaryMetric;
  range: { key: RangeKey; label: string };
  sync: SyncMetadata;
}

export interface XirrLens {
  value: number | null;
  status: string;
  message: string;
  rangeKey: RangeKey;
  startDate: string;
  endDate: string;
}

export interface XirrAsset {
  value: number | null;
  status: string;
  message: string;
  invested: number;
  current: number;
}

export interface XirrResponse {
  marketPortfolio: XirrLens;
  perAsset: XirrLens & { perAsset: Record<string, XirrAsset> };
}

export interface ApiError {
  error: string;
}
