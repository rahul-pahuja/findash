import type { RangeKey } from "../lib/types";

export type AppPage = "dashboard" | "snapshots" | "analytics-overview" | "analytics-investments" | "plan" | "settings" | "not-found";

export interface AppRoute {
  page: AppPage;
  canonicalPath: string;
  redirect?: string;
}

export type AnalyticsPeriod =
  | { kind: "preset"; range: RangeKey }
  | { kind: "custom"; from: string; to: string };

const validRanges = new Set<RangeKey>(["1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"]);
const validDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!validDatePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function resolveRoute(pathname: string): AppRoute {
  if (pathname === "/" || pathname === "") return { page: "dashboard", canonicalPath: "/" };
  if (pathname === "/snapshots") return { page: "snapshots", canonicalPath: pathname };
  if (pathname === "/analytics") return { page: "analytics-overview", canonicalPath: "/analytics/overview", redirect: "/analytics/overview" };
  if (pathname === "/analytics/overview") return { page: "analytics-overview", canonicalPath: pathname };
  if (pathname === "/analytics/investments") return { page: "analytics-investments", canonicalPath: pathname };
  if (pathname === "/plan") return { page: "plan", canonicalPath: pathname };
  if (pathname === "/settings") return { page: "settings", canonicalPath: pathname };
  return { page: "not-found", canonicalPath: pathname };
}

export function parseAnalyticsPeriod(search: string, fallback: AnalyticsPeriod = { kind: "preset", range: "ALL" }): AnalyticsPeriod {
  const params = new URLSearchParams(search);
  const from = params.get("from");
  const to = params.get("to");
  if (from && to && isValidDate(from) && isValidDate(to) && from <= to) {
    return { kind: "custom", from, to };
  }
  const requested = params.get("range")?.toUpperCase() as RangeKey | undefined;
  if (requested && validRanges.has(requested)) return { kind: "preset", range: requested };
  return fallback;
}

export function serializeAnalyticsPeriod(period: AnalyticsPeriod) {
  const params = new URLSearchParams();
  if (period.kind === "custom") {
    params.set("from", period.from);
    params.set("to", period.to);
  } else {
    params.set("range", period.range.toLowerCase());
  }
  return params.toString();
}

export function analyticsPeriodLabel(period: AnalyticsPeriod) {
  if (period.kind === "custom") return period.from && period.to ? `${formatIsoDate(period.from)} – ${formatIsoDate(period.to)}` : "Choose dates";
  const labels: Record<RangeKey, string> = {
    "1M": "Last month",
    "3M": "Last 3 months",
    "6M": "Last 6 months",
    "1Y": "Last year",
    "3Y": "Last 3 years",
    "5Y": "Last 5 years",
    ALL: "All time"
  };
  return labels[period.range];
}

function formatIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
  return `${day} ${monthLabel} ${year}`;
}
