import type { ReactNode } from "react";
import type { TabKey } from "../lib/types";

interface SidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const navigation: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3.5 10.5 8.5-7 8.5 7v9a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1v-9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
  },
  {
    key: "history",
    label: "Snapshots",
    icon: <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.35-5.66L4 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 4v5h5m3-1v4l2.8 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 19V5m0 14h16M7.5 15l3.1-4 3 2.1 5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M15.5 7h3.2v3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="app-sidebar" aria-label="Main navigation">
      <a className="brand-lockup" href="#dashboard" onClick={(event) => { event.preventDefault(); onTabChange("dashboard"); }} aria-label="FinDash dashboard">
        <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path d="M4.5 10.5 14 6l12.2 7.4 7.3-4.2 1.6 5.5-9 5.1-12.2-7.4-7.8 3.8-1.6-5.7Z" fill="currentColor" />
          <path d="m5.2 21 8.9-4.3 12.3 7.5 7.4-4.3 1.3 5.8-8.9 5.1-12.3-7.5-7 3.4-1.7-5.7Z" fill="currentColor" />
        </svg>
        <span>Fin<span className="brand-light">Dash</span></span>
      </a>

      <p className="sidebar-caption">Personal finance</p>
      <nav className="sidebar-nav">
        {navigation.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-link ${activeTab === item.key ? "is-active" : ""}`}
            aria-current={activeTab === item.key ? "page" : undefined}
            onClick={() => onTabChange(item.key)}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
