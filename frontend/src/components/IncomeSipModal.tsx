import { useEffect, useRef, useState } from "react";
import type { Entry } from "../lib/types";
import { ASSET_KEYS, ASSET_LABELS } from "../utils/config";
import { formatMonthLabel } from "../utils/format";

interface Props {
  open: boolean;
  entry: Entry | null;
  onClose: () => void;
  onSave: (entry: Entry) => void;
}

export function IncomeSipModal({ open, entry, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Entry | null>(entry);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setDraft(entry ? JSON.parse(JSON.stringify(entry)) as Entry : null);
  }, [entry, open]);

  useEffect(() => {
    if (!open) return;
    const dialog = contentRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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
  }, [open, onClose]);

  if (!open || !draft) return null;

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
      onClose();
    }
  };

  const updateNumber = (path: string, value: string) => {
    const numberValue = value === "" ? null : Number(value);
    setDraft((current) => {
      if (!current) return current;
      const next = JSON.parse(JSON.stringify(current)) as Entry;
      const chunks = path.split(".");
      let target = next as unknown as Record<string, unknown>;
      while (chunks.length > 1) {
        target = target[chunks.shift()!] as Record<string, unknown>;
      }
      target[chunks[0]] = numberValue;
      return next;
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <section ref={contentRef} className="snapshot-dialog income-dialog" role="dialog" aria-modal="true" aria-labelledby="income-dialog-title" aria-describedby="income-dialog-description" tabIndex={-1}>
        <header className="snapshot-dialog-header">
          <div>
            <p className="dialog-kicker">Income &amp; strategy</p>
            <h2 id="income-dialog-title">{formatMonthLabel(draft.id)}</h2>
            <p id="income-dialog-description">Keep take-home income and monthly contributions with this snapshot.</p>
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close income and strategy editor">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="snapshot-dialog-body income-dialog-body">
          <section className="income-summary-panel" aria-labelledby="income-heading">
            <div>
              <p className="income-summary-label">Monthly take-home</p>
              <h3 id="income-heading">In-hand income</h3>
              <p>Use the amount received after deductions.</p>
            </div>
            <div className="field entry-field income-amount-field">
              <label htmlFor="income-in-hand">Amount <span>INR</span></label>
              <input
                id="income-in-hand"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={draft.income.in_hand ?? ""}
                onChange={(event) => updateNumber("income.in_hand", event.target.value)}
                placeholder="0"
              />
            </div>
          </section>

          <section className="form-section sip-section" aria-labelledby="sip-heading">
            <div className="form-section-heading">
              <h3 id="sip-heading">Monthly SIP contributions</h3>
              <p>Regular investments associated with this month.</p>
            </div>
            <div className="investment-grid sip-grid">
              {ASSET_KEYS.map((asset) => (
                <article key={asset} className="investment-card sip-card">
                  <div>
                    <h4>{ASSET_LABELS[asset]}</h4>
                    <p>Monthly contribution</p>
                  </div>
                  <div className="field entry-field">
                    <label htmlFor={`sip-${asset}`}>Amount <span>INR</span></label>
                    <input
                      id={`sip-${asset}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={draft.sip?.[asset] ?? ""}
                      onChange={(event) => updateNumber(`sip.${asset}`, event.target.value)}
                      placeholder="0"
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <footer className="snapshot-dialog-footer">
          <button type="button" className="dialog-secondary-action" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="dialog-primary-action"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Save changes
          </button>
        </footer>
      </section>
    </div>
  );
}
