import { useState } from "react";
import type { RangeKey } from "../lib/types";
import type { AnalyticsPeriod } from "../utils/router";
import { RANGE_OPTIONS } from "../utils/config";
import { SelectControl } from "./FormControls";

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

export function AppHeader(props: Props) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const pendingCount = props.notifications.length;
  return <header className="page-toolbar">
    <div className="page-toolbar-title"><h1>{props.title}</h1><p>{props.subtitle}</p></div>
    <div className="toolbar-actions">
      {props.period && props.onPeriodChange ? <PeriodControl period={props.period} onChange={props.onPeriodChange} /> : null}
      <div className="toolbar-popover-anchor">
        <button className="toolbar-icon-button" type="button" onClick={() => setNotificationsOpen((open) => !open)} aria-label={pendingCount ? `Notifications, ${pendingCount} pending` : "Notifications"} aria-expanded={notificationsOpen}>
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
  const selectedRange = period.kind === "preset" ? period.range : "CUSTOM";
  return <div className="global-period-control" aria-label="Analytics period">
    <SelectControl aria-label="Analytics date range" wrapperClassName="global-period-select-wrap" className="global-period-select" value={selectedRange} onChange={(event) => {
      if (event.target.value === "CUSTOM") onChange({ kind: "custom", from: period.kind === "custom" ? period.from : "", to: period.kind === "custom" ? period.to : "" });
      else onChange({ kind: "preset", range: event.target.value as RangeKey });
    }} options={[...RANGE_OPTIONS.map((option) => ({ value: option.key, label: option.label })), { value: "CUSTOM", label: "Custom dates" }]} />
    {period.kind === "custom" ? <span className="custom-date-fields"><input type="date" value={period.from} max={period.to || undefined} aria-label="Start date" onChange={(event) => onChange({ ...period, from: event.target.value })} /><input type="date" value={period.to} min={period.from || undefined} aria-label="End date" onChange={(event) => onChange({ ...period, to: event.target.value })} /></span> : null}
  </div>;
}

function BellIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
