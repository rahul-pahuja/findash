let numberLocale: "en-IN" | "en-US" = "en-IN";
let numberStyle: "indian" | "international" = "indian";

export function setNumberFormatPreference(preference: "indian" | "international") {
  numberStyle = preference;
  numberLocale = preference === "indian" ? "en-IN" : "en-US";
}

export function formatCurrency(value: number | null | undefined, masked: boolean) {
  if (value === null || value === undefined) return "N/A";
  if (masked) return "₹ ••••";
  const formatter = new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
  return value < 0 ? `−${formatter.format(Math.abs(value))}` : formatter.format(value);
}

export function formatSigned(value: number | null | undefined, masked = false) {
  if (value === null || value === undefined) return "N/A";
  if (masked) return "₹ ••••";
  const sign = value < 0 ? "−" : value > 0 ? "+" : "";
  return `${sign}${formatCurrency(Math.abs(value), false)}`;
}

export function formatSignedPercent(value: number | null | undefined, masked: boolean, digits = 1) {
  if (value === null || value === undefined) return "N/A";
  if (masked) return "••%";
  const sign = value < 0 ? "−" : value > 0 ? "+" : "";
  return `${sign}${Math.abs(value * 100).toFixed(digits)}%`;
}

export function getCompactCurrencyParts(value: number | null | undefined, masked: boolean) {
  if (value === null || value === undefined) return "N/A";
  if (masked) return { amount: "₹", unit: "••••" };

  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const compactFormat = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 });
  if (numberStyle === "international") {
    if (absoluteValue >= 1_000_000) return { amount: `${sign}₹${compactFormat.format(absoluteValue / 1_000_000)}`, unit: "M" };
    if (absoluteValue >= 1_000) return { amount: `${sign}₹${compactFormat.format(absoluteValue / 1_000)}`, unit: "K" };
    return { amount: `${sign}${formatCurrency(absoluteValue, false)}`, unit: null };
  }
  if (absoluteValue >= 10_000_000) return { amount: `${sign}₹${compactFormat.format(absoluteValue / 10_000_000)}`, unit: "Cr" };
  if (absoluteValue >= 100_000) return { amount: `${sign}₹${compactFormat.format(absoluteValue / 100_000)}`, unit: "L" };
  return { amount: `${sign}${formatCurrency(absoluteValue, false)}`, unit: null };
}

export function formatCompactCurrency(value: number | null | undefined, masked: boolean) {
  const parts = getCompactCurrencyParts(value, masked);
  if (typeof parts === "string") return parts;
  return parts.unit ? `${parts.amount}\u202f${parts.unit}` : parts.amount;
}

export function formatPercent(value: number | null | undefined, masked: boolean) {
  if (value === null || value === undefined) return "N/A";
  if (masked) return "••%";
  return `${(value * 100).toFixed(1)}%`;
}

/** Monthly amount rendered in lakhs to one decimal, e.g. "₹3.7 L". */
export function formatLakhsPerMonth(value: number | null | undefined, masked = false) {
  if (value === null || value === undefined) return "N/A";
  if (masked) return "₹ ••••";
  const sign = value < 0 ? "−" : "";
  const lakhs = Math.round(Math.abs(value) / 100_000 * 10) / 10;
  return `${sign}₹${lakhs.toFixed(1)}\u202fL`;
}

/** Next snapshot due date after the latest snapshot, from the reminder day, e.g. "1 Dec". */
export function formatNextDueLabel(latestDate: string, reminderDay: number, now = new Date()) {
  const [latestYear, latestMonth, latestDay] = latestDate.split("-").map(Number);
  const day = Math.min(Math.max(Math.round(reminderDay), 1), 31);
  for (let offset = 0; offset <= 12; offset += 1) {
    const total = latestYear * 12 + (latestMonth - 1) + offset;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    const dueDay = Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate());
    if (year === latestYear && month === latestMonth && dueDay <= latestDay) continue;
    const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, dueDay)));
    return year === now.getFullYear() ? `${dueDay} ${monthLabel}` : `${dueDay} ${monthLabel} ${year}`;
  }
  return null;
}

export function formatDateLabel(value: string, includeYear = true) {
  const [year, month, day] = value.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return includeYear ? `${day} ${monthName} ${year}` : `${day} ${monthName}`;
}

export function formatDateRangeLabel(start: string, end: string) {
  if (start === end) return formatDateLabel(start);
  const crossesYears = Number(start.slice(0, 4)) !== Number(end.slice(0, 4));
  return `${formatDateLabel(start, crossesYears)} – ${formatDateLabel(end, crossesYears)}`;
}

export function formatChartMonth(timestamp: number) {
  const date = new Date(timestamp);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
  const year = new Intl.DateTimeFormat("en-US", { year: "2-digit", timeZone: "UTC" }).format(date);
  return `${month} ’${year}`;
}

export function getNiceAxisBounds(values: number[], targetTicks = 4) {
  if (values.length === 0) return { min: 0, max: 1, step: 1 };
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const rawRange = dataMax - dataMin || Math.max(Math.abs(dataMax) * 0.2, 1);
  const rawStep = rawRange / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  let min = Math.floor(dataMin / step) * step;
  let max = Math.ceil(dataMax / step) * step;
  if (min === max) {
    min -= step;
    max += step;
  }
  return { min, max, step };
}

export function formatMonthLabel(id: string) {
  const [year, month] = id.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}
