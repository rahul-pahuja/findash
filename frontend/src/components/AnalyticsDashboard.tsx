import type { ChartData, ChartOptions, Plugin } from "chart.js";
import { Chart as ChartJS, registerables } from "chart.js";
import { Chart } from "react-chartjs-2";
import type { DataResponse, Entry, XirrResponse } from "../lib/types";
import type { AnalyticsPeriod } from "../utils/router";
import { analyticsPeriodLabel } from "../utils/router";
import { InfoTooltip } from "./InfoTooltip";
import { CompactCurrency } from "./CompactCurrency";
import { SegmentedControl } from "./FormControls";
import { ASSET_KEYS, ASSET_LABELS, getAssetPalette, getLiquidityPalette } from "../utils/config";
import { formatChartMonth, formatCompactCurrency, formatCurrency, formatDateLabel, formatSigned, formatSignedPercent, getNiceAxisBounds } from "../utils/format";
import { getSnapshotTotals, selectPeriod } from "../utils/insights";

ChartJS.register(...registerables);

interface Props {
  response: DataResponse | null;
  returns: XirrResponse | null;
  returnsLoading: boolean;
  masked: boolean;
  themeMode: "light" | "dark";
  period: AnalyticsPeriod;
  section: "overview" | "investments";
  onSectionChange: (section: "overview" | "investments") => void;
}

function fullDate(date: string) {
  return formatDateLabel(date);
}

export function AnalyticsDashboard({ response, returns, returnsLoading, masked, themeMode, period: selectedPeriod, section, onSectionChange }: Props) {
  const dataset = response?.dataset;
  const assetColors = getAssetPalette(themeMode);
  const liquidityColors = getLiquidityPalette(themeMode);
  const allEntries = dataset ? [...dataset.entries].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const period = selectPeriod(allEntries, selectedPeriod);
  const entries = period.entries;
  const anchor = period.anchor;
  const latest = period.latest;
  const latestTotals = latest ? getSnapshotTotals(latest) : null;
  const anchorTotals = anchor ? getSnapshotTotals(anchor) : null;
  const change = latestTotals && anchorTotals ? latestTotals.netWorth - anchorTotals.netWorth : null;
  const changePercent = anchorTotals && anchorTotals.netWorth > 0 && change !== null ? change / anchorTotals.netWorth : null;
  const hardCapitalChange = latestTotals && anchorTotals ? latestTotals.hardCapital - anchorTotals.hardCapital : 0;
  const unrealizedChange = latestTotals && anchorTotals ? latestTotals.unrealizedGain - anchorTotals.unrealizedGain : 0;
  const absoluteMovement = Math.abs(hardCapitalChange) + Math.abs(unrealizedChange);
  const capitalShare = absoluteMovement > 0 ? Math.abs(hardCapitalChange) / absoluteMovement * 100 : 0;
  const marketShare = absoluteMovement > 0 ? Math.abs(unrealizedChange) / absoluteMovement * 100 : 0;
  const netWorthColor = themeMode === "dark" ? "#91A3FF" : "#2447F5";
  const marketFill = themeMode === "dark" ? "rgba(104,120,179,.28)" : "rgba(184,196,255,.55)";
  const liquidity = latest ? [
    { key: "bank", label: "Bank balance", value: latest.liquid?.bank ?? 0, color: liquidityColors.bank },
    { key: "sodexo", label: "Sodexo / other cash", value: latest.liquid?.sodexo ?? 0, color: liquidityColors.sodexo },
    { key: "fd", label: "Fixed deposit", value: latest.hardAssets?.fd ?? 0, color: liquidityColors.fd },
    { key: "stocksWallet", label: "Stocks wallet", value: latest.hardAssets?.stocksWallet ?? 0, color: liquidityColors.stocksWallet }
  ] : [];
  const availableLiquidity = liquidity.reduce((sum, item) => sum + item.value, 0);
  const chartLabel = themeMode === "dark" ? "#AAA9A2" : "#75736D";
  const chartGrid = themeMode === "dark" ? "rgba(245,244,239,.10)" : "rgba(22,22,20,.09)";
  const netWorthPoints = entries.map((entry) => ({ x: Date.parse(`${entry.date}T00:00:00Z`), y: getSnapshotTotals(entry).netWorth }));
  const netWorthAxis = getNiceAxisBounds(netWorthPoints.map((point) => point.y));
  const firstTimestamp = netWorthPoints[0]?.x;
  const lastTimestamp = netWorthPoints[netWorthPoints.length - 1]?.x;

  const netWorthData: ChartData<"line", { x: number; y: number }[]> = {
    datasets: [{
      label: "Net worth",
      data: netWorthPoints,
      borderColor: netWorthColor,
      backgroundColor: marketFill,
      borderWidth: 2.5,
      pointRadius: entries.length < 2 ? 3 : 0,
      pointHoverRadius: 4,
      pointBackgroundColor: netWorthColor,
      pointBorderWidth: 0,
      tension: 0.2,
      fill: false
    }]
  };
  const netWorthOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external(context) {
          const { chart, tooltip } = context;
          let tooltipEl = chart.canvas.parentNode?.querySelector(".apple-chart-tooltip") as HTMLElement | null;

          if (!tooltipEl) {
            tooltipEl = document.createElement("div");
            tooltipEl.className = "apple-chart-tooltip";
            chart.canvas.parentNode?.appendChild(tooltipEl);
          }

          if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = "0";
            return;
          }

          if (tooltip.body) {
            const timestamp = Number(tooltip.dataPoints[0]?.parsed.x ?? 0);
            const entry = entries.find((item) => Date.parse(`${item.date}T00:00:00Z`) === timestamp);
            const dateText = entry ? formatDateLabel(entry.date).toUpperCase() : "";

            const nwVal = Number(tooltip.dataPoints[0]?.parsed.y ?? 0);
            const note = entry?.expensesNote?.trim();

            let html = `<div class="apple-chart-tooltip-date">${dateText}</div>`;
            html += `<div class="apple-chart-tooltip-rows">`;
            html += `
              <div class="apple-chart-tooltip-row">
                <span class="apple-chart-tooltip-metric">
                  <i class="dot is-networth"></i> Net worth
                </span>
                <span class="apple-chart-tooltip-val">${formatCurrency(nwVal, masked)}</span>
              </div>`;
            html += `</div>`;

            if (note) {
              html += `
                <div class="apple-chart-tooltip-note">
                  <p class="apple-chart-tooltip-note-text">${note}</p>
                </div>`;
            }

            tooltipEl.innerHTML = html;
          }

          const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
          const tooltipWidth = tooltipEl.offsetWidth || 210;
          const tooltipHeight = tooltipEl.offsetHeight || 80;
          const parentWidth = (chart.canvas.parentNode as HTMLElement)?.offsetWidth || chart.width;

          let left = positionX + tooltip.caretX - tooltipWidth / 2;
          left = Math.max(8, Math.min(parentWidth - tooltipWidth - 8, left));

          let top = positionY + tooltip.caretY - tooltipHeight - 14;
          if (top < 8) {
            top = positionY + tooltip.caretY + 14;
          }

          tooltipEl.style.left = `${left}px`;
          tooltipEl.style.top = `${top}px`;
          tooltipEl.style.opacity = "1";
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
          callback(value) { return formatChartMonth(Number(value)); }
        }
      },
      y: {
        position: "right",
        min: netWorthAxis.min,
        max: netWorthAxis.max,
        grid: { color: chartGrid, drawTicks: false },
        border: { display: false },
        ticks: { maxTicksLimit: 4, stepSize: netWorthAxis.step, color: chartLabel, callback(value) { return masked ? "" : formatCompactCurrency(Number(value), false); } }
      }
    }
  };

  const xirrStart = returns?.marketPortfolio.startDate;
  const xirrEnd = returns?.marketPortfolio.endDate;
  const shortHistory = xirrStart && xirrEnd
    ? Date.parse(`${xirrEnd}T00:00:00`) - Date.parse(`${xirrStart}T00:00:00`) < 365 * 86_400_000
    : false;
  const overallReturn = returns?.marketPortfolio.value ?? null;
  const rateCaveat = shortHistory || (overallReturn !== null && Math.abs(overallReturn) > 1);
  const rangeLabel = analyticsPeriodLabel(selectedPeriod);

  return (
    <div className="analytics-page page-enter">
      <SegmentedControl ariaLabel="Analytics sections" role="tablist" value={section} onChange={onSectionChange} className="analytics-tabs" options={[{ value: "overview", label: "Overview" }, { value: "investments", label: "Investments" }]} />

      {section === "overview" ? <>
      <section className="analytics-hero" aria-labelledby="analytics-net-worth-title">
        <div className="analytics-hero-copy">
          <p className="micro-label" id="analytics-net-worth-title">Net worth · {latest ? fullDate(latest.date) : "No snapshot yet"}</p>
          <strong className="analytics-net-worth-value">{latestTotals ? <CompactCurrency value={latestTotals.netWorth} masked={masked} /> : "—"}</strong>
          {change !== null && anchor && latest && anchor.id !== latest.id ? (
            <p className={`analytics-change${change < 0 ? " is-negative" : ""}`}><strong>{formatSigned(change, masked)}{masked ? "" : ` (${changePercent === null ? "—" : formatSignedPercent(changePercent, false)})`}</strong><span> since {fullDate(anchor.date)}</span></p>
          ) : <p className="analytics-change is-quiet">{latest ? "One recorded snapshot in this period" : allEntries.length ? "No snapshots were recorded in these dates." : "Add a snapshot to start tracking your wealth."}</p>}
          {anchor && latest ? <div className="analytics-period-stats"><div><span>Start</span><strong>{fullDate(anchor.date)}</strong></div><div><span>End</span><strong>{fullDate(latest.date)}</strong></div></div> : null}
        </div>
        <div className="analytics-period-chart" aria-label="Net worth over the selected period">
          {entries.length > 0 ? <Chart type="line" data={netWorthData} options={netWorthOptions} /> : <p className="chart-empty">No snapshots in this period.</p>}
        </div>
      </section>

      {anchor && latest && anchor.id !== latest.id ? <aside className="analytics-attribution"><span className="section-eyebrow">{rangeLabel}</span><p>Hard capital changed <strong>{formatSigned(hardCapitalChange, masked)}</strong>; unrealized gain changed <strong>{formatSigned(unrealizedChange, masked)}</strong>.</p></aside> : null}

      <section className="analytics-two-column">
        <article className="ruled-panel" aria-labelledby="movement-heading">
          <div className="section-heading"><div><h2 id="movement-heading">What moved your net worth <InfoTooltip text="Capital change is the change in cash, deposits, wallet balances, and invested principal. Market movement is the change in unrealized gain, not transaction-level total return." /></h2><p>{anchor && latest ? `${fullDate(anchor.date)} to ${fullDate(latest.date)}` : "Change across the selected period"}</p></div></div>
          {anchor && latest && anchor.id !== latest.id ? (
            <>
              <div className="movement-track" aria-label={`Recorded hard capital changed ${formatSigned(hardCapitalChange, masked)}; unrealized gain changed ${formatSigned(unrealizedChange, masked)}`}>
                {capitalShare > 0 ? <span className="movement-segment is-capital" style={{ width: `${capitalShare}%` }} /> : null}
                {marketShare > 0 ? <span className="movement-segment is-market" style={{ width: `${marketShare}%` }} /> : null}
              </div>
              <div className="movement-rows">
                <MovementRow label="Capital change" value={hardCapitalChange} masked={masked} tone="capital" />
                <MovementRow label="Market movement" value={unrealizedChange} masked={masked} tone="market" />
                <div className="movement-total"><span>Total net-worth change</span><strong className={change! < 0 ? "is-negative" : ""}>{formatSigned(change!, masked)}</strong></div>
              </div>
          <p className="panel-footnote">Changes reconcile to the total net-worth change for these snapshots.</p>
            </>
          ) : <p className="panel-empty">Save another snapshot to see what changed.</p>}
        </article>

        <article className="ruled-panel" aria-labelledby="liquidity-heading">
          <div className="section-heading"><div><h2 id="liquidity-heading">Total liquidity <InfoTooltip text="Total liquidity = cash buffer (bank + Sodexo) + fixed deposits + stocks wallet balances." /></h2><p>Cash buffer + fixed deposits + stocks wallet</p></div></div>
          <strong className="liquidity-total">{latest ? <CompactCurrency value={availableLiquidity} masked={masked} /> : "—"}</strong>
          {latest ? (
            <>
              <div className="liquidity-stack" role="img" aria-label={liquidity.map((item) => `${item.label}: ${formatCurrency(item.value, masked)}`).join(", ")}>
                {liquidity.filter((item) => item.value > 0).map((item) => <span key={item.label} style={{ width: `${availableLiquidity ? item.value / availableLiquidity * 100 : 0}%`, backgroundColor: item.color }} />)}
              </div>
              <div className="liquidity-list">{liquidity.map((item) => <div key={item.label}><span><i className={item.value === 0 ? "is-zero" : ""} style={{ backgroundColor: item.value === 0 ? "transparent" : item.color, borderColor: item.color }} />{item.label}</span><strong>{formatCurrency(item.value, masked)}</strong></div>)}</div>
            </>
          ) : <p className="panel-empty">Add a snapshot to see available liquidity.</p>}
        </article>
      </section>
      </> : null}

      {section === "investments" ? <>
      <section className="ruled-panel performance-panel" aria-labelledby="returns-heading">
          <div className="performance-heading">
          <div className="section-heading"><div><h2 id="returns-heading">Investment performance</h2><p>Annualized return, weighted by when contributions were recorded.</p></div></div>
          <div className="portfolio-xirr"><span>Market return <InfoTooltip text="Annualized, money-weighted XIRR for the selected period." /></span><strong className={returns?.marketPortfolio.value !== null && (returns?.marketPortfolio.value ?? 0) < 0 ? "is-negative" : ""}>{returnsLoading ? "…" : formatReturn(returns?.marketPortfolio.value ?? null, masked)}</strong><small>a year</small></div>
        </div>
        {returnsLoading ? <p className="panel-empty">Calculating returns…</p> : returns ? (
          <div className="return-rows">
            {ASSET_KEYS.map((asset) => {
              const result = returns.perAsset.perAsset[asset];
              if (!result) return null;
              const value = result.value;
              const totalSoFar = value === null && result.invested > 0 ? (result.current - result.invested) / result.invested : null;
              const displayedValue = value;
              const shownReturn = displayedValue ?? totalSoFar;
              return <div className="return-row" key={asset}>
                <div className="return-name"><span className="asset-color-dot" style={{ backgroundColor: assetColors[asset] }} /><strong>{ASSET_LABELS[asset]}</strong><small>{formatCompactCurrency(result.invested, masked)} → {formatCompactCurrency(result.current, masked)}</small></div>
                {value !== null ? <div className="return-line"><i /><span style={{ width: `${Math.min(Math.abs(value * 100) / 30 * 50, 50)}%`, left: value < 0 ? `${50 - Math.min(Math.abs(value * 100) / 30 * 50, 50)}%` : "50%", backgroundColor: value < 0 ? "var(--negative)" : "var(--positive)" }} /></div> : <div className="return-line-unavailable" aria-label="Annualized return unavailable">—</div>}
                <div className={`return-value${shownReturn !== null && shownReturn < 0 ? " is-negative" : ""}`}><strong>{formatReturn(shownReturn, masked)}</strong><small>{value !== null ? "per year" : totalSoFar !== null ? "total so far" : result.message}</small></div>
              </div>;
            })}
          </div>
        ) : <p className="panel-empty">{entries.length < 2 ? "Add another snapshot in this period to calculate money-weighted returns." : "Returns are unavailable for this period."}</p>}
        {rateCaveat ? <div className="performance-footer"><p className="return-caveat">Short histories or rates above 100% can exaggerate yearly returns. Treat this as a rough guide.</p></div> : null}
      </section>

      <section className="ruled-panel asset-trends-panel" aria-labelledby="asset-trends-heading">
        <div className="section-heading"><div><h2 id="asset-trends-heading">Unrealized gain / loss by asset</h2><p>Current value minus invested principal at each snapshot.</p></div></div>
        {entries.length > 0 ? <div className="asset-trend-grid">{ASSET_KEYS.map((asset) => <AssetTrend key={asset} asset={asset} entries={entries} masked={masked} tone={assetColors[asset]} chartLabel={chartLabel} chartGrid={chartGrid} />)}</div> : <p className="panel-empty">No snapshots in this period.</p>}
        {entries.length > 0 ? <details className="trend-data-details"><summary><span>View exact values</span><i aria-hidden="true" /></summary><div className="trend-table-scroll"><table className="trend-table"><thead><tr><th>Snapshot</th>{ASSET_KEYS.map((asset) => <th key={asset}>{ASSET_LABELS[asset]}</th>)}</tr></thead><tbody>{[...entries].reverse().map((entry) => <tr key={entry.id}><th>{fullDate(entry.date)}</th>{ASSET_KEYS.map((asset) => { const value = (entry.marketAssets?.[asset]?.current ?? 0) - (entry.marketAssets?.[asset]?.invested ?? 0); const tone = masked ? "" : value > 0 ? "is-positive" : value < 0 ? "is-negative" : "trend-value-neutral"; return <td key={asset} className={tone}>{formatSigned(value, masked)}</td>; })}</tr>)}</tbody></table></div></details> : null}
      </section>
      </> : null}
    </div>
  );
}

function MovementRow({ label, value, masked, tone }: { label: string; value: number; masked: boolean; tone: "capital" | "market" }) {
  return <div className="movement-row"><span><i className={`movement-dot is-${tone}`} />{label}</span><strong className={value < 0 ? "is-negative" : "is-positive"}>{formatSigned(value, masked)}</strong></div>;
}

function AssetTrend({ asset, entries, masked, tone, chartLabel, chartGrid }: { asset: string; entries: Entry[]; masked: boolean; tone: string; chartLabel: string; chartGrid: string }) {
  const points = entries.map((entry) => ({ x: Date.parse(`${entry.date}T00:00:00Z`), y: (entry.marketAssets?.[asset]?.current ?? 0) - (entry.marketAssets?.[asset]?.invested ?? 0) }));
  const latest = points[points.length - 1]?.y ?? 0;
  const values = points.map((point) => point.y);
  const axis = getNiceAxisBounds(values);
  const zeroLine: Plugin<"line"> = {
    id: `zero-line-${asset}`,
    afterDraw(chart) {
      const y = chart.scales.y.getPixelForValue(0);
      if (y < chart.chartArea.top || y > chart.chartArea.bottom) return;
      const context = chart.ctx;
      context.save();
      context.strokeStyle = chartLabel;
      context.globalAlpha = 0.45;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(chart.chartArea.left, y);
      context.lineTo(chart.chartArea.right, y);
      context.stroke();
      context.restore();
    }
  };
  const data: ChartData<"line", { x: number; y: number }[]> = { datasets: [{ label: `${ASSET_LABELS[asset]} unrealized gain/loss`, data: points, borderColor: tone, backgroundColor: `${tone}18`, borderWidth: 1.4, pointRadius: points.length < 2 ? 2 : 0, pointHoverRadius: 2.5, tension: 0.16, fill: { target: "origin", above: `${tone}18`, below: "rgba(215,38,61,.08)" } }] };
  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartLabel === "#AAA9A2" ? "#1E1F1C" : "#FFFFFF",
        borderColor: chartLabel === "#AAA9A2" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
        borderWidth: 1,
        cornerRadius: 14,
        displayColors: false,
        padding: { top: 10, right: 14, bottom: 10, left: 14 },
        titleFont: { size: 10, weight: 700 },
        bodyFont: { size: 14, weight: 700 },
        titleColor: chartLabel,
        bodyColor: chartLabel === "#AAA9A2" ? "#F4F2ED" : "#111111",
        callbacks: {
          title(items) {
            const entry = entries.find((item) => Date.parse(`${item.date}T00:00:00Z`) === Number(items[0]?.parsed.x ?? 0));
            return entry ? formatDateLabel(entry.date).toUpperCase() : "SNAPSHOT";
          },
          label(context) {
            return formatSigned(Number(context.parsed.y), masked);
          },
          afterLabel() {
            return `${ASSET_LABELS[asset]} gain/loss`;
          }
        }
      }
    },
    scales: {
      x: { type: "linear", grid: { display: false }, border: { display: false }, ticks: { display: false } },
      y: { position: "right", min: axis.min, max: axis.max, grid: { color: chartGrid }, border: { display: false }, ticks: { maxTicksLimit: 3, stepSize: axis.step, color: chartLabel, callback(value) { return masked ? "" : formatCompactCurrency(Number(value), false); } } }
    }
  };
  return <article className="asset-trend-card"><div className="asset-trend-heading"><span className="asset-color-dot" style={{ backgroundColor: tone }} /><h3>{ASSET_LABELS[asset]}</h3><strong className={latest < 0 ? "is-negative" : "is-positive"}>{formatSigned(latest, masked)}</strong></div><div className="asset-trend-chart"><Chart type="line" data={data} options={options} plugins={[zeroLine]} /></div></article>;
}

function formatReturn(value: number | null, masked: boolean) {
  if (value === null || !Number.isFinite(value)) return "—";
  return masked ? "••%" : `${value < 0 ? "−" : value > 0 ? "+" : ""}${Math.abs(value * 100).toFixed(2)}%`;
}
