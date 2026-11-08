import type { ReactNode } from "react";
import type { ChartData } from "chart.js";
import { Chart as ChartJS, Filler, registerables } from "chart.js";
import { Chart, Doughnut, Line } from "react-chartjs-2";
import type { DataResponse, Dataset } from "../lib/types";
import { ASSET_KEYS, ASSET_LABELS } from "../utils/config";
import { formatCurrency, formatMonthLabel } from "../utils/format";
import { InfoTooltip } from "./InfoTooltip";

ChartJS.register(...registerables, Filler);

interface Props {
  response: DataResponse | null;
  dataset: Dataset | null;
  masked: boolean;
  themeMode: "light" | "dark";
  primaryOnly?: boolean;
}

// ── Asset Allocation Callout Plugin ──────────────────
const calloutPlugin = {
  id: "calloutLabels",
  afterDraw(chart: any) {
    const { ctx, data } = chart;
    const meta = chart.getDatasetMeta(0);
    const cx = meta.data[0]?.x;
    const cy = meta.data[0]?.y;
    if (!cx || !cy) return;

    const palette = getComputedStyle(document.documentElement);
    const mutedColor = palette.getPropertyValue("--muted-foreground").trim() || "#77777d";
    const borderColor = palette.getPropertyValue("--border").trim() || "#e2e2e5";
    ctx.save();
    
    const leftSide: any[] = [];
    const rightSide: any[] = [];

    meta.data.forEach((datapoint: any, i: number) => {
      const midAngle = (datapoint.startAngle + datapoint.endAngle) / 2;
      const x = cx + Math.cos(midAngle) * datapoint.outerRadius;
      const y = cy + Math.sin(midAngle) * datapoint.outerRadius;
      
      const item = {
        index: i,
        label: data.labels[i],
        angle: midAngle,
        startX: x,
        startY: y,
        outerRadius: datapoint.outerRadius,
        isRight: Math.cos(midAngle) > 0
      };
      
      if (item.isRight) rightSide.push(item);
      else leftSide.push(item);
    });

    // Sort by Y position to handle overlaps sequentially
    rightSide.sort((a, b) => a.startY - b.startY);
    leftSide.sort((a, b) => a.startY - b.startY);

    const arrangeSide = (side: any[], isRight: boolean) => {
      const minGap = 16;
      let lastY = -Infinity;
      
      side.forEach((item) => {
        const lineLen = 35;
        let endX = cx + Math.cos(item.angle) * (item.outerRadius + lineLen);
        let endY = cy + Math.sin(item.angle) * (item.outerRadius + lineLen);
        
        // Prevent overlap: push down if too close to previous label
        if (endY < lastY + minGap) {
          endY = lastY + minGap;
        }
        
        // Draw line from chart to elbow
        ctx.beginPath();
        ctx.moveTo(item.startX, item.startY);
        ctx.lineTo(endX, endY);
        
        // Horizontal elbow
        const elbowLen = 12;
        const finalX = isRight ? endX + elbowLen : endX - elbowLen;
        ctx.lineTo(finalX, endY);
        
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        
        // Label
        ctx.font = "500 11px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = mutedColor;
        ctx.textAlign = isRight ? "left" : "right";
        ctx.textBaseline = "middle";
        ctx.fillText(item.label, isRight ? finalX + 5 : finalX - 5, endY);
        
        lastY = endY;
      });
    };

    arrangeSide(rightSide, true);
    arrangeSide(leftSide, false);
    
    ctx.restore();
  }
};

export function Charts({ response, dataset, masked, themeMode, primaryOnly = false }: Props) {
  if (!response || !dataset) {
    return null;
  }

  const visibleEntries = dataset.entries.filter((entry) => response.visibleEntryIds.includes(entry.id));
  const labels = visibleEntries.map((entry) => formatMonthLabel(entry.id));
  const latest = visibleEntries[visibleEntries.length - 1];
  const latestDerived = latest ? response.derived[latest.id] : null;
  const tooltipLabel = (value: number) => (masked ? "Hidden" : formatCurrency(value, false));

  // Read chart colors from CSS variables — same in light and dark mode
  const s = getComputedStyle(document.documentElement);
  const CHART = {
    primary: s.getPropertyValue("--chart-primary").trim() || "#111111",
    muted: s.getPropertyValue("--chart-muted").trim() || "#b8b8bd",
    grid: s.getPropertyValue("--chart-grid").trim() || "rgba(20,20,24,0.08)",
    success: s.getPropertyValue("--chart-success").trim() || "#10B981",
    danger: s.getPropertyValue("--chart-danger").trim() || "#F43F5E",
  };
  ChartJS.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif";
  ChartJS.defaults.color = s.getPropertyValue("--muted-foreground").trim() || "#77777d";
  const cardSurface = s.getPropertyValue("--card").trim() || "#ffffff";

  const lineData: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      {
        label: "Net Worth",
        data: visibleEntries.map((entry) => response.derived[entry.id]?.currentNetWorth ?? 0),
        borderColor: CHART.primary,
        segment: {
          borderColor: (ctx: any) => {
            const idx = ctx.p1DataIndex;
            const nw = response.derived[visibleEntries[idx].id]?.currentNetWorth ?? 0;
            const hc = response.derived[visibleEntries[idx].id]?.hardCapital ?? 0;
            return nw >= hc ? CHART.success : CHART.danger;
          }
        },
        backgroundColor: `${CHART.primary}26`,
        tension: 0.24,
        fill: false,
        borderWidth: 2.4,
        pointRadius: 2.5,
        pointBackgroundColor: (ctx: any) => {
          const idx = ctx.dataIndex;
          const nw = response.derived[visibleEntries[idx].id]?.currentNetWorth ?? 0;
          const hc = response.derived[visibleEntries[idx].id]?.hardCapital ?? 0;
          return nw >= hc ? CHART.success : CHART.danger;
        }
      },
      {
        label: "Hard Capital",
        data: visibleEntries.map((entry) => response.derived[entry.id]?.hardCapital ?? 0),
        borderColor: CHART.muted,
        borderDash: [5, 5],
        tension: 0.24,
        fill: false,
        pointRadius: 0
      }
    ]
  };

  const netWorthChangeData: ChartData<"bar", number[], string> = {
    labels,
    datasets: [
      {
        label: "Net Worth Change",
        data: visibleEntries.map((entry) => response.derived[entry.id]?.netWorthAddition ?? 0),
        backgroundColor: (context) => {
          const val = context.raw as number;
          return val >= 0 ? CHART.success : CHART.danger;
        },
        borderRadius: 4
      }
    ]
  };

  const donutData = latest
    ? (() => {
        const labels = ["Liquid", "FD", "Wallet", ...ASSET_KEYS.map((asset) => ASSET_LABELS[asset])];
        const data = [
          latestDerived?.liquidBuffer ?? 0,
          latest.hard_assets.fd,
          latest.hard_assets.stocks_wallet,
          ...ASSET_KEYS.map((asset) => latest.market_assets[asset].current)
        ];

        const neutralShades = [
          "#111111",
          "#404046",
          "#707078",
          "#96969d",
          "#b8b8be",
          "#d1d1d6",
          "#e8e8ec",
        ];

        // Sort indices by value descending to map shades (largest value -> darkest shade)
        const sortedIndices = data
          .map((val, i) => ({ val, i }))
          .sort((a, b) => b.val - a.val)
          .map((obj) => obj.i);

        const backgroundColors = new Array(data.length);
        sortedIndices.forEach((originalIndex, shadeIndex) => {
          backgroundColors[originalIndex] = neutralShades[Math.min(shadeIndex, neutralShades.length - 1)];
        });

        return {
          labels,
          datasets: [
            {
              data,
              backgroundColor: backgroundColors,
              borderWidth: 1,
              borderColor: cardSurface
            }
          ]
        };
      })()
    : null;

  // ── Gain/Loss Heatmap Data ──────────────────────────────
  const heatmapData = visibleEntries.map((entry) => {
    const row: Record<string, number | string> = { month: entry.id };
    for (const asset of ASSET_KEYS) {
      const m = entry.market_assets[asset];
      row[asset] = m.invested > 0 ? ((m.current - m.invested) / m.invested) * 100 : 0;
    }
    return row;
  });

  // ── Available Liquidity Data ──────────────────────────
  const liquidTimeData = {
    labels,
    datasets: [
      {
        label: "Available Liquidity",
        data: visibleEntries.map((entry) => entry.liquid.bank + entry.liquid.sodexo + entry.hard_assets.fd + entry.hard_assets.stocks_wallet),
        borderColor: CHART.success,
        backgroundColor: `${CHART.success}26`,
        tension: 0.3,
        fill: true,
        pointRadius: 2
      }
    ]
  };

  return (
    <section key={themeMode} className="chart-grid">
      <ChartPanel title="Wealth Progression" subtitle="Net worth compared with contributed capital" className="chart-panel--progress" info="Net Worth is the current value of liquid, hard and market assets. Hard Capital is the cash and principal you have put in.">
        <Line
          data={lineData}
          options={buildMoneyOptions(masked, tooltipLabel)}
        />
      </ChartPanel>

      <ChartPanel title="Asset Allocation" subtitle="How your latest net worth is distributed" className="chart-panel--allocation" info="A breakdown of current value across liquid cash, FD, stocks wallet, mutual funds, NPS, stocks and crypto.">
        <div className="allocation-chart-wrap">
          {donutData ? (
            <Doughnut
              data={donutData}
              plugins={[calloutPlugin]}
              options={{
                cutout: "70%",
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                  padding: 26
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label(context) {
                        const raw = typeof context.raw === "number" ? context.raw : Number(context.raw);
                        return `${context.label}: ${tooltipLabel(raw)}`;
                      }
                    }
                  }
                }
              }}
            />
          ) : null}
        </div>
      </ChartPanel>

      {!primaryOnly ? <>
      <ChartPanel title="Net Worth Change" subtitle="Change between recorded snapshots" info="Bars show how much net worth changed since the previous recorded snapshot. Green indicates growth; red indicates a decrease.">
        <Chart
          type="bar"
          data={netWorthChangeData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: "index" as const,
              intersect: false,
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label(context) {
                    const raw = typeof context.raw === "number" ? context.raw : Number(context.raw);
                    return `Change: ${tooltipLabel(raw)}`;
                  }
                }
              }
            },
            scales: {
              y: {
                ticks: { callback: (value) => (masked ? "" : `₹${value}`) },
                grid: { color: CHART.grid }
              },
              x: {
                grid: { display: false }
              }
            }
          }}
        />
      </ChartPanel>

      <ChartPanel title="Available Liquidity" subtitle="Cash, fixed deposits and wallet balances" info="Tracks accessible assets across recorded snapshots: bank, Sodexo, FD and stocks wallet.">
        <Line
          data={liquidTimeData}
          options={buildMoneyOptions(masked, tooltipLabel)}
        />
      </ChartPanel>

      {/* ── Gain/Loss Heatmap ─────────────────────────────── */}
      <ChartPanel title="Gain / Loss Heatmap" subtitle="Market asset performance against invested principal" className="chart-panel--heatmap">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 text-left font-semibold uppercase tracking-wider text-muted-foreground">Month</th>
                {ASSET_KEYS.map((asset) => (
                  <th key={asset} className="px-2 py-2 text-center font-semibold uppercase tracking-wider text-muted-foreground">
                    {ASSET_LABELS[asset]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row) => (
                <tr key={row.month} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-4 font-medium text-muted-foreground">{formatMonthLabel(row.month as string)}</td>
                  {ASSET_KEYS.map((asset) => {
                    const val = (row[asset] as number) ?? 0;
                    const intensity = Math.min(Math.abs(val) / 30, 1);
                    const bg = val >= 0
                      ? `${CHART.success}${Math.round((intensity * 0.6 + 0.05) * 255).toString(16).padStart(2, "0")}`
                      : `${CHART.danger}${Math.round((intensity * 0.6 + 0.05) * 255).toString(16).padStart(2, "0")}`;
                    const color = val >= 0 ? CHART.success : CHART.danger;
                    return (
                      <td key={asset} className="px-2 py-1.5 text-center">
                        <div
                          className="rounded-md px-2 py-1.5 font-bold tabular-nums transition-transform hover:scale-105"
                          style={{ backgroundColor: bg, color }}
                        >
                          {`${val >= 0 ? "+" : ""}${val.toFixed(1)}%`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartPanel>
      </> : null}
    </section>
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

function buildMoneyOptions(masked: boolean, tooltipLabel: (value: number) => string) {
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
      legend: { display: false },
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
            return masked ? "" : `₹${value}`;
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
