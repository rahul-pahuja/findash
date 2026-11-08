export function formatCurrency(value: number | null | undefined, masked: boolean) {
  if (value === null || value === undefined) return "N/A";
  if (masked) return "₹ ••••";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
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
