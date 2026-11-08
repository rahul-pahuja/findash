import type { DataResponse, Entry, ShortTermGoal } from "../lib/types";
import { ASSET_KEYS, ASSET_LABELS } from "../utils/config";
import { formatCompactCurrency, formatCurrency, formatDateLabel, formatPercent, formatSigned } from "../utils/format";
import { getPeakDrawdown, getRecentCapitalPace, getSnapshotTotals } from "../utils/insights";
import { Charts } from "./Charts";
import { CompactCurrency } from "./CompactCurrency";
import { TableView } from "./TableView";

interface Props {
  response: DataResponse;
  masked: boolean;
  themeMode: "light" | "dark";
  goal: ShortTermGoal | null;
  onSetGoal: () => void;
  onOpenHistory: () => void;
  onEdit: (entry: Entry) => void;
  onEditIncomeSip: (entry: Entry) => void;
}

function displayDate(date: string, includeYear = true) { return formatDateLabel(date, includeYear); }

function projectedGoalDate(goal: ShortTermGoal, currentWorth: number, pace: number, latestDate: string) {
  if (pace <= 0 || goal.targetAmount <= currentWorth) return null;
  const months = (goal.targetAmount - currentWorth) / pace;
  const timestamp = Date.parse(`${latestDate}T00:00:00Z`) + months * 30.4375 * 86_400_000;
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(timestamp));
}

export function Dashboard({ response, masked, themeMode, goal, onSetGoal, onOpenHistory, onEdit, onEditIncomeSip }: Props) {
  const entries = [...response.dataset.entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries[entries.length - 1];
  const previous = entries[entries.length - 2];
  if (!latest) return <div className="page-empty-state"><h1>Your wealth story starts here.</h1><p>Add your first snapshot to see your net worth and history.</p></div>;

  const totals = getSnapshotTotals(latest);
  const priorTotals = previous ? getSnapshotTotals(previous) : null;
  const change = priorTotals ? totals.netWorth - priorTotals.netWorth : null;
  const hardCapitalChange = priorTotals ? totals.hardCapital - priorTotals.hardCapital : null;
  const unrealizedChange = priorTotals ? totals.unrealizedGain - priorTotals.unrealizedGain : null;
  const drawdown = getPeakDrawdown(entries);
  const capitalPace = getRecentCapitalPace(entries);
  const latestDerived = response.derived[latest.id];
  const marketPortfolio = latestDerived?.marketExposure ?? ASSET_KEYS.reduce((sum, asset) => sum + latest.market_assets[asset].current, 0);
  const allocation = [...ASSET_KEYS.map((asset) => ({
    key: asset,
    label: ASSET_LABELS[asset],
    value: latest.market_assets[asset].current
  })), { key: "liquid", label: "Cash buffer", value: totals.liquidBuffer }, { key: "other", label: "Deposits + wallet", value: latest.hard_assets.fd + latest.hard_assets.stocks_wallet }]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const leadingAsset = allocation[0];
  const targetProgress = goal ? Math.min(100, Math.max(0, (totals.netWorth / goal.targetAmount) * 100)) : 0;
  const estimate = goal && capitalPace ? projectedGoalDate(goal, totals.netWorth, capitalPace.amountPerMonth, latest.date) : null;

  return (
    <div className="dashboard-page page-enter">
      <section className="dashboard-hero-grid" aria-label="Latest wealth snapshot">
        <div className="dashboard-hero-copy">
          <p className="section-eyebrow">Net worth <span>·</span> {displayDate(latest.date)}</p>
          <h1 className="net-worth-hero"><CompactCurrency value={totals.netWorth} masked={masked} /></h1>
          <p className={`hero-change${change !== null && change < 0 ? " is-negative" : ""}`}>
            {change === null ? "Your first recorded snapshot" : <>
              <strong>{formatSigned(change, masked)}</strong>
              <span> since {displayDate(previous!.date, false)}</span>
            </>}
          </p>
          {previous && hardCapitalChange !== null && unrealizedChange !== null ? <p className="hero-note">Since {displayDate(previous.date, false)}: hard capital changed {formatSigned(hardCapitalChange, masked)}; unrealized gain changed {formatSigned(unrealizedChange, masked)}.</p> : null}
        </div>

        <section className={`goal-tile${goal ? " has-goal" : " is-empty"}`} aria-labelledby="goal-tile-title">
          {goal ? (
            <>
              <p className="goal-tile-eyebrow" id="goal-tile-title">Short-term target</p>
              <div className="goal-tile-amount"><CompactCurrency value={goal.targetAmount} masked={masked} /></div>
              <div className="goal-progress-track" role="progressbar" aria-label="Progress toward short-term target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={masked ? undefined : Math.round(targetProgress)}><span style={{ width: `${masked ? 0 : targetProgress}%` }} /></div>
              <div className="goal-progress-labels"><strong>{masked ? "••% there" : `${targetProgress.toFixed(1)}% there`}</strong><span>{masked ? "•• to go" : `${formatCompactCurrency(Math.max(0, goal.targetAmount - totals.netWorth), false)} to go`}</span></div>
              <p className="goal-tile-copy">
                {totals.netWorth >= goal.targetAmount ? "Target reached." : estimate ? `At your recent pace, around ${estimate}.` : capitalPace ? "Recent hard-capital change does not support an estimate." : "Add more snapshots to estimate your pace."}
              </p>
              <p className="goal-tile-date">Your target date · {displayDate(goal.targetDate)}</p>
              <button className="goal-edit-link" type="button" onClick={onSetGoal}>Edit target <span aria-hidden="true">↗</span></button>
            </>
          ) : (
            <>
              <p className="goal-tile-eyebrow" id="goal-tile-title">A short-term milestone</p>
              <h2>Give your next goal a number and a date.</h2>
              <p className="goal-tile-copy">Your progress stays here, with a pace estimate when your snapshots support one.</p>
              <button className="goal-tile-cta" type="button" onClick={onSetGoal}>Set a short-term target <span aria-hidden="true">→</span></button>
            </>
          )}
        </section>
      </section>

      <section className="metric-strip" aria-label="Supporting wealth measures">
        <Metric label="Hard capital" value={formatCompactCurrency(totals.hardCapital, masked)} hint="Balances + invested principal" />
        <Metric label="Market portfolio" value={formatCompactCurrency(marketPortfolio, masked)} hint="Current market value" />
        <Metric label="Unrealized gain" value={formatCompactCurrency(totals.unrealizedGain, masked)} hint="Value less principal" tone={totals.unrealizedGain < 0 ? "negative" : "positive"} />
        <Metric label="Cash buffer" value={formatCompactCurrency(totals.liquidBuffer, masked)} hint="Bank + Sodexo" />
        <Metric
          label="Added / month"
          value={capitalPace ? formatCompactCurrency(capitalPace.amountPerMonth, masked) : "—"}
          hint={capitalPace ? `Hard capital · since ${displayDate(capitalPace.anchor.date, false)}` : "Add more snapshots for a pace"}
        />
      </section>

      <section className="dashboard-insight-row" aria-label="Snapshot context">
        <Fact label="From peak" value={drawdown && drawdown.amount < 0 ? formatCompactCurrency(drawdown.amount, masked) : "At recorded peak"} detail={drawdown && drawdown.amount < 0 ? `${masked ? "••%" : `${Math.abs(drawdown.percent * 100).toFixed(1)}%`} below ${displayDate(drawdown.peak.date, false)}` : "Latest recorded net worth"} />
        <Fact label="Largest allocation" value={leadingAsset?.label ?? "—"} detail={leadingAsset && totals.netWorth > 0 ? `${formatPercent(leadingAsset.value / totals.netWorth, masked)} of latest net worth` : "No allocation recorded"} />
        <Fact label="Added / month" value={capitalPace ? formatCompactCurrency(capitalPace.amountPerMonth, masked) : "—"} detail={capitalPace ? `Hard-capital change · ${displayDate(capitalPace.anchor.date, false)} to ${displayDate(capitalPace.latest.date, false)}` : "Add more snapshots for a pace"} />
        <p className="insight-footnote">Figures reflect recorded snapshot values; capital change is not a transaction-level savings measure.</p>
      </section>

      <Charts response={response} dataset={response.dataset} masked={masked} themeMode={themeMode} />

      <section className="recent-snapshots" aria-labelledby="recent-snapshots-title">
        <div className="section-heading-row">
          <div><h2 id="recent-snapshots-title">Snapshots</h2><p>Latest {Math.min(entries.length, 4)} of {entries.length} records</p></div>
          <button className="text-action" type="button" onClick={onOpenHistory}>All {entries.length} snapshots <span aria-hidden="true">→</span></button>
        </div>
        <TableView entries={entries} allEntries={entries} masked={masked} maxRows={4} onEdit={onEdit} onEditIncomeSip={onEditIncomeSip} />
      </section>
    </div>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "positive" | "negative" }) {
  return <article className="metric-strip-item"><p>{label}</p><strong className={tone ? `is-${tone}` : ""}>{value}</strong><span>{hint}</span></article>;
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="insight-chip"><p className="insight-chip-label">{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}
