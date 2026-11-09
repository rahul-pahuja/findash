import { useMemo, useState, type FormEvent } from "react";
import type { Dataset, EffectiveDatedAmount, Goal } from "../lib/types";
import { formatCompactCurrency, formatDateLabel, formatSignedPercent } from "../utils/format";
import { getEffectiveMonthlyAmount, getRegularCapitalPace, getSnapshotTotals } from "../utils/insights";
import { estimateDate, projectedMonths } from "../utils/goalProjection";
import { FormInput, FormSelect } from "./FormControls";

interface Props { dataset: Dataset; masked: boolean; overallReturn: number | null; overallReturnLoading: boolean; onChange: (dataset: Dataset) => void; }

export function PlanPage({ dataset, masked, overallReturn, overallReturnLoading, onChange }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [goalType, setGoalType] = useState<Goal["type"]>("milestone");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [incomeDate, setIncomeDate] = useState(() => monthStart());
  const [incomeAmount, setIncomeAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => monthStart());
  const [expenseAmount, setExpenseAmount] = useState("");
  const [revealSavedAmounts, setRevealSavedAmounts] = useState(false);
  const hideSavedAmounts = masked && !revealSavedAmounts;
  const entries = [...dataset.entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries.at(-1);
  const totals = latest ? getSnapshotTotals(latest) : null;
  const pace6 = getRegularCapitalPace(entries, 6);
  const pace12 = getRegularCapitalPace(entries, 12);
  const monthlyIncome = latest ? getEffectiveMonthlyAmount(dataset.incomeHistory, latest.date) : null;
  const monthlyExpenses = latest ? getEffectiveMonthlyAmount(dataset.expenseHistory, latest.date) : null;
  const savingsRate = monthlyIncome && pace6 ? pace6.amountPerMonth / monthlyIncome : null;
  const runway = monthlyExpenses && totals ? totals.liquidBuffer / monthlyExpenses : null;

  const goals = useMemo(() => dataset.goals ?? [], [dataset.goals]);
  function addGoal(event: FormEvent) {
    event.preventDefault();
    const targetAmount = Number(amount.replace(/,/g, ""));
    if (!name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) return;
    const now = new Date().toISOString();
    const goal: Goal = { id: crypto.randomUUID(), name: name.trim(), type: goalType, targetAmount, ...(targetDate ? { targetDate } : {}), createdAt: now, updatedAt: now };
    onChange({ ...dataset, goals: [...goals, goal] });
    setName(""); setAmount(""); setTargetDate(""); setGoalType("milestone");
    setGoalFormOpen(false);
  }
  function deleteGoal(id: string) { onChange({ ...dataset, goals: goals.filter((goal) => goal.id !== id) }); }
  function beginEdit(goal: Goal) { setEditingId(goal.id); setGoalFormOpen(true); setName(goal.name); setAmount(String(goal.targetAmount)); setTargetDate(goal.targetDate ?? ""); setGoalType(goal.type); }
  function saveGoalEdit(event: FormEvent) {
    event.preventDefault();
    const current = goals.find((goal) => goal.id === editingId);
    const targetAmount = Number(amount.replace(/,/g, ""));
    if (!current || !name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) return;
    const updated: Goal = { ...current, name: name.trim(), type: goalType, targetAmount, ...(targetDate ? { targetDate } : { targetDate: undefined }), updatedAt: new Date().toISOString() };
    onChange({ ...dataset, goals: goals.map((goal) => goal.id === current.id ? updated : goal) });
    setEditingId(null); setName(""); setAmount(""); setTargetDate("");
    setGoalFormOpen(false);
  }
  function cancelGoalForm() { setEditingId(null); setGoalFormOpen(false); setName(""); setAmount(""); setTargetDate(""); setGoalType("milestone"); }
  function addHistory(kind: "incomeHistory" | "expenseHistory") {
    const date = kind === "incomeHistory" ? incomeDate : expenseDate;
    const amount = Number((kind === "incomeHistory" ? incomeAmount : expenseAmount).replace(/,/g, ""));
    if (!date || !Number.isFinite(amount) || amount < 0) return;
    const next: EffectiveDatedAmount[] = [...dataset[kind].filter((item) => item.from !== date), { from: date, monthlyAmount: amount }].sort((a, b) => a.from.localeCompare(b.from));
    onChange({ ...dataset, [kind]: next });
    if (kind === "incomeHistory") setIncomeAmount(""); else setExpenseAmount("");
  }
  function editHistory(kind: "incomeHistory" | "expenseHistory", from: string, amount: number) {
    onChange({ ...dataset, [kind]: dataset[kind].map((item) => item.from === from ? { ...item, monthlyAmount: amount } : item) });
  }
  function deleteHistory(kind: "incomeHistory" | "expenseHistory", from: string) {
    onChange({ ...dataset, [kind]: dataset[kind].filter((item) => item.from !== from) });
  }
  function useOverallReturn() {
    if (overallReturn === null) return;
    onChange({ ...dataset, settings: { ...dataset.settings, expectedMarketReturn: overallReturn } });
  }

  return <div className="page-content plan-page page-enter">
    {!latest ? <div className="empty-panel"><h3>Add a snapshot to start planning</h3><p>Your current wealth and progress will appear here.</p></div> : null}
    <section className="plan-goals-section ruled-panel" aria-labelledby="goals-heading">
      <div className="section-heading"><div><h2 id="goals-heading">Goals</h2><p>{goals.length ? `${goals.length} saved ${goals.length === 1 ? "goal" : "goals"}` : "Add targets you want to keep in view."}</p></div></div>
      <div className="goal-list">{goals.map((goal) => {
        const progress = totals ? Math.min(100, Math.max(0, totals.netWorth / goal.targetAmount * 100)) : 0;
        const months6 = pace6 ? projectedMonths(totals?.netWorth ?? 0, goal.targetAmount, pace6.amountPerMonth, 0) : null;
        const assumedReturn = dataset.settings.expectedMarketReturn;
        const months12 = pace12 && assumedReturn !== null ? projectedMonths(totals?.netWorth ?? 0, goal.targetAmount, pace12.amountPerMonth, assumedReturn) : null;
        const scenarioMonths = [months6, months12].filter((value): value is number => value !== null).sort((a, b) => a - b);
        const scenarioDates = latest ? scenarioMonths.map((months) => estimateDate(latest.date, months)).filter((value): value is string => Boolean(value)) : [];
        return <article className="goal-plan-card" key={goal.id}>
          <div className="goal-plan-top"><div><p className="micro-label">{goal.type === "long-term" ? "Long-term" : "Short-term milestone"}</p><h3>{goal.name}</h3></div><div className="goal-card-actions"><button className="quiet-button" type="button" onClick={() => beginEdit(goal)}>Edit</button><button className="quiet-button" type="button" onClick={() => deleteGoal(goal.id)} aria-label={`Delete ${goal.name}`}>Remove</button></div></div>
          <strong className="goal-target-value">{formatCompactCurrency(goal.targetAmount, masked)}</strong>
          {totals ? <><div className="goal-progress-track" role="progressbar" aria-label={`${goal.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={masked ? undefined : Math.round(progress)}><span style={{ width: `${masked ? 0 : progress}%` }} /></div><div className="goal-progress-labels"><span>{masked ? "••% complete" : `${progress.toFixed(1)}% complete`}</span><span>{masked ? "•• remaining" : `${formatCompactCurrency(Math.max(0, goal.targetAmount - totals.netWorth), false)} remaining`}</span></div></> : null}
          <p className="goal-date-note">{goal.targetDate ? `Your target date: ${formatDateLabel(goal.targetDate)}` : "No target date set"}</p>
          <p className="goal-projection-note">{masked ? "Progress and projections are hidden while amounts are masked." : totals && totals.netWorth >= goal.targetAmount ? "Target reached." : scenarioDates.length > 1 ? `Scenario range: ${scenarioDates[0]}–${scenarioDates.at(-1)}. Based on trailing 6/12 month capital pace and 0% to your assumed market return (${(assumedReturn! * 100).toFixed(1)}%).` : scenarioDates.length === 1 ? `At the recorded pace: around ${scenarioDates[0]}${assumedReturn === null ? " with 0% market return; add an assumption in Plan for another scenario." : "."}` : "A projection needs at least two snapshots and a positive recorded capital pace."}</p>
        </article>;
      })}</div>
      {!goals.length && !goalFormOpen ? <p className="settings-empty-hint">No goals set yet. Add a target to keep a milestone in view.</p> : null}
      {goalFormOpen ? <form className="goal-create-form" onSubmit={editingId ? saveGoalEdit : addGoal}>
        <h3>{editingId ? "Edit goal" : "Add a goal"}</h3>
        <FormInput label="Goal name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Home down payment" />
        <FormInput label="Target amount (₹)" required inputMode="decimal" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <FormSelect label="Goal type" value={goalType} onChange={(event) => setGoalType(event.target.value as Goal["type"])} options={[{ value: "milestone", label: "Short-term milestone" }, { value: "long-term", label: "Long-term goal" }]} />
        <FormInput label={<>Target date <span className="optional-label">Optional</span></>} type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        <div className="goal-form-actions"><button className="primary-action" type="submit">{editingId ? "Save goal" : "Add goal"}</button><button className="quiet-button" type="button" onClick={cancelGoalForm}>Cancel</button></div>
      </form> : <button className="text-action" type="button" onClick={() => setGoalFormOpen(true)}>+ Add your own goal <span aria-hidden="true">›</span></button>}
    </section>

    <section className="ruled-panel plan-metrics" aria-labelledby="plan-metrics-title"><div className="section-heading"><div><h2 id="plan-metrics-title">Your pace</h2><p>Calculated only when the needed inputs are available.</p></div></div>
      <div className="plan-metric-grid">
        <article><span>Savings rate</span><strong>{savingsRate === null ? "—" : masked ? "••%" : `${(savingsRate * 100).toFixed(1)}%`}</strong><p>{savingsRate === null ? "Add income history and at least two snapshots in Assumptions below." : `Based on recorded capital change and ${formatCompactCurrency(monthlyIncome, masked)} monthly income.`}</p></article>
        <article><span>Emergency runway</span><strong>{runway === null ? "—" : masked ? "•• months" : `${runway.toFixed(1)} months`}</strong><p>{runway === null ? "Add monthly expenses in Assumptions below to calculate runway." : `Cash buffer divided by ${formatCompactCurrency(monthlyExpenses, masked)} monthly expenses.`}</p></article>
        <article><span>Capital pace · 6 months</span><strong>{pace6 ? formatCompactCurrency(pace6.amountPerMonth, masked) : "—"}</strong><p>{pace6 ? `Recorded change, adjusted for ${formatCompactCurrency(pace6.oneOffAdjustment, masked)} in one-off events.` : "Add more snapshot history to establish a pace."}</p></article>
      </div>
    </section>

    <section className="ruled-panel settings-section plan-assumptions-section" aria-labelledby="assumptions-heading">
      <div className="section-heading"><div><h2 id="assumptions-heading">Assumptions</h2><p>Used for projections only. Recorded snapshots never change.</p></div>{masked ? <button className="quiet-button" type="button" onClick={() => setRevealSavedAmounts((value) => !value)}>{revealSavedAmounts ? "Hide saved amounts" : "Reveal saved amounts"}</button> : null}</div>

      <details className="assumption-disclosure">
        <summary><span><strong>Monthly income</strong><small>Effective monthly take-home income, starting on the date shown.</small></span><b>{monthlyIncome === null ? "Not set" : formatCompactCurrency(monthlyIncome, hideSavedAmounts)}</b></summary>
        <div className="assumption-disclosure-content"><HistoryList kind="incomeHistory" values={dataset.incomeHistory} hidden={hideSavedAmounts} onEdit={editHistory} onDelete={deleteHistory} /><div className="history-add-row"><FormInput label="From" type="date" value={incomeDate} onChange={(event) => setIncomeDate(event.target.value)} /><FormInput label="Amount (₹)" type="number" min="0" value={incomeAmount} onChange={(event) => setIncomeAmount(event.target.value)} /><button type="button" className="quiet-button" onClick={() => addHistory("incomeHistory")}>Add period</button></div></div>
      </details>

      <details className="assumption-disclosure">
        <summary><span><strong>Monthly expenses</strong><small>Effective monthly spend, used for emergency runway.</small></span><b>{monthlyExpenses === null ? "Not set" : formatCompactCurrency(monthlyExpenses, hideSavedAmounts)}</b></summary>
        <div className="assumption-disclosure-content"><HistoryList kind="expenseHistory" values={dataset.expenseHistory} hidden={hideSavedAmounts} onEdit={editHistory} onDelete={deleteHistory} /><div className="history-add-row"><FormInput label="From" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} /><FormInput label="Amount (₹)" type="number" min="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} /><button type="button" className="quiet-button" onClick={() => addHistory("expenseHistory")}>Add period</button></div></div>
      </details>

      <details className="assumption-disclosure">
        <summary><span><strong>Expected market return</strong><small>Optional projection assumption.</small></span><b>{dataset.settings.expectedMarketReturn === null ? "Not set" : hideSavedAmounts ? "••% a year" : `${(dataset.settings.expectedMarketReturn * 100).toFixed(1)}% a year`}</b></summary>
        <div className="assumption-disclosure-content"><div className="overall-return-choice"><div><strong>Current overall return</strong><small>{overallReturnLoading ? "Calculating from all snapshots…" : overallReturn === null ? "Unavailable for this history." : hideSavedAmounts ? "••% a year · all snapshots" : `${formatSignedPercent(overallReturn, false)} a year · all snapshots`}</small></div><button type="button" className="quiet-button" onClick={useOverallReturn} disabled={overallReturnLoading || overallReturn === null}>Use overall return</button></div><FormInput fieldClassName="assumption-field" label="Or set your expected annual return (%)" type={hideSavedAmounts ? "text" : "number"} inputMode="decimal" step="0.1" readOnly={hideSavedAmounts} value={hideSavedAmounts ? "••••" : dataset.settings.expectedMarketReturn === null ? "" : (dataset.settings.expectedMarketReturn * 100).toFixed(1)} onChange={(event) => onChange({ ...dataset, settings: { ...dataset.settings, expectedMarketReturn: event.target.value === "" ? null : Number(event.target.value) / 100 } })} placeholder="Optional" helper="Plan also shows a 0% market return scenario." /></div>
      </details>

      <details className="assumption-disclosure">
        <summary><span><strong>Emergency fund target</strong><small>Used to assess your cash buffer.</small></span><b>{dataset.settings.emergencyFundTargetMonths} months</b></summary>
        <div className="assumption-disclosure-content"><FormInput fieldClassName="assumption-field" label="Target in months" type="number" min="1" max="60" step="1" value={dataset.settings.emergencyFundTargetMonths} onChange={(event) => onChange({ ...dataset, settings: { ...dataset.settings, emergencyFundTargetMonths: Math.max(1, Number(event.target.value)) } })} /></div>
      </details>
    </section>
  </div>;
}

function monthStart() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`; }

function HistoryList({ kind, values, hidden, onEdit, onDelete }: { kind: "incomeHistory" | "expenseHistory"; values: EffectiveDatedAmount[]; hidden: boolean; onEdit: (kind: "incomeHistory" | "expenseHistory", from: string, amount: number) => void; onDelete: (kind: "incomeHistory" | "expenseHistory", from: string) => void }) {
  const label = kind === "incomeHistory" ? "income" : "expense";
  return values.length ? <div className="effective-history-list">{values.map((item) => <div key={item.from}><time>{formatDateLabel(item.from)}</time><label><span>₹</span><input aria-label={`${label} amount from ${item.from}`} type={hidden ? "text" : "number"} inputMode="decimal" min="0" readOnly={hidden} value={hidden ? "••••" : item.monthlyAmount} onChange={(event) => onEdit(kind, item.from, Math.max(0, Number(event.target.value)))} /></label><button type="button" className="history-remove-button" aria-label={`Remove ${label} period effective ${formatDateLabel(item.from)}`} onClick={() => onDelete(kind, item.from)}>×</button></div>)}</div> : <p className="settings-empty-hint">No history entered. Add a dated amount below to enable related metrics.</p>;
}
