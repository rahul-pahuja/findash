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
        
        ctx.strokeStyle = "rgba(148,144,163,0.4)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        
        // Label
        ctx.font = "bold 10px sans-serif";
        ctx.fillStyle = "rgba(148,144,163,0.9)";
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

export function Charts({ response, dataset, masked, themeMode }: Props) {
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
    primary: s.getPropertyValue("--chart-primary").trim() || "#9353D3",
    muted: s.getPropertyValue("--chart-muted").trim() || "#9490A3",
    grid: s.getPropertyValue("--chart-grid").trim() || "rgba(148,144,163,0.12)",
    success: s.getPropertyValue("--chart-success").trim() || "#10B981",
    danger: s.getPropertyValue("--chart-danger").trim() || "#F43F5E",
  };

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
        tension: 0.1,
        fill: false,
        pointRadius: 2,
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
        tension: 0.1,
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

        // Defined sequence of greens from most saturated to lightest (Emerald 800 to 50)
        const greenShades = [
          "#065f46", // Emerald 800
          "#059669", // Emerald 600
          "#10b981", // Emerald 500
          "#34d399", // Emerald 400
          "#6ee7b7", // Emerald 300
          "#a7f3d0", // Emerald 200
          "#ecfdf5", // Emerald 50
        ];

        // Sort indices by value descending to map shades (largest value -> darkest shade)
        const sortedIndices = data
          .map((val, i) => ({ val, i }))
          .sort((a, b) => b.val - a.val)
          .map((obj) => obj.i);

        const backgroundColors = new Array(data.length);
        sortedIndices.forEach((originalIndex, shadeIndex) => {
          backgroundColors[originalIndex] = greenShades[Math.min(shadeIndex, greenShades.length - 1)];
        });

        return {
          labels,
          datasets: [
            {
              data,
              backgroundColor: backgroundColors,
              borderWidth: 1,
              borderColor: "var(--background)"
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
        data: visibleEntries.map((entry) => entry.liquid.bank + entry.hard_assets.fd + entry.hard_assets.stocks_wallet),
        borderColor: CHART.success,
        backgroundColor: `${CHART.success}26`,
        tension: 0.3,
        fill: true,
        pointRadius: 2
      }
    ]
  };

  return (
    <section key={themeMode} className="grid gap-6 lg:grid-cols-2">
      <ChartPanel title="Wealth Progression" info="Net Worth = liquid + hard assets + all market current values. Hard Capital = all principal you've invested. The gap between them is your unrealized gain.">
        <Line
          data={lineData}
          options={buildMoneyOptions(masked, tooltipLabel)}
        />
      </ChartPanel>

      <ChartPanel title="Asset Allocation" info="Donut showing how your net worth is split across liquid cash, FD, stocks wallet, mutual funds, NPS, stocks, and crypto.">
        <div className="flex h-full items-center justify-center p-2">
          {donutData ? (
            <Doughnut
              data={donutData}
              plugins={[calloutPlugin]}
              options={{
                cutout: "70%",
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                  padding: 40 // Reduced padding to allow chart to be bigger
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

      <ChartPanel title="Net Worth Change" info="Bar chart showing how much your net worth increased or decreased compared to the previous month. Green bars indicate gain, red indicate loss.">
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

      <ChartPanel title="Available Liquidity" info="Shows the trend of your most accessible assets (Bank, FD, and Stocks Wallet) over time.">
        <Line
          data={liquidTimeData}
          options={buildMoneyOptions(masked, tooltipLabel)}
        />
      </ChartPanel>

      {/* ── Gain/Loss Heatmap ─────────────────────────────── */}
      <ChartPanel title="Gain / Loss Heatmap" className="lg:col-span-2">
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
    </section>
  );
}

function ChartPanel({ title, subtitle, children, className, info }: { title: string; subtitle?: string; children: ReactNode; className?: string; info?: string }) {
  return (
    <div className={`card-base glass-hover flex flex-col p-6 ${className ?? ""}`}>
      <div className="flex items-center">
        <h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
        {info ? <InfoTooltip text={info} /> : null}
      </div>
      {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
      <div className="mt-8 flex-1 min-h-[320px]">{children}</div>
    </div>
  );
}

function buildMoneyOptions(masked: boolean, tooltipLabel: (value: number) => string) {
  const grid = getComputedStyle(document.documentElement).getPropertyValue("--chart-grid").trim() || "rgba(148,144,163,0.12)";
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
          callback(value: string | number) {
            return masked ? "" : `₹${value}`;
          }
        },
        grid: { color: grid }
      },
      x: { grid: { display: false } }
    }
  };
}
