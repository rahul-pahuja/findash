import { useEffect, useRef, useState } from "react";
import type { Entry } from "../lib/types";
import { ASSET_KEYS, ASSET_LABELS } from "../utils/config";
import { formatCurrency, formatDateLabel, formatSigned, formatSignedPercent } from "../utils/format";
import { FormInput, SegmentedControl } from "./FormControls";

interface Props {
  open: boolean;
  entry: Entry | null;
  initialDate?: string;
  masked: boolean;
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
  liquid: { bank: 0, sodexo: 0 },
  hard_assets: { stocks_wallet: 0, fd: 0 },
  market_assets: {
    mutual_funds: { invested: 0, current: 0 },
    nps: { invested: 0, current: 0 },
    stock_market: { invested: 0, current: 0 },
    crypto: { invested: 0, current: 0 }
  },
  oneOffs: [],
  expenses_note: ""
});

function draftFromLatest(entries: Entry[], initialDate?: string) {
  const targetDate = initialDate ?? localToday();
  const eligible = entries.filter((item) => item.date <= targetDate).sort((a, b) => a.date.localeCompare(b.date));
  const latest = eligible[eligible.length - 1];
  if (!latest) return { ...emptyEntry(), date: targetDate, id: targetDate };
  return {
    ...(JSON.parse(JSON.stringify(latest)) as Entry),
    id: "",
    date: targetDate,
    expenses_note: ""
  };
}

function netWorthFor(entry: Entry) {
  const balances = entry.liquid.bank + entry.liquid.sodexo + entry.hard_assets.stocks_wallet + entry.hard_assets.fd;
  return balances + ASSET_KEYS.reduce((sum, asset) => sum + entry.market_assets[asset].current, 0);
}

function hardCapitalFor(entry: Entry) {
  const balances = entry.liquid.bank + entry.liquid.sodexo + entry.hard_assets.stocks_wallet + entry.hard_assets.fd;
  return balances + ASSET_KEYS.reduce((sum, asset) => sum + entry.market_assets[asset].invested, 0);
}

function dateLabel(date: string) {
  return formatDateLabel(date);
}

export function DataEntryModal({ open, entry, initialDate, masked, entries, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Entry>(emptyEntry());
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingAmounts, setEditingAmounts] = useState<Record<string, string>>({});
  const [oneOffLabel, setOneOffLabel] = useState("");
  const [oneOffAmount, setOneOffAmount] = useState("");
  const [oneOffType, setOneOffType] = useState<"inflow" | "outflow">("inflow");
  const [oneOffOpen, setOneOffOpen] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const initialDraftRef = useRef<string>("");
  const dirtyRef = useRef(false);
  const cancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    const nextDraft = entry ?? draftFromLatest(entries, initialDate);
    setDraft(nextDraft);
    initialDraftRef.current = JSON.stringify(nextDraft);
    dirtyRef.current = false;
    setNoteOpen(Boolean(entry?.expenses_note));
    setEditingAmounts({});
    setOneOffLabel(""); setOneOffAmount(""); setOneOffType("inflow");
    setOneOffOpen(false);
  }, [entry, initialDate, open, entries]);

  useEffect(() => {
    if (!open) return;
    const dialog = contentRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelRef.current();
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

  dirtyRef.current = Boolean(initialDraftRef.current) && JSON.stringify(draft) !== initialDraftRef.current;

  if (!open) return null;

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
        className={[className, value === 0 ? "is-zero" : ""].filter(Boolean).join(" ")}
        type="text"
        aria-label={label}
        inputMode="decimal"
        value={editingAmounts[id] ?? (value === null ? "" : masked ? "₹ ••••" : formatCurrency(value, false))}
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
  const capitalChange = previousEntry ? hardCapitalFor(draft) - hardCapitalFor(previousEntry) : null;
  const unrealizedChange = snapshotChange !== null && capitalChange !== null ? snapshotChange - capitalChange : null;
  const formattedDate = draft.date ? dateLabel(draft.date) : "Select date";
  const isToday = draft.date === localToday();
  const hasCarryForward = entries.some((item) => item.date <= localToday());
  const balanceSubtotal = balanceFields.reduce((total, field) => total + field.value, 0);
  const marketSubtotal = ASSET_KEYS.reduce((total, asset) => total + draft.market_assets[asset].current, 0);
  const saveDraft = () => {
    onSave({ ...draft, id: draft.date });
    onClose();
  };
  const addOneOff = () => {
    const amount = Number(oneOffAmount.replace(/,/g, ""));
    if (!oneOffLabel.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setDraft((current) => ({ ...current, oneOffs: [...(current.oneOffs ?? []), { id: crypto.randomUUID(), type: oneOffType, amount, label: oneOffLabel.trim() }] }));
    setOneOffLabel(""); setOneOffAmount("");
  };
  const cancelDraft = () => {
    if (dirtyRef.current && !window.confirm("Discard your unsaved snapshot changes?")) return;
    onClose();
  };
  cancelRef.current = cancelDraft;
  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      saveDraft();
      return;
    }
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement) || event.target.type === "date") return;
    event.preventDefault();
    const fields = Array.from(contentRef.current?.querySelectorAll<HTMLInputElement>('input:not([type="date"]):not([disabled])') ?? []);
    const index = fields.indexOf(event.target);
    fields[index + 1]?.focus();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (contentRef.current && !contentRef.current.contains(event.target as Node)) cancelDraft(); }}>
      <section ref={contentRef} className="snapshot-dialog snapshot-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="snapshot-dialog-title" tabIndex={-1} onKeyDown={handleDialogKeyDown}>
        <header className="snapshot-sheet-header">
          <button type="button" className="snapshot-sheet-action" onClick={cancelDraft}>Cancel</button>
          <h2 id="snapshot-dialog-title">{entry ? "Edit snapshot" : "New snapshot"}</h2>
          <button type="button" className="snapshot-sheet-action snapshot-sheet-save" onClick={saveDraft}>{entry ? "Save changes" : "Save snapshot"}</button>
        </header>

        <div className="snapshot-dialog-body snapshot-editor-body">
          <section className="snapshot-net-worth" aria-label="Live snapshot summary">
            <span className="snapshot-net-worth-label">Net worth · live</span>
            <strong>{formatCurrency(netWorth, masked)}</strong>
            {snapshotChange === null ? (
              <span className="snapshot-period-change snapshot-period-change--neutral">No earlier snapshot</span>
            ) : (
              <span className={`snapshot-period-change${snapshotChange < 0 ? " is-negative" : ""}`}>
                {formatSigned(snapshotChange, masked)} since {previousEntry ? dateLabel(previousEntry.date) : "previous snapshot"}
              </span>
            )}
            {capitalChange !== null && unrealizedChange !== null ? <span className="snapshot-movement-summary">Hard capital {formatSigned(capitalChange, masked)} · unrealized gain {formatSigned(unrealizedChange, masked)}</span> : null}
          </section>

          <div className="snapshot-date-panel">
            <div className="snapshot-date-control-wrap">
            <button type="button" className="snapshot-date-control" onClick={() => {
              const input = dateInputRef.current;
              if (!input) return;
              try {
                if (typeof input.showPicker === "function") input.showPicker();
                else { input.focus(); input.click(); }
              } catch {
                input.focus();
                input.click();
              }
            }} aria-label={`Change snapshot date, currently ${formattedDate}`}>
              <span>{!entry && isToday ? `Today, ${formattedDate}` : formattedDate}</span>
              <span className="snapshot-date-chevron" aria-hidden="true">⌄</span>
            </button>
            <input ref={dateInputRef} id="snapshot-date" className="snapshot-date-input" type="date" value={draft.date} aria-label="Snapshot date" tabIndex={-1} onClick={(event) => {
              const input = event.currentTarget;
              try { if (typeof input.showPicker === "function") input.showPicker(); } catch { /* Native click remains the fallback. */ }
            }} onChange={(event) => handleBase("date", event.target.value)} />
            </div>
          </div>

          <section className="snapshot-editor-section" aria-labelledby="snapshot-balances-heading">
            <div className="snapshot-editor-section-heading">
              <h3 id="snapshot-balances-heading">Cash, deposits and wallet</h3>
              <strong>{formatCurrency(balanceSubtotal, masked)}</strong>
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
              <strong>{formatCurrency(marketSubtotal, masked)}</strong>
            </div>
            <div className="snapshot-investment-list snapshot-form-surface">
              {ASSET_KEYS.map((asset) => {
                const invested = draft.market_assets[asset].invested ?? 0;
                const current = draft.market_assets[asset].current ?? 0;
                const gain = current - invested;
                const hasValues = invested !== 0 || current !== 0;
                const percent = invested > 0 ? ` (${formatSignedPercent(gain / invested, false)})` : "";
                return (
                  <article className="snapshot-investment-row" key={asset}>
                    <div className="snapshot-investment-main">
                      <h4><i className={`snapshot-asset-dot is-${asset}`} />{ASSET_LABELS[asset]}</h4>
                      {amountInput(`${ASSET_LABELS[asset]} current value`, `snapshot-${asset}-current`, draft.market_assets[asset].current, `market_assets.${asset}.current`, "snapshot-current-value")}
                    </div>
                    <div className="snapshot-investment-meta">
                      <label className="snapshot-invested-editable" htmlFor={`snapshot-${asset}-invested`}>
                        <span>Invested</span>
                        {amountInput(`${ASSET_LABELS[asset]} invested`, `snapshot-${asset}-invested`, draft.market_assets[asset].invested, `market_assets.${asset}.invested`)}
                      </label>
                      <p className={`snapshot-investment-performance${gain < 0 ? " is-negative" : ""}${hasValues ? "" : " is-neutral"}`}>
                        {hasValues ? masked ? "₹ ••••" : <>{formatSigned(gain, false)}{percent}</> : "—"}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="snapshot-editor-section one-off-section" aria-labelledby="one-off-heading">
            <div className="snapshot-editor-section-heading"><div><h3 id="one-off-heading">One-off cash events</h3><p>Bonuses, trips, big purchases. Recurring income and spending live in Plan.</p></div></div>
            {draft.oneOffs?.length ? <div className="one-off-list">{draft.oneOffs.map((item) => <div key={item.id}><span className={`one-off-type is-${item.type}`}>{item.type === "inflow" ? "In" : "Out"}</span><strong>{item.label}</strong><span>{masked ? "₹ ••••" : formatCurrency(item.amount, false)}</span><button type="button" aria-label={`Remove ${item.label}`} onClick={() => setDraft((current) => ({ ...current, oneOffs: current.oneOffs.filter((event) => event.id !== item.id) }))}>×</button></div>)}</div> : null}
            <button type="button" className="one-off-toggle" aria-expanded={oneOffOpen} onClick={() => setOneOffOpen((open) => !open)}><span>{oneOffOpen ? "− Add one-off in/out" : "+ Add one-off in/out"}</span><i aria-hidden="true">{oneOffOpen ? "⌃" : "›"}</i></button>
            {oneOffOpen ? <div className="one-off-add-row">
              <SegmentedControl ariaLabel="Cash event direction" value={oneOffType} onChange={setOneOffType} className="one-off-direction" options={[{ value: "inflow", label: "Inflow" }, { value: "outflow", label: "Outflow" }]} />
              <FormInput aria-label="Cash event label" value={oneOffLabel} onChange={(event) => setOneOffLabel(event.target.value)} placeholder="Bonus, travel, medical…" />
              <FormInput aria-label="Cash event amount" type="number" min="1" inputMode="decimal" value={oneOffAmount} onChange={(event) => setOneOffAmount(event.target.value)} placeholder="Amount in ₹" />
              <button type="button" className="primary-action" onClick={addOneOff}>Add event</button>
            </div> : null}
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
                <span className="snapshot-note-helper">Shows as a marker on your charts.</span>
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
