import { useEffect, useMemo, useState } from "react";
import type { Entry } from "../lib/types";
import { formatCurrency, formatDateLabel, formatSigned, formatSignedPercent } from "../utils/format";
import { getSnapshotTotals } from "../utils/insights";

export type SnapshotSortBy = "date" | "change" | "percent";
export type SortDirection = "asc" | "desc";

interface Props {
  entries: Entry[];
  allEntries?: Entry[];
  masked: boolean;
  onEdit: (entry: Entry) => void;
  maxRows?: number;
  sortBy?: SnapshotSortBy;
  sortDirection?: SortDirection;
}

export function TableView({ entries, allEntries = entries, masked, onEdit, maxRows, sortBy = "date", sortDirection = "desc" }: Props) {
  const compact = Boolean(maxRows);
  const [visibleCount, setVisibleCount] = useState(7);
  const chronological = useMemo(() => [...allEntries].sort((a, b) => a.date.localeCompare(b.date)), [allEntries]);
  const previousById = useMemo(() => {
    const map = new Map<string, Entry>();
    chronological.forEach((entry, index) => { if (index > 0) map.set(entry.id, chronological[index - 1]); });
    return map;
  }, [chronological]);
  const sortedEntries = useMemo(() => {
    const sorted = [...entries];
    const direction = sortDirection === "desc" ? -1 : 1;
    sorted.sort((a, b) => {
      if (compact || sortBy === "date") {
        const dateComparison = a.date.localeCompare(b.date) * direction;
        return dateComparison || b.id.localeCompare(a.id);
      }

      const valueFor = (entry: Entry) => {
        const previous = previousById.get(entry.id);
        if (!previous) return null;
        const previousWorth = getSnapshotTotals(previous).netWorth;
        const change = getSnapshotTotals(entry).netWorth - previousWorth;
        if (sortBy === "change") return change;
        return previousWorth > 0 ? change / previousWorth : null;
      };
      const left = valueFor(a);
      const right = valueFor(b);
      if (left === null && right !== null) return 1;
      if (right === null && left !== null) return -1;
      if (left !== null && right !== null && left !== right) return (left - right) * direction;
      return b.date.localeCompare(a.date);
    });
    return sorted;
  }, [entries, compact, sortBy, sortDirection, previousById]);
  const visibleEntries = compact ? sortedEntries.slice(0, maxRows ?? 0) : sortedEntries.slice(0, visibleCount);

  useEffect(() => { setVisibleCount(7); }, [entries, sortBy, sortDirection]);

  if (visibleEntries.length === 0) {
    return <div className="snapshot-empty"><p>No snapshots match this view.</p></div>;
  }

  return (
    <div className={`snapshot-table-wrap${compact ? " is-compact" : ""}`}>
      <div className="snapshot-table-scroll">
        <table className="snapshot-table">
          <thead><tr>
            <th scope="col" aria-sort={sortBy === "date" ? (sortDirection === "desc" ? "descending" : "ascending") : undefined}>Snapshot</th>
            <th scope="col" className="numeric">Net worth</th>
            <th scope="col" className="numeric" aria-sort={sortBy === "change" || sortBy === "percent" ? (sortDirection === "desc" ? "descending" : "ascending") : undefined}>Change</th>
            {!compact ? <th scope="col" className="numeric">Hard capital</th> : null}
            {!compact ? <th scope="col" className="numeric">Market value</th> : null}
            <th scope="col" className="numeric">Unrealized gain</th>
            <th scope="col" className="actions-heading"><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {visibleEntries.map((entry) => {
              const totals = getSnapshotTotals(entry);
              const previous = previousById.get(entry.id);
              const previousWorth = previous ? getSnapshotTotals(previous).netWorth : null;
              const change = previousWorth === null ? null : totals.netWorth - previousWorth;
              const changePercent = previousWorth !== null && previousWorth > 0 ? (change ?? 0) / previousWorth : null;
              const label = formatDateLabel(entry.date);
              return <tr key={entry.id}>
                <td className="snapshot-date-cell"><strong className="snapshot-date">{label}</strong><span className="snapshot-note" title={entry.expensesNote || "No note"}>{entry.expensesNote || "Monthly snapshot"}</span></td>
                <td className="numeric net-worth-cell"><span className="mobile-label">Net worth</span>{formatCurrency(totals.netWorth, masked)}</td>
                <td className="numeric change-cell"><span className="mobile-label">Change</span>{change === null ? <span className="table-muted">First snapshot</span> : <><strong className={change < 0 ? "is-negative" : "is-positive"}>{formatSigned(change, masked)}</strong><small>{changePercent === null ? "—" : formatSignedPercent(changePercent, masked)} since {formatDateLabel(previous!.date)}</small></>}</td>
                {!compact ? <td className="numeric"><span className="mobile-label">Hard capital</span>{formatCurrency(totals.hardCapital, masked)}</td> : null}
                {!compact ? <td className="numeric"><span className="mobile-label">Market value</span>{formatCurrency(totals.marketValue, masked)}</td> : null}
                <td className="numeric"><span className="mobile-label">Unrealized gain</span><strong className={totals.unrealizedGain < 0 ? "is-negative" : "is-positive"}>{formatSigned(totals.unrealizedGain, masked)}</strong></td>
                <td className="snapshot-actions"><div className="snapshot-action-buttons"><button type="button" onClick={() => onEdit(entry)} aria-label={`Edit snapshot for ${label}`} title="Edit snapshot"><EditIcon /></button></div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {!compact ? <div className="snapshot-pagination">
        <span>Showing {visibleEntries.length} of {sortedEntries.length}</span>
        {visibleEntries.length < sortedEntries.length ? (
          <button
            className="snapshot-show-more-btn"
            type="button"
            onClick={() => setVisibleCount((count) => Math.min(sortedEntries.length, count + 7))}
          >
            Show more
          </button>
        ) : null}
      </div> : null}
    </div>
  );
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L5.2 16.1 4 20Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
