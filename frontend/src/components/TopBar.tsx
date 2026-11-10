import type { RangeKey, SyncMetadata } from "../lib/types";
import { RANGE_OPTIONS } from "../utils/config";

interface TopBarProps {
  selectedRange: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  isPrivateMode: boolean;
  onTogglePrivate: () => void;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  onSave: () => void;
  onLoad: () => void;
  onSystemLoad: () => void;
  sync: SyncMetadata | null;
  statusText: string;
}

export function TopBar(props: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          {props.statusText} • {props.sync?.fileExists ? `Sync: ${new Date(props.sync.fileUpdated).toLocaleTimeString()}` : "No file found"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="chip-group hidden sm:flex">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              className={`chip-item ${props.selectedRange === option.key ? "chip-item-active" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => props.onRangeChange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mx-2 h-4 w-[1px] bg-border hidden lg:block" />

        <button className="btn btn-ghost text-xs font-bold uppercase tracking-widest" onClick={props.onTogglePrivate}>
          {props.isPrivateMode ? "Reveal" : "Hide"}
        </button>
        <button className="btn btn-ghost text-xs font-bold uppercase tracking-widest" onClick={props.onToggleTheme}>
          {props.themeMode === "dark" ? "Light" : "Dark"}
        </button>
        <button className="btn btn-outline h-9" onClick={props.onLoad} title="Sync with saved data">Sync</button>
        <button className="btn btn-outline h-9 px-2" onClick={props.onSystemLoad} title="Load any .json file">📁</button>
        <button className="btn btn-primary h-9" onClick={props.onSave}>Save</button>
      </div>
    </header>
  );
}
