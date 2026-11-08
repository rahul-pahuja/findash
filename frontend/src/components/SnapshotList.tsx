import type { Entry } from "../lib/types";

interface Props {
  entries: Entry[];
  onEdit: (entry: Entry) => void;
  onEditIncomeSip: (entry: Entry) => void;
}

export function SnapshotList({ entries, onEdit, onEditIncomeSip }: Props) {
  if (entries.length === 0) {
    return (
      <div className="snapshot-list-empty">
        <span className="empty-mark" aria-hidden="true">＋</span>
        <p>No snapshots in this range.</p>
      </div>
    );
  }

  return (
    <section className="snapshot-list-panel" aria-label="Snapshots">
      {[...entries].reverse().map((entry) => {
        const dateLabel = new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        });

        return (
          <article key={entry.id} className="snapshot-list-row">
            <div className="snapshot-list-date">
              <span>{dateLabel}</span>
              <span>{entry.expenses_note || "Monthly snapshot"}</span>
            </div>
            <div className="snapshot-list-actions">
              <button type="button" onClick={() => onEdit(entry)}>Edit balances</button>
              <button type="button" onClick={() => onEditIncomeSip(entry)}>Income &amp; SIP</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
