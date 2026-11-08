import { useRef, useEffect, useState, useCallback } from "react";
import type { RangeKey, TabKey } from "../lib/types";
import { RANGE_OPTIONS } from "../utils/config";

interface ControlBarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  selectedRange: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  isPrivateMode: boolean;
  onTogglePrivate: () => void;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  onSave: () => void;
  onLoad: () => void;
  onSystemLoad: () => void;
}

const TABS: Array<{ key: TabKey; label: string; icon: JSX.Element }> = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    )
  },
  {
    key: "history",
    label: "History",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  }
];

/* ── Sliding Pill Container ──────────────────────────────
   Renders buttons with a shared sliding background that
   animates left/right when the active index changes.       */
interface PillGroupProps {
  children: (props: {
    registerBtn: (idx: number, el: HTMLButtonElement | null) => void;
  }) => React.ReactNode;
  activeIndex: number;
  pillClassName?: string;
  trackClassName?: string;
}

function PillGroup({ children, activeIndex, pillClassName = "", trackClassName = "" }: PillGroupProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const track = trackRef.current;
    const btn = buttons.current[activeIndex];
    if (!track || !btn) return;
    const tRect = track.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setPill({ left: bRect.left - tRect.left, width: bRect.width });
  }, [activeIndex]);

  useEffect(() => { measure(); }, [measure]);

  // Measure after first layout
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    requestAnimationFrame(() => { measure(); });
  }, [measure]);

  return (
    <div ref={trackRef} className={`relative flex items-center gap-1 ${trackClassName}`}>
      {/* Sliding background */}
      <div
        className={`absolute inset-y-1 rounded-full bg-primary transition-[left,width] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${pillClassName}`}
        style={{ left: pill.left, width: pill.width }}
      />
      {children({
        registerBtn: (idx, el) => { buttons.current[idx] = el; }
      })}
    </div>
  );
}

export function ControlBar(props: ControlBarProps) {
  const tabIdx = TABS.findIndex((t) => t.key === props.activeTab);
  const rangeIdx = RANGE_OPTIONS.findIndex((o) => o.key === props.selectedRange);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="glass-glance flex items-center gap-2.5 rounded-full px-3 py-2.5">

        {/* ── Tabs: sliding background ──────────────────── */}
        <PillGroup
          activeIndex={tabIdx}
          trackClassName="pr-2 mr-2 border-r border-white/10 dark:border-white/5"
        >
          {({ registerBtn }) =>
            TABS.map((tab, idx) => (
              <button
                key={tab.key}
                ref={(el) => registerBtn(idx, el)}
                onClick={() => props.onTabChange(tab.key)}
                className={`relative z-10 flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium transition-colors duration-200 ${
                  tabIdx === idx
                    ? "text-primary-foreground"
                    : "text-muted-foreground/70 hover:text-foreground"
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))
          }
        </PillGroup>

        {/* Divider */}
        <div className="mx-1 h-7 w-px bg-border/60" />

        {/* ── Range Selector: sliding background ────────── */}
        <PillGroup
          activeIndex={rangeIdx}
          trackClassName="pr-2 mr-2 border-r border-white/10 dark:border-white/5"
        >
          {({ registerBtn }) =>
            RANGE_OPTIONS.map((opt, idx) => (
              <button
                key={opt.key}
                ref={(el) => registerBtn(idx, el)}
                onClick={() => props.onRangeChange(opt.key)}
                className={`relative z-10 rounded-full px-3 py-2 text-[11px] font-medium transition-colors duration-200 ${
                  rangeIdx === idx
                    ? "text-primary-foreground"
                    : "text-muted-foreground/70 hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))
          }
        </PillGroup>

        {/* Action Icons */}
        <div className="flex items-center gap-0.5 px-1">
          <button className="btn-icon" onClick={props.onTogglePrivate} title={props.isPrivateMode ? "Show Data" : "Hide Data"}>
            {props.isPrivateMode ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.97 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>

          <button className="btn-icon" onClick={props.onToggleTheme} title="Toggle Appearance">
            {props.themeMode === "dark" ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 18v1m9-11h1M3 12h1m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <div className="mx-1 h-4 w-[1px] bg-border/50" />

          <button className="btn-icon" onClick={props.onLoad} title="Sync with data.json">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button className="btn-icon" onClick={props.onSystemLoad} title="Open Local File">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>
        </div>

        <button
          className="ml-1.5 rounded-full bg-primary px-5 py-2.5 text-[12px] font-medium text-primary-foreground shadow-lg transition-all hover:opacity-90 active:scale-95"
          onClick={props.onSave}
        >
          Save
        </button>
      </div>
    </div>
  );
}
