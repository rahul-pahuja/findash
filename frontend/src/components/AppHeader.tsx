import { useEffect, useRef, useState } from "react";
import type { RangeKey } from "../lib/types";
import type { AnalyticsPeriod } from "../utils/router";
import { formatDateLabel } from "../utils/format";
import { DatePickerModal } from "./DatePickerModal";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
  onSnooze?: () => void;
}

interface Props {
  title: string;
  subtitle: string;
  onAddSnapshot: () => void;
  notifications: NotificationItem[];
  period?: AnalyticsPeriod;
  onPeriodChange?: (period: AnalyticsPeriod) => void;
}

const PERIOD_PRESETS: Array<{ key: RangeKey; label: string }> = [
  { key: "1M", label: "1 month" },
  { key: "3M", label: "3 months" },
  { key: "6M", label: "6 months" },
  { key: "1Y", label: "1 year" },
  { key: "3Y", label: "3 years" },
  { key: "5Y", label: "5 years" },
  { key: "ALL", label: "All time" },
];

export function AppHeader(props: Props) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationAnchorRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const pendingCount = props.notifications.length;
  useEffect(() => {
    if (!notificationsOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!notificationAnchorRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setNotificationsOpen(false);
      notificationButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [notificationsOpen]);
  return <header className="page-toolbar">
    <div className="page-toolbar-title"><h1>{props.title}</h1><p>{props.subtitle}</p></div>
    <div className="toolbar-actions">
      {props.period && props.onPeriodChange ? <PeriodControl period={props.period} onChange={props.onPeriodChange} /> : null}
      <div className="toolbar-popover-anchor" ref={notificationAnchorRef}>
        <button ref={notificationButtonRef} className="toolbar-icon-button" type="button" onClick={() => setNotificationsOpen((open) => !open)} aria-label={pendingCount ? `Notifications, ${pendingCount} pending` : "Notifications"} aria-expanded={notificationsOpen}>
          <BellIcon />{pendingCount ? <span className="notification-dot" aria-hidden="true" /> : null}
        </button>
        {notificationsOpen ? <section className="header-popover notification-popover" aria-label="Notifications">
          <div className="popover-heading"><div><p className="micro-label">Your next steps</p><h2>Notifications</h2></div>{pendingCount ? <span className="notification-count">{pendingCount} pending</span> : null}</div>
          {!pendingCount ? <div className="notification-empty"><span aria-hidden="true">✓</span><p>You're all caught up.</p></div> : <div className="notification-list">{props.notifications.map((item) => <article className="notification-item" key={item.id}>
            <span className="notification-item-mark" aria-hidden="true" /><div className="notification-item-copy"><h3>{item.title}</h3><p>{item.message}</p></div>
            <button className="notification-dismiss" type="button" onClick={item.onDismiss} aria-label={`Dismiss: ${item.title}`}>×</button>
            <button className="notification-action" type="button" onClick={() => { item.onAction(); setNotificationsOpen(false); }}>{item.actionLabel}<span aria-hidden="true">→</span></button>
            {item.onSnooze ? <button className="notification-snooze" type="button" onClick={item.onSnooze}>Remind me in a week</button> : null}
          </article>)}</div>}
          <p className="popover-footnote">The red dot stays until you complete, snooze, or dismiss an item.</p>
        </section> : null}
      </div>
      <button className="header-add-button" type="button" onClick={props.onAddSnapshot}>Add snapshot <span aria-hidden="true">＋</span></button>
    </div>
  </header>;
}

function PeriodControl({ period, onChange }: { period: AnalyticsPeriod; onChange: (period: AnalyticsPeriod) => void }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const fromBtnRef = useRef<HTMLButtonElement>(null);
  const toBtnRef = useRef<HTMLButtonElement>(null);
  const [customFrom, setCustomFrom] = useState(period.kind === "custom" ? period.from : "");
  const [customTo, setCustomTo] = useState(period.kind === "custom" ? period.to : "");
  const [pickingDate, setPickingDate] = useState<"from" | "to" | null>(null);

  useEffect(() => {
    if (period.kind === "custom") {
      setCustomFrom(period.from);
      setCustomTo(period.to);
    }
  }, [period]);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if ((event.target as HTMLElement)?.closest?.(".date-picker-modal-card")) return;
      if (!anchorRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pickingDate) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open, pickingDate]);

  const activeLabel =
    period.kind === "preset"
      ? PERIOD_PRESETS.find((p) => p.key === period.range)?.label || "Period"
      : period.from && period.to
      ? `${formatDateLabel(period.from, false)} – ${formatDateLabel(period.to, false)}`
      : "Custom range";

  return (
    <div className="global-period-control" ref={anchorRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="apple-period-trigger-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span>{activeLabel}</span>
        <span className="apple-period-chevron" aria-hidden="true">▾</span>
      </button>

      {open ? (
        <div className="apple-period-popover" role="dialog" aria-label="Select analytics period">
          {PERIOD_PRESETS.map((preset) => {
            const isSelected = period.kind === "preset" && period.range === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                className={`apple-period-item ${isSelected ? "is-selected" : ""}`}
                onClick={() => {
                  onChange({ kind: "preset", range: preset.key });
                  setOpen(false);
                }}
              >
                <span>{preset.label}</span>
                {isSelected ? <span className="apple-period-check" aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
          <div className="apple-period-divider" />
          <div className="apple-period-custom-header">Custom range</div>
          <div className="apple-period-custom-row">
            <button
              ref={fromBtnRef}
              type="button"
              className="apple-period-date-btn"
              onClick={() => setPickingDate("from")}
            >
              {customFrom ? formatDateLabel(customFrom, false) : "Start date"}
            </button>
            <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>→</span>
            <button
              ref={toBtnRef}
              type="button"
              className="apple-period-date-btn"
              onClick={() => setPickingDate("to")}
            >
              {customTo ? formatDateLabel(customTo, false) : "End date"}
            </button>
          </div>
          <button
            type="button"
            className="apple-period-apply-btn"
            disabled={!customFrom || !customTo || customFrom > customTo}
            onClick={() => {
              if (customFrom && customTo && customFrom <= customTo) {
                onChange({ kind: "custom", from: customFrom, to: customTo });
                setOpen(false);
              }
            }}
          >
            Apply range
          </button>
          <p className="apple-period-footnote">Custom ranges re-anchor metrics to the nearest snapshots.</p>
        </div>
      ) : null}

      <DatePickerModal
        open={pickingDate === "from"}
        value={customFrom || new Date().toISOString().slice(0, 10)}
        anchorEl={fromBtnRef.current}
        onSelect={(val) => {
          setCustomFrom(val);
          setPickingDate(null);
        }}
        onClose={() => setPickingDate(null)}
      />

      <DatePickerModal
        open={pickingDate === "to"}
        value={customTo || new Date().toISOString().slice(0, 10)}
        anchorEl={toBtnRef.current}
        onSelect={(val) => {
          setCustomTo(val);
          setPickingDate(null);
        }}
        onClose={() => setPickingDate(null)}
      />
    </div>
  );
}

function BellIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
