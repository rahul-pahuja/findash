import { useEffect, useRef, useState } from "react";
import type { Entry } from "../lib/types";
import { ASSET_KEYS, ASSET_LABELS } from "../utils/config";

interface Props {
  open: boolean;
  entry: Entry | null;
  onClose: () => void;
  onSave: (entry: Entry) => void;
}

const emptyEntry = (): Entry => ({
  id: "",
  date: "",
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

export function DataEntryModal({ open, entry, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Entry>(emptyEntry());
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(entry ?? emptyEntry());
  }, [entry, open]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const update = (path: string, value: string) => {
    const numberValue = value === "" ? null : Number(value);
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
      if (field === "date" && value) {
        next.id = value;
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-sm" onClick={handleBackdropClick}>
      <div ref={contentRef} className="card-base max-h-[90vh] w-full max-w-4xl overflow-y-auto p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Snapshot</p>
            <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">{entry ? "Edit Record" : "New Record"}</h2>
          </div>
          <button className="btn btn-ghost h-10 w-10 p-0" onClick={onClose}>✕</button>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="field">
            <label>Date</label>
            <input type="date" value={draft.date} onChange={(e) => handleBase("date", e.target.value)} />
          </div>
          <div className="field">
            <label>Bank Balance</label>
            <input type="number" value={draft.liquid.bank} onChange={(e) => update("liquid.bank", e.target.value)} />
          </div>
          <div className="field">
            <label>Sodexo / Other Cash</label>
            <input type="number" value={draft.liquid.sodexo} onChange={(e) => update("liquid.sodexo", e.target.value)} />
          </div>
          <div className="field">
            <label>Stocks Wallet</label>
            <input type="number" value={draft.hard_assets.stocks_wallet} onChange={(e) => update("hard_assets.stocks_wallet", e.target.value)} />
          </div>
          <div className="field">
            <label>Fixed Deposit</label>
            <input type="number" value={draft.hard_assets.fd} onChange={(e) => update("hard_assets.fd", e.target.value)} />
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {ASSET_KEYS.map((asset) => (
            <div key={asset} className="glass-hover rounded-xl border border-transparent p-5 transition-all">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{ASSET_LABELS[asset]}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="field">
                  <label>Invested</label>
                  <input type="number" value={draft.market_assets[asset].invested} onChange={(e) => update(`market_assets.${asset}.invested`, e.target.value)} />
                </div>
                <div className="field">
                  <label>Current Value</label>
                  <input type="number" value={draft.market_assets[asset].current} onChange={(e) => update(`market_assets.${asset}.current`, e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="field mt-8">
          <label>Notes</label>
          <textarea value={draft.expenses_note} onChange={(e) => handleBase("expenses_note", e.target.value)} rows={3} placeholder="Any major expenses or travel notes?" />
        </div>

        <div className="mt-10 flex justify-end gap-3 pt-8">
          <button className="rounded-lg bg-muted px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground" onClick={onClose}>Cancel</button>
          <button className="rounded-lg bg-primary px-8 py-2.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:opacity-90"
            onClick={() => {
              const normalized = {
                ...draft,
                id: draft.date
              };
              onSave(normalized);
              onClose();
            }}
          >
            Save Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}
