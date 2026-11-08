import { ReactNode } from "react";
import { InfoTooltip } from "./InfoTooltip";

interface Props {
  label: string;
  value: string;
  hint?: string;
  info?: string;
  trend?: {
    value: number;
    percentage: number;
    isPositive: boolean;
  } | null;
}

export function MetricCard({ label, value, hint, info, trend }: Props) {
  return (
    <div className="card-base glass-hover flex flex-col p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">{label}</span>
          {info && <InfoTooltip text={info} />}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-bold ${trend.isPositive ? "text-success" : "text-danger"}`}>
            <div className="flex items-center gap-0.5">
              {trend.isPositive ? (
                <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 3l-7 9h14l-7-9z" />
                </svg>
              ) : (
                <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 17l7-9H3l7 9z" />
                </svg>
              )}
              <span>{Math.abs(trend.percentage).toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-baseline gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</h2>
      </div>
      
      {hint && (
        <p className="mt-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{hint}</p>
      )}
    </div>
  );
}
