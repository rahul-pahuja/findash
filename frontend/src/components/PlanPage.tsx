import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Dataset, EffectiveDatedAmount, Goal } from "../lib/types";
import { formatCompactCurrency, formatCurrency, formatDateLabel } from "../utils/format";
import { getRegularCapitalPace, getSnapshotTotals } from "../utils/insights";
import { estimateDate, projectedMonths } from "../utils/goalProjection";
import { CompactCurrency } from "./CompactCurrency";
import { FormInput, FormSelect, SwitchControl } from "./FormControls";

interface Props { dataset: Dataset; masked: boolean; overallReturn: number | null; overallReturnLoading: boolean; onChange: (dataset: Dataset) => void; }
type PlanModal = "incomeHistory" | "expenseHistory" | "marketReturn" | "emergencyFund";

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
  const [marketReturnDraft, setMarketReturnDraft] = useState("");
  const [returnMode, setReturnMode] = useState<"observed" | "custom">("observed");
  const [showZeroReturnScenarioDraft, setShowZeroReturnScenarioDraft] = useState(true);
  const [emergencyFundTargetDraft, setEmergencyFundTargetDraft] = useState("");
  const [activeModal, setActiveModal] = useState<PlanModal | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [railEdges, setRailEdges] = useState({ back: false, forward: false });
  const hideSavedAmounts = masked;
  const entries = [...dataset.entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries.at(-1);
  const totals = latest ? getSnapshotTotals(latest) : null;
  const pace6 = getRegularCapitalPace(entries, 6);
  const pace12 = getRegularCapitalPace(entries, 12);
  const asOfDate = latest?.date ?? todayDate();
  const currentIncome = [...dataset.incomeHistory].sort((a, b) => a.from.localeCompare(b.from)).filter((item) => item.from <= asOfDate).at(-1);
  const currentExpense = [...dataset.expenseHistory].sort((a, b) => a.from.localeCompare(b.from)).filter((item) => item.from <= asOfDate).at(-1);
  const monthlyIncome = currentIncome?.monthlyAmount ?? null;
  const monthlyExpenses = currentExpense?.monthlyAmount ?? null;
  const savingsRate = monthlyIncome && pace6 ? pace6.amountPerMonth / monthlyIncome : null;
  const runway = monthlyExpenses && totals ? totals.liquidBuffer / monthlyExpenses : null;

  useEffect(() => {
    if (!activeModal) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setActiveModal(null); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [activeModal]);

  const goals = useMemo(() => dataset.goals ?? [], [dataset.goals]);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const updateRailEdges = () => setRailEdges({ back: el.scrollLeft > 1, forward: el.scrollLeft < el.scrollWidth - el.clientWidth - 1 });
    updateRailEdges();
    el.addEventListener("scroll", updateRailEdges, { passive: true });
    const observer = new ResizeObserver(updateRailEdges);
    observer.observe(el);
    return () => { el.removeEventListener("scroll", updateRailEdges); observer.disconnect(); };
  }, [goals.length]);
  function scrollGoalsByCard(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".goal-plan-card");
    const step = (card ? card.offsetWidth + 14 : 394) * direction;
    el.scrollBy({ left: step, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
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
  function beginEdit(goal: Goal) { setEditingId(goal.id); setGoalFormOpen(true); setName(goal.name); setAmount(String(goal.targetAmount)); setTargetDate(goal.targetDate ?? ""); setGoalType(goal.type); document.getElementById(`goal-card-${goal.id}`)?.scrollIntoView({ block: "nearest", inline: "nearest" }); }
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
    setReturnMode("observed");
    setMarketReturnDraft((overallReturn * 100).toFixed(1));
  }
  function openMarketReturnModal() {
    const savedReturn = dataset.settings.expectedMarketReturn;
    const observedSelected = savedReturn === null && overallReturn !== null;
    setReturnMode(observedSelected ? "observed" : "custom");
    setMarketReturnDraft((observedSelected ? overallReturn : savedReturn) === null ? "" : (((observedSelected ? overallReturn : savedReturn) ?? 0) * 100).toFixed(1));
    setShowZeroReturnScenarioDraft(dataset.settings.showZeroReturnScenario);
    setActiveModal("marketReturn");
  }
  function saveMarketReturn(event: FormEvent) {
    event.preventDefault();
    const trimmed = marketReturnDraft.trim();
    const value = returnMode === "observed" ? overallReturn : trimmed === "" ? null : Number(trimmed) / 100;
    if (value !== null && !Number.isFinite(value)) return;
    onChange({ ...dataset, settings: { ...dataset.settings, expectedMarketReturn: value, showZeroReturnScenario: showZeroReturnScenarioDraft } });
    setActiveModal(null);
  }
  function openEmergencyFundModal() {
    setEmergencyFundTargetDraft(String(dataset.settings.emergencyFundTargetMonths));
    setActiveModal("emergencyFund");
  }
  function saveEmergencyFundTarget(event: FormEvent) {
    event.preventDefault();
    const value = Number(emergencyFundTargetDraft);
    if (!Number.isInteger(value) || value < 1 || value > 60) return;
    onChange({ ...dataset, settings: { ...dataset.settings, emergencyFundTargetMonths: value } });
    setActiveModal(null);
  }

  return <div className="page-content plan-page page-enter">
    {!latest ? <div className="empty-panel"><h3>Add a snapshot to start planning</h3><p>Your current wealth and progress will appear here.</p></div> : null}
    <section className="plan-goals-section ruled-panel" aria-labelledby="goals-heading">
      <div className="section-heading">
        <div><h2 id="goals-heading">Goals</h2><p>What are you building towards, with a projected date?</p></div>
        {goals.length && !goalFormOpen ? <button className="text-action goals-add-action" type="button" onClick={() => setGoalFormOpen(true)}>+ Add your own goal <span aria-hidden="true">›</span></button> : null}
      </div>
      {goals.length ? <div className="goal-scroller" ref={scrollerRef} tabIndex={0} aria-label="Goal cards">{goals.map((goal) => {
        const progress = totals ? Math.min(100, Math.max(0, totals.netWorth / goal.targetAmount * 100)) : 0;
        const assumedReturn = dataset.settings.expectedMarketReturn;
        const showZeroReturnScenario = dataset.settings.showZeroReturnScenario;
        const paceWindows = [pace6, pace12].filter((pace): pace is NonNullable<typeof pace> => pace !== null);
        const forecastsForReturn = (annualRate: number) => latest ? paceWindows
          .map((pace) => projectedMonths(totals?.netWorth ?? 0, goal.targetAmount, pace.amountPerMonth, annualRate))
          .filter((months): months is number => months !== null)
          .sort((a, b) => a - b)
          .map((months) => ({ months, date: estimateDate(latest.date, months) }))
          .filter((forecast): forecast is { months: number; date: string } => forecast.date !== null) : [];
        const expectedForecasts = assumedReturn === null ? [] : forecastsForReturn(assumedReturn);
        const zeroForecasts = showZeroReturnScenario && assumedReturn !== 0 ? forecastsForReturn(0) : [];
        const allForecasts = [...expectedForecasts, ...zeroForecasts].sort((a, b) => a.months - b.months);
        const scenarioDates = allForecasts.map((forecast) => forecast.date);
        const reached = Boolean(totals && totals.netWorth >= goal.targetAmount);
        const projectionTitle = reached ? "Target reached" : scenarioDates.length > 1 ? `Around ${formatMonthRange(scenarioDates[0], scenarioDates.at(-1)!)}` : scenarioDates.length === 1 ? `Around ${formatMonthYear(scenarioDates[0])}` : goal.targetDate ? `Target · ${formatDateLabel(goal.targetDate)}` : "Projection needs more history";
        const forecastRange = (forecasts: typeof expectedForecasts) => forecasts.length > 1
          ? `around ${formatMonthRange(forecasts[0].date, forecasts.at(-1)!.date)}`
          : forecasts.length === 1 ? `around ${formatMonthYear(forecasts[0].date)}` : null;
        const projectionDetails = [
          expectedForecasts.length ? `${((assumedReturn ?? 0) * 100).toFixed(2)}% a year: ${forecastRange(expectedForecasts)}` : null,
          zeroForecasts.length ? `0%: ${forecastRange(zeroForecasts)}` : null
        ].filter((detail): detail is string => detail !== null);
        const projectionBasis = projectionDetails.length
          ? `Based on trailing 6/12-month capital pace. ${projectionDetails.join(". ")}.`
          : null;
        const projectionCopy = masked ? "Your projection is hidden while amounts are masked." : reached ? "You have reached this target." : projectionBasis ? `${projectionBasis}${goal.targetDate ? ` Your target date is ${formatDateLabel(goal.targetDate)}.` : ""} Change your saving pace or market return assumption below.` : "A projection needs at least two snapshots and a positive recorded capital pace.";
        return <article className="goal-plan-card" key={goal.id} id={`goal-card-${goal.id}`}>
          <div className="goal-feature-progress">
            <p className="goal-feature-eyebrow">{goal.type === "long-term" ? "Long-term goal" : "Short-term milestone"}</p>
            <h3>{goal.name}</h3>
            <strong className="goal-target-value"><CompactCurrency value={goal.targetAmount} masked={masked} /></strong>
            {totals ? <><div className="goal-progress-track" role="progressbar" aria-label={`${goal.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={masked ? undefined : Math.round(progress)}><span style={{ width: `${masked ? 0 : progress}%` }} /></div><div className="goal-progress-labels"><span>{masked ? "••% there" : `${progress.toFixed(1)}% there`}</span><span>{masked ? "•• to go" : `${formatCompactCurrency(Math.max(0, goal.targetAmount - totals.netWorth), false)} to go`}</span></div></> : <p className="goal-no-snapshot">Add a snapshot to see your progress.</p>}
          </div>
          <div className="goal-feature-details">
            <h4>{projectionTitle}</h4>
            <p>{projectionCopy}</p>
            <div className="goal-feature-actions"><button className="goal-feature-primary" type="button" onClick={() => beginEdit(goal)}>Edit target</button><button className="goal-feature-secondary" type="button" onClick={() => deleteGoal(goal.id)} aria-label={`Remove ${goal.name}`}>Remove</button></div>
          </div>
        </article>;
      })}</div> : null}
      {goals.length && (railEdges.back || railEdges.forward) ? <div className="goal-rail-footer">
        <div className="goal-rail-arrows">
          <button type="button" className="goal-rail-arrow" aria-label="Scroll goals backward" disabled={!railEdges.back} onClick={() => scrollGoalsByCard(-1)}><span aria-hidden="true">‹</span></button>
          <button type="button" className="goal-rail-arrow" aria-label="Scroll goals forward" disabled={!railEdges.forward} onClick={() => scrollGoalsByCard(1)}><span aria-hidden="true">›</span></button>
        </div>
      </div> : null}
      {!goals.length && !goalFormOpen ? <article className="goal-empty-feature"><div><p className="goal-feature-eyebrow">Start planning</p><h3>Choose a goal to track</h3></div><div><p>Add a target to see your progress and a projected date based on your saved snapshots.</p><button className="goal-feature-primary" type="button" onClick={() => setGoalFormOpen(true)}>Set a target</button></div></article> : null}
      {goalFormOpen ? <form className="goal-create-form" onSubmit={editingId ? saveGoalEdit : addGoal}>
        <h3>{editingId ? "Edit goal" : "Add a goal"}</h3>
        <FormInput label="Goal name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Home down payment" />
        <FormInput label="Target amount (₹)" required inputMode="decimal" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <FormSelect label="Goal type" value={goalType} onChange={(event) => setGoalType(event.target.value as Goal["type"])} options={[{ value: "milestone", label: "Short-term milestone" }, { value: "long-term", label: "Long-term goal" }]} />
        <FormInput label={<>Target date <span className="optional-label">Optional</span></>} type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        <div className="goal-form-actions"><button className="primary-action" type="submit">{editingId ? "Save goal" : "Add goal"}</button><button className="quiet-button" type="button" onClick={cancelGoalForm}>Cancel</button></div>
      </form> : null}
    </section>

    <section className="ruled-panel plan-metrics" aria-labelledby="plan-metrics-title"><div className="section-heading"><div><h2 id="plan-metrics-title">Your pace</h2><p>Calculated only when the needed inputs are available.</p></div></div>
      <div className="plan-metric-grid">
        <article><span>Savings rate</span><strong>{savingsRate === null ? "—" : masked ? "••%" : `${(savingsRate * 100).toFixed(1)}%`}</strong><p>{savingsRate === null ? "Add monthly salary above and at least two snapshots." : `Based on recorded capital change and ${formatCompactCurrency(monthlyIncome, masked)} monthly income.`}</p></article>
        <article><span>Emergency runway</span><strong>{runway === null ? "—" : masked ? "•• months" : `${runway.toFixed(1)} months`}</strong><p>{runway === null ? "Add monthly expenses above to calculate runway." : `Cash buffer divided by ${formatCompactCurrency(monthlyExpenses, masked)} monthly expenses.`}</p></article>
        <article><span>Capital pace · 6 months</span><strong>{pace6 ? <CompactCurrency value={pace6.amountPerMonth} masked={masked} /> : "—"}</strong><p>{pace6 ? `Recorded change, adjusted for ${formatCompactCurrency(pace6.oneOffAdjustment, masked)} in one-off events.` : "Add more snapshot history to establish a pace."}</p></article>
      </div>
    </section>

    <section className="ruled-panel settings-section plan-assumptions-section" aria-labelledby="assumptions-heading">
      <div className="section-heading"><div><h2 id="assumptions-heading">Assumptions</h2><p>Salary, expenses, and planning settings. Recorded snapshots never change.</p></div></div>

      <div className="assumption-disclosure money-assumption-row">
        <button className="money-assumption-trigger" type="button" aria-haspopup="dialog" onClick={() => setActiveModal("incomeHistory")}>
          <span><strong>Monthly salary</strong><small>Take-home pay, starting on the date shown.</small></span>
          <b>{monthlyIncome === null ? "Not set" : <CompactCurrency value={monthlyIncome} masked={hideSavedAmounts} />}</b>
        </button>
      </div>

      <div className="assumption-disclosure money-assumption-row">
        <button className="money-assumption-trigger" type="button" aria-haspopup="dialog" onClick={() => setActiveModal("expenseHistory")}>
          <span><strong>Monthly expenses</strong><small>Regular spending used to calculate emergency runway.</small></span>
          <b>{monthlyExpenses === null ? "Not set" : <CompactCurrency value={monthlyExpenses} masked={hideSavedAmounts} />}</b>
        </button>
      </div>

      <div className="assumption-disclosure money-assumption-row">
        <button className="money-assumption-trigger" type="button" aria-haspopup="dialog" onClick={openMarketReturnModal}>
          <span><strong>Expected market return</strong><small>Used to project goal timelines.</small></span>
          <b>{dataset.settings.expectedMarketReturn === null ? "Not set" : hideSavedAmounts ? "••% a year" : `${(dataset.settings.expectedMarketReturn * 100).toFixed(1)}% a year`}</b>
        </button>
      </div>

      <div className="assumption-disclosure money-assumption-row">
        <button className="money-assumption-trigger" type="button" aria-haspopup="dialog" onClick={openEmergencyFundModal}>
          <span><strong>Emergency fund target</strong><small>Used to assess your cash buffer.</small></span>
          <b>{dataset.settings.emergencyFundTargetMonths} months</b>
        </button>
      </div>
    </section>

    {activeModal ? createPortal(<div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveModal(null); }}>
      {activeModal === "incomeHistory" ? <MoneyHistoryDialog dialogRef={dialogRef} closeButtonRef={closeButtonRef} kind="incomeHistory" title="Monthly salary" description="Take-home pay and other regular income." values={dataset.incomeHistory} asOfDate={asOfDate} currentAmount={monthlyIncome} date={incomeDate} amount={incomeAmount} hidden={hideSavedAmounts} onDateChange={setIncomeDate} onAmountChange={setIncomeAmount} onAdd={() => addHistory("incomeHistory")} onEdit={editHistory} onDelete={deleteHistory} onClose={() => setActiveModal(null)} />
        : activeModal === "expenseHistory" ? <MoneyHistoryDialog dialogRef={dialogRef} closeButtonRef={closeButtonRef} kind="expenseHistory" title="Monthly expenses" description="Regular spending used to calculate your emergency runway." values={dataset.expenseHistory} asOfDate={asOfDate} currentAmount={monthlyExpenses} date={expenseDate} amount={expenseAmount} hidden={hideSavedAmounts} onDateChange={setExpenseDate} onAmountChange={setExpenseAmount} onAdd={() => addHistory("expenseHistory")} onEdit={editHistory} onDelete={deleteHistory} onClose={() => setActiveModal(null)} />
          : activeModal === "marketReturn" ? <SettingsDialogShell dialogRef={dialogRef} closeButtonRef={closeButtonRef} id="market-return-dialog" title="Expected market return" onClose={() => setActiveModal(null)}>
            <form className="expected-return-form" onSubmit={saveMarketReturn}>
              <div className="segmented-control expected-return-mode" role="group" aria-label="Market return source">
                <button type="button" className={returnMode === "observed" ? "is-selected" : ""} aria-pressed={returnMode === "observed"} onClick={useOverallReturn} disabled={overallReturnLoading || overallReturn === null}>Observed</button>
                <button type="button" className={returnMode === "custom" ? "is-selected" : ""} aria-pressed={returnMode === "custom"} onClick={() => setReturnMode("custom")}>Custom</button>
              </div>
              <label className="expected-return-field" htmlFor="expected-return-value">
                <span className="expected-return-label">Expected annual return</span>
                <span className="expected-return-value">
                  <input id="expected-return-value" className="expected-return-input modal-value-input" aria-label="Expected annual return in percent" type={hideSavedAmounts ? "text" : "number"} inputMode="decimal" step="0.1" disabled={hideSavedAmounts || returnMode === "observed"} value={hideSavedAmounts ? "••••" : marketReturnDraft} onChange={(event) => setMarketReturnDraft(event.target.value)} />
                  <span aria-hidden="true">%</span>
                </span>
              </label>
              <p className="expected-return-observed">{overallReturnLoading ? "Calculating observed return…" : overallReturn === null ? "Observed return is unavailable." : `Observed return is ${hideSavedAmounts ? "••%" : `${(overallReturn * 100).toFixed(2)}%`} a year.`}</p>
              <SwitchControl className="expected-return-scenario" label="Also show a 0% scenario" description="Compare against no market growth." checked={showZeroReturnScenarioDraft} onChange={setShowZeroReturnScenarioDraft} />
              <button className="money-add-button" type="submit" disabled={returnMode === "observed" ? overallReturn === null : marketReturnDraft.trim() !== "" && !Number.isFinite(Number(marketReturnDraft))}>Save</button>
            </form>
          </SettingsDialogShell>
            : <SettingsDialogShell dialogRef={dialogRef} closeButtonRef={closeButtonRef} id="emergency-fund-dialog" title="Emergency fund target" onClose={() => setActiveModal(null)}>
              <div className="money-current-block"><p className="money-card-eyebrow">Current</p><strong>{dataset.settings.emergencyFundTargetMonths} months</strong><p>Used to assess how long your cash buffer can cover expenses.</p></div>
              <form className="settings-modal-form" onSubmit={saveEmergencyFundTarget}>
                <label className="money-entry-row" htmlFor="emergency-fund-target"><span>Target in months</span><span className="money-amount-input"><input className="modal-value-input" id="emergency-fund-target" aria-label="Target in months" type="number" min="1" max="60" step="1" required value={emergencyFundTargetDraft} onChange={(event) => setEmergencyFundTargetDraft(event.target.value)} /><b>months</b></span></label>
                <p className="money-modal-hint">Choose between 1 and 60 months.</p>
                <button className="money-add-button" type="submit" disabled={!Number.isInteger(Number(emergencyFundTargetDraft)) || Number(emergencyFundTargetDraft) < 1 || Number(emergencyFundTargetDraft) > 60}>Save</button>
              </form>
            </SettingsDialogShell>}
    </div>, document.body) : null}
  </div>;
}

function monthStart() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`; }
function todayDate() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function formatMonthYear(value: string) {
  const separator = value.lastIndexOf(" ");
  if (separator < 0) return value;
  return `${value.slice(0, separator).slice(0, 3)} ${value.slice(separator + 1)}`;
}
function formatMonthRange(start: string, end: string) {
  const startSeparator = start.lastIndexOf(" ");
  const endSeparator = end.lastIndexOf(" ");
  if (startSeparator < 0 || endSeparator < 0) return `${start}–${end}`;
  const startMonth = start.slice(0, startSeparator);
  const startYear = start.slice(startSeparator + 1);
  const endMonth = end.slice(0, endSeparator);
  const endYear = end.slice(endSeparator + 1);
  if (startMonth === endMonth && startYear === endYear) return formatMonthYear(start);
  if (startYear === endYear) return `${startMonth.slice(0, 3)}–${endMonth.slice(0, 3)} ${startYear}`;
  return `${formatMonthYear(start)}–${formatMonthYear(end)}`;
}

type HistoryKind = "incomeHistory" | "expenseHistory";
type HistoryEditorProps = {
  dialogRef: RefObject<HTMLElement>;
  closeButtonRef: RefObject<HTMLButtonElement>;
  kind: HistoryKind;
  title: string;
  description: string;
  values: EffectiveDatedAmount[];
  asOfDate: string;
  currentAmount: number | null;
  date: string;
  amount: string;
  hidden: boolean;
  onDateChange: (date: string) => void;
  onAmountChange: (amount: string) => void;
  onAdd: () => void;
  onEdit: (kind: HistoryKind, from: string, amount: number) => void;
  onDelete: (kind: HistoryKind, from: string) => void;
  onClose: () => void;
};

function MoneyHistoryDialog({ dialogRef, closeButtonRef, kind, title, description, values, asOfDate, currentAmount, date, amount, hidden, onDateChange, onAmountChange, onAdd, onEdit, onDelete, onClose }: HistoryEditorProps) {
  const label = kind === "incomeHistory" ? "salary" : "expense";
  const current = [...values].sort((a, b) => a.from.localeCompare(b.from)).filter((item) => item.from <= asOfDate).at(-1);
  const parsedAmount = Number(amount.replace(/,/g, ""));
  const canAdd = Boolean(date && amount.trim() && Number.isFinite(parsedAmount) && parsedAmount >= 0);

  return <section ref={dialogRef} className="money-history-dialog" role="dialog" aria-modal="true" aria-labelledby={`${kind}-heading`} tabIndex={-1}>
    <header className="money-history-card-header"><button ref={closeButtonRef} className="money-history-close" type="button" onClick={onClose}>Close</button><h2 id={`${kind}-heading`}>{title}</h2></header>
    <div className="money-current-block">
      <p className="money-card-eyebrow">Current</p>
      <strong aria-live="polite">{currentAmount === null ? "Not set" : <CompactCurrency value={currentAmount} masked={hidden} />}</strong>
      <p>{current ? `a month · from ${formatDateLabel(current.from)}` : description}</p>
    </div>

    <div className="money-history-block">
      <h3>History</h3>
      {values.length ? <div className="money-history-list">{[...values].sort((a, b) => a.from.localeCompare(b.from)).map((item) => <div className="money-history-row" key={item.from}>
        <time dateTime={item.from}>{formatDateLabel(item.from)}</time>
        <HistoryAmount kind={kind} from={item.from} amount={item.monthlyAmount} hidden={hidden} onEdit={onEdit} />
        <button type="button" className="money-history-remove" aria-label={`Remove ${label} period effective ${formatDateLabel(item.from)}`} onClick={() => onDelete(kind, item.from)}>×</button>
      </div>)}</div> : <p className="money-history-empty">No history yet. Add a dated amount below.</p>}
    </div>

    <form className="money-change-block" onSubmit={(event) => { event.preventDefault(); if (canAdd) onAdd(); }}>
      <h3>Add a change</h3>
      <label className="money-entry-row" htmlFor={`${kind}-date`}><span>From</span><span className="money-date-input"><span>{date ? formatDateLabel(date) : "Choose date"}</span><span aria-hidden="true">⌄</span><input id={`${kind}-date`} aria-label={`${title} start date`} type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></span></label>
      <label className="money-entry-row" htmlFor={`${kind}-amount`}><span>Monthly amount</span><span className="money-amount-input"><b>₹</b><input className="modal-value-input" id={`${kind}-amount`} type="number" inputMode="decimal" min="0" step="1" value={amount} onChange={(event) => onAmountChange(event.target.value)} placeholder="Enter amount" /></span></label>
      <button className="money-add-button" type="submit" disabled={!canAdd}>Add</button>
      <p>New entries apply from their start date, so earlier months keep their old value.</p>
    </form>
  </section>;
}

function SettingsDialogShell({ dialogRef, closeButtonRef, id, title, onClose, children }: { dialogRef: RefObject<HTMLElement>; closeButtonRef: RefObject<HTMLButtonElement>; id: string; title: string; onClose: () => void; children: ReactNode }) {
  return <section ref={dialogRef} className="money-history-dialog money-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} tabIndex={-1}>
    <header className="money-history-card-header"><button ref={closeButtonRef} className="money-history-close" type="button" onClick={onClose}>Close</button><h2 id={`${id}-heading`}>{title}</h2></header>
    {children}
  </section>;
}

function HistoryAmount({ kind, from, amount, hidden, onEdit }: { kind: HistoryKind; from: string; amount: number; hidden: boolean; onEdit: (kind: HistoryKind, from: string, amount: number) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(amount));
  const label = kind === "incomeHistory" ? "salary" : "expense";
  return <label className="money-history-amount"><span>₹</span><input className="modal-value-input" aria-label={`${label} amount from ${from}`} type="text" inputMode="decimal" readOnly={hidden} value={hidden ? "••••" : isEditing ? draft : formatCurrency(amount, false).replace(/[₹\s]/g, "")} onFocus={() => { if (!hidden) { setDraft(String(amount)); setIsEditing(true); } }} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} onBlur={() => {
    if (!isEditing || hidden) return;
    const value = Number(draft.replace(/[₹,\s]/g, ""));
    if (Number.isFinite(value) && value >= 0) onEdit(kind, from, value);
    else setDraft(String(amount));
    setIsEditing(false);
  }} /></label>;
}
