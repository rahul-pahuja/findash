import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader, type NotificationItem } from "./components/AppHeader";
import { Dashboard } from "./components/Dashboard";
import { DataEntryModal } from "./components/DataEntryModal";
import { Sidebar } from "./components/Sidebar";
import { StatusBanner } from "./components/StatusBanner";
import { TableView, type SnapshotSortBy, type SortDirection } from "./components/TableView";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import type { ApiError, DataResponse, Dataset, Entry, RangeKey, XirrResponse } from "./lib/types";
import { buildLocalDataResponse } from "./utils/derive";
import { formatDateLabel, setNumberFormatPreference } from "./utils/format";
import { migrateDataset } from "./utils/migrateDataset";
import { getBigMoves, getMostRecentMissingMonth, selectPeriod } from "./utils/insights";
import { analyticsPeriodLabel, parseAnalyticsPeriod, resolveRoute, serializeAnalyticsPeriod, type AnalyticsPeriod, type AppPage } from "./utils/router";

const AnalyticsDashboard = lazy(() => import("./components/AnalyticsDashboard").then((module) => ({ default: module.AnalyticsDashboard })));
const PlanPage = lazy(() => import("./components/PlanPage").then((module) => ({ default: module.PlanPage })));
const SettingsPage = lazy(() => import("./components/SettingsPage").then((module) => ({ default: module.SettingsPage })));

const EMPTY_DATASET = migrateDataset({ entries: [], meta: { currency: "INR", created: "", last_updated: "" } });
const STORAGE_KEYS = { dataset: "findash.dataset", theme: "findash.theme", privacy: "findash.privacy", period: "findash.analyticsPeriod" };
type Banner = { kind: "info" | "error" | "success"; message: string };
type HistoryFilter = "all" | "notes" | "big-moves";

function normalizeDataset(dataset: unknown): Dataset { return migrateDataset(dataset); }
function storedPeriod(value: unknown): AnalyticsPeriod {
  if (value && typeof value === "object" && "kind" in value) return value as AnalyticsPeriod;
  if (typeof value === "string") return parseAnalyticsPeriod(`?range=${encodeURIComponent(value)}`);
  return { kind: "preset", range: "ALL" };
}
function titleFor(page: AppPage): [string, string] {
  if (page === "dashboard") return ["Dashboard", "A clear view of your latest snapshot"];
  if (page === "snapshots") return ["Snapshots", "Your wealth records, newest first"];
  if (page === "analytics-overview") return ["Analytics", "Overview · period comparison"];
  if (page === "analytics-investments") return ["Analytics", "Investments · portfolio performance"];
  if (page === "plan") return ["Plan", "Goals and personal finance assumptions"];
  if (page === "settings") return ["Settings", "Profile, privacy and data"];
  return ["Page not found", "This FinDash route does not exist"];
}
function pathForLanding(page: Dataset["settings"]["defaultLandingPage"]) {
  return page === "dashboard" ? "/" : page === "snapshots" ? "/snapshots" : page === "plan" ? "/plan" : "/analytics/overview";
}
function monthName(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export default function App() {
  const [datasetState, setDatasetState] = useLocalStorageState<Dataset>(STORAGE_KEYS.dataset, EMPTY_DATASET);
  const dataset = useMemo(() => normalizeDataset(datasetState), [datasetState]);
  const [themeMode, setThemeMode] = useLocalStorageState<"light" | "dark">(STORAGE_KEYS.theme, "light");
  const [isPrivateMode, setIsPrivateMode] = useLocalStorageState<boolean>(STORAGE_KEYS.privacy, dataset.settings.hideAmountsByDefault);
  const [storedPeriodValue, setStoredPeriod] = useLocalStorageState<AnalyticsPeriod>(STORAGE_KEYS.period, { kind: "preset", range: "ALL" });
  const [period, setPeriod] = useState<AnalyticsPeriod>(() => parseAnalyticsPeriod(window.location.search, storedPeriod(storedPeriodValue)));
  const [routePath, setRoutePath] = useState(() => window.location.pathname || "/");
  const route = resolveRoute(routePath);
  const [response, setResponse] = useState<DataResponse | null>(null);
  const [statusText, setStatusText] = useState("Ready");
  const [isDirty, setIsDirty] = useState(false);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [entryInitialDate, setEntryInitialDate] = useState<string | undefined>();
  const [activeEntry, setActiveEntry] = useState<Entry | null>(null);
  const [xirrLoading, setXirrLoading] = useState(false);
  const [xirrData, setXirrData] = useState<XirrResponse | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [snapshotSort, setSnapshotSort] = useState<SnapshotSortBy>("date");
  const [snapshotSortDirection, setSnapshotSortDirection] = useState<SortDirection>("desc");
  const [dashboardRange, setDashboardRange] = useState<RangeKey>("1Y");
  const [importPreview, setImportPreview] = useState<{ dataset: Dataset; fileName: string } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const xirrRequestRef = useRef(0);
  const scrollPositions = useRef<Record<string, number>>({});
  const datasetRef = useRef(dataset);
  datasetRef.current = dataset;

  const navigate = useCallback((path: string, replace = false) => {
    const isAnalytics = path.startsWith("/analytics");
    const next = isAnalytics ? `${path}?${serializeAnalyticsPeriod(period)}` : path;
    if (replace) window.history.replaceState({}, "", next);
    else window.history.pushState({}, "", next);
    setRoutePath(path);
  }, [period]);

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname || "/";
      setRoutePath(path);
      setPeriod(parseAnalyticsPeriod(window.location.search, storedPeriod(storedPeriodValue)));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [storedPeriodValue]);

  useEffect(() => {
    if (!route.redirect) return;
    navigate(route.redirect, true);
  }, [route.redirect, navigate]);

  useEffect(() => {
    setStoredPeriod(period);
    if (routePath.startsWith("/analytics")) window.history.replaceState({}, "", `${routePath}?${serializeAnalyticsPeriod(period)}`);
  }, [period, routePath, setStoredPeriod]);

  useEffect(() => {
    const saveScroll = () => { scrollPositions.current[routePath] = window.scrollY; };
    window.addEventListener("scroll", saveScroll, { passive: true });
    requestAnimationFrame(() => window.scrollTo(0, scrollPositions.current[routePath] ?? 0));
    return () => window.removeEventListener("scroll", saveScroll);
  }, [routePath]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const configured = dataset.settings.appearance;
      const next = configured === "auto" ? (media.matches ? "dark" : "light") : configured;
      setThemeMode(next);
    };
    syncTheme();
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, [dataset.settings.appearance, setThemeMode]);

  useEffect(() => {
    if (dataset.settings.hideAmountsByDefault) setIsPrivateMode(true);
  }, [dataset.settings.hideAmountsByDefault, setIsPrivateMode]);

  useEffect(() => {
    if (!dataset.settings.autoHideOnBlur) return;
    const onBlur = () => setIsPrivateMode(true);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [dataset.settings.autoHideOnBlur, setIsPrivateMode]);

  useEffect(() => { document.documentElement.classList.toggle("dark", themeMode === "dark"); }, [themeMode]);
  useEffect(() => { setNumberFormatPreference(dataset.settings.numberFormat); }, [dataset.settings.numberFormat]);
  useEffect(() => { document.title = isPrivateMode ? "FinDash · Values hidden" : "FinDash"; }, [isPrivateMode]);
  useEffect(() => { if (!banner) return; const timer = setTimeout(() => setBanner(null), 5000); return () => clearTimeout(timer); }, [banner]);
  useEffect(() => { if (JSON.stringify(datasetState) !== JSON.stringify(dataset)) setDatasetState(dataset); }, [dataset, datasetState, setDatasetState]);
  useEffect(() => { if (dataset.entries.length) setResponse(buildLocalDataResponse(dataset, "ALL", response?.sync ?? null)); }, [dataset]);

  useEffect(() => {
    if (routePath !== "/" || !dataset.entries.length) return;
    const defaultPath = pathForLanding(dataset.settings.defaultLandingPage);
    if (defaultPath !== "/") navigate(defaultPath, true);
  }, [routePath, dataset.entries.length, dataset.settings.defaultLandingPage, navigate]);

  useEffect(() => { void hydrate(); }, []);
  async function hydrate() {
    try {
      const backend = await fetch("/api/data?range=ALL").then((res) => res.json() as Promise<DataResponse>);
      const remoteDataset = normalizeDataset(backend.dataset);
      const localDataset = datasetRef.current;
      if (localDataset.entries.length > 0) {
        const isDifferent = JSON.stringify(localDataset) !== JSON.stringify(remoteDataset);
        setDatasetState(localDataset);
        setMismatch(isDifferent);
        setIsDirty(isDifferent);
        setStatusText(isDifferent ? "Unsaved changes" : "Saved");
        setResponse(buildLocalDataResponse(localDataset, "ALL", backend.sync));
      } else {
        setDatasetState(remoteDataset);
        setMismatch(false);
        setIsDirty(false);
        setStatusText("Saved");
        setResponse(buildLocalDataResponse(remoteDataset, "ALL", backend.sync));
      }
    } catch {
      setResponse(buildLocalDataResponse(datasetRef.current, "ALL", response?.sync ?? null));
      setStatusText("Offline");
      setBanner({ kind: "error", message: "Could not reach the local backend. The browser copy is still available." });
    }
  }

  async function handleSave() {
    try {
      const payload = normalizeDataset(datasetRef.current);
      const res = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const error = await res.json() as ApiError; throw new Error(error.error || "Failed to save dataset."); }
      const result = await res.json() as DataResponse;
      const savedDataset = normalizeDataset(result.dataset);
      setDatasetState(savedDataset);
      setResponse(buildLocalDataResponse(savedDataset, "ALL", result.sync));
      setMismatch(false); setIsDirty(false); setStatusText("Saved");
      setBanner({ kind: "success", message: "Saved snapshots and settings to data.json." });
    } catch (error) { setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed to save dataset." }); }
  }
  async function handleLoad() {
    if (isDirty) { setReloadConfirmOpen(true); return; }
    await reloadFromFile();
  }
  async function reloadFromFile() {
    try {
      setStatusText("Loading file…");
      const res = await fetch("/api/data?range=ALL");
      if (!res.ok) { const error = await res.json() as ApiError; throw new Error(error.error || "Failed to load dataset."); }
      const result = await res.json() as DataResponse;
      const loadedDataset = normalizeDataset(result.dataset);
      setDatasetState(loadedDataset); setResponse(buildLocalDataResponse(loadedDataset, "ALL", result.sync)); setMismatch(false); setIsDirty(false); setStatusText("Saved");
      setBanner({ kind: "info", message: "Reloaded snapshots and settings from data.json." });
    } catch (error) { setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed to load dataset." }); setStatusText("Load failed"); }
  }
  const handleSystemFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const input = event.target;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = normalizeDataset(JSON.parse(e.target?.result as string));
        setImportPreview({ dataset: imported, fileName: file.name });
      } catch (error) { setBanner({ kind: "error", message: error instanceof Error ? error.message : "Choose a valid FinDash JSON export." }); }
      finally { input.value = ""; }
    };
    reader.readAsText(file);
  };
  function confirmImport() {
    if (!importPreview) return;
    setDatasetState(importPreview.dataset);
    setResponse(buildLocalDataResponse(importPreview.dataset, "ALL", response?.sync ?? null));
    setMismatch(false); setIsDirty(true); setStatusText("Unsaved changes");
    setBanner({ kind: "success", message: "Imported and migrated the JSON data. Save to data.json to keep it." });
    setImportPreview(null);
  }
  function exportDataset() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(datasetRef.current, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "findash-data.json"; anchor.click(); URL.revokeObjectURL(url);
  }
  async function handleAnalyze() {
    const isPlan = routePath === "/plan";
    const isAnalytics = routePath === "/analytics/investments" || routePath === "/analytics/overview";
    if ((!isAnalytics && !isPlan) || !dataset.entries.length) {
      if (isPlan) { setXirrData(null); setXirrLoading(false); }
      return;
    }
    const id = ++xirrRequestRef.current;
    const selected = selectPeriod(dataset.entries, isPlan ? "ALL" : period);
    if (!selected.anchor || !selected.latest || selected.anchor.id === selected.latest.id) { setXirrData(null); setXirrLoading(false); return; }
    setXirrData(null);
    setXirrLoading(true);
    try {
      const query = new URLSearchParams({ range: "ALL", start: selected.anchor.date, end: selected.latest.date });
      const res = await fetch(`/api/xirr?${query}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dataset) });
      if (!res.ok) { const error = await res.json() as ApiError; throw new Error(error.error || "Failed to analyze returns."); }
      const result = await res.json() as XirrResponse;
      if (id === xirrRequestRef.current) setXirrData(result);
    } catch { if (id === xirrRequestRef.current) setBanner({ kind: "error", message: isPlan ? "Could not calculate the current overall return." : "Could not calculate returns for this period." }); }
    finally { if (id === xirrRequestRef.current) setXirrLoading(false); }
  }
  useEffect(() => { void handleAnalyze(); }, [routePath, period, dataset.entries]);

  const entries = dataset.entries;
  const orderedPlanEntries = useMemo(() => [...dataset.entries].sort((a, b) => a.date.localeCompare(b.date)), [dataset.entries]);
  const allTimeReturnMatches = xirrData?.marketPortfolio.startDate === orderedPlanEntries[0]?.date && xirrData?.marketPortfolio.endDate === orderedPlanEntries.at(-1)?.date;
  const currentOverallReturn = allTimeReturnMatches && !xirrLoading ? xirrData?.marketPortfolio.value ?? null : null;
  const missingMonth = useMemo(() => getMostRecentMissingMonth(entries), [entries]);
  const notificationPrefs = dataset.preferences?.notifications;
  const targetPromptSnoozed = notificationPrefs?.snoozedGoalPromptUntil && Date.parse(notificationPrefs.snoozedGoalPromptUntil) > Date.now();
  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    if (!dataset.goals.length && !notificationPrefs?.dismissedGoalPromptAt && !targetPromptSnoozed) items.push({
      id: "goal-setup", title: "Set a short-term target", message: "Add an amount and optional date in Plan to track progress.", actionLabel: "Set a target", onAction: () => navigate("/plan"),
      onDismiss: () => updateDataset((current) => ({ ...current, preferences: { version: 2, notifications: { ...current.preferences?.notifications, dismissedGoalPromptAt: new Date().toISOString() } } })),
      onSnooze: () => updateDataset((current) => ({ ...current, preferences: { version: 2, notifications: { ...current.preferences?.notifications, snoozedGoalPromptUntil: new Date(Date.now() + 7 * 86_400_000).toISOString() } } }))
    });
    if (missingMonth && notificationPrefs?.dismissedGapMonth !== missingMonth.key) items.push({
      id: `gap-${missingMonth.key}`, title: `No ${monthName(missingMonth.key)} snapshot recorded`, message: "Add a record for this month to fill in the timeline.", actionLabel: `Add ${monthName(missingMonth.key).split(" ")[0]}`,
      onAction: () => openNewSnapshot(missingMonth.suggestedDate),
      onDismiss: () => updateDataset((current) => ({ ...current, preferences: { version: 2, notifications: { ...current.preferences?.notifications, dismissedGapMonth: missingMonth.key } } }))
    });
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const latestDate = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? "";
    const latestMonth = latestDate.slice(0, 7);
    const afterReminderDay = today.getDate() >= dataset.settings.reminderDayOfMonth;
    if (entries.length > 0 && latestMonth !== currentMonth && afterReminderDay && (!missingMonth || notificationPrefs?.dismissedGapMonth === missingMonth.key) && notificationPrefs?.dismissedGapMonth !== currentMonth) items.push({
      id: `monthly-snapshot-${currentMonth}`, title: `Add a ${new Intl.DateTimeFormat("en-IN", { month: "long" }).format(today)} snapshot`, message: `Your preferred reminder day is the ${dataset.settings.reminderDayOfMonth}. Add this month's balances when ready.`, actionLabel: "Add snapshot", onAction: () => openNewSnapshot(`${currentMonth}-${String(today.getDate()).padStart(2, "0")}`),
      onDismiss: () => updateDataset((current) => ({ ...current, preferences: { version: 2, notifications: { ...current.preferences?.notifications, dismissedGapMonth: currentMonth } } }))
    });
    return items;
  }, [dataset.goals.length, dataset.settings.reminderDayOfMonth, entries, notificationPrefs, targetPromptSnoozed, missingMonth, navigate]);

  function updateDataset(update: (current: Dataset) => Dataset) {
    setDatasetState((current) => update(normalizeDataset(current)));
    setIsDirty(true);
    setStatusText("Unsaved changes");
  }
  function selectSnapshotSort(next: SnapshotSortBy) {
    if (snapshotSort === next) setSnapshotSortDirection((current) => current === "desc" ? "asc" : "desc");
    else { setSnapshotSort(next); setSnapshotSortDirection("desc"); }
  }
  function openNewSnapshot(date?: string) { setActiveEntry(null); setEntryInitialDate(date); setModalOpen(true); }
  function editSnapshot(entry: Entry) { setActiveEntry(entry); setEntryInitialDate(undefined); setModalOpen(true); }
  const unresolvedGap = missingMonth && notificationPrefs?.dismissedGapMonth !== missingMonth.key;
  const filteredSnapshots = useMemo(() => {
    if (historyFilter === "notes") return entries.filter((entry) => Boolean(entry.expenses_note.trim()));
    if (historyFilter === "big-moves") return getBigMoves(entries, 5).map((item) => item.entry);
    return entries;
  }, [entries, historyFilter]);
  const [title, defaultSubtitle] = titleFor(route.page);
  const orderedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const pageSubtitle = route.page.startsWith("analytics") ? `${route.page === "analytics-overview" ? "Overview" : "Investments"} · ${analyticsPeriodLabel(period)}`
    : route.page === "snapshots" && orderedEntries.length ? `${orderedEntries.length} records · ${formatDateLabel(orderedEntries[0].date, false)}–${formatDateLabel(orderedEntries.at(-1)!.date, false)}`
      : defaultSubtitle;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void handleSave(); return; }
      if (reloadConfirmOpen && event.key === "Escape") { setReloadConfirmOpen(false); return; }
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
      if (typing || modalOpen || importPreview || reloadConfirmOpen || helpOpen) return;
      if (event.key === "?") { event.preventDefault(); setHelpOpen(true); return; }
      if (event.key.toLowerCase() === "g") {
        const onNext = (next: KeyboardEvent) => {
          window.removeEventListener("keydown", onNext);
          const nextTarget = next.target;
          const nextIsTyping = nextTarget instanceof HTMLElement && (nextTarget.matches("input, textarea, select") || nextTarget.isContentEditable);
          if (nextIsTyping) return;
          if (next.key.toLowerCase() === "d") navigate("/");
          else if (next.key.toLowerCase() === "s") navigate("/snapshots");
          else if (next.key.toLowerCase() === "a") navigate("/analytics/overview");
          else if (next.key.toLowerCase() === "p") navigate("/plan");
        };
        window.addEventListener("keydown", onNext, { once: true });
        window.setTimeout(() => window.removeEventListener("keydown", onNext), 900);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, modalOpen, importPreview, reloadConfirmOpen, helpOpen]);

  return <div className="findash-app">
    <input id="system-file-input" type="file" accept=".json,application/json" className="visually-hidden" onChange={handleSystemFileLoad} />
    <Sidebar page={route.page} navigate={navigate} onAdd={() => openNewSnapshot()} privateMode={isPrivateMode} onTogglePrivate={() => setIsPrivateMode((current) => !current)} themeMode={themeMode} onToggleTheme={() => updateDataset((current) => ({ ...current, settings: { ...current.settings, appearance: themeMode === "dark" ? "light" : "dark" } }))} statusText={statusText} isDirty={isDirty} savedAt={response?.sync?.fileUpdated} onSave={() => void handleSave()} onReload={() => void handleLoad()} onImport={() => document.getElementById("system-file-input")?.click()} onExport={exportDataset} />
    <div className="app-main-column">
      <AppHeader title={title} subtitle={pageSubtitle} onAddSnapshot={() => openNewSnapshot()} notifications={notifications} period={route.page.startsWith("analytics") ? period : undefined} onPeriodChange={(next) => setPeriod(next)} />
      <main className="page-main">
        {!response && statusText !== "Offline" ? <div className="page-empty-state"><h2>Preparing your dashboard</h2><p>Loading your latest snapshot.</p></div> : null}
        {route.page === "dashboard" && response ? <Dashboard response={response} masked={isPrivateMode} themeMode={themeMode} onOpenHistory={() => navigate("/snapshots")} onOpenPlan={() => navigate("/plan")} onEdit={editSnapshot} chartRange={dashboardRange} onChartRangeChange={setDashboardRange} /> : null}
        {route.page === "snapshots" ? <div className="history-page page-enter">
          {unresolvedGap ? <aside className="gap-callout"><span><strong>No {monthName(missingMonth!.key)} snapshot recorded.</strong> Add one if you want to fill in this month.</span><button type="button" onClick={() => openNewSnapshot(missingMonth!.suggestedDate)}>Add {monthName(missingMonth!.key).split(" ")[0]}</button></aside> : null}
          <div className="snapshot-controls-row">
            <div className="snapshot-filters" role="tablist" aria-label="Filter snapshots">{(["all", "notes", "big-moves"] as const).map((filter) => <button key={filter} className={historyFilter === filter ? "is-selected" : ""} type="button" role="tab" aria-selected={historyFilter === filter} onClick={() => setHistoryFilter(filter)}>{filter === "all" ? "All" : filter === "notes" ? "With notes" : "Big moves"}</button>)}</div>
            <div className="snapshot-sort-control" role="group" aria-label="Sort snapshots">
              <span>Sort by</span>
              {([ ["date", "Date"], ["change", "₹ change"], ["percent", "% change"] ] as Array<[SnapshotSortBy, string]>).map(([key, label]) => <button key={key} type="button" className={snapshotSort === key ? "is-selected" : ""} aria-pressed={snapshotSort === key} aria-label={`Sort by ${label}${snapshotSort === key ? `, ${snapshotSortDirection === "desc" ? "descending" : "ascending"}` : ""}`} onClick={() => selectSnapshotSort(key)}>{label}{snapshotSort === key ? <span aria-hidden="true">{snapshotSortDirection === "desc" ? " ↓" : " ↑"}</span> : null}</button>)}
            </div>
          </div>
          <div className="history-table-toolbar"><div><h2>{historyFilter === "big-moves" ? "Top 5 moves" : historyFilter === "notes" ? "Snapshots with notes" : "All snapshots"}</h2><p>{historyFilter === "big-moves" ? "Ranked by absolute percentage change from the previous snapshot." : "Change and return use the immediately prior saved snapshot."}</p></div><span>{filteredSnapshots.length} records</span></div>
          <TableView entries={filteredSnapshots} allEntries={entries} masked={isPrivateMode} sortBy={snapshotSort} sortDirection={snapshotSortDirection} onEdit={editSnapshot} />
        </div> : null}
        {route.page.startsWith("analytics") ? <Suspense fallback={<div className="page-loading">Loading analytics…</div>}><AnalyticsDashboard response={response} returns={xirrData} returnsLoading={xirrLoading} masked={isPrivateMode} themeMode={themeMode} period={period} section={route.page === "analytics-overview" ? "overview" : "investments"} onSectionChange={(section) => navigate(`/analytics/${section}`)} /></Suspense> : null}
        {route.page === "plan" ? <Suspense fallback={<div className="page-loading">Loading plan…</div>}><PlanPage dataset={dataset} masked={isPrivateMode} overallReturn={currentOverallReturn} overallReturnLoading={routePath === "/plan" && xirrLoading} onChange={(next) => updateDataset(() => next)} /></Suspense> : null}
        {route.page === "settings" ? <Suspense fallback={<div className="page-loading">Loading settings…</div>}><SettingsPage dataset={dataset} onChange={(next) => updateDataset(() => next)} onSave={() => void handleSave()} onReload={() => void handleLoad()} onImport={() => document.getElementById("system-file-input")?.click()} onExport={exportDataset} statusText={statusText} isDirty={isDirty} fileUpdated={response?.sync?.fileUpdated} privateMode={isPrivateMode} onTogglePrivate={() => setIsPrivateMode((current) => !current)} /></Suspense> : null}
        {route.page === "not-found" ? <div className="page-empty-state"><h2>We couldn't find that page.</h2><button className="primary-action" type="button" onClick={() => navigate("/")}>Go to dashboard</button></div> : null}
      </main>
    </div>
    {banner ? <StatusBanner kind={banner.kind} message={banner.message} onDismiss={() => setBanner(null)} /> : null}
    {mismatch ? <StatusBanner kind="info" message="Unsaved changes are on this device. Save them to data.json or reload the file." onDismiss={() => setMismatch(false)} /> : null}
    {reloadConfirmOpen ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReloadConfirmOpen(false); }}><section className="import-preview-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reload-confirm-title"><button className="dialog-close" type="button" onClick={() => setReloadConfirmOpen(false)} aria-label="Close">×</button><p className="section-eyebrow">Reload data.json</p><h2 id="reload-confirm-title">Replace unsaved changes?</h2><p className="import-preview-file">Reloading replaces the current browser copy with the saved data.json file.</p><div className="import-preview-actions"><button className="quiet-button" type="button" onClick={() => setReloadConfirmOpen(false)}>Cancel</button><button className="primary-action" type="button" onClick={() => { setReloadConfirmOpen(false); void reloadFromFile(); }}>Reload file</button></div></section></div> : null}
    <DataEntryModal open={modalOpen} entry={activeEntry} initialDate={entryInitialDate} masked={isPrivateMode} entries={dataset.entries} onClose={() => setModalOpen(false)} onSave={(entry) => {
      if (activeEntry && dataset.entries.some((item) => item.id !== activeEntry.id && item.date === entry.date)) {
        setBanner({ kind: "error", message: `A snapshot already exists for ${entry.date}. Choose another date.` });
        return;
      }
      updateDataset((current) => {
        const nextEntries = [...current.entries];
        const index = nextEntries.findIndex((item) => item.id === (activeEntry?.id ?? entry.id));
        const normalizedEntry = { ...entry, id: entry.date };
        if (index >= 0) nextEntries[index] = normalizedEntry; else nextEntries.push(normalizedEntry);
        nextEntries.sort((a, b) => a.date.localeCompare(b.date));
        return { ...current, entries: nextEntries, meta: { ...current.meta, currency: "INR", last_updated: new Date().toISOString().slice(0, 10) } };
      });
      setBanner({ kind: "success", message: `Updated snapshot for ${entry.date}. Save to data.json to keep it.` });
      setModalOpen(false);
    }} />
    {importPreview ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setImportPreview(null); }}><section className="import-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="import-preview-title"><button className="dialog-close" type="button" onClick={() => setImportPreview(null)} aria-label="Close">×</button><p className="section-eyebrow">Import preview</p><h2 id="import-preview-title">{isDirty ? "Replace unsaved changes?" : "Import this file?"}</h2><p className="import-preview-file">{importPreview.fileName}</p><dl><div><dt>Snapshots</dt><dd>{importPreview.dataset.entries.length}</dd></div><div><dt>Date range</dt><dd>{importPreview.dataset.entries.length ? `${formatDateLabel([...importPreview.dataset.entries].sort((a,b) => a.date.localeCompare(b.date))[0].date, false)} – ${formatDateLabel([...importPreview.dataset.entries].sort((a,b) => a.date.localeCompare(b.date)).at(-1)!.date, false)}` : "No snapshots"}</dd></div></dl><p>{isDirty ? "This will replace unsaved changes on this device." : "This replaces the current browser copy."}</p><div className="import-preview-actions"><button className="quiet-button" type="button" onClick={() => setImportPreview(null)}>Cancel</button><button className="primary-action" type="button" onClick={confirmImport}>Replace and import</button></div></section></div> : null}
    {helpOpen ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}><section className="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-title"><button className="dialog-close" type="button" onClick={() => setHelpOpen(false)} aria-label="Close">×</button><p className="section-eyebrow">Keyboard shortcuts</p><h2 id="shortcut-title">Move around FinDash</h2><dl><div><dt>Go to Dashboard</dt><dd>g, then d</dd></div><div><dt>Go to Snapshots</dt><dd>g, then s</dd></div><div><dt>Go to Analytics</dt><dd>g, then a</dd></div><div><dt>Go to Plan</dt><dd>g, then p</dd></div><div><dt>Save to data.json</dt><dd>⌘S / Ctrl S</dd></div><div><dt>Show shortcuts</dt><dd>?</dd></div></dl></section></div> : null}
  </div>;
}
