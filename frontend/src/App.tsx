import { useEffect, useMemo, useRef, useState } from "react";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { AppHeader, type NotificationItem } from "./components/AppHeader";
import { Dashboard } from "./components/Dashboard";
import { DataEntryModal } from "./components/DataEntryModal";
import { GoalModal } from "./components/GoalModal";
import { IncomeSipModal } from "./components/IncomeSipModal";
import { StatusBanner } from "./components/StatusBanner";
import { TableView } from "./components/TableView";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import type { ApiError, DataResponse, Dataset, Entry, RangeKey, TabKey, XirrResponse } from "./lib/types";
import { buildLocalDataResponse } from "./utils/derive";
import { formatMonthLabel } from "./utils/format";
import { getBigMoves, getMostRecentMissingMonth } from "./utils/insights";

const STORAGE_KEYS = {
  dataset: "findash.dataset",
  theme: "findash.theme",
  privacy: "findash.privacy",
  range: "findash.analyticsRange"
};

type Banner = { kind: "info" | "error" | "success"; message: string };
type HistoryFilter = "all" | "notes" | "big-moves";

function emptyDataset(): Dataset {
  return { entries: [], meta: { currency: "INR", created: "", last_updated: "" } };
}

function normalizeDataset(dataset: Dataset): Dataset {
  return {
    ...dataset,
    preferences: {
      version: 1,
      ...dataset.preferences,
      notifications: { ...dataset.preferences?.notifications }
    }
  };
}

function monthName(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export default function App() {
  const [dataset, setDataset] = useLocalStorageState<Dataset>(STORAGE_KEYS.dataset, emptyDataset());
  const [themeMode, setThemeMode] = useLocalStorageState<"light" | "dark">(STORAGE_KEYS.theme, "light");
  const [isPrivateMode, setIsPrivateMode] = useLocalStorageState<boolean>(STORAGE_KEYS.privacy, false);
  const [selectedRange, setSelectedRange] = useLocalStorageState<RangeKey>(STORAGE_KEYS.range, "ALL");
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [response, setResponse] = useState<DataResponse | null>(null);
  const [statusText, setStatusText] = useState("Ready");
  const [modalOpen, setModalOpen] = useState(false);
  const [entryInitialDate, setEntryInitialDate] = useState<string | undefined>();
  const [activeEntry, setActiveEntry] = useState<Entry | null>(null);
  const [incomeSipOpen, setIncomeSipOpen] = useState(false);
  const [incomeSipEntry, setIncomeSipEntry] = useState<Entry | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [xirrLoading, setXirrLoading] = useState(false);
  const [xirrData, setXirrData] = useState<XirrResponse | null>(null);
  const xirrRequestRef = useRef(0);
  const [mismatch, setMismatch] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [bigMoveCount, setBigMoveCount] = useState<5 | 10>(5);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
  }, [themeMode]);

  useEffect(() => {
    document.title = isPrivateMode ? "FinDash · Values hidden" : "FinDash";
  }, [isPrivateMode]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(timer);
  }, [banner]);

  useEffect(() => { void hydrate(); }, []);

  useEffect(() => {
    if (dataset.entries.length > 0) {
      setResponse(buildLocalDataResponse(dataset, "ALL", response?.sync ?? null));
    }
  }, [dataset]);

  async function hydrate() {
    try {
      const backend = await fetch("/api/data?range=ALL").then((res) => res.json() as Promise<DataResponse>);
      const remoteDataset = normalizeDataset(backend.dataset);
      if (dataset.entries.length > 0) {
        const localDataset = normalizeDataset(dataset);
        const isDifferent = JSON.stringify(localDataset) !== JSON.stringify(remoteDataset);
        setDataset(localDataset);
        setMismatch(isDifferent);
        setStatusText(isDifferent ? "Out of sync" : "Synced");
        setResponse(buildLocalDataResponse(localDataset, "ALL", backend.sync));
        return;
      }
      setDataset(remoteDataset);
      setMismatch(false);
      setStatusText("Ready");
      setResponse(buildLocalDataResponse(remoteDataset, "ALL", backend.sync));
    } catch {
      setStatusText("Offline");
      setBanner({ kind: "error", message: "Could not reach the local backend. Your browser copy is still available." });
    }
  }

  async function handleSave() {
    try {
      const payload = normalizeDataset(dataset);
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const error = await res.json() as ApiError;
        throw new Error(error.error || "Failed to save dataset.");
      }
      const result = await res.json() as DataResponse;
      const savedDataset = normalizeDataset(result.dataset);
      setDataset(savedDataset);
      setResponse(buildLocalDataResponse(savedDataset, "ALL", result.sync));
      setMismatch(false);
      setStatusText("Saved to file");
      setBanner({ kind: "success", message: "Saved snapshots and preferences to data.json." });
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed to save dataset." });
    }
  }

  async function handleLoad() {
    try {
      setStatusText("Loading file…");
      const res = await fetch("/api/data?range=ALL");
      if (!res.ok) {
        const error = await res.json() as ApiError;
        throw new Error(error.error || "Failed to load dataset.");
      }
      const result = await res.json() as DataResponse;
      const loadedDataset = normalizeDataset(result.dataset);
      setDataset(loadedDataset);
      setResponse(buildLocalDataResponse(loadedDataset, "ALL", result.sync));
      setMismatch(false);
      setStatusText("Loaded from file");
      setBanner({ kind: "info", message: "Reloaded snapshots and preferences from data.json." });
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed to load dataset." });
      setStatusText("Load failed");
    }
  }

  const handleSystemFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as Dataset;
        if (!Array.isArray(parsed.entries) || !parsed.meta) throw new Error("Invalid dataset format.");
        const imported = normalizeDataset(parsed);
        setDataset(imported);
        setMismatch(true);
        setStatusText("Imported JSON");
        setBanner({ kind: "success", message: "Imported snapshots and preferences. Save to file to keep them in data.json." });
      } catch {
        setBanner({ kind: "error", message: "Could not read that file. Choose a FinDash JSON export." });
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  async function handleAnalyze() {
    const requestId = ++xirrRequestRef.current;
    setXirrLoading(true);
    try {
      const res = await fetch(`/api/xirr?range=${selectedRange}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataset)
      });
      if (!res.ok) {
        const error = await res.json() as ApiError;
        throw new Error(error.error || "Failed to analyze returns.");
      }
      const result = await res.json() as XirrResponse;
      if (requestId === xirrRequestRef.current) setXirrData(result);
    } catch {
      if (requestId === xirrRequestRef.current) setBanner({ kind: "error", message: "Could not calculate returns for this period." });
    } finally {
      if (requestId === xirrRequestRef.current) setXirrLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "analytics" && dataset.entries.length > 0) void handleAnalyze();
  }, [activeTab, selectedRange, dataset.entries]);

  const normalizedDataset = normalizeDataset(dataset);
  const goal = normalizedDataset.preferences?.shortTermGoal ?? null;
  const entries = normalizedDataset.entries;
  const missingMonth = useMemo(() => getMostRecentMissingMonth(entries), [entries]);
  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    const notificationPrefs = normalizedDataset.preferences?.notifications;
    if (!goal && !notificationPrefs?.dismissedGoalPromptAt) {
      items.push({
        id: "goal-setup",
        title: "Set a short-term target",
        message: "Choose an amount and date to keep a near-term goal in view.",
        actionLabel: "Set target",
        onAction: () => setGoalModalOpen(true),
        onDismiss: () => updatePreferences((current) => ({
          ...current,
          notifications: { ...current.notifications, dismissedGoalPromptAt: new Date().toISOString() }
        }))
      });
    }
    if (missingMonth && notificationPrefs?.dismissedGapMonth !== missingMonth.key) {
      items.push({
        id: `gap-${missingMonth.key}`,
        title: `No ${monthName(missingMonth.key)} snapshot recorded`,
        message: "Add a snapshot for this month to complete the timeline.",
        actionLabel: `Add ${monthName(missingMonth.key).split(" ")[0]}`,
        onAction: () => openNewSnapshot(missingMonth.suggestedDate),
        onDismiss: () => updatePreferences((current) => ({
          ...current,
          notifications: { ...current.notifications, dismissedGapMonth: missingMonth.key }
        }))
      });
    }
    return items;
  }, [goal, missingMonth, normalizedDataset.preferences]);

  const filteredSnapshots = useMemo(() => {
    if (historyFilter === "notes") return entries.filter((entry) => Boolean(entry.expenses_note.trim()));
    if (historyFilter === "big-moves") return getBigMoves(entries, bigMoveCount).map((item) => item.entry);
    return entries;
  }, [entries, historyFilter, bigMoveCount]);

  const unresolvedGap = missingMonth && normalizedDataset.preferences?.notifications?.dismissedGapMonth !== missingMonth.key;

  function updatePreferences(update: (current: NonNullable<Dataset["preferences"]>) => NonNullable<Dataset["preferences"]>) {
    setDataset((current) => {
      const preferences = normalizeDataset(current).preferences!;
      return { ...current, preferences: update(preferences) };
    });
    setStatusText("Changes on this device");
  }

  function openNewSnapshot(date?: string) {
    setActiveEntry(null);
    setEntryInitialDate(date);
    setModalOpen(true);
  }

  function editSnapshot(entry: Entry) {
    setActiveEntry(entry);
    setEntryInitialDate(undefined);
    setModalOpen(true);
  }

  function saveGoal(targetAmount: number, targetDate: string) {
    const now = new Date().toISOString();
    updatePreferences((current) => ({
      ...current,
      shortTermGoal: {
        targetAmount,
        targetDate,
        createdAt: current.shortTermGoal?.createdAt ?? now,
        updatedAt: now
      },
      notifications: { ...current.notifications, dismissedGoalPromptAt: undefined }
    }));
    setBanner({ kind: "success", message: "Short-term target saved on this device. Use Save to file to include it in data.json." });
  }

  return (
    <div className="findash-app">
      <input id="system-file-input" type="file" accept=".json,application/json" className="visually-hidden" onChange={handleSystemFileLoad} />
      <AppHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddSnapshot={() => openNewSnapshot()}
        isPrivateMode={isPrivateMode}
        onTogglePrivate={() => setIsPrivateMode((current) => !current)}
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode((current) => current === "dark" ? "light" : "dark")}
        onSave={() => void handleSave()}
        onLoad={() => void handleLoad()}
        onSystemLoad={() => document.getElementById("system-file-input")?.click()}
        statusText={statusText}
        fileUpdated={response?.sync?.fileUpdated}
        notifications={notifications}
      />

      <main className="page-main">
        {!response ? (
          <div className="page-empty-state"><p className="section-eyebrow">FinDash</p><h1>{statusText === "Offline" ? "Your data is still here." : "Preparing your dashboard"}</h1><p>{statusText === "Offline" ? "The local server is offline. Restart it to load or save data.json." : "Loading your latest snapshot."}</p></div>
        ) : null}

        {activeTab === "dashboard" && response ? <Dashboard
          response={response}
          masked={isPrivateMode}
          themeMode={themeMode}
          goal={goal}
          onSetGoal={() => setGoalModalOpen(true)}
          onOpenHistory={() => setActiveTab("history")}
          onEdit={editSnapshot}
          onEditIncomeSip={(entry) => { setIncomeSipEntry(entry); setIncomeSipOpen(true); }}
        /> : null}

        {activeTab === "analytics" ? <AnalyticsDashboard
          response={response}
          returns={xirrData}
          returnsLoading={xirrLoading}
          masked={isPrivateMode}
          themeMode={themeMode}
          selectedRange={selectedRange}
          onRangeChange={setSelectedRange}
        /> : null}

        {activeTab === "history" && response ? (
          <div className="history-page page-enter">
            <header className="history-page-header">
              <div><p className="section-eyebrow">Snapshot history · since {entries[0] ? formatMonthLabel(entries[0].date) : "today"}</p><h1>Snapshots</h1></div>
              <div className="snapshot-filters" role="group" aria-label="Filter snapshots">
                {(["all", "notes", "big-moves"] as const).map((filter) => <button key={filter} className={historyFilter === filter ? "is-selected" : ""} type="button" aria-pressed={historyFilter === filter} onClick={() => setHistoryFilter(filter)}>{filter === "all" ? "All" : filter === "notes" ? "With notes" : "Big moves"}</button>)}
              </div>
            </header>

            {unresolvedGap ? <aside className="gap-callout"><span><strong>No {monthName(missingMonth!.key)} snapshot recorded.</strong> A quick snapshot keeps the timeline current.</span><button type="button" onClick={() => openNewSnapshot(missingMonth!.suggestedDate)}>Add {monthName(missingMonth!.key).split(" ")[0]}</button></aside> : null}

            <div className="history-table-toolbar"><div><h2>All snapshots</h2><p>{historyFilter === "big-moves" ? `Top ${bigMoveCount} by absolute percentage change in net worth` : historyFilter === "notes" ? "Snapshots with a note" : "Newest first · change is compared with the prior recorded snapshot"}</p></div><span>{filteredSnapshots.length} {filteredSnapshots.length === 1 ? "record" : "records"}</span></div>
            {historyFilter === "big-moves" ? <div className="big-move-count"><span>Show</span><button type="button" className={bigMoveCount === 5 ? "is-selected" : ""} aria-pressed={bigMoveCount === 5} onClick={() => setBigMoveCount(5)}>Top 5</button><button type="button" className={bigMoveCount === 10 ? "is-selected" : ""} aria-pressed={bigMoveCount === 10} onClick={() => setBigMoveCount(10)}>Top 10</button></div> : null}
            <TableView entries={filteredSnapshots} allEntries={entries} masked={isPrivateMode} ranked={historyFilter === "big-moves"} onEdit={editSnapshot} onEditIncomeSip={(entry) => { setIncomeSipEntry(entry); setIncomeSipOpen(true); }} />
          </div>
        ) : null}
      </main>

      {banner ? <StatusBanner kind={banner.kind} message={banner.message} onDismiss={() => setBanner(null)} /> : null}
      {mismatch ? <StatusBanner kind="info" message="This browser copy differs from data.json. Save or reload to resolve." onDismiss={() => setMismatch(false)} /> : null}

      <DataEntryModal
        open={modalOpen}
        entry={activeEntry}
        initialDate={entryInitialDate}
        masked={isPrivateMode}
        entries={dataset.entries}
        onClose={() => setModalOpen(false)}
        onSave={(entry) => {
          setDataset((current) => {
            const nextEntries = [...current.entries];
            const index = activeEntry ? nextEntries.findIndex((item) => item.id === activeEntry.id) : nextEntries.findIndex((item) => item.id === entry.id);
            const normalizedEntry = { ...entry, id: entry.date };
            if (index >= 0) nextEntries[index] = normalizedEntry;
            else nextEntries.push(normalizedEntry);
            nextEntries.sort((a, b) => a.date.localeCompare(b.date));
            return { ...current, entries: nextEntries, meta: { ...current.meta, currency: "INR", last_updated: new Date().toISOString().slice(0, 10) } };
          });
          setStatusText("Changes on this device");
          setBanner({ kind: "success", message: `Updated snapshot for ${entry.date}. Save to file to keep the change in data.json.` });
          setModalOpen(false);
        }}
      />

      <IncomeSipModal
        open={incomeSipOpen}
        entry={incomeSipEntry}
        masked={isPrivateMode}
        onClose={() => setIncomeSipOpen(false)}
        onSave={(entry) => {
          setDataset((current) => ({ ...current, entries: current.entries.map((item) => item.id === entry.id ? entry : item), meta: { ...current.meta, last_updated: new Date().toISOString().slice(0, 10) } }));
          setStatusText("Changes on this device");
          setBanner({ kind: "success", message: `Updated income and contributions for ${entry.id}.` });
        }}
      />

      <GoalModal open={goalModalOpen} goal={goal} masked={isPrivateMode} onClose={() => setGoalModalOpen(false)} onSave={saveGoal} />
    </div>
  );
}
