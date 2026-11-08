import { useEffect, useRef, useState } from "react";
import type { Entry } from "../lib/types";
import { ASSET_KEYS, ASSET_LABELS } from "../utils/config";
import { formatCurrency } from "../utils/format";

interface Props {
  open: boolean;
  entry: Entry | null;
  entries: Entry[];
  onClose: () => void;
  onSave: (entry: Entry) => void;
}

function localToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const emptyEntry = (): Entry => ({
  id: "",
  date: localToday(),
  income: { in_hand: null },
  liquid: { bank: 0, sodexo: 0 },
  hard_assets: { stocks_wallet: 0, fd: 0 },
  market_assets: {
    mutual_funds: { invested: 0, current: 0 },
    nps: { invested: 0, current: 0 },
    stock_market: { invested: 0, current: 0 },
    crypto: { invested: 0, current: 0 }
  },
  sip: {
    mutual_funds: null,
    nps: null,
    stock_market: null,
    crypto: null
  },
  expenses_note: ""
});

function draftFromLatest(entries: Entry[]) {
  const today = localToday();
  const latest = entries.filter((item) => item.date <= today).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!latest) return emptyEntry();
  return {
    ...(JSON.parse(JSON.stringify(latest)) as Entry),
    id: "",
    date: localToday(),
    expenses_note: ""
  };
}

function netWorthFor(entry: Entry) {
  const balances = entry.liquid.bank + entry.liquid.sodexo + entry.hard_assets.stocks_wallet + entry.hard_assets.fd;
  return balances + ASSET_KEYS.reduce((sum, asset) => sum + entry.market_assets[asset].current, 0);
}

export function DataEntryModal({ open, entry, entries, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Entry>(emptyEntry());
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingAmounts, setEditingAmounts] = useState<Record<string, string>>({});
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setDraft(entry ?? draftFromLatest(entries));
    setNoteOpen(Boolean(entry?.expenses_note));
    setEditingAmounts({});
  }, [entry, open, entries]);

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

  if (!open) return null;

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
      onClose();
    }
  };

  const update = (path: string, value: string) => {
    const parsedValue = value === "" || value === "." || value === "-" ? null : Number(value.replace(/,/g, ""));
    const numberValue = parsedValue !== null && !Number.isFinite(parsedValue) ? null : parsedValue;
    setDraft((current) => {
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

  const handleBase = (field: "date" | "expenses_note", value: string) => {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "date" && value) next.id = value;
      return next;
    });
  };

  const amountInput = (label: string, id: string, value: number | null, path: string, className = "") => (
      <input
        id={id}
        className={className}
        type="text"
        aria-label={label}
        inputMode="decimal"
        value={editingAmounts[id] ?? (value === null ? "" : formatCurrency(value, false))}
        onFocus={() => setEditingAmounts((current) => ({ ...current, [id]: value === null ? "" : String(value) }))}
        onChange={(event) => {
          setEditingAmounts((current) => ({ ...current, [id]: event.target.value.replace(/[^\d.,-]/g, "") }));
          update(path, event.target.value.replace(/[^\d.,-]/g, "").replace(/,/g, ""));
        }}
        onBlur={() => setEditingAmounts((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        })}
      />
  );

  const balanceFields = [
    { label: "Bank balance", id: "snapshot-bank", value: draft.liquid.bank, path: "liquid.bank" },
    { label: "Sodexo / Other Cash", id: "snapshot-sodexo", value: draft.liquid.sodexo, path: "liquid.sodexo" },
    { label: "Stocks wallet", id: "snapshot-wallet", value: draft.hard_assets.stocks_wallet, path: "hard_assets.stocks_wallet" },
    { label: "Fixed deposit", id: "snapshot-fd", value: draft.hard_assets.fd, path: "hard_assets.fd" }
  ];

  const netWorth = netWorthFor(draft);
  const previousEntry = entries
    .filter((candidate) => candidate.id !== entry?.id && candidate.date < draft.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const snapshotChange = previousEntry ? netWorth - netWorthFor(previousEntry) : null;
  const formattedDate = draft.date
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${draft.date}T00:00:00`))
    : "Select date";
  const isToday = draft.date === localToday();
  const hasCarryForward = entries.some((item) => item.date <= localToday());
  const saveDraft = () => {
    onSave({ ...draft, id: draft.date });
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <section ref={contentRef} className="snapshot-dialog snapshot-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="snapshot-dialog-title" tabIndex={-1}>
        <header className="snapshot-sheet-header">
          <button type="button" className="snapshot-sheet-action" onClick={onClose}>Cancel</button>
          <h2 id="snapshot-dialog-title">{entry ? "Edit snapshot" : "New snapshot"}</h2>
          <button type="button" className="snapshot-sheet-action snapshot-sheet-save" onClick={saveDraft}>Save</button>
        </header>

        <div className="snapshot-dialog-body snapshot-editor-body">
          <section className="snapshot-net-worth" aria-label="Live snapshot summary">
            <span className="snapshot-net-worth-label">Net worth</span>
            <strong>{formatCurrency(netWorth, false)}</strong>
            {snapshotChange === null ? (
              <span className="snapshot-period-change snapshot-period-change--neutral">No earlier snapshot</span>
            ) : (
              <span className={`snapshot-period-change${snapshotChange < 0 ? " is-negative" : ""}`}>
                {snapshotChange > 0 ? "+" : snapshotChange < 0 ? "−" : ""}{formatCurrency(Math.abs(snapshotChange), false)} since previous snapshot
              </span>
            )}
          </section>

          <div className="snapshot-date-panel">
            <label className="snapshot-date-control" htmlFor="snapshot-date">
              <span>{isToday ? `Today, ${formattedDate}` : formattedDate}</span>
              <input id="snapshot-date" type="date" value={draft.date} aria-label="Snapshot date" onChange={(event) => handleBase("date", event.target.value)} />
            </label>
          </div>

          <section className="snapshot-editor-section" aria-labelledby="snapshot-balances-heading">
            <div className="snapshot-editor-section-heading">
              <h3 id="snapshot-balances-heading">Cash and deposits</h3>
            </div>
            <div className="snapshot-balance-list snapshot-form-surface">
              {balanceFields.map((field) => (
                <label className="snapshot-balance-row" htmlFor={field.id} key={field.id}>
                  <span>{field.label}</span>
                  {amountInput(field.label, field.id, field.value, field.path)}
                </label>
              ))}
            </div>
          </section>

          <section className="snapshot-editor-section snapshot-investments-section" aria-labelledby="market-assets-heading">
            <div className="snapshot-editor-section-heading">
              <h3 id="market-assets-heading">Market investments</h3>
            </div>
            <div className="snapshot-investment-list snapshot-form-surface">
              {ASSET_KEYS.map((asset) => {
                const invested = draft.market_assets[asset].invested ?? 0;
                const current = draft.market_assets[asset].current ?? 0;
                const gain = current - invested;
                const hasValues = invested !== 0 || current !== 0;
                const percent = invested > 0 ? ` (${((gain / invested) * 100).toFixed(1)}%)` : "";
                return (
                  <article className="snapshot-investment-row" key={asset}>
                    <div className="snapshot-investment-main">
                      <h4>{ASSET_LABELS[asset]}</h4>
                      {amountInput(`${ASSET_LABELS[asset]} current value`, `snapshot-${asset}-current`, draft.market_assets[asset].current, `market_assets.${asset}.current`, "snapshot-current-value")}
                    </div>
                    <div className="snapshot-investment-meta">
                      <label className="snapshot-invested-editable" htmlFor={`snapshot-${asset}-invested`}>
                        <span>Invested</span>
                        {amountInput(`${ASSET_LABELS[asset]} invested`, `snapshot-${asset}-invested`, draft.market_assets[asset].invested, `market_assets.${asset}.invested`)}
                      </label>
                      <p className={`snapshot-investment-performance${gain < 0 ? " is-negative" : ""}${hasValues ? "" : " is-neutral"}`}>
                        {hasValues ? <>{gain > 0 ? "+" : gain < 0 ? "−" : ""}{formatCurrency(Math.abs(gain), false)}{percent}</> : "—"}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="snapshot-note-section" aria-labelledby="snapshot-notes-heading">
            <button
              type="button"
              className="snapshot-note-toggle"
              aria-expanded={noteOpen}
              aria-controls="snapshot-note-content"
              onClick={() => setNoteOpen((value) => !value)}
            >
              <span aria-hidden="true">{noteOpen ? "−" : "+"}</span>
              <span id="snapshot-notes-heading">{draft.expenses_note ? "Edit note" : "Add a note"}</span>
            </button>
            {noteOpen && (
              <div id="snapshot-note-content" className="snapshot-note-content field entry-field">
                <label htmlFor="snapshot-note" className="sr-only">Snapshot note</label>
                <textarea id="snapshot-note" value={draft.expenses_note} onChange={(event) => handleBase("expenses_note", event.target.value)} rows={2} placeholder="Add context for a major expense or portfolio change" />
              </div>
            )}
          </section>
          <p className="snapshot-carry-forward">
            {entry ? "Update the values recorded for this date." : hasCarryForward ? "Values are carried over from your last snapshot. Change only what moved." : "Enter your balances and investment values for this date."}
          </p>
        </div>
      </section>
    </div>
  );
}
