import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ChartData } from "chart.js";
import { Chart as ChartJS, Filler, registerables } from "chart.js";
import { Chart } from "react-chartjs-2";
import type { DataResponse, Dataset } from "../lib/types";
import { ASSET_KEYS, ASSET_LABELS } from "../utils/config";
import { formatCompactCurrency, formatCurrency, formatMonthLabel, formatPercent } from "../utils/format";
import { InfoTooltip } from "./InfoTooltip";

ChartJS.register(...registerables, Filler);

interface Props {
  response: DataResponse | null;
  dataset: Dataset | null;
  masked: boolean;
  themeMode: "light" | "dark";
}

export function Charts({ response, dataset, masked, themeMode }: Props) {
  if (!response || !dataset) {
    return null;
  }

  const visibleEntries = dataset.entries.filter((entry) => response.visibleEntryIds.includes(entry.id));
  const progressionEntries = visibleEntries.slice(-7);
  const progressionLabels = progressionEntries.map((entry) => formatMonthLabel(entry.id));
  const latest = visibleEntries[visibleEntries.length - 1];
  const latestDerived = latest ? response.derived[latest.id] : null;
  const tooltipLabel = (value: number) => (masked ? "Hidden" : formatCurrency(value, false));

  // Read chart colors from CSS variables — same in light and dark mode
  const s = getComputedStyle(document.documentElement);
  const CHART = {
    primary: s.getPropertyValue("--chart-primary").trim() || "#111111",
    muted: s.getPropertyValue("--chart-muted").trim() || "#b8b8bd",
    grid: s.getPropertyValue("--chart-grid").trim() || "rgba(20,20,24,0.08)",
  };
  ChartJS.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif";
  ChartJS.defaults.color = s.getPropertyValue("--muted-foreground").trim() || "#77777d";
  const progressionData: ChartData<"bar", number[], string> = {
    labels: progressionLabels,
    datasets: [
      {
        label: "Net worth",
        data: progressionEntries.map((entry) => response.derived[entry.id]?.currentNetWorth ?? 0),
        backgroundColor: CHART.primary,
        borderRadius: 5,
        maxBarThickness: 24,
        categoryPercentage: 0.68,
        barPercentage: 0.82
      },
      {
        label: "Hard capital",
        data: progressionEntries.map((entry) => response.derived[entry.id]?.hardCapital ?? 0),
        backgroundColor: CHART.muted,
        borderRadius: 5,
        maxBarThickness: 24,
        categoryPercentage: 0.68,
        barPercentage: 0.82
      }
    ]
  };

  const allocationItems = latest && latestDerived
    ? [
        { label: "Liquid", value: latestDerived.liquidBuffer },
        { label: "Fixed deposits", value: latest.hard_assets.fd },
        { label: "Stocks wallet", value: latest.hard_assets.stocks_wallet },
        ...ASSET_KEYS.map((asset) => ({ label: ASSET_LABELS[asset], value: latest.market_assets[asset].current }))
      ].filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
    : [];
  const allocationTotal = allocationItems.reduce((total, item) => total + item.value, 0);

  return (
    <section key={themeMode} className="chart-grid">
      <ChartPanel title="Wealth Progression" subtitle={`Latest ${progressionEntries.length} snapshots`} className="chart-panel--progress" info="Compare your recorded net worth with the cash and principal contributed across your latest snapshots.">
        <Chart
          type="bar"
          data={progressionData}
          options={buildMoneyOptions(masked, tooltipLabel, true)}
        />
      </ChartPanel>

      <ChartPanel title="Asset Allocation" subtitle="Top holdings · share of net worth" className="chart-panel--allocation" info="The list ranks assets by current value. Percentages show each item's share of your latest net worth.">
        <AllocationList items={allocationItems} total={allocationTotal} masked={masked} />
      </ChartPanel>
    </section>
  );
}

function AllocationList({ items, total, masked }: { items: { label: string; value: number }[]; total: number; masked: boolean }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [itemLimit, setItemLimit] = useState(4);

  useEffect(() => {
    const node = listRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      setItemLimit(entry.contentRect.width < 390 ? 3 : 4);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (items.length === 0 || total <= 0) {
    return <div className="allocation-empty">No asset values in this snapshot.</div>;
  }

  const featured = items.slice(0, itemLimit);
  const otherValue = items.slice(itemLimit).reduce((sum, item) => sum + item.value, 0);
  const rows = otherValue > 0 ? [...featured, { label: "Other assets", value: otherValue }] : featured;
  const tones = ["#111112", "#55555b", "#85858b", "#b3b3b8", "#d2d2d6"];

  return (
    <div ref={listRef} className="allocation-list" role="list" aria-label="Asset allocation by share of net worth">
      {rows.map((item, index) => {
        const share = item.value / total;
        const percent = Math.max(0, share * 100);
        return (
          <div key={item.label} className="allocation-list-item" role="listitem" aria-label={`${item.label}: ${formatPercent(share, masked)} of net worth`}>
            <div className="allocation-list-heading">
              <span className="allocation-list-name">
                <span className="allocation-list-dot" style={{ backgroundColor: tones[Math.min(index, tones.length - 1)] }} aria-hidden="true" />
                <span>{item.label}</span>
              </span>
              <span className="allocation-list-percent">{formatPercent(share, masked)}</span>
            </div>
            <div className="allocation-list-track" aria-hidden="true">
              <span style={{ width: `${percent}%`, backgroundColor: tones[Math.min(index, tones.length - 1)] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChartPanel({ title, subtitle, children, className, info }: { title: string; subtitle?: string; children: ReactNode; className?: string; info?: string }) {
  return (
    <article className={`dashboard-card chart-panel ${className ?? ""}`}>
      <div className="chart-panel-heading">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {info ? <InfoTooltip text={info} /> : null}
      </div>
      <div className="chart-panel-content">{children}</div>
    </article>
  );
}

function buildMoneyOptions(masked: boolean, tooltipLabel: (value: number) => string, showLegend = false) {
  const grid = getComputedStyle(document.documentElement).getPropertyValue("--chart-grid").trim() || "rgba(148,144,163,0.12)";
  const foreground = getComputedStyle(document.documentElement).getPropertyValue("--muted-foreground").trim() || "#77777d";
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: showLegend
        ? {
            display: true,
            position: "top" as const,
            align: "end" as const,
            labels: {
              boxWidth: 8,
              boxHeight: 8,
              usePointStyle: true,
              pointStyle: "rectRounded" as const,
              padding: 12,
              font: { size: 10 }
            }
          }
        : { display: false },
      tooltip: {
        callbacks: {
          label(context: { dataset: { label?: string }; raw: unknown }) {
            const raw = typeof context.raw === "number" ? context.raw : Number(context.raw);
            return `${context.dataset.label}: ${tooltipLabel(raw)}`;
          }
        }
      }
    },
    scales: {
      y: {
        ticks: {
          color: foreground,
          font: { family: "-apple-system, BlinkMacSystemFont, sans-serif", size: 10 },
          callback(value: string | number) {
            return masked ? "" : formatCompactCurrency(Number(value), false);
          }
        },
        grid: { color: grid }
      },
      x: {
        ticks: { color: foreground, font: { family: "-apple-system, BlinkMacSystemFont, sans-serif", size: 10 } },
        grid: { display: false }
      }
    }
  };
}
