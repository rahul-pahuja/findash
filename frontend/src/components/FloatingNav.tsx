import type { RangeKey } from "../lib/types";
import { RANGE_OPTIONS } from "../utils/config";

interface ControlBarProps {
  selectedRange: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  isPrivateMode: boolean;
  onTogglePrivate: () => void;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  onSave: () => void;
  onLoad: () => void;
  onSystemLoad: () => void;
  statusText: string;
  fileUpdated?: string;
}

export function ControlBar(props: ControlBarProps) {
  const isSynced = props.statusText === "Synced" || props.statusText === "Saved" || props.statusText === "Ready";

  return (
    <div className="workspace-toolbar">
      <div className="toolbar-status" role="status" aria-live="polite">
        <span className={`status-indicator ${isSynced ? "is-ready" : ""}`} />
        <span>{props.statusText}</span>
        {props.fileUpdated ? <span className="status-time">Updated {new Date(props.fileUpdated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span> : null}
      </div>

      <div className="toolbar-controls">
        <div className="range-control" role="group" aria-label="Date range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={props.selectedRange === option.key}
              className={`range-option ${props.selectedRange === option.key ? "is-selected" : ""}`}
              onClick={() => props.onRangeChange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="toolbar-divider" aria-hidden="true" />

        <button className="toolbar-icon-button" type="button" onClick={props.onTogglePrivate} title={props.isPrivateMode ? "Show values" : "Hide values"} aria-label={props.isPrivateMode ? "Show values" : "Hide values"}>
          {props.isPrivateMode ? (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.3A10.7 10.7 0 0 1 12 5c4.5 0 8.3 2.9 9.5 7-.4 1.3-1.1 2.5-2.1 3.4M6.2 6.2A10.5 10.5 0 0 0 2.5 12c1.2 4.1 5 7 9.5 7 1 0 2-.2 2.9-.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.2-7 9.5-7 9.5 7 9.5 7-3.2 7-9.5 7-9.5-7-9.5-7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.7" /></svg>
          )}
        </button>

        <button className="toolbar-icon-button" type="button" onClick={props.onToggleTheme} title={props.themeMode === "dark" ? "Use light appearance" : "Use dark appearance"} aria-label={props.themeMode === "dark" ? "Use light appearance" : "Use dark appearance"}>
          {props.themeMode === "dark" ? (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.7" /><path d="M12 2.8v2m0 14.4v2m9.2-9.2h-2M4.8 12h-2m15.7-6.5-1.4 1.4M6.9 17.1l-1.4 1.4m13 0-1.4-1.4M6.9 6.9 5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.5 15.2A8.6 8.6 0 0 1 8.8 3.5 8.8 8.8 0 1 0 20.5 15.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>

        <button className="toolbar-icon-button" type="button" onClick={props.onLoad} title="Reload saved data" aria-label="Reload saved data">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.8-3L4 10m0-5v5h5m-5 3a8 8 0 0 0 14.8 3L20 14m0 5v-5h-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        <button className="toolbar-icon-button" type="button" onClick={props.onSystemLoad} title="Open a local JSON file" aria-label="Open a local JSON file">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h5l2 2h5.8a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V7.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M12 17V11m0 0-2.3 2.3M12 11l2.3 2.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        <button className="toolbar-save-button" type="button" onClick={props.onSave}>Save</button>
      </div>
    </div>
  );
}
