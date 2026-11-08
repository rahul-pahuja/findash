import { useEffect, useState } from "react";
import type { Entry } from "../lib/types";
import { ASSET_KEYS } from "../utils/config";
import { formatCurrency } from "../utils/format";

interface Props {
  entries: Entry[];
  masked: boolean;
  onEdit: (entry: Entry) => void;
  onEditIncomeSip: (entry: Entry) => void;
  maxRows?: number;
}

export function TableView({ entries, masked, onEdit, onEditIncomeSip, maxRows }: Props) {
  const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const compact = Boolean(maxRows);
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeInput, setPageSizeInput] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const pageCount = compact ? 1 : Math.max(1, Math.ceil(sortedEntries.length / pageSize));
  const activePage = Math.min(currentPage, pageCount);
  const startIndex = compact ? 0 : (activePage - 1) * pageSize;
  const visibleEntries = compact
    ? sortedEntries.slice(0, maxRows ?? 0)
    : sortedEntries.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  useEffect(() => {
    setCurrentPage(1);
  }, [entries]);

  const commitPageSize = () => {
    const parsed = Number.parseInt(pageSizeInput, 10);
    const nextSize = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 10;
    setPageSize(nextSize);
    setPageSizeInput(String(nextSize));
    setCurrentPage(1);
  };

  if (visibleEntries.length === 0) {
    return (
      <div className="snapshot-empty">
        <span className="empty-mark" aria-hidden="true">＋</span>
        <p>No snapshots in this range.</p>
      </div>
    );
  }

  return (
    <div className={`snapshot-table-wrap${compact ? " is-compact" : ""}`}>
      <div className="snapshot-table-scroll">
        <table className="snapshot-table">
          <thead>
            <tr>
              <th scope="col" aria-sort="descending">Snapshot</th>
              {compact ? (
                <>
                  <th scope="col" className="numeric">Net worth</th>
                  <th scope="col" className="numeric">Gain / loss</th>
                </>
              ) : (
                <>
                  <th scope="col" className="numeric">Liquid assets</th>
                  <th scope="col" className="numeric">Hard capital</th>
                  <th scope="col" className="numeric">Market value</th>
                  <th scope="col" className="numeric">Net worth</th>
                  <th scope="col" className="numeric">Gain / loss</th>
                </>
              )}
              <th scope="col" className="actions-heading"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => {
              const liquid = entry.liquid.bank + entry.liquid.sodexo;
              const baseCapital = liquid + entry.hard_assets.fd + entry.hard_assets.stocks_wallet;
              const marketInvested = ASSET_KEYS.reduce((total, asset) => total + entry.market_assets[asset].invested, 0);
              const marketValue = ASSET_KEYS.reduce((total, asset) => total + entry.market_assets[asset].current, 0);
              const hardCapital = baseCapital + marketInvested;
              const netWorth = baseCapital + marketValue;
              const gain = netWorth - hardCapital;
              const dateLabel = new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
              });

              return (
                <tr key={entry.id}>
                  <td className="snapshot-date-cell">
                    <span className="snapshot-date">{dateLabel}</span>
                    <span className="snapshot-note" title={entry.expenses_note || "Monthly snapshot"}>{entry.expenses_note || "Monthly snapshot"}</span>
                  </td>
                  {compact ? (
                    <>
                      <td className="numeric net-worth-cell"><span className="mobile-label">Net worth</span><span>{formatCurrency(netWorth, masked)}</span></td>
                      <td className="numeric"><span className="mobile-label">Gain / loss</span><span className={`gain-value ${gain < 0 ? "is-negative" : "is-positive"}`}>{formatSignedCurrency(gain, masked)}</span></td>
                    </>
                  ) : (
                    <>
                      <td className="numeric"><span className="mobile-label">Liquid assets</span><span>{formatCurrency(liquid, masked)}</span></td>
                      <td className="numeric"><span className="mobile-label">Hard capital</span><span>{formatCurrency(hardCapital, masked)}</span></td>
                      <td className="numeric"><span className="mobile-label">Market value</span><span>{formatCurrency(marketValue, masked)}</span></td>
                      <td className="numeric net-worth-cell"><span className="mobile-label">Net worth</span><span>{formatCurrency(netWorth, masked)}</span></td>
                      <td className="numeric"><span className="mobile-label">Gain / loss</span><span className={`gain-value ${gain < 0 ? "is-negative" : "is-positive"}`}>{formatSignedCurrency(gain, masked)}</span></td>
                    </>
                  )}
                  <td className="snapshot-actions">
                    <div className="snapshot-action-buttons">
                      <button type="button" onClick={() => onEdit(entry)} aria-label={`Edit balances for ${dateLabel}`} title="Edit snapshot balances">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L5.2 16.1 4 20Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <button type="button" onClick={() => onEditIncomeSip(entry)} aria-label={`Edit income and SIP for ${dateLabel}`} title="Edit income and SIP contributions">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4.5h14v15H5zM8 8h8M8 12h8M8 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!compact ? (
        <div className="snapshot-pagination">
          <div className="snapshot-pagination-summary">
            <label htmlFor="snapshot-page-size">Rows per page</label>
            <input
              id="snapshot-page-size"
              type="number"
              inputMode="numeric"
              min="1"
              max="1000"
              step="1"
              value={pageSizeInput}
              onChange={(event) => setPageSizeInput(event.target.value)}
              onBlur={commitPageSize}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              aria-label="Number of snapshots per page"
            />
            <span className="snapshot-range-count">Showing {startIndex + 1}–{Math.min(startIndex + visibleEntries.length, sortedEntries.length)} of {sortedEntries.length}</span>
          </div>
          <div className="snapshot-pagination-controls">
            <span>Page {activePage} of {pageCount}</span>
            <button type="button" aria-label="Previous page" title="Previous page" disabled={activePage <= 1} onClick={() => setCurrentPage(activePage - 1)}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14.5 5-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" aria-label="Next page" title="Next page" disabled={activePage >= pageCount} onClick={() => setCurrentPage(activePage + 1)}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9.5 5 7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatSignedCurrency(value: number, masked: boolean) {
  if (masked) return formatCurrency(value, true);
  return `${value < 0 ? "−" : "+"}${formatCurrency(Math.abs(value), false)}`;
}
