import { InfoTooltip } from "./InfoTooltip";

interface Props {
  label: string;
  value: string;
  hint?: string;
  info?: string;
  featured?: boolean;
}

const metricPaths: Record<string, string> = {
  "Net Worth": "M12 2.5v19m5-14H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6",
  "Hard Capital": "M4 19h16M6 16V9m6 7V5m6 11v-4M5 7l6-4 7 3",
  "Liquid Buffer": "M3.5 7.5h17v12h-17zM3.5 10.5h17m-13 5h4M7 4.5h10",
  "Market Portfolio": "M4 7.5h16v12H4zM7 7.5v-3h10v3m-10 5h3m3 0h3m-9 4h3m3 0h3",
  "Unrealized Gain": "m4 16 5-5 3 3 8-9M14 5h6v6M4 20h16",
  Snapshots: "M6 3.5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Zm3 5h6m-6 4h6m-6 4h4"
};

export function MetricCard({ label, value, hint, info, featured = false }: Props) {
  return (
    <article className={`metric-card ${featured ? "is-featured" : ""}`}>
      <div className="metric-card-head">
        <span className="metric-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d={metricPaths[label] ?? metricPaths.Snapshots} />
          </svg>
        </span>
        {info ? <InfoTooltip text={info} /> : null}
      </div>
      <p className="metric-value" title={value}>{value}</p>
      <p className="metric-label">{label}</p>
      {hint ? <p className="metric-hint">{hint}</p> : null}
      {featured ? <span className="metric-jump" aria-hidden="true">↗</span> : null}
    </article>
  );
}
