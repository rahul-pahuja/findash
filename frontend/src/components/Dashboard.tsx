import type { ReactNode } from "react";
import type { DataResponse, Entry, RangeKey } from "../lib/types";
import { ASSET_KEYS } from "../utils/config";
import { formatCompactCurrency, formatDateLabel, formatSigned } from "../utils/format";
import { getPeakDrawdown, getRegularCapitalPace, getSnapshotTotals } from "../utils/insights";
import { estimateDate, pickNextGoal, projectedMonths } from "../utils/goalProjection";
import { Charts } from "./Charts";
import { CompactCurrency } from "./CompactCurrency";
import { TableView } from "./TableView";

interface Props {
  response: DataResponse;
  masked: boolean;
  themeMode: "light" | "dark";
  onOpenHistory: () => void;
  onEdit: (entry: Entry) => void;
  chartRange: RangeKey;
  onChartRangeChange: (range: RangeKey) => void;
  onOpenPlan: () => void;
}

function displayDate(date: string, includeYear = true) { return formatDateLabel(date, includeYear); }

export function Dashboard({ response, masked, themeMode, onOpenHistory, onEdit, chartRange, onChartRangeChange, onOpenPlan }: Props) {
  const entries = [...response.dataset.entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries[entries.length - 1];
  const previous = entries[entries.length - 2];
  if (!latest) return <div className="page-empty-state"><h2>Your wealth story starts here.</h2><p>Add your first snapshot to see your net worth and history.</p></div>;

  const totals = getSnapshotTotals(latest);
  const priorTotals = previous ? getSnapshotTotals(previous) : null;
  const change = priorTotals ? totals.netWorth - priorTotals.netWorth : null;
  const drawdown = getPeakDrawdown(entries);
  const latestDerived = response.derived[latest.id];
  const marketPortfolio = latestDerived?.marketExposure ?? ASSET_KEYS.reduce((sum, asset) => sum + (latest.marketAssets?.[asset]?.current ?? 0), 0);
  const nextGoal = pickNextGoal(response.dataset.goals, totals.netWorth);
  const nextGoalEyebrow = nextGoal ? (nextGoal.type === "milestone" ? "Next milestone" : "Long-term goal") : "Next milestone";
  const goalProgress = nextGoal ? Math.min(100, Math.max(0, totals.netWorth / nextGoal.targetAmount * 100)) : 0;
  const capitalPace = getRegularCapitalPace(entries, 6);
  const expectedReturn = response.dataset.settings.expectedMarketReturn;
  const showZeroReturnScenario = response.dataset.settings.showZeroReturnScenario;
  const expectedGoalMonths = nextGoal && capitalPace && expectedReturn !== null
    ? projectedMonths(totals.netWorth, nextGoal.targetAmount, capitalPace.amountPerMonth, expectedReturn)
    : null;
  const showDistinctZeroScenario = showZeroReturnScenario && expectedReturn !== 0;
  const zeroGoalMonths = nextGoal && capitalPace && showDistinctZeroScenario
    ? projectedMonths(totals.netWorth, nextGoal.targetAmount, capitalPace.amountPerMonth, 0)
    : null;
  const expectedGoalEstimate = expectedGoalMonths === null ? null : estimateDate(latest.date, expectedGoalMonths);
  const zeroGoalEstimate = zeroGoalMonths === null ? null : estimateDate(latest.date, zeroGoalMonths);
  const goalProjectionDetails = [
    expectedGoalEstimate ? `around ${expectedGoalEstimate} at ${(expectedReturn! * 100).toFixed(1)}%` : null,
    zeroGoalEstimate ? `around ${zeroGoalEstimate} at 0%` : null
  ].filter((detail): detail is string => detail !== null);
  const goalTileCopy = !capitalPace
    ? "Add another snapshot to estimate a date from your recorded pace."
    : goalProjectionDetails.length > 1
      ? `At ${formatCompactCurrency(capitalPace.amountPerMonth, masked)} a month: ${goalProjectionDetails.join("; ")}.`
      : goalProjectionDetails.length === 1
        ? `At ${formatCompactCurrency(capitalPace.amountPerMonth, masked)} a month, ${goalProjectionDetails[0]}.`
        : `Recorded pace is ${formatCompactCurrency(capitalPace.amountPerMonth, masked)} a month. Add a market return assumption in Plan to estimate a date.`;
  const hardCapitalChange = priorTotals ? totals.hardCapital - priorTotals.hardCapital : null;
  const marketMovement = priorTotals ? totals.unrealizedGain - priorTotals.unrealizedGain : null;

  return (
    <div className="dashboard-page page-enter">
      <section className="dashboard-hero-grid" aria-label="Latest wealth snapshot">
        <div className="dashboard-hero-copy">
          <p className="section-eyebrow">Net worth <span>·</span> {displayDate(latest.date)}</p>
          <h2 className="net-worth-hero"><CompactCurrency value={totals.netWorth} masked={masked} /></h2>
          <p className={`hero-change${change !== null && change < 0 ? " is-negative" : ""}`}>
            {change === null ? "Your first recorded snapshot" : <>
              <strong>{formatSigned(change, masked)}</strong>
              <span> since {displayDate(previous!.date, false)}</span>
            </>}
          </p>
          {drawdown && drawdown.amount < 0 ? <span className="peak-pill">{masked ? "••% below peak" : `${Math.abs(drawdown.percent * 100).toFixed(1)}% below peak`} · {displayDate(drawdown.peak.date, false)}</span> : <span className="peak-pill">At recorded peak</span>}
          {hardCapitalChange !== null && marketMovement !== null ? <p className="hero-note">Hard capital changed <strong>{formatSigned(hardCapitalChange, masked)}</strong>; market movement changed <strong>{formatSigned(marketMovement, masked)}</strong> since {displayDate(previous!.date, false)}.</p> : null}
        </div>
        {nextGoal ? <aside className="goal-tile" aria-label={`${nextGoalEyebrow}: ${nextGoal.name}`}>
          <div className="goal-tile-heading-row"><p className="goal-tile-eyebrow">{nextGoalEyebrow}</p><span className="goal-tile-heading-separator" aria-hidden="true" /><h3 className="goal-tile-name">{nextGoal.name}</h3></div>
          <p className="goal-tile-amount"><CompactCurrency value={nextGoal.targetAmount} masked={masked} /></p>
          <div className="goal-progress-track" role="progressbar" aria-label={`${nextGoal.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={masked ? undefined : Math.round(goalProgress)} aria-valuetext={masked ? "Progress hidden" : `${goalProgress.toFixed(1)}% complete`}><span style={{ width: masked ? "0%" : `${goalProgress}%` }} /></div>
          <div className="goal-progress-labels"><span>{masked ? "••% complete" : `${goalProgress.toFixed(1)}% there`}</span><span>{formatCompactCurrency(Math.max(0, nextGoal.targetAmount - totals.netWorth), masked)} to go</span></div>
          <p className="goal-tile-copy">{goalTileCopy}</p>
          {nextGoal.targetDate ? <p className="goal-tile-date">Your target date: {displayDate(nextGoal.targetDate)}</p> : expectedReturn === null && showZeroReturnScenario ? <p className="goal-tile-date">Projection uses a 0% market return assumption.</p> : null}
          <button className="goal-edit-link" type="button" onClick={onOpenPlan}>Open Plan <span aria-hidden="true">→</span></button>
        </aside> : <aside className="goal-tile is-empty" aria-label="Set a financial milestone">
          <p className="goal-tile-eyebrow">Next milestone</p>
          <h2>Choose what you’re building towards.</h2>
          <p className="goal-tile-copy">Set a target in Plan to keep your next milestone in view.</p>
          <button className="goal-tile-cta" type="button" onClick={onOpenPlan}>Open Plan <span aria-hidden="true">→</span></button>
        </aside>}
      </section>

      <section className="metric-strip" aria-label="Supporting wealth measures">
        <Metric label="Hard capital" value={<CompactCurrency value={totals.hardCapital} masked={masked} />} hint="Balances + invested principal" />
        <Metric label="Market portfolio" value={<CompactCurrency value={marketPortfolio} masked={masked} />} hint="Current market value" />
        <Metric label="Unrealized gain" value={<CompactCurrency value={totals.unrealizedGain} masked={masked} />} hint="Value less principal" tone={totals.unrealizedGain < 0 ? "negative" : "positive"} />
        <Metric label="Cash buffer" value={<CompactCurrency value={totals.liquidBuffer} masked={masked} />} hint="Bank + Sodexo" />
      </section>
      <Charts response={response} dataset={response.dataset} masked={masked} themeMode={themeMode} chartRange={chartRange} onChartRangeChange={onChartRangeChange} />

      <section className="recent-snapshots" aria-labelledby="recent-snapshots-title">
        <div className="section-heading-row">
          <div><h2 id="recent-snapshots-title">Snapshots</h2><p>Latest {Math.min(entries.length, 3)} of {entries.length} records</p></div>
          <button className="text-action" type="button" onClick={onOpenHistory}>All {entries.length} snapshots <span aria-hidden="true">→</span></button>
        </div>
        <TableView entries={entries} allEntries={entries} masked={masked} maxRows={3} onEdit={onEdit} />
      </section>
    </div>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: ReactNode; hint: string; tone?: "positive" | "negative" }) {
  return <article className="metric-strip-item"><p>{label}</p><strong className={tone ? `is-${tone}` : ""}>{value}</strong><span>{hint}</span></article>;
}
