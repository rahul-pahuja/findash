import type { RangeKey, XirrResponse } from "../lib/types";
import { formatCurrency } from "../utils/format";

interface Props {
  data: XirrResponse | null;
  loading: boolean;
  range: RangeKey;
  masked: boolean;
}

export function XirrPanel({ data, loading, range, masked }: Props) {
  return (
    <section className="card-base">
      <div className="border-b border-border p-6">
        <h3 className="text-xl font-bold tracking-tight text-foreground">Deep Analytics</h3>
        <p className="mt-1 text-sm text-muted-foreground">Annualized performance engine using Newton-Raphson solver · Range: {range}</p>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : data ? (
          <div className="grid gap-6 animate-in fade-in duration-500">
            <div className="grid gap-4 lg:grid-cols-2">
              <LensCard title="Life Portfolio XIRR" value={data.lifePortfolio.value} status={data.lifePortfolio.message} masked={masked} />
              <LensCard title="Market Portfolio XIRR" value={data.marketPortfolio.value} status={data.marketPortfolio.message} masked={masked} />
            </div>

            <div className="mt-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-4 ml-1">Asset Lens</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(data.perAsset.perAsset).map(([asset, value]) => {
                  const isPos = value.value !== null && value.value >= 0;
                  const cClass = value.value === null ? "text-muted-foreground" : isPos ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
                  
                  return (
                    <div key={asset} className="glass-hover rounded-lg border border-border bg-muted/30 p-4 transition-all">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{asset.split("_").join(" ")}</p>
                      <div className="mt-2 flex items-baseline justify-between gap-2">
                        <p className={`text-xl font-black tracking-tight ${cClass} tabular-nums`}>
                          {value.value === null || masked ? "••%" : `${(value.value * 100).toFixed(2)}%`}
                        </p>
                      </div>
                      <p className="mt-1 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tight truncate" title={value.message}>
                        {value.message}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function LensCard({ title, value, status, masked }: { title: string; value: number | null; status: string; masked: boolean }) {
  const isPositive = value !== null && value >= 0;
  const colorClass = value === null ? "text-muted-foreground" : isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";

  return (
    <div className="glass-hover rounded-xl border border-border bg-card p-6 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">{title}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <p className={`text-4xl font-black tracking-tighter ${colorClass} tabular-nums`}>
          {masked || value === null ? "••%" : `${(value * 100).toFixed(2)}%`}
        </p>
      </div>
      <p className="mt-2 text-xs font-bold text-muted-foreground uppercase tracking-tight">{status}</p>
    </div>
  );
}
