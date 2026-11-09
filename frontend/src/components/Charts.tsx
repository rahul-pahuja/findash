import type { ChartData, ChartOptions, Plugin } from "chart.js";
import { Chart as ChartJS, Filler, registerables } from "chart.js";
import { Chart } from "react-chartjs-2";
import type { ReactNode } from "react";
import type { DataResponse, Entry, RangeKey } from "../lib/types";
import { SegmentedControl } from "./FormControls";
import { ASSET_KEYS, ASSET_LABELS, getAssetPalette } from "../utils/config";
import { formatChartMonth, formatCompactCurrency, formatCurrency, formatDateLabel, formatPercent, getNiceAxisBounds } from "../utils/format";
import { getSnapshotTotals, selectPeriod } from "../utils/insights";

ChartJS.register(...registerables, Filler);

interface Props {
  response: DataResponse | null;
  dataset: DataResponse["dataset"] | null;
  masked: boolean;
  themeMode: "light" | "dark";
  chartRange: RangeKey;
  onChartRangeChange: (range: RangeKey) => void;
}

export function Charts({ response, dataset, masked, themeMode, chartRange, onChartRangeChange }: Props) {
  if (!response || !dataset) return null;

  const entries = [...dataset.entries].sort((a, b) => a.date.localeCompare(b.date));
  const assetColors = getAssetPalette(themeMode);
  const netWorthColor = themeMode === "dark" ? "#91A3FF" : "#2447F5";
  const hardCapitalColor = themeMode === "dark" ? "#AAA69C" : "#6B6860";
  const marketFill = themeMode === "dark" ? "rgba(104,120,179,.28)" : "rgba(184,196,255,.55)";
  const progressionEntries = selectPeriod(entries, chartRange).entries;
  const latest = entries[entries.length - 1];
  const latestTotals = latest ? getSnapshotTotals(latest) : null;
  const chartGrid = themeMode === "dark" ? "rgba(245,244,239,.10)" : "rgba(22,22,20,.09)";
  const chartLabel = themeMode === "dark" ? "#AAA9A2" : "#75736D";
  const notes = progressionEntries.filter((entry) => Boolean((entry.expensesNote ?? "").trim()));
  const progressionPoints = progressionEntries.map((entry) => ({ x: Date.parse(`${entry.date}T00:00:00Z`), y: getSnapshotTotals(entry).netWorth }));
  const hardCapitalPoints = progressionEntries.map((entry) => ({ x: Date.parse(`${entry.date}T00:00:00Z`), y: getSnapshotTotals(entry).hardCapital }));
  const progressionAxis = getNiceAxisBounds([...progressionPoints, ...hardCapitalPoints].map((point) => point.y));
  const firstTimestamp = progressionPoints[0]?.x;
  const lastTimestamp = progressionPoints[progressionPoints.length - 1]?.x;

  const eventPlugin: Plugin<"line"> = {
    id: "snapshot-note-markers",
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      const notePoints = chart.getDatasetMeta(2).data;
      notePoints.forEach((point) => {
        const { x, y } = point.getProps(["x", "y"], true);
        if (x < chart.chartArea.left || x > chart.chartArea.right) return;
        ctx.save();
        ctx.strokeStyle = themeMode === "dark" ? "rgba(244,242,237,.40)" : "rgba(17,17,17,.30)";
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(x, chart.chartArea.top + 8);
        ctx.lineTo(x, chart.chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = assetColors.other;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = themeMode === "dark" ? "#20211E" : "#F4F2ED";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      });
    }
  };

  const progressionData: ChartData<"line", { x: number; y: number }[]> = {
    datasets: [
      {
        label: "Net worth",
        data: progressionPoints,
        borderColor: netWorthColor,
        backgroundColor: marketFill,
        borderWidth: 2.5,
        pointRadius: progressionEntries.length < 2 ? 3 : 0,
        pointHoverRadius: 4,
        pointBackgroundColor: netWorthColor,
        pointBorderWidth: 0,
        tension: 0.18,
        fill: { target: 1, above: marketFill, below: marketFill }
      },
      {
        label: "Hard capital",
        data: hardCapitalPoints,
        borderColor: hardCapitalColor,
        backgroundColor: "transparent",
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointBorderWidth: 0,
        tension: 0.18,
        fill: false
      },
      {
        label: "Snapshot notes",
        data: notes.map((entry) => ({ x: Date.parse(`${entry.date}T00:00:00Z`), y: getSnapshotTotals(entry).netWorth })),
        borderColor: "transparent",
        backgroundColor: "transparent",
        borderWidth: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointBorderWidth: 0,
        showLine: false,
        fill: false
      }
    ]
  };

  const progressionOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter(context) { return context.datasetIndex < 2; },
        backgroundColor: themeMode === "dark" ? "#252622" : "#FFFFFF",
        borderColor: themeMode === "dark" ? "#41413A" : "#DAD6CD",
        borderWidth: 1,
        cornerRadius: 12,
        displayColors: false,
        padding: { top: 8, right: 10, bottom: 8, left: 10 },
        titleFont: { size: 10, weight: 600 },
        bodyFont: { size: 11, weight: 550 },
        titleColor: themeMode === "dark" ? "#AAA69C" : "#6B6860",
        bodyColor: themeMode === "dark" ? "#F4F2ED" : "#111111",
        callbacks: {
          title(items) {
            const timestamp = Number(items[0]?.parsed.x ?? 0);
            const entry = progressionEntries.find((item) => Date.parse(`${item.date}T00:00:00Z`) === timestamp);
            return entry ? formatDateLabel(entry.date) : "Snapshot";
          },
          label(context) {
            const value = Number(context.parsed.y);
            return `${context.dataset.label}: ${formatCurrency(value, masked)}`;
          },
          afterBody(items) {
            const timestamp = Number(items[0]?.parsed.x ?? 0);
            const entry = progressionEntries.find((item) => Date.parse(`${item.date}T00:00:00Z`) === timestamp);
            if (!entry?.expensesNote) return [];
            const note = (entry.expensesNote ?? "").trim();
            return [`Note: ${note.length > 78 ? `${note.slice(0, 75).trimEnd()}…` : note}`];
          }
        }
      }
    },
    scales: {
      x: {
        type: "linear",
        ...(firstTimestamp !== undefined && lastTimestamp !== undefined ? { min: firstTimestamp, max: lastTimestamp === firstTimestamp ? firstTimestamp + 86_400_000 : lastTimestamp } : {}),
        grid: { display: false },
        border: { display: false },
        ticks: {
          maxTicksLimit: 6,
          maxRotation: 0,
          color: chartLabel,
          callback(value) {
            return formatChartMonth(Number(value));
          }
        }
      },
      y: {
        position: "right",
        min: progressionAxis.min,
        max: progressionAxis.max,
        grid: { color: chartGrid, drawTicks: false },
        border: { display: false },
        ticks: {
          maxTicksLimit: 4,
          stepSize: progressionAxis.step,
          color: chartLabel,
          callback(value) { return masked ? "" : formatCompactCurrency(Number(value), false); }
        }
      }
    }
  };

  const allocationItems = latest ? [
    ...ASSET_KEYS.map((asset) => ({ key: asset, label: ASSET_LABELS[asset], value: latest.marketAssets?.[asset]?.current ?? 0 })),
    { key: "liquid", label: "Cash buffer", value: latestTotals?.liquidBuffer ?? 0 },
    { key: "other", label: "Deposits + wallet", value: (latest.hardAssets?.fd ?? 0) + (latest.hardAssets?.stocksWallet ?? 0) }
  ].filter((item) => item.value > 0).sort((a, b) => b.value - a.value) : [];
  const allocationTotal = latestTotals?.netWorth ?? 0;
  const largestAllocation = allocationTotal > 0 ? allocationItems[0] : null;

  return (
    <section className="dashboard-visual-grid" aria-label="Wealth over time and asset allocation">
      <ChartPanel title="Wealth progression" subtitle={`${progressionEntries.length} snapshots · actual dates`} className="progression-panel" actions={<SegmentedControl<RangeKey> ariaLabel="Chart date range" value={chartRange} onChange={onChartRangeChange} className="chart-range-control" options={[{ value: "3M", label: "3M" }, { value: "1Y", label: "1Y" }, { value: "ALL", label: "All" }]} />}>
        {progressionEntries.length > 0 ? (
          <>
            <div className="progression-legend"><span><i className="legend-line is-ink" />Net worth</span><span><i className="legend-line is-muted" />Hard capital</span><span><i className="legend-area" />Market movement</span><span><i className="legend-event-dot" />Snapshot note</span></div>
            <div className="wealth-chart"><Chart type="line" data={progressionData} options={progressionOptions} plugins={[eventPlugin]} /></div>
          </>
        ) : <p className="chart-empty">Add a snapshot to see your wealth progression.</p>}
      </ChartPanel>

      <ChartPanel title="Allocation" subtitle="Share of latest net worth" className="allocation-panel">
        {allocationItems.length > 0 ? (
          <>
            <div className="allocation-stacked-bar" role="img" aria-label={allocationItems.map((item) => `${item.label} ${formatPercent(item.value / allocationTotal, masked)}`).join(", ")}>
              {allocationItems.map((item) => <span key={item.key} style={{ width: `${Math.max(0.7, (item.value / allocationTotal) * 100)}%`, backgroundColor: assetColors[item.key] ?? assetColors.other }} />)}
            </div>
            <div className="allocation-data-list">
              {allocationItems.map((item) => (
                <div className="allocation-data-row" key={item.key}>
                  <span className="allocation-name"><i style={{ backgroundColor: assetColors[item.key] ?? assetColors.other }} /><span>{item.label}</span></span>
                  <strong>{formatCurrency(item.value, masked)}</strong>
                  <b>{formatPercent(item.value / allocationTotal, masked)}</b>
                </div>
              ))}
            </div>
            {largestAllocation ? <p className="allocation-callout">Largest share: <strong>{largestAllocation.label}</strong> · {formatPercent(largestAllocation.value / allocationTotal, masked)} of current net worth.</p> : null}
          </>
        ) : <p className="chart-empty">No asset values in this snapshot.</p>}
      </ChartPanel>
    </section>
  );
}

function ChartPanel({ title, subtitle, children, className, actions }: { title: string; subtitle: string; children: ReactNode; className: string; actions?: ReactNode }) {
  return <article className={`chart-panel ${className}`}><div className="chart-panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{actions}</div>{children}</article>;
}
