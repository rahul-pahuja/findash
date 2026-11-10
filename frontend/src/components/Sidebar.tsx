import { useRef, useState } from "react";
import type { AppPage } from "../utils/router";

interface Props {
  page: AppPage;
  navigate: (path: string) => void;
  onAdd: () => void;
  privateMode: boolean;
  onTogglePrivate: () => void;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  statusText: string;
  isDirty: boolean;
  savedAt?: string;
  onSave: () => void;
  onReload: () => void;
  onImport: () => void;
  onExport: () => void;
}

const pages = [
  { path: "/", label: "Dashboard", icon: "dashboard", pages: ["dashboard"] },
  { path: "/snapshots", label: "Snapshots", icon: "snapshots", pages: ["snapshots"] },
  { path: "/analytics/overview", label: "Analytics", icon: "analytics", pages: ["analytics-overview", "analytics-investments"] },
  { path: "/plan", label: "Plan", icon: "plan", pages: ["plan"] }
] as const;

type IconName = "dashboard" | "snapshots" | "analytics" | "plan" | "save" | "reload" | "import" | "export" | "hide" | "show" | "sun" | "moon" | "settings";

function NavIcon({ name }: { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "dashboard": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m4 10 8-6.5 8 6.5v9.5h-6v-6h-4v6H4z" /></svg>;
    case "snapshots": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 1.9" /></svg>;
    case "analytics": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M3.5 19.5h17" /><path d="m5 16 4-4.2 3.5 2.5 6.5-7.1" /><path d="M15.8 7.2H19v3.2" /></svg>;
    case "plan": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.3" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
    case "save": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M4.5 4.5h12l3 3v12h-15z" /><path d="M8 4.8v5.5h8V5" /><path d="M8 19.2v-5.5h8v5.5" /></svg>;
    case "reload": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M19.2 9A7.5 7.5 0 0 0 6 6.4L4.3 8" /><path d="M4.4 4.5V8h3.5" /><path d="M4.8 15a7.5 7.5 0 0 0 13.2 2.6l1.7-1.6" /><path d="M19.6 19.5V16h-3.5" /></svg>;
    case "import": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M4 14.5v4.8h16v-4.8" /><path d="M12 4v11" /><path d="m7.8 11 4.2 4.2 4.2-4.2" /></svg>;
    case "export": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M4 14.5v4.8h16v-4.8" /><path d="M12 15V4" /><path d="m7.8 8.2 4.2-4.2 4.2 4.2" /></svg>;
    case "hide": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.7" /></svg>;
    case "show": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6.3 0 9.5 6 9.5 6a15.5 15.5 0 0 1-3.1 3.7M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.2 6 9.5 6c1.4 0 2.6-.3 3.7-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
    case "sun": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.4 4.4l1.4 1.4m12.4 12.4 1.4 1.4M2.5 12h2m15 0h2M4.4 19.6l1.4-1.4M18.2 5.8l1.4-1.4" /></svg>;
    case "moon": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M19.8 15.1A8.5 8.5 0 0 1 8.9 4.2 8.5 8.5 0 1 0 19.8 15.1Z" /></svg>;
    case "settings": return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M9.5 3.5h5l.7 2.3c.7.2 1.3.5 1.8.9l2.2-.7 2.5 4.3-1.7 1.7a7 7 0 0 1 0 2l1.7 1.7-2.5 4.3-2.2-.7c-.5.4-1.1.7-1.8.9l-.7 2.3h-5l-.7-2.3c-.7-.2-1.3-.5-1.8-.9l-2.2.7-2.5-4.3L4 14a7 7 0 0 1 0-2l-1.7-1.7 2.5-4.3 2.2.7c.5-.4 1.1-.7 1.8-.9z" /><circle cx="12" cy="13" r="2.8" /></svg>;
  }
}

function RailAction({ label, icon, onClick, className = "", pressed, status, current }: { label: string; icon: IconName; onClick: () => void; className?: string; pressed?: boolean; status?: "saved" | "dirty"; current?: boolean }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const timer = useRef<number | undefined>();
  const show = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setTooltipOpen(true), 150); };
  const hide = () => { window.clearTimeout(timer.current); setTooltipOpen(false); };
  const tooltip = <span className={`rail-tooltip${tooltipOpen ? " is-open" : ""}`} role="tooltip">{label}</span>;
  return <button className={`rail-action ${className}${status ? ` is-${status}` : ""}${current ? " is-active" : ""}`} type="button" aria-label={label} aria-pressed={pressed} aria-current={current ? "page" : undefined} onClick={onClick} onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide} onKeyDown={(event) => { if (event.key === "Escape") hide(); }}>
    <span className="rail-action-icon"><NavIcon name={icon} /></span>
    {status ? <span className="rail-save-dot" aria-hidden="true" /> : null}
    {tooltip}
  </button>;
}

export function Sidebar({ page, navigate, onAdd, privateMode, onTogglePrivate, themeMode, onToggleTheme, statusText, isDirty, savedAt, onSave, onReload, onImport, onExport }: Props) {
  const active = (routePages: readonly string[]) => routePages.includes(page);
  const savedTime = savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const saveTooltip = isDirty ? "Unsaved changes · Save ⌘S" : savedTime ? `Saved at ${savedTime} · Save ⌘S` : statusText === "Offline" ? "Saved on this device · Save ⌘S" : "Saved · Save ⌘S";

  return <>
    <aside className="app-sidebar" aria-label="Primary navigation">
      <button className="rail-brand" type="button" aria-label="FinDash dashboard" onClick={() => navigate("/")}><span className="brand-mark"><i /><i /></span></button>
      <nav className="rail-capsule rail-navigation" aria-label="Pages">
        {pages.map((item) => <RailAction key={item.path} label={item.label} icon={item.icon} onClick={() => navigate(item.path)} current={active(item.pages)} className="rail-page-action" />)}
      </nav>
      <nav className="rail-capsule rail-data-actions" aria-label="JSON file controls">
        <RailAction label={saveTooltip} icon="save" onClick={onSave} status={isDirty ? "dirty" : "saved"} className="rail-save-action" />
        <RailAction label="Reload saved data" icon="reload" onClick={onReload} />
        <RailAction label="Import JSON" icon="import" onClick={onImport} />
        <RailAction label="Export JSON" icon="export" onClick={onExport} />
      </nav>
      <nav className="rail-capsule rail-app-actions" aria-label="App">
        <RailAction label={privateMode ? "Show amounts" : "Hide amounts"} icon={privateMode ? "show" : "hide"} onClick={onTogglePrivate} pressed={privateMode} />
        <RailAction label={themeMode === "dark" ? "Use light appearance" : "Use dark appearance"} icon={themeMode === "dark" ? "sun" : "moon"} onClick={onToggleTheme} pressed={themeMode === "dark"} />
        <RailAction label="Settings" icon="settings" onClick={() => navigate("/settings")} current={page === "settings"} className="rail-settings-link" />
      </nav>
    </aside>
    <nav className="mobile-navigation" aria-label="Primary navigation">
      {[pages[0], pages[1]].map((item) => <button key={item.path} className={`mobile-nav-link${active(item.pages) ? " is-active" : ""}`} type="button" aria-label={item.label} aria-current={active(item.pages) ? "page" : undefined} onClick={() => navigate(item.path)}><NavIcon name={item.icon} /><small>{item.label}</small></button>)}
      <button className="mobile-nav-add" type="button" onClick={onAdd} aria-label="Add snapshot"><span aria-hidden="true">＋</span><small>Add</small></button>
      {[pages[2], pages[3]].map((item) => <button key={item.path} className={`mobile-nav-link${active(item.pages) ? " is-active" : ""}`} type="button" aria-label={item.label} aria-current={active(item.pages) ? "page" : undefined} onClick={() => navigate(item.path)}><NavIcon name={item.icon} /><small>{item.label}</small></button>)}
    </nav>
  </>;
}
