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
  const visibleEntries = maxRows ? sortedEntries.slice(0, maxRows) : sortedEntries;

  if (visibleEntries.length === 0) {
    return (
      <div className="snapshot-empty">
        <span className="empty-mark" aria-hidden="true">＋</span>
        <p>No snapshots in this range.</p>
      </div>
    );
  }

  return (
    <div className="snapshot-table-wrap">
      <div className="snapshot-table-scroll">
        <table className="snapshot-table">
          <thead>
            <tr>
              <th scope="col">Snapshot</th>
              <th scope="col" className="numeric">Liquid</th>
              <th scope="col" className="numeric">Hard capital</th>
              <th scope="col" className="numeric">Market value</th>
              <th scope="col" className="numeric">Net worth</th>
              <th scope="col" className="numeric">Unrealized gain</th>
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
                    <span className="snapshot-note">{entry.expenses_note || "Monthly snapshot"}</span>
                  </td>
                  <td className="numeric">{formatCurrency(liquid, masked)}</td>
                  <td className="numeric">{formatCurrency(hardCapital, masked)}</td>
                  <td className="numeric">{formatCurrency(marketValue, masked)}</td>
                  <td className="numeric net-worth-cell">{formatCurrency(netWorth, masked)}</td>
                  <td className="numeric"><span className={`gain-value ${gain < 0 ? "is-negative" : ""}`}>{formatCurrency(gain, masked)}</span></td>
                  <td className="snapshot-actions">
                    <div className="snapshot-action-buttons">
                      <button type="button" onClick={() => onEdit(entry)} aria-label={`Edit balances for ${dateLabel}`} title="Edit balances">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L5.2 16.1 4 20Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <button type="button" onClick={() => onEditIncomeSip(entry)} aria-label={`Edit income and SIP for ${dateLabel}`} title="Edit income and SIP">
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
    </div>
  );
}
