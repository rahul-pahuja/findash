import { useEffect, useMemo, useState } from "react";
import type { Entry } from "../lib/types";
import { formatCurrency, formatDateLabel, formatSigned, formatSignedPercent } from "../utils/format";
import { getSnapshotTotals } from "../utils/insights";

interface Props {
  entries: Entry[];
  allEntries?: Entry[];
  masked: boolean;
  onEdit: (entry: Entry) => void;
  onEditIncomeSip: (entry: Entry) => void;
  maxRows?: number;
  ranked?: boolean;
}

export function TableView({ entries, allEntries = entries, masked, onEdit, onEditIncomeSip, maxRows, ranked = false }: Props) {
  const sortedEntries = ranked ? [...entries] : [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const chronological = [...allEntries].sort((a, b) => a.date.localeCompare(b.date));
  const compact = Boolean(maxRows);
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeInput, setPageSizeInput] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const pageCount = compact ? 1 : Math.max(1, Math.ceil(sortedEntries.length / pageSize));
  const activePage = Math.min(currentPage, pageCount);
  const startIndex = compact ? 0 : (activePage - 1) * pageSize;
  const visibleEntries = compact ? sortedEntries.slice(0, maxRows ?? 0) : sortedEntries.slice(startIndex, startIndex + pageSize);
  const previousById = useMemo(() => {
    const map = new Map<string, Entry>();
    chronological.forEach((entry, index) => { if (index > 0) map.set(entry.id, chronological[index - 1]); });
    return map;
  }, [allEntries]);

  useEffect(() => { if (currentPage > pageCount) setCurrentPage(pageCount); }, [currentPage, pageCount]);
  useEffect(() => { setCurrentPage(1); }, [entries]);

  const commitPageSize = () => {
    const parsed = Number.parseInt(pageSizeInput, 10);
    const nextSize = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 10;
    setPageSize(nextSize);
    setPageSizeInput(String(nextSize));
    setCurrentPage(1);
  };

  if (visibleEntries.length === 0) {
    return <div className="snapshot-empty"><p>No snapshots match this view.</p></div>;
  }

  return (
    <div className={`snapshot-table-wrap${compact ? " is-compact" : ""}`}>
      <div className="snapshot-table-scroll">
        <table className="snapshot-table">
          <thead><tr>
            <th scope="col" aria-sort={ranked ? undefined : "descending"}>Snapshot</th>
            <th scope="col" className="numeric">Net worth</th>
            <th scope="col" className="numeric">Change</th>
            {!compact ? <th scope="col" className="numeric">Hard capital</th> : null}
            {!compact ? <th scope="col" className="numeric">Market value</th> : null}
            <th scope="col" className="numeric">Unrealized gain</th>
            <th scope="col" className="actions-heading"><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {visibleEntries.map((entry, rowIndex) => {
              const totals = getSnapshotTotals(entry);
              const previous = previousById.get(entry.id);
              const change = previous ? totals.netWorth - getSnapshotTotals(previous).netWorth : null;
              const changePercent = previous && getSnapshotTotals(previous).netWorth > 0 ? (change ?? 0) / getSnapshotTotals(previous).netWorth : null;
              const label = formatDateLabel(entry.date);
              return <tr key={entry.id}>
                <td className="snapshot-date-cell">{ranked ? <span className="snapshot-rank">#{startIndex + rowIndex + 1}</span> : null}<strong className="snapshot-date">{label}</strong><span className="snapshot-note" title={entry.expenses_note || "No note"}>{entry.expenses_note || "Monthly snapshot"}</span></td>
                <td className="numeric net-worth-cell"><span className="mobile-label">Net worth</span>{formatCurrency(totals.netWorth, masked)}</td>
                <td className="numeric change-cell"><span className="mobile-label">Change</span>{change === null ? <span className="table-muted">First snapshot</span> : <><strong className={change < 0 ? "is-negative" : "is-positive"}>{formatSigned(change, masked)}</strong><small>{changePercent === null ? "—" : formatSignedPercent(changePercent, masked)} since {formatDateLabel(previous!.date)}</small></>}</td>
                {!compact ? <td className="numeric"><span className="mobile-label">Hard capital</span>{formatCurrency(totals.hardCapital, masked)}</td> : null}
                {!compact ? <td className="numeric"><span className="mobile-label">Market value</span>{formatCurrency(totals.marketValue, masked)}</td> : null}
                <td className="numeric"><span className="mobile-label">Unrealized gain</span><strong className={totals.unrealizedGain < 0 ? "is-negative" : "is-positive"}>{formatSigned(totals.unrealizedGain, masked)}</strong></td>
                <td className="snapshot-actions"><div className="snapshot-action-buttons">
                  <button type="button" onClick={() => onEdit(entry)} aria-label={`Edit snapshot for ${label}`} title="Edit snapshot"><EditIcon /></button>
                  <button type="button" onClick={() => onEditIncomeSip(entry)} aria-label={`Edit income and contributions for ${label}`} title="Edit income and contributions"><NoteIcon /></button>
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {!compact ? <div className="snapshot-pagination">
        <div className="snapshot-pagination-summary"><label htmlFor="snapshot-page-size">Rows</label><input id="snapshot-page-size" type="number" inputMode="numeric" min="1" max="1000" step="1" value={pageSizeInput} onChange={(event) => setPageSizeInput(event.target.value)} onBlur={commitPageSize} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label="Snapshots per page" /><span>Showing {startIndex + 1}–{Math.min(startIndex + visibleEntries.length, sortedEntries.length)} of {sortedEntries.length}</span></div>
        <div className="snapshot-pagination-controls"><span>Page {activePage} of {pageCount}</span><button type="button" aria-label="Previous page" disabled={activePage <= 1} onClick={() => setCurrentPage(activePage - 1)}>←</button><button type="button" aria-label="Next page" disabled={activePage >= pageCount} onClick={() => setCurrentPage(activePage + 1)}>→</button></div>
      </div> : null}
    </div>
  );
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L5.2 16.1 4 20Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function NoteIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4.5h14v15H5zM8 8h8M8 12h8M8 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
