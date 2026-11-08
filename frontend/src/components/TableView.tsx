import type { Entry } from "../lib/types";
import { ASSET_KEYS, ASSET_LABELS } from "../utils/config";
import { formatCurrency, formatMonthLabel } from "../utils/format";

interface Props {
  entries: Entry[];
  masked: boolean;
  onEdit: (entry: Entry) => void;
  onEditIncomeSip: (entry: Entry) => void;
}

export function TableView({ entries, masked, onEdit, onEditIncomeSip }: Props) {
  const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="card-base overflow-hidden border border-border shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="p-3 font-bold uppercase tracking-wider text-muted-foreground border-r border-border/50">Date</th>
              <th className="p-3 font-bold uppercase tracking-wider text-muted-foreground border-r border-border/50 text-right">Bank + Sodexo</th>
              <th className="p-3 font-bold uppercase tracking-wider text-muted-foreground border-r border-border/50 text-right">Wallet</th>
              <th className="p-3 font-bold uppercase tracking-wider text-muted-foreground border-r border-border/50 text-right">FD</th>
              {ASSET_KEYS.map((asset) => (
                <th key={asset} className="p-3 font-bold uppercase tracking-wider text-muted-foreground border-r border-border/50 text-right whitespace-nowrap">
                  {ASSET_LABELS[asset]}
                </th>
              ))}
              <th className="p-3 font-bold uppercase tracking-wider text-muted-foreground text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sortedEntries.map((entry) => {
              const liquid = entry.liquid.bank + entry.liquid.sodexo;
              return (
                <tr key={entry.id} className="border-b border-border/50 last:border-0 group">
                  <td className="p-3 font-bold border-r border-border/50 whitespace-nowrap">
                    {formatMonthLabel(entry.id)}
                  </td>
                  <td className="p-3 border-r border-border/50 text-right tabular-nums">
                    {masked ? "••••" : formatCurrency(liquid, false)}
                  </td>
                  <td className="p-3 border-r border-border/50 text-right tabular-nums">
                    {masked ? "••••" : formatCurrency(entry.hard_assets.stocks_wallet, false)}
                  </td>
                  <td className="p-3 border-r border-border/50 text-right tabular-nums">
                    {masked ? "••••" : formatCurrency(entry.hard_assets.fd, false)}
                  </td>
                  {ASSET_KEYS.map((asset) => (
                    <td key={asset} className="p-3 border-r border-border/50 text-right tabular-nums">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">
                          {masked ? "••••" : formatCurrency(entry.market_assets[asset].current, false)}
                        </span>
                        <span className="text-[9px] font-medium text-muted-foreground/60">
                          {masked ? "••••" : `Invested: ${formatCurrency(entry.market_assets[asset].invested, false)}`}
                        </span>
                      </div>
                    </td>
                  ))}
                  <td className="p-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <button 
                        onClick={() => onEdit(entry)}
                        className="rounded border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase text-primary hover:bg-primary hover:text-primary-foreground hover:scale-110 active:scale-95 transition-all duration-300 shadow-sm"
                      >
                        Balances
                      </button>
                      <button 
                        onClick={() => onEditIncomeSip(entry)}
                        className="rounded border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase text-primary hover:bg-primary hover:text-primary-foreground hover:scale-110 active:scale-95 transition-all duration-300 shadow-sm"
                      >
                        Income
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
