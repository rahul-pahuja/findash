import { useState, type ReactNode } from "react";
import type { TabKey } from "../lib/types";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
}

interface Props {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onAddSnapshot: () => void;
  isPrivateMode: boolean;
  onTogglePrivate: () => void;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  onSave: () => void;
  onLoad: () => void;
  onSystemLoad: () => void;
  statusText: string;
  fileUpdated?: string;
  notifications: NotificationItem[];
}

const navigation: Array<{ key: TabKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "history", label: "Snapshots" },
  { key: "analytics", label: "Analytics" }
];

export function AppHeader(props: Props) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const pendingCount = props.notifications.length;
  const status = props.statusText.toLowerCase();
  const statusClass = ["synced", "saved to file", "loaded from file"].includes(status)
    ? "is-ready"
    : ["offline", "load failed", "out of sync"].includes(status) ? "is-error" : "";

  return (
    <header className="app-header">
      <a className="brand-lockup" href="#dashboard" onClick={(event) => { event.preventDefault(); props.onTabChange("dashboard"); }} aria-label="FinDash dashboard">
        <span className="brand-mark" aria-hidden="true"><i /><i /></span>
        <span>FinDash</span>
      </a>

      <nav className="primary-navigation" aria-label="Main navigation">
        {navigation.map((item) => (
          <button
            key={item.key}
            className={`primary-navigation-item${props.activeTab === item.key ? " is-active" : ""}`}
            type="button"
            aria-current={props.activeTab === item.key ? "page" : undefined}
            onClick={() => props.onTabChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="header-actions">
        <div className="header-popover-anchor">
          <button
            className="header-icon-button notification-trigger"
            type="button"
            aria-label={pendingCount ? `Notifications, ${pendingCount} pending` : "Notifications"}
            aria-expanded={notificationsOpen}
            onClick={() => { setNotificationsOpen((open) => !open); setDataMenuOpen(false); }}
          >
            <BellIcon />
            {pendingCount > 0 ? <span className="notification-dot" aria-hidden="true" /> : null}
          </button>
          {notificationsOpen ? (
            <section className="header-popover notification-popover" aria-label="Notifications">
              <div className="popover-heading">
                <div><p className="micro-label">Your next steps</p><h2>Notifications</h2></div>
                {pendingCount > 0 ? <span className="notification-count">{pendingCount} pending</span> : null}
              </div>
              {pendingCount === 0 ? (
                <div className="notification-empty"><span aria-hidden="true">✓</span><p>You're all caught up.</p></div>
              ) : (
                <div className="notification-list">
                  {props.notifications.map((item) => (
                    <article className="notification-item" key={item.id}>
                      <span className="notification-item-mark" aria-hidden="true" />
                      <div className="notification-item-copy"><h3>{item.title}</h3><p>{item.message}</p></div>
                      <button className="notification-dismiss" type="button" onClick={item.onDismiss} aria-label={`Dismiss: ${item.title}`}>×</button>
                      <button className="notification-action" type="button" onClick={() => { item.onAction(); setNotificationsOpen(false); }}>{item.actionLabel}<span aria-hidden="true">→</span></button>
                    </article>
                  ))}
                </div>
              )}
              <p className="popover-footnote">Only actions you can take show a pending dot.</p>
            </section>
          ) : null}
        </div>

        <button
          className={`header-icon-button${props.isPrivateMode ? " is-selected" : ""}`}
          type="button"
          onClick={props.onTogglePrivate}
          title={props.isPrivateMode ? "Show values" : "Hide values"}
          aria-label={props.isPrivateMode ? "Show financial values" : "Hide financial values"}
        >
          <EyeIcon hidden={props.isPrivateMode} />
        </button>

        <button className="header-add-button" type="button" onClick={props.onAddSnapshot}>
          Add snapshot <span aria-hidden="true">＋</span>
        </button>

        <div className="header-popover-anchor">
          <button
            className="header-more-button"
            type="button"
            aria-label="Data and appearance settings"
            aria-expanded={dataMenuOpen}
            onClick={() => { setDataMenuOpen((open) => !open); setNotificationsOpen(false); }}
          >
            <MoreIcon />
          </button>
          {dataMenuOpen ? (
            <section className="header-popover data-popover" aria-label="Data and appearance">
              <div className="data-status-line" role="status" aria-live="polite">
                <span className={`status-indicator ${statusClass}`} />
                <span>{props.statusText}</span>
                {props.fileUpdated ? <time>{new Date(props.fileUpdated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time> : null}
              </div>
              <button className="mobile-menu-item" type="button" onClick={() => { props.onAddSnapshot(); setDataMenuOpen(false); }}><ActionIcon><PlusIcon /></ActionIcon><span>Add snapshot</span></button>
              <button className="mobile-menu-item" type="button" onClick={props.onTogglePrivate}><ActionIcon><EyeIcon hidden={props.isPrivateMode} /></ActionIcon><span>{props.isPrivateMode ? "Show values" : "Hide values"}</span></button>
              <button type="button" onClick={props.onSave}><ActionIcon><SaveIcon /></ActionIcon><span>Save data.json</span></button>
              <button type="button" onClick={props.onLoad}><ActionIcon><ReloadIcon /></ActionIcon><span>Reload data.json</span></button>
              <button type="button" onClick={props.onSystemLoad}><ActionIcon><UploadIcon /></ActionIcon><span>Import JSON</span></button>
              <div className="popover-divider" />
              <button type="button" onClick={props.onToggleTheme}><ActionIcon>{props.themeMode === "dark" ? "☼" : "◐"}</ActionIcon><span>Use {props.themeMode === "dark" ? "light" : "dark"} appearance</span></button>
            </section>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ActionIcon({ children }: { children: ReactNode }) {
  return <span className="data-action-icon" aria-hidden="true">{children}</span>;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden
    ? <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.3A10.7 10.7 0 0 1 12 5c4.5 0 8.3 2.9 9.5 7-.4 1.3-1.1 2.5-2.1 3.4M6.2 6.2A10.5 10.5 0 0 0 2.5 12c1.2 4.1 5 7 9.5 7 1 0 2-.2 2.9-.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.2-7 9.5-7 9.5 7 9.5 7-3.2 7-9.5 7-9.5-7-9.5-7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.7" /></svg>;
}

function MoreIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>;
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function SaveIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4h12l3 3v13H4V4h1Zm3 0v6h8V4M8 20v-7h8v7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
}

function ReloadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.8 9a7 7 0 0 1 11.7-2L20 9M4 15l2.5 2a7 7 0 0 0 11.7-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function UploadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 14v5h14v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
