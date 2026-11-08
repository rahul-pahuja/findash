import type { ChartOptions } from "chart.js";
import { Chart as ChartJS, Filler, registerables } from "chart.js";
import { Line } from "react-chartjs-2";
import type { DataResponse, Entry, XirrResponse } from "../lib/types";
import { ASSET_KEYS, ASSET_LABELS } from "../utils/config";
import { formatCompactCurrency, formatCurrency, formatMonthLabel } from "../utils/format";

ChartJS.register(...registerables, Filler);

interface Props {
  response: DataResponse | null;
  returns: XirrResponse | null;
  returnsLoading: boolean;
  masked: boolean;
  themeMode: "light" | "dark";
  onAddSnapshot: () => void;
}

function netWorth(entry: Entry) {
  return entry.liquid.bank + entry.liquid.sodexo + entry.hard_assets.fd + entry.hard_assets.stocks_wallet
    + ASSET_KEYS.reduce((sum, asset) => sum + entry.market_assets[asset].current, 0);
}

function signedCurrency(value: number, masked: boolean) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatCurrency(Math.abs(value), masked)}`;
}

function periodChange(first: Entry | undefined, latest: Entry | undefined) {
  if (!first || !latest) return null;
  return netWorth(latest) - netWorth(first);
}

export function AnalyticsDashboard({ response, returns, returnsLoading, masked, themeMode, onAddSnapshot }: Props) {
  const entries = response
    ? response.dataset.entries.filter((entry) => response.visibleEntryIds.includes(entry.id))
    : [];
  const first = entries[0];
  const latest = entries[entries.length - 1];
  const heatmapEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const change = periodChange(first, latest);
  const total = latest ? netWorth(latest) : 0;
  const firstNetWorth = first ? netWorth(first) : 0;
  const capitalChange = first && latest && response
    ? (response.derived[latest.id]?.hardCapital ?? 0) - (response.derived[first.id]?.hardCapital ?? 0)
    : 0;
  const marketChange = change === null ? 0 : change - capitalChange;
  const liquidity = latest ? [
    { label: "Fixed deposit", value: latest.hard_assets.fd },
    { label: "Bank balance", value: latest.liquid.bank },
    { label: "Stocks wallet", value: latest.hard_assets.stocks_wallet },
    { label: "Sodexo / other", value: latest.liquid.sodexo }
  ] : [];
  const availableLiquidity = liquidity.reduce((sum, item) => sum + item.value, 0);
  const firstLabel = first ? formatMonthLabel(first.id) : "the first snapshot";
  const latestLabel = latest ? formatMonthLabel(latest.id) : "";
  const netWorthValues = entries.map(netWorth);
  const minValue = Math.min(...netWorthValues);
  const maxValue = Math.max(...netWorthValues);
  const chartSpan = Math.max(maxValue - minValue, Math.abs(maxValue) * .1, 1);
  const chartMin = Math.max(0, minValue - chartSpan * .1);
  const chartMax = Math.max(maxValue + chartSpan * .05, chartMin + 1);
  const chartPalette = themeMode === "dark"
    ? {
        primary: "#f5f5f7",
        muted: "#77777d",
        grid: "rgba(245, 245, 247, .11)",
        fill: "rgba(245, 245, 247, .10)",
        secondary: "#c7c7cc",
        tertiary: "#929298",
        quaternary: "#626268"
      }
    : {
        primary: "#111112",
        muted: "#b9b9bf",
        grid: "rgba(25, 25, 29, .08)",
        fill: "rgba(17, 17, 18, .07)",
        secondary: "#55555b",
        tertiary: "#85858b",
        quaternary: "#b3b3b8"
      };
  const chartLabelColor = themeMode === "dark" ? "#a0a0a6" : "#77777d";
  const liquidityTones = [chartPalette.primary, chartPalette.secondary, chartPalette.tertiary, chartPalette.quaternary];
  const chartData = {
    labels: entries.map((entry) => formatMonthLabel(entry.id)),
    datasets: [{
      label: "Net worth",
      data: netWorthValues,
      borderColor: chartPalette.primary,
      backgroundColor: chartPalette.fill,
      borderWidth: 2,
      pointRadius: entries.length === 1 ? 3 : 0,
      pointHoverRadius: 4,
      pointBackgroundColor: chartPalette.primary,
      pointBorderWidth: 0,
      tension: .22,
      fill: true
    }]
  };
  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context) {
            const value = typeof context.raw === "number" ? context.raw : Number(context.raw);
            return `Net worth: ${formatCurrency(value, masked)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { maxTicksLimit: 5, maxRotation: 0, color: chartLabelColor, font: { size: 11 } }
      },
      y: {
        position: "right",
        min: netWorthValues.length > 1 ? chartMin : undefined,
        max: netWorthValues.length > 1 ? chartMax : undefined,
      grid: { color: chartPalette.grid, drawTicks: false },
        border: { display: false },
        ticks: {
          maxTicksLimit: 3,
          color: chartLabelColor,
          font: { size: 10 },
          callback(value) {
            return masked ? "" : formatCompactCurrency(Number(value), false);
          }
        }
      }
    }
  };

  const absoluteMovement = Math.abs(capitalChange) + Math.abs(marketChange);
  const capitalShare = absoluteMovement > 0 ? (Math.abs(capitalChange) / absoluteMovement) * 100 : 0;
  const marketShare = absoluteMovement > 0 ? (Math.abs(marketChange) / absoluteMovement) * 100 : 0;
  const xirrStart = returns?.marketPortfolio.startDate;
  const xirrEnd = returns?.marketPortfolio.endDate;
  const shortHistory = xirrStart && xirrEnd
    ? new Date(`${xirrEnd}T00:00:00`).getTime() - new Date(`${xirrStart}T00:00:00`).getTime() < 365 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div className="analytics-page analytics-page-v2 page-enter">
      <header className="analytics-header">
        <h1>Analytics</h1>
        <button type="button" className="analytics-add-button" onClick={onAddSnapshot}>Add snapshot <span aria-hidden="true">＋</span></button>
      </header>

      <section className="analytics-hero dashboard-card" aria-labelledby="analytics-net-worth-title">
        <div className="analytics-hero-summary">
          <div>
            <p id="analytics-net-worth-title" className="analytics-card-eyebrow">Net worth</p>
            <strong>{latest ? formatCurrency(total, masked) : "—"}</strong>
            {change !== null && first && latest && first.id !== latest.id ? (
              <p className={`analytics-change${change < 0 ? " is-negative" : ""}`}>
                <b>{masked ? "••%" : `${change > 0 ? "↑ " : change < 0 ? "↓ −" : ""}${formatCurrency(Math.abs(change), false)} (${firstNetWorth > 0 ? `${((change / firstNetWorth) * 100).toFixed(1)}%` : "—"})`}</b>
                <span> since {firstLabel}</span>
              </p>
            ) : (
              <p className="analytics-change analytics-change--quiet">{latest ? "One saved snapshot" : "Add a snapshot to start tracking your wealth."}</p>
            )}
          </div>
        </div>

        <div className="analytics-net-worth-chart" aria-label="Net worth over time">
          {entries.length > 0 ? <Line data={chartData} options={chartOptions} /> : <p className="analytics-empty-hint">No snapshots in this period.</p>}
        </div>

      </section>

      <div className="analytics-support-grid">
        <section className="analytics-support-card dashboard-card" aria-labelledby="analytics-movement-title">
          <div className="analytics-section-heading">
            <h2 id="analytics-movement-title">Capital vs. market movement</h2>
            <p>{first && latest && first.id !== latest.id ? `From ${firstLabel} to ${latestLabel}` : "Change across the selected period"}</p>
          </div>
          {first && latest && first.id !== latest.id ? (
            <>
              <div className="analytics-movement-bar" role="img" aria-label={`Capital base change ${signedCurrency(capitalChange, masked)}; market movement ${signedCurrency(marketChange, masked)}`}>
                {capitalShare > 0 && <span className={`is-capital${capitalChange < 0 ? " is-negative" : ""}`} style={{ width: `${capitalShare}%` }} />}
                {marketShare > 0 && <span className={`is-market${marketChange < 0 ? " is-negative" : ""}`} style={{ width: `${marketShare}%` }} />}
              </div>
              <div className="analytics-breakdown-list">
                <div><span><i className="analytics-dot is-capital" />Capital base change</span><b className={capitalChange < 0 ? "is-negative" : ""}>{signedCurrency(capitalChange, masked)}</b></div>
                <div><span><i className="analytics-dot is-market" />Market movement</span><b className={marketChange < 0 ? "is-negative" : ""}>{signedCurrency(marketChange, masked)}</b></div>
                <div className="analytics-total-row"><span>Total change</span><b className={change! < 0 ? "is-negative" : ""}>{signedCurrency(change!, masked)}</b></div>
              </div>
              <p className="analytics-footnote">Capital base combines balances, deposits, wallet funds and invested principal.</p>
            </>
          ) : (
            <p className="analytics-empty-hint">Save another snapshot to see the change split between capital and markets.</p>
          )}
        </section>

        <section className="analytics-support-card dashboard-card" aria-labelledby="analytics-liquidity-title">
          <div className="analytics-section-heading">
            <h2 id="analytics-liquidity-title">Cash and reserves</h2>
            <p>Balances, wallet funds and fixed deposits</p>
          </div>
          <strong className="analytics-liquidity-total">{latest ? formatCurrency(availableLiquidity, masked) : "—"}</strong>
          {latest ? (
            <>
              <div className="analytics-liquidity-bar" role="img" aria-label={`Available balances total ${formatCurrency(availableLiquidity, masked)}`}>
                {liquidity.map((item, index) => item.value > 0 ? (
                  <span key={item.label} style={{ width: `${availableLiquidity ? item.value / availableLiquidity * 100 : 0}%`, backgroundColor: liquidityTones[index] }} />
                ) : null)}
              </div>
              <div className="analytics-breakdown-list analytics-liquidity-list">
                {liquidity.map((item, index) => (
                  <div key={item.label}>
                    <span><i className="analytics-dot" style={{ backgroundColor: liquidityTones[index] }} />{item.label}</span>
                    <b>{formatCurrency(item.value, masked)}</b>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="analytics-empty-hint">Add a snapshot to see your available balances.</p>}
        </section>
      </div>

      <section className="analytics-returns dashboard-card" aria-labelledby="analytics-returns-title">
        <div className="analytics-returns-header">
          <div>
            <h2 id="analytics-returns-title">Investment performance</h2>
            <p>Annualized returns, weighted for when money moved in or out.</p>
          </div>
          <div className="analytics-market-return">
            <span>Portfolio XIRR</span>
            <strong className={returns?.marketPortfolio.value !== null && (returns?.marketPortfolio.value ?? 0) < 0 ? "is-negative" : ""}>
              {returnsLoading ? "…" : returns?.marketPortfolio.value === null || !returns ? "—" : masked ? "••%" : `${(returns.marketPortfolio.value * 100).toFixed(2)}%`}
            </strong>
            <small>a year</small>
          </div>
        </div>

        {returnsLoading ? (
          <p className="analytics-empty-hint analytics-returns-loading">Calculating returns…</p>
        ) : returns ? (
          <div className="analytics-return-rows">
            {ASSET_KEYS.map((asset) => {
              const result = returns.perAsset.perAsset[asset];
              if (!result) return null;
              const annualized = result.value;
              const totalReturn = result.invested > 0 ? (result.current - result.invested) / result.invested : null;
              const displayedReturn = annualized ?? totalReturn;
              const scale = Math.max(25, Math.ceil(Math.max(...ASSET_KEYS.map((key) => Math.abs((returns.perAsset.perAsset[key]?.value ?? 0) * 100))) / 5) * 5);
              const width = displayedReturn === null ? 0 : Math.min(Math.abs(displayedReturn * 100) / scale * 50, 50);
              const isNegative = displayedReturn !== null && displayedReturn < 0;
              const startValue = formatCompactCurrency(result.invested, masked);
              const endValue = formatCompactCurrency(result.current, masked);
              return (
                <div className="analytics-return-row" key={asset}>
                  <div className="analytics-return-asset">
                    <strong>{ASSET_LABELS[asset]}</strong>
                    <span>{startValue} → {endValue}</span>
                  </div>
                  <div className="analytics-return-track" aria-hidden="true">
                    <i />
                    {displayedReturn !== null && <span className={`${isNegative ? "is-negative" : ""}`} style={{ left: isNegative ? `${50 - width}%` : "50%", width: `${width}%` }} />}
                  </div>
                  <div className={`analytics-return-value${isNegative ? " is-negative" : ""}`}>
                    <strong>{displayedReturn === null ? "—" : masked ? "••%" : `${displayedReturn > 0 ? "+" : displayedReturn < 0 ? "−" : ""}${Math.abs(displayedReturn * 100).toFixed(2)}%`}</strong>
                    <span>{annualized !== null ? "a year" : totalReturn !== null ? "total so far" : result.message}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="analytics-empty-hint analytics-returns-loading">Returns are unavailable for this period.</p>
        )}

        <div className="analytics-returns-footer">
          <div><span>Overall return</span><strong>{returns?.lifePortfolio.value === null || !returns ? "—" : masked ? "••%" : `${returns.lifePortfolio.value < 0 ? "−" : ""}${Math.abs(returns.lifePortfolio.value * 100).toFixed(2)}%`}</strong><small>a year</small></div>
          {shortHistory && <p className="analytics-return-warning"><span aria-hidden="true">⚠</span> Short histories can inflate annualized rates. Treat these as a guide.</p>}
        </div>
        <p className="analytics-footnote">Returns use XIRR when cash-flow history allows. Otherwise, the asset row shows total return to date.</p>
      </section>

      <section className="analytics-heatmap dashboard-card" aria-labelledby="analytics-heatmap-title">
        <div className="analytics-heatmap-header">
          <div>
            <h2 id="analytics-heatmap-title">Asset gain / loss by snapshot</h2>
            <p>Unrealized return at each saved date, compared with invested principal.</p>
          </div>
        </div>
        {entries.length > 0 ? (
          <div className="analytics-heatmap-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Snapshot</th>
                  {ASSET_KEYS.map((asset) => <th scope="col" key={asset}>{ASSET_LABELS[asset]}</th>)}
                </tr>
              </thead>
              <tbody>
                {heatmapEntries.map((entry) => (
                  <tr key={entry.id}>
                    <th scope="row">{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(`${entry.date}T00:00:00`))}</th>
                    {ASSET_KEYS.map((asset) => {
                      const holding = entry.market_assets[asset];
                      const value = holding.invested > 0 ? ((holding.current - holding.invested) / holding.invested) * 100 : null;
                      const magnitude = value === null ? 0 : Math.min(Math.abs(value) / 30, 1);
                      const alpha = .06 + magnitude * .2;
                      const background = value === null
                        ? "transparent"
                        : value >= 0
                          ? `color-mix(in srgb, var(--chart-success) ${Math.round(alpha * 100)}%, var(--card))`
                          : `color-mix(in srgb, var(--chart-danger) ${Math.round(alpha * 100)}%, var(--card))`;
                      return (
                        <td key={asset}>
                          <span
                            role="img"
                            className={`analytics-heatmap-value${value === null ? " is-empty" : value < 0 ? " is-negative" : ""}`}
                            style={{ backgroundColor: background }}
                            aria-label={masked ? `${ASSET_LABELS[asset]} return hidden` : `${ASSET_LABELS[asset]} ${value === null ? "unavailable" : `${value >= 0 ? "plus " : "minus "}${Math.abs(value).toFixed(1)} percent`}`}
                          >
                            {masked ? "••%" : value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${value.toFixed(1)}%`}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="analytics-empty-hint">No snapshots in this period.</p>
        )}
      </section>
    </div>
  );
}
