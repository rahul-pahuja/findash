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
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(entry ? JSON.parse(JSON.stringify(entry)) as Entry : null);
  }, [entry, open]);

  if (!open || !draft) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-sm" onClick={handleBackdropClick}>
      <div ref={contentRef} className="card-base w-full max-w-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Income and Strategy</p>
            <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">{formatMonthLabel(draft.id)}</h2>
          </div>
          <button className="btn btn-ghost h-10 w-10 p-0" onClick={onClose}>✕</button>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Update your in-hand income and SIP contributions for this snapshot.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="field">
            <label>In-hand Income</label>
            <input
              type="number"
              value={draft.income.in_hand ?? ""}
              onChange={(event) => updateNumber("income.in_hand", event.target.value)}
              placeholder="e.g. 100000"
            />
          </div>
        </div>

        <div className="mt-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Monthly SIP Contributions</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {ASSET_KEYS.map((asset) => (
              <div key={asset} className="glass-hover rounded-lg border border-transparent p-4 transition-all">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">{ASSET_LABELS[asset]}</label>
                <input
                  type="number"
                  className="mt-1.5"
                  value={draft.sip?.[asset] ?? ""}
                  onChange={(event) => updateNumber(`sip.${asset}`, event.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex justify-end gap-3 pt-8">
          <button className="rounded-lg bg-muted px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground" onClick={onClose}>Cancel</button>
          <button className="rounded-lg bg-primary px-8 py-2.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:opacity-90"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
