export function formatCurrency(value: number | null | undefined, masked: boolean) {
  if (value === null || value === undefined) return "N/A";
  if (masked) return "₹ ••••";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatCompactCurrency(value: number | null | undefined, masked: boolean) {
  if (value === null || value === undefined) return "N/A";
  if (masked) return "₹ ••••";

  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const compactFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
  if (absoluteValue >= 10_000_000) return `${sign}₹${compactFormat.format(absoluteValue / 10_000_000)} Cr`;
  if (absoluteValue >= 100_000) return `${sign}₹${compactFormat.format(absoluteValue / 100_000)} L`;
  if (absoluteValue >= 1_000) return `${sign}₹${compactFormat.format(absoluteValue / 1_000)}K`;
  return `${sign}${formatCurrency(absoluteValue, false)}`;
}

export function formatPercent(value: number | null | undefined, masked: boolean) {
  if (value === null || value === undefined) return "N/A";
  if (masked) return "••%";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatMonthLabel(id: string) {
  const [year, month] = id.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(date);
}
