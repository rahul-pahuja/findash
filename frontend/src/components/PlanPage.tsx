import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Dataset, EffectiveDatedAmount, Goal } from "../lib/types";
import { formatCompactCurrency, formatCurrency, formatDateLabel, formatLakhsPerMonth, formatSigned, formatSignedPercent } from "../utils/format";
import { getRegularCapitalPace, getSnapshotTotals } from "../utils/insights";
import { estimateMonthYear, goalStatus, projectedMonths, requiredMonthlyAmount, type GoalStatus } from "../utils/goalProjection";
import { CompactCurrency } from "./CompactCurrency";
import { SwitchControl } from "./FormControls";
import { GoalTimeline, type GoalProjectionView } from "./GoalTimeline";
import { DatePickerModal } from "./DatePickerModal";
import { AlertModal } from "./AlertModal";

interface Props {
  dataset: Dataset;
  masked: boolean;
  overallReturn: number | null;
  overallReturnLoading: boolean;
  onChange: (dataset: Dataset) => void;
  onOpenSnapshots: () => void;
}

type PlanModal = "incomeHistory" | "expenseHistory" | "marketReturn" | "emergencyFund";
type GoalSheet = { mode: "add" } | { mode: "edit"; id: string } | null;

export function PlanPage({ dataset, masked, overallReturn, overallReturnLoading, onChange, onOpenSnapshots }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [goalType, setGoalType] = useState<Goal["type"]>("milestone");
  const [goalSheet, setGoalSheet] = useState<GoalSheet>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removedGoal, setRemovedGoal] = useState<{ goal: Goal; index: number } | null>(null);
  const [hoveredGoalId, setHoveredGoalId] = useState<string | null>(null);
  const [incomeDate, setIncomeDate] = useState(() => monthStart());
  const [incomeAmount, setIncomeAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => monthStart());
  const [expenseAmount, setExpenseAmount] = useState("");
  const [marketReturnDraft, setMarketReturnDraft] = useState("");
  const [returnMode, setReturnMode] = useState<"observed" | "custom">("observed");
  const [showZeroReturnScenarioDraft, setShowZeroReturnScenarioDraft] = useState(true);
  const [emergencyFundTargetDraft, setEmergencyFundTargetDraft] = useState("");
  const [activeModal, setActiveModal] = useState<PlanModal | null>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<"goal" | "income" | "expense" | null>(null);
  const [datePickerAnchor, setDatePickerAnchor] = useState<HTMLElement | null>(null);

  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetDialogRef = useRef<HTMLElement>(null);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);

  const hideSavedAmounts = masked;
  const entries = [...dataset.entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries.at(-1);
  const totals = latest ? getSnapshotTotals(latest) : null;
  const pace6 = getRegularCapitalPace(entries, 6);
  const asOfDate = latest?.date ?? todayDate();
  const currentIncome = [...dataset.incomeHistory].sort((a, b) => a.from.localeCompare(b.from)).filter((item) => item.from <= asOfDate).at(-1);
  const currentExpense = [...dataset.expenseHistory].sort((a, b) => a.from.localeCompare(b.from)).filter((item) => item.from <= asOfDate).at(-1);
  const monthlyIncome = currentIncome?.monthlyAmount ?? null;
  const monthlyExpenses = currentExpense?.monthlyAmount ?? null;
  const savingsRate = monthlyIncome && pace6 ? pace6.amountPerMonth / monthlyIncome : null;
  const runway = monthlyExpenses && totals ? totals.liquidBuffer / monthlyExpenses : null;

  const expectedReturn = dataset.settings.expectedMarketReturn ?? overallReturn;
  const showZeroScenario = dataset.settings.showZeroReturnScenario && (expectedReturn === null || expectedReturn !== 0);
  const projectionPace = pace6 && pace6.amountPerMonth > 0 ? pace6.amountPerMonth : null;
  const hasPace = projectionPace !== null && entries.length >= 2;
  const goals = useMemo(() => dataset.goals ?? [], [dataset.goals]);

  const goalViews = useMemo<Array<GoalProjectionView & { status: GoalStatus | null; required: number | null }>>(() => {
    if (!latest || !totals) return [];
    const crossing = (goal: Goal, annualRate: number) => {
      if (projectionPace === null) return null;
      const months = projectedMonths(totals.netWorth, goal.targetAmount, projectionPace, annualRate);
      if (months === null) return null;
      return { months, label: estimateMonthYear(latest.date, months) ?? "" };
    };
    return goals.map((goal) => {
      const expected = expectedReturn !== null ? crossing(goal, expectedReturn) : null;
      const zero = showZeroScenario ? crossing(goal, 0) : null;
      const status = !hasPace || !(expected ?? zero) || !goal.targetDate ? null : goalStatus((expected ?? zero)!.months, goal.targetDate, latest.date);
      const required = goal.targetDate && expectedReturn !== null ? requiredMonthlyAmount(totals.netWorth, goal.targetAmount, expectedReturn, latest.date, goal.targetDate) : null;
      return { goal, expected, zero, status, required };
    });
  }, [goals, latest, totals, projectionPace, expectedReturn, showZeroScenario, hasPace]);

  const drawnIds = useMemo(() => {
    const currentNetWorth = totals?.netWorth ?? 0;
    const pending = goalViews.filter((v) => v.goal.targetAmount > currentNetWorth);

    const sortFn = (a: typeof goalViews[0], b: typeof goalViews[0]) => {
      if (a.goal.targetDate && b.goal.targetDate) return a.goal.targetDate.localeCompare(b.goal.targetDate);
      if (a.goal.targetDate) return -1;
      if (b.goal.targetDate) return 1;
      return a.goal.targetAmount - b.goal.targetAmount;
    };

    if (pending.length > 0) {
      pending.sort(sortFn);
      return pending.slice(0, 4).map((view) => view.goal.id);
    }

    const achieved = [...goalViews].sort(sortFn);
    return achieved.slice(0, 4).map((view) => view.goal.id);
  }, [goalViews, totals?.netWorth]);

  useEffect(() => {
    if (!goalSheet) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetCloseRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { closeSheet(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(sheetDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
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
  }, [goalSheet]);

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

  function openAddSheet() {
    setName(""); setAmount(""); setTargetDate(""); setGoalType("milestone");
    setRemoveConfirmOpen(false);
    setGoalSheet({ mode: "add" });
  }

  function openEditSheet(goal: Goal) {
    setName(goal.name); setAmount(String(goal.targetAmount)); setTargetDate(goal.targetDate ?? ""); setGoalType(goal.type);
    setRemoveConfirmOpen(false);
    setGoalSheet({ mode: "edit", id: goal.id });
  }

  function closeSheet() { setGoalSheet(null); setRemoveConfirmOpen(false); setName(""); setAmount(""); setTargetDate(""); setGoalType("milestone"); }

  function submitSheet(event?: FormEvent) {
    if (event) event.preventDefault();
    const targetAmount = Number(amount.replace(/,/g, ""));
    if (!name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) return;
    const now = new Date().toISOString();
    if (goalSheet?.mode === "edit") {
      const current = goals.find((goal) => goal.id === goalSheet.id);
      if (!current) return;
      const updated: Goal = { ...current, name: name.trim(), type: goalType, targetAmount, ...(targetDate ? { targetDate } : { targetDate: undefined }), updatedAt: now };
      onChange({ ...dataset, goals: goals.map((goal) => goal.id === current.id ? updated : goal) });
    } else {
      const goal: Goal = { id: crypto.randomUUID(), name: name.trim(), type: goalType, targetAmount, ...(targetDate ? { targetDate } : {}), createdAt: now, updatedAt: now };
      onChange({ ...dataset, goals: [...goals, goal] });
    }
    closeSheet();
  }

  function removeGoal() {
    if (goalSheet?.mode !== "edit") return;
    const index = goals.findIndex((goal) => goal.id === goalSheet.id);
    if (index < 0) return;
    setRemovedGoal({ goal: goals[index], index });
    onChange({ ...dataset, goals: goals.filter((goal) => goal.id !== goalSheet.id) });
    setRemoveConfirmOpen(false);
    closeSheet();
  }

  function undoRemove() {
    if (!removedGoal) return;
    const next = [...goals];
    next.splice(Math.min(removedGoal.index, next.length), 0, removedGoal.goal);
    onChange({ ...dataset, goals: next });
    setRemovedGoal(null);
  }

  useEffect(() => {
    if (!removedGoal) return;
    const timer = setTimeout(() => setRemovedGoal(null), 8000);
    return () => clearTimeout(timer);
  }, [removedGoal]);

  function addHistory(kind: "incomeHistory" | "expenseHistory") {
    const date = kind === "incomeHistory" ? incomeDate : expenseDate;
    const parsedAmt = Number((kind === "incomeHistory" ? incomeAmount : expenseAmount).replace(/,/g, ""));
    if (!date || !Number.isFinite(parsedAmt) || parsedAmt < 0) return;
    const next: EffectiveDatedAmount[] = [...dataset[kind].filter((item) => item.from !== date), { from: date, monthlyAmount: parsedAmt }].sort((a, b) => a.from.localeCompare(b.from));
    onChange({ ...dataset, [kind]: next });
    if (kind === "incomeHistory") setIncomeAmount(""); else setExpenseAmount("");
  }

  function editHistory(kind: "incomeHistory" | "expenseHistory", from: string, editAmt: number) {
    onChange({ ...dataset, [kind]: dataset[kind].map((item) => item.from === from ? { ...item, monthlyAmount: editAmt } : item) });
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

  const parsedGoalAmount = Number(amount.replace(/,/g, ""));
  const canSaveGoal = Boolean(name.trim() && Number.isFinite(parsedGoalAmount) && parsedGoalAmount > 0);

  return <div className="page-content plan-page page-enter">
    {!latest ? <div className="empty-panel"><h3>Add a snapshot to start planning</h3><p>Your current wealth and progress will appear here.</p></div> : null}
    <section className="plan-goals-section ruled-panel" aria-labelledby="goals-heading">
      <div className="section-heading">
        <div>
          <h2 id="goals-heading">Goals</h2>
          <p>Where your current pace takes you, goal by goal.</p>
        </div>
      </div>

      {!latest || !totals ? null : <>
        {!hasPace ? <div className="goal-projection-notice" role="status">
          <strong>No projection yet.</strong> Projections need at least two snapshots and a positive capital pace.{pace6 ? <> Yours is <strong className="nowrap-amount">{formatSigned(pace6.amountPerMonth, masked)}</strong> a month.</> : null}{" "}
          <button className="goal-notice-link" type="button" onClick={() => document.getElementById("your-pace-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}>See your pace ↓</button>
        </div> : null}

        {hasPace ? <div className="goal-legend">
          {expectedReturn !== null ? <span className="goal-legend-item"><i className="goal-legend-line is-accent" aria-hidden="true" />At {(expectedReturn * 100).toFixed(1)}% a year</span> : null}
          {showZeroScenario ? <span className="goal-legend-item"><i className="goal-legend-line is-zero" aria-hidden="true" />No market growth</span> : null}
          <span className="goal-legend-item"><i className="goal-legend-diamond" aria-hidden="true" />Your target date</span>
          <span className="goal-legend-item"><i className="goal-legend-dot" aria-hidden="true" />Projected</span>
        </div> : null}

        {goals.length ? <GoalTimeline projections={goalViews} drawnIds={drawnIds} current={totals.netWorth} latestDate={latest.date} pace={hasPace ? projectionPace : null} expectedReturn={expectedReturn} showZeroScenario={showZeroScenario} masked={masked} canProject={hasPace} hoveredId={hoveredGoalId} onHoverGoal={setHoveredGoalId} /> : null}

        {goals.length ? <div className="goal-table-wrap"><table className="goal-table">
          <thead><tr><th scope="col">GOAL</th><th scope="col" className="is-num">TARGET</th><th scope="col">PROGRESS</th><th scope="col">PROJECTED</th><th scope="col">STATUS</th><th scope="col"><span className="visually-hidden">Open goal</span></th></tr></thead>
          <tbody>{goalViews.map((view) => {
            const { goal } = view;
            const progress = Math.min(100, Math.max(0, totals.netWorth / goal.targetAmount * 100));
            const remaining = Math.max(0, goal.targetAmount - totals.netWorth);
            const isAchieved = totals.netWorth >= goal.targetAmount;
            const projectedCrossing = view.expected ?? view.zero;
            const chip = isAchieved
              ? { kind: "ahead", label: "Achieved" }
              : !goal.targetDate
              ? { kind: "muted", label: "No date set" }
              : !hasPace || !projectedCrossing || !view.status
              ? { kind: "muted", label: "Can't project yet" }
              : { kind: view.status.kind, label: view.status.label };
            return <tr key={goal.id} className={hoveredGoalId === goal.id ? "is-hovered" : ""} onClick={() => openEditSheet(goal)} onMouseEnter={() => setHoveredGoalId(goal.id)} onMouseLeave={() => setHoveredGoalId(null)} onFocus={() => setHoveredGoalId(goal.id)} onBlur={() => setHoveredGoalId(null)}>
              <td>
                <button type="button" className="goal-row-open" onClick={() => openEditSheet(goal)} aria-haspopup="dialog">
                  <strong>{goal.name}</strong>
                  <small>{goal.type === "long-term" ? "Long-term" : "Short-term"}{goal.targetDate ? ` · target ${formatDateLabel(goal.targetDate)}` : " · no date set"}</small>
                </button>
              </td>
              <td className="is-num"><CompactCurrency value={goal.targetAmount} masked={masked} /></td>
              <td>
                <div className="goal-progress-track is-table" role="progressbar" aria-label={`${goal.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={masked ? undefined : Math.round(progress)}><span style={{ width: `${masked ? 0 : progress}%` }} /></div>
                <small>{masked ? "••" : `${progress.toFixed(1)}%`} · {formatCompactCurrency(remaining, masked)} to go</small>
              </td>
              <td>
                {isAchieved ? (
                  <><strong>Achieved</strong><small>already reached</small></>
                ) : hasPace && projectedCrossing ? (
                  <><strong>{projectedCrossing.label}</strong><small>at {view.expected && expectedReturn !== null ? `${(expectedReturn * 100).toFixed(1)}%` : "0%"} a year</small></>
                ) : (
                  <><strong>—</strong><small>needs a positive pace</small></>
                )}
              </td>
              <td>
                <span className={`goal-status-chip is-${chip.kind}`}>{chip.label}</span>
                {!isAchieved && goal.targetDate && view.required !== null ? <small>{view.required > 0 ? <>needs ≈ <span className="nowrap-amount">{formatLakhsPerMonth(view.required, masked)}</span> a month</> : "on pace already"}</small> : null}
              </td>
              <td className="is-chevron" aria-hidden="true">›</td>
            </tr>;
          })}</tbody>
        </table></div> : null}

        {goals.length ? <button className="goal-add-own-row" type="button" onClick={openAddSheet}>+ Add your own goal <span aria-hidden="true">›</span></button> : null}
        {hasPace ? <p className="goal-projection-footnote">Projections use your trailing 6 and 12-month capital pace ({formatCompactCurrency(pace6!.amountPerMonth, masked)} a month){expectedReturn !== null ? " plus your expected return" : ""}.{showZeroScenario ? " Open a goal for the 0% scenario and edit it." : ""}</p> : null}
      </>}
      {!goals.length ? <article className="goal-empty-feature"><div><p className="goal-feature-eyebrow">Start planning</p><h3>Choose a goal to track</h3></div><div><p>Add a target to see your progress and a projected date based on your saved snapshots.</p><button className="goal-feature-primary" type="button" onClick={openAddSheet}>Set a target</button></div></article> : null}
    </section>

    <section className="ruled-panel plan-metrics" id="your-pace-section" aria-labelledby="plan-metrics-title"><div className="section-heading"><div><h2 id="plan-metrics-title">Your pace</h2><p>Unlock as your income and expenses cover enough history.</p></div></div>
      <div className="plan-metric-grid">
        <article><span>Savings rate</span><strong className={savingsRate !== null && savingsRate < 0 ? "is-negative" : ""}>{savingsRate === null ? "—" : formatSignedPercent(savingsRate, masked)}</strong><p>{savingsRate === null ? "Add monthly salary above and at least two snapshots." : savingsRate < 0 ? "You drew down more than you added." : `Based on recorded capital change and ${formatCompactCurrency(monthlyIncome, masked)} monthly income.`}</p></article>
        <article><span>Emergency runway</span><strong>{runway === null ? "—" : masked ? "•• months" : `${runway.toFixed(1)} months`}</strong><p>{runway === null ? "Add monthly expenses above to calculate runway." : `Cash buffer divided by ${formatCompactCurrency(monthlyExpenses, masked)} monthly expenses.`}</p></article>
        <article><span>Capital pace · 6 months</span><strong className={pace6 && pace6.amountPerMonth < 0 ? "is-negative" : ""}>{pace6 ? <CompactCurrency value={pace6.amountPerMonth} masked={masked} /> : "—"}</strong><p>{pace6 ? `Recorded change, adjusted for ${formatCompactCurrency(pace6.oneOffAdjustment, masked)} in one-off events.` : "Add more snapshot history to establish a pace."}</p></article>
      </div>
      {pace6 && monthlyIncome !== null && pace6.amountPerMonth > monthlyIncome ? <aside className="pace-callout" role="status"><strong>Capital pace is above your income.</strong> {formatCompactCurrency(pace6.amountPerMonth, masked)} a month vs {formatCompactCurrency(monthlyIncome, masked)} take-home. Untagged one-offs or other income may be inflating it. <button className="goal-notice-link" type="button" onClick={onOpenSnapshots}>Review one-offs →</button></aside> : null}
    </section>

    <section className="ruled-panel settings-section plan-assumptions-section" aria-labelledby="assumptions-heading">
      <div className="section-heading"><div><h2 id="assumptions-heading">Assumptions</h2><p>Salary, expenses, and planning settings. Recorded snapshots never change.</p></div></div>

      <div className="assumption-disclosure money-assumption-row">
        <button className="money-assumption-trigger" type="button" aria-haspopup="dialog" onClick={() => setActiveModal("incomeHistory")}>
          <span><strong>Monthly income</strong><small>Take-home pay and other regular income, starting on the date shown.</small></span>
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

    {/* Apple-style Goal Sheet (Add & Edit Goal, Page 11) */}
    {goalSheet ? createPortal(<div className="modal-backdrop apple-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSheet(); }}>
      <section ref={sheetDialogRef} className="apple-card-dialog" role="dialog" aria-modal="true" aria-labelledby="goal-sheet-title" tabIndex={-1}>
        <header className="apple-sheet-header">
          <button ref={sheetCloseRef} className="apple-sheet-cancel" type="button" onClick={closeSheet}>Cancel</button>
          <h2 id="goal-sheet-title">{goalSheet.mode === "edit" ? (name || "Goal") : "Add a goal"}</h2>
          <button className="apple-sheet-submit" type="button" onClick={() => submitSheet()} disabled={!canSaveGoal}>
            {goalSheet.mode === "edit" ? "Save goal" : "Add goal"}
          </button>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); submitSheet(); }}>
          <div className="apple-list-group">
            <label className="apple-list-row">
              <span className="apple-list-label">Name</span>
              <input
                className="apple-list-input"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Home down payment"
              />
            </label>

            <label className="apple-list-row">
              <div className="apple-list-label">
                <span>Target amount</span>
                {parsedGoalAmount > 0 ? (
                  <small className="apple-list-label-sub">= {formatCompactCurrency(parsedGoalAmount, false)}</small>
                ) : null}
              </div>
              <input
                className="apple-list-input"
                required
                inputMode="decimal"
                type="number"
                min="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="₹0"
              />
            </label>

            <div className="apple-list-row">
              <span className="apple-list-label">Target date</span>
              <button
                type="button"
                className={`apple-list-date-trigger ${!targetDate ? "is-empty" : ""}`}
                onClick={(e) => {
                  setDatePickerAnchor(e.currentTarget);
                  setDatePickerTarget("goal");
                }}
              >
                {targetDate ? formatDateLabel(targetDate) : "No date"} <span className="chevron">›</span>
              </button>
            </div>

            <div className="apple-list-row">
              <span className="apple-list-label">Type</span>
              <div className="apple-segmented-control" role="group" aria-label="Goal type">
                <button
                  type="button"
                  className={`apple-segmented-btn ${goalType === "milestone" ? "is-active" : ""}`}
                  onClick={() => setGoalType("milestone")}
                >
                  Short-term
                </button>
                <button
                  type="button"
                  className={`apple-segmented-btn ${goalType === "long-term" ? "is-active" : ""}`}
                  onClick={() => setGoalType("long-term")}
                >
                  Long-term
                </button>
              </div>
            </div>
          </div>

          {goalSheet.mode === "add" && (
            <div>
              <p className="goal-suggestions-header">SUGGESTIONS</p>
              <div className="goal-suggestions-pills">
                <button type="button" className="goal-suggestion-pill" onClick={() => setAmount("12500000")}>
                  ₹1.25 Cr · next milestone
                </button>
                <button type="button" className="goal-suggestion-pill" onClick={() => setAmount("50000000")}>
                  ₹5 Cr
                </button>
                <button type="button" className="goal-suggestion-pill" onClick={() => setAmount("100000000")}>
                  ₹10 Cr
                </button>
              </div>
              <p className="goal-suggestion-hint">Add a name and amount to see your projection.</p>
            </div>
          )}

          {goalSheet.mode === "edit" && (() => {
            const view = goalViews.find((item) => item.goal.id === goalSheet.id);
            return (
              <div>
                <div className="goal-projection-card">
                  <div className="goal-projection-row">
                    <dt>At {expectedReturn !== null ? `${(expectedReturn * 100).toFixed(1)}%` : "0%"} a year</dt>
                    <dd>{view?.expected ? `${view.expected.label}${view.status ? ` · ${view.status.label}` : ""}` : hasPace ? "—" : "needs a positive pace"}</dd>
                  </div>
                  {showZeroScenario && (
                    <div className="goal-projection-row">
                      <dt>No market growth</dt>
                      <dd>{view?.zero ? view.zero.label : hasPace ? "—" : "needs a positive pace"}</dd>
                    </div>
                  )}
                  {view?.required !== null && view?.required !== undefined && (
                    <div className="goal-projection-row">
                      <dt>To hit your date</dt>
                      <dd>{view.required > 0 ? `add ≈ ${formatLakhsPerMonth(view.required, masked)} a month` : "on pace already"}</dd>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="goal-remove-link-btn"
                  onClick={() => setRemoveConfirmOpen(true)}
                >
                  Remove goal
                </button>
              </div>
            );
          })()}
        </form>
      </section>
    </div>, document.body) : null}

    {/* Remove Goal Confirmation Alert (Page 15) */}
    <AlertModal
      open={removeConfirmOpen}
      title="Remove this goal?"
      description={`${name || "This goal"} (${parsedGoalAmount > 0 ? formatCompactCurrency(parsedGoalAmount, masked) : "₹0"}) will be removed. You can undo for 8 seconds.`}
      actionLabel="Remove goal"
      cancelLabel="Cancel"
      variant="danger"
      onCancel={() => setRemoveConfirmOpen(false)}
      onAction={removeGoal}
    />

    {removedGoal ? <div className="goal-toast" role="status"><span>Removed {removedGoal.goal.name}.</span><button type="button" onClick={undoRemove}>Undo</button></div> : null}

    {/* Assumptions & History Modals (Pages 8 & 12) */}
    {activeModal ? createPortal(<div className="modal-backdrop apple-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveModal(null); }}>
      {activeModal === "incomeHistory" ? (
        <MoneyHistoryDialog
          dialogRef={dialogRef}
          closeButtonRef={closeButtonRef}
          kind="incomeHistory"
          title="Monthly income"
          description="Take-home pay and other regular income."
          values={dataset.incomeHistory}
          asOfDate={asOfDate}
          currentAmount={monthlyIncome}
          date={incomeDate}
          amount={incomeAmount}
          hidden={hideSavedAmounts}
          onOpenDatePicker={(el) => {
            setDatePickerAnchor(el);
            setDatePickerTarget("income");
          }}
          onAmountChange={setIncomeAmount}
          onAdd={() => addHistory("incomeHistory")}
          onEdit={editHistory}
          onDelete={deleteHistory}
          onClose={() => setActiveModal(null)}
        />
      ) : activeModal === "expenseHistory" ? (
        <MoneyHistoryDialog
          dialogRef={dialogRef}
          closeButtonRef={closeButtonRef}
          kind="expenseHistory"
          title="Monthly expenses"
          description="Regular spending used to calculate your emergency runway."
          values={dataset.expenseHistory}
          asOfDate={asOfDate}
          currentAmount={monthlyExpenses}
          date={expenseDate}
          amount={expenseAmount}
          hidden={hideSavedAmounts}
          onOpenDatePicker={(el) => {
            setDatePickerAnchor(el);
            setDatePickerTarget("expense");
          }}
          onAmountChange={setExpenseAmount}
          onAdd={() => addHistory("expenseHistory")}
          onEdit={editHistory}
          onDelete={deleteHistory}
          onClose={() => setActiveModal(null)}
        />
      ) : activeModal === "marketReturn" ? (
        <SettingsDialogShell dialogRef={dialogRef} closeButtonRef={closeButtonRef} id="market-return-dialog" title="Expected market return" onClose={() => setActiveModal(null)}>
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
            <button className="apple-modal-footer-save" type="submit" disabled={returnMode === "observed" ? overallReturn === null : marketReturnDraft.trim() !== "" && !Number.isFinite(Number(marketReturnDraft))}>Save</button>
          </form>
        </SettingsDialogShell>
      ) : (
        <SettingsDialogShell dialogRef={dialogRef} closeButtonRef={closeButtonRef} id="emergency-fund-dialog" title="Emergency fund target" onClose={() => setActiveModal(null)}>
          <form onSubmit={saveEmergencyFundTarget}>
            <div className="reminder-stepper-box">
              <div className="reminder-day-display">
                <input
                  type="number"
                  min="1"
                  max="60"
                  className="reminder-big-num"
                  style={{
                    border: "none",
                    background: "transparent",
                    textAlign: "center",
                    width: "120px",
                    outline: "none",
                    fontVariantNumeric: "tabular-nums"
                  }}
                  value={emergencyFundTargetDraft}
                  onChange={(e) => setEmergencyFundTargetDraft(e.target.value)}
                  aria-label="Target months of expenses"
                />
                <span className="reminder-sublabel">
                  {Number(emergencyFundTargetDraft) === 1 ? "month of expenses" : "months of expenses"}
                </span>
              </div>

              <div className="apple-preset-pills" style={{ marginTop: "20px", marginBottom: "8px" }}>
                {[3, 6, 9, 12].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`apple-preset-pill ${Number(emergencyFundTargetDraft) === p ? "is-active" : ""}`}
                    onClick={() => setEmergencyFundTargetDraft(String(p))}
                  >
                    {p} months
                  </button>
                ))}
              </div>
            </div>

            <p className="money-modal-hint" style={{ textAlign: "center", marginBottom: "16px" }}>
              Your cash buffer is {totals ? formatCompactCurrency(totals.liquidBuffer, masked) : "₹0"}. Add monthly expenses to see how many months it covers.
            </p>

            <button
              className="apple-modal-footer-save"
              type="submit"
              disabled={!Number.isInteger(Number(emergencyFundTargetDraft)) || Number(emergencyFundTargetDraft) < 1 || Number(emergencyFundTargetDraft) > 60}
            >
              Save
            </button>
          </form>
        </SettingsDialogShell>
      )}
    </div>, document.body) : null}

    {/* Calendar Date Picker Modal (Page 14) */}
    <DatePickerModal
      open={datePickerTarget !== null}
      value={datePickerTarget === "goal" ? targetDate : datePickerTarget === "income" ? incomeDate : expenseDate}
      anchorEl={datePickerAnchor}
      onSelect={(selectedDate) => {
        if (datePickerTarget === "goal") setTargetDate(selectedDate);
        else if (datePickerTarget === "income") setIncomeDate(selectedDate);
        else if (datePickerTarget === "expense") setExpenseDate(selectedDate);
        setDatePickerTarget(null);
      }}
      onClose={() => setDatePickerTarget(null)}
    />
  </div>;
}

function monthStart() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`; }
function todayDate() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }

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
  onOpenDatePicker: (el: HTMLElement) => void;
  onAmountChange: (amount: string) => void;
  onAdd: () => void;
  onEdit: (kind: HistoryKind, from: string, amount: number) => void;
  onDelete: (kind: HistoryKind, from: string) => void;
  onClose: () => void;
};

function MoneyHistoryDialog({
  dialogRef,
  closeButtonRef,
  kind,
  title,
  description,
  values,
  asOfDate,
  currentAmount,
  date,
  amount,
  hidden,
  onOpenDatePicker,
  onAmountChange,
  onAdd,
  onEdit,
  onDelete,
  onClose
}: HistoryEditorProps) {
  const label = kind === "incomeHistory" ? "salary" : "expense";
  const current = [...values].sort((a, b) => a.from.localeCompare(b.from)).filter((item) => item.from <= asOfDate).at(-1);
  const parsedAmount = Number(amount.replace(/,/g, ""));
  const canAdd = Boolean(date && amount.trim() && Number.isFinite(parsedAmount) && parsedAmount >= 0);

  return <section ref={dialogRef} className="money-history-dialog" role="dialog" aria-modal="true" aria-labelledby={`${kind}-heading`} tabIndex={-1}>
    <header className="money-history-card-header"><button ref={closeButtonRef} className="money-history-close" type="button" onClick={onClose}>Close</button><h2 id={`${kind}-heading`}>{title}</h2></header>
    <div className="money-current-block">
      <p className="money-card-eyebrow">Current</p>
      <strong aria-live="polite">{currentAmount === null ? "—" : <CompactCurrency value={currentAmount} masked={hidden} />}</strong>
      <p>{current ? `a month · from ${formatDateLabel(current.from)}` : currentAmount === null ? (kind === "incomeHistory" ? "Not set." : "Not set. Add an amount to unlock Emergency runway.") : description}</p>
    </div>

    <div className="money-history-block">
      <h3>History</h3>
      {values.length ? <div className="money-history-list">{[...values].sort((a, b) => a.from.localeCompare(b.from)).map((item) => <div className="money-history-row" key={item.from}>
        <time dateTime={item.from}>{formatDateLabel(item.from)}</time>
        <HistoryAmount kind={kind} from={item.from} amount={item.monthlyAmount} hidden={hidden} onEdit={onEdit} />
        <button type="button" className="money-history-remove" aria-label={`Remove ${label} period effective ${formatDateLabel(item.from)}`} onClick={() => onDelete(kind, item.from)}>×</button>
      </div>)}</div> : <p className="money-history-empty">No entries yet.</p>}
    </div>

    <form className="money-change-block" onSubmit={(event) => { event.preventDefault(); if (canAdd) onAdd(); }}>
      <h3>Add a change</h3>
      <div className="money-entry-row">
        <span>From</span>
        <button type="button" className="apple-list-date-trigger" onClick={(e) => onOpenDatePicker(e.currentTarget)}>
          {date ? formatDateLabel(date) : "Choose date"} <span className="chevron">⌄</span>
        </button>
      </div>
      <label className="money-entry-row" htmlFor={`${kind}-amount`}><span>Monthly amount</span><span className="money-amount-input"><b>₹</b><input className="modal-value-input" id={`${kind}-amount`} type="number" inputMode="decimal" min="0" step="1" value={amount} onChange={(event) => onAmountChange(event.target.value)} placeholder="Enter amount" /></span></label>
      <button className="apple-modal-footer-save" type="submit" disabled={!canAdd}>Add</button>
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
