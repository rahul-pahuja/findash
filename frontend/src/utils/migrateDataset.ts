import type { Dataset, Entry, Goal, UserSettings } from "../lib/types";

export const CURRENT_SCHEMA_VERSION = 2;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  profileName: "",
  appearance: "auto",
  numberFormat: "indian",
  defaultLandingPage: "dashboard",
  hideAmountsByDefault: false,
  autoHideOnBlur: false,
  reminderDayOfMonth: 1,
  expectedMarketReturn: null,
  emergencyFundTargetMonths: 6
};

export function migrateDataset(input: unknown): Dataset {
  if (!input || typeof input !== "object") throw new Error("Invalid dataset format.");
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.entries) || !raw.meta || typeof raw.meta !== "object") throw new Error("Invalid dataset format.");
  if (typeof raw.schemaVersion === "number" && raw.schemaVersion > CURRENT_SCHEMA_VERSION) throw new Error(`This JSON uses schema version ${raw.schemaVersion}, newer than this app supports.`);

  const oldPreferences = raw.preferences && typeof raw.preferences === "object"
    ? raw.preferences as Record<string, unknown>
    : {};
  const oldGoal = oldPreferences.shortTermGoal as Record<string, unknown> | null | undefined;
  const migratedGoal: Goal[] = oldGoal && Number(oldGoal.targetAmount) > 0
    ? [{
      id: "migrated-short-term-target",
      name: "Short-term target",
      type: "milestone",
      targetAmount: Number(oldGoal.targetAmount),
      ...(typeof oldGoal.targetDate === "string" && oldGoal.targetDate ? { targetDate: oldGoal.targetDate } : {}),
      createdAt: typeof oldGoal.createdAt === "string" ? oldGoal.createdAt : new Date().toISOString(),
      updatedAt: typeof oldGoal.updatedAt === "string" ? oldGoal.updatedAt : new Date().toISOString()
    }]
    : [];
  const entries = (raw.entries as Array<Entry & { income?: unknown; sip?: unknown }>).map((entry) => {
    const { income: _income, sip: _sip, ...snapshot } = entry;
    return { ...snapshot, oneOffs: Array.isArray(snapshot.oneOffs) ? snapshot.oneOffs : [] } as Entry;
  });
  const notifications = oldPreferences.notifications && typeof oldPreferences.notifications === "object"
    ? oldPreferences.notifications
    : {};

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    entries,
    meta: raw.meta as Dataset["meta"],
    incomeHistory: Array.isArray(raw.incomeHistory) ? raw.incomeHistory as Dataset["incomeHistory"] : [],
    expenseHistory: Array.isArray(raw.expenseHistory) ? raw.expenseHistory as Dataset["expenseHistory"] : [],
    goals: Array.isArray(raw.goals) ? raw.goals as Dataset["goals"] : migratedGoal,
    settings: { ...DEFAULT_USER_SETTINGS, ...(raw.settings && typeof raw.settings === "object" ? raw.settings as Partial<UserSettings> : {}) },
    preferences: { version: 2, notifications: notifications as NonNullable<Dataset["preferences"]>["notifications"] }
  };
}
