export type RangeKey = "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "ALL";

export type TabKey = "dashboard" | "history" | "analytics";

export type NullableNumber = number | null;

export interface Dataset {
  entries: Entry[];
  meta: Meta;
  preferences?: DatasetPreferences;
}

export interface DatasetPreferences {
  version: 1;
  shortTermGoal?: ShortTermGoal | null;
  notifications?: {
    dismissedGoalPromptAt?: string;
    dismissedGapMonth?: string;
  };
}

export interface ShortTermGoal {
  targetAmount: number;
  targetDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Meta {
  currency: string;
  created: string;
  last_updated: string;
}

export interface Entry {
  id: string;
  date: string;
  income: { in_hand: NullableNumber };
  liquid: { bank: number; sodexo: number };
  hard_assets: { stocks_wallet: number; fd: number };
  market_assets: Record<string, MarketAsset>;
  sip?: Record<string, NullableNumber>;
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
  liquidBufferRatio: number | null;
  capitalAddedRate: number | null;
  investmentVelocity: number | null;
  incomeEstimated: boolean;
  totalSip: number;
  sipByAsset: Record<string, number>;
  contributionDelta: Record<string, number>;
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
  latestIncome: number | null;
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
  lifePortfolio: XirrLens;
  marketPortfolio: XirrLens;
  perAsset: XirrLens & { perAsset: Record<string, XirrAsset> };
}

export interface ApiError {
  error: string;
}
