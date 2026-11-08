import { useEffect, useRef, useState } from "react";
import type { ShortTermGoal } from "../lib/types";
import { formatCurrency } from "../utils/format";

interface Props {
  open: boolean;
  goal: ShortTermGoal | null;
  masked: boolean;
  onClose: () => void;
  onSave: (targetAmount: number, targetDate: string) => void;
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function GoalModal({ open, goal, masked, onClose, onSave }: Props) {
  const [amount, setAmount] = useState("");
  const [amountFocused, setAmountFocused] = useState(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    setAmount(goal ? String(goal.targetAmount) : "");
    setAmountFocused(false);
    setDate(goal?.targetDate ?? "");
    setError("");
  }, [goal, open]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  const parsedAmount = Number(amount.replace(/,/g, ""));
  const save = () => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a target amount greater than zero.");
      return;
    }
    if (!date) {
      setError("Choose the date you want to reach this target.");
      return;
    }
    if (date < localToday()) {
      setError("Choose today or a future date.");
      return;
    }
    onSave(parsedAmount, date);
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="goal-dialog" role="dialog" aria-modal="true" aria-labelledby="goal-dialog-title" tabIndex={-1}>
        <header className="goal-dialog-header">
          <div><p className="micro-label">A near-term milestone</p><h2 id="goal-dialog-title">{goal ? "Update your target" : "Set a short-term target"}</h2></div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Close target setup">×</button>
        </header>
        <div className="goal-dialog-content">
          <p className="goal-dialog-intro">Choose an amount and a date. We’ll track your progress using your snapshots and show an estimate only when there’s enough history.</p>
          <label className="design-field" htmlFor="goal-amount"><span>Target amount</span><div className="currency-input-wrap"><b>₹</b><input id="goal-amount" type="text" inputMode="decimal" value={masked && !amountFocused && amount ? "••••" : amount} onFocus={() => setAmountFocused(true)} onBlur={() => setAmountFocused(false)} onChange={(event) => { setAmount(event.target.value.replace(/[^\d.,-]/g, "")); setError(""); }} placeholder="1,25,00,000" /></div></label>
          <label className="design-field" htmlFor="goal-date"><span>Target date</span><input id="goal-date" type="date" min={localToday()} value={date} onChange={(event) => { setDate(event.target.value); setError(""); }} /></label>
          <p className="goal-assumption">Any projected date is an estimate based on your recent hard-capital pace. It assumes no market movement.</p>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {parsedAmount > 0 ? <p className="goal-preview">Your target: <strong>{formatCurrency(parsedAmount, masked)}</strong></p> : null}
        </div>
        <footer className="goal-dialog-footer">
          <button className="quiet-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="button" onClick={save}>Save target</button>
        </footer>
      </section>
    </div>
  );
}
