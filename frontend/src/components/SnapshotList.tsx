import type { Entry } from "../lib/types";
import { formatMonthLabel } from "../utils/format";

interface Props {
  entries: Entry[];
  onAdd: () => void;
  onEdit: (entry: Entry) => void;
  onEditIncomeSip: (entry: Entry) => void;
}

export function SnapshotList({ entries, onAdd, onEdit, onEditIncomeSip }: Props) {
  return (
    <section className="card-base">
      <div className="flex flex-col gap-4 border-b border-border p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground">Snapshot History</h3>
          <p className="mt-1 text-sm text-muted-foreground">Detailed records of your asset and income state.</p>
        </div>
        <button className="glass-hover rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary transition-all hover:bg-primary hover:text-primary-foreground" onClick={onAdd}>Add New Snapshot</button>
      </div>

      <div className="space-y-2 p-4">
        {entries.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic">
            No snapshots found. Add your first one to get started.
          </div>
        ) : (
          [...entries].reverse().map((entry) => (
            <div key={entry.id} className="glass-hover flex flex-col gap-4 rounded-xl border border-transparent p-5 transition-all lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <h4 className="text-base font-bold text-foreground">{formatMonthLabel(entry.id)}</h4>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">
                    {entry.date}
                  </span>
                </div>
                <p className="line-clamp-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {entry.expenses_note || "No note recorded."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button className="glass-hover rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-all hover:text-foreground" onClick={() => onEdit(entry)}>
                  Balances
                </button>
                <button className="glass-hover rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-all hover:text-foreground" onClick={() => onEditIncomeSip(entry)}>
                  Income
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
