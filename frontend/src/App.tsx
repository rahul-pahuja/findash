import { useEffect, useMemo, useState } from "react";
import { Charts } from "./components/Charts";
import { DataEntryModal } from "./components/DataEntryModal";
import { ControlBar } from "./components/FloatingNav";
import { IncomeSipModal } from "./components/IncomeSipModal";
import { MetricCard } from "./components/MetricCard";
import { SnapshotList } from "./components/SnapshotList";
import { TableView } from "./components/TableView";
import { StatusBanner } from "./components/StatusBanner";
import { Sidebar } from "./components/Sidebar";
import { XirrPanel } from "./components/XirrPanel";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import type { ApiError, DataResponse, Dataset, Entry, RangeKey, XirrResponse, TabKey } from "./lib/types";
import { buildLocalDataResponse } from "./utils/derive";
import { formatCompactCurrency, formatMonthLabel } from "./utils/format";

const STORAGE_KEYS = {
  dataset: "findash.dataset",
  timestamp: "findash.datasetUpdatedAt",
  theme: "findash.theme",
  privacy: "findash.privacy"
};

function emptyDataset(): Dataset {
  return {
    entries: [],
    meta: { currency: "INR", created: "", last_updated: "" }
  };
}

export default function App() {
  const [dataset, setDataset] = useLocalStorageState<Dataset>(STORAGE_KEYS.dataset, emptyDataset());
  const [datasetTimestamp, setDatasetTimestamp] = useLocalStorageState<string>(STORAGE_KEYS.timestamp, "");
  const [themeMode, setThemeMode] = useLocalStorageState<"light" | "dark">(STORAGE_KEYS.theme, "light");
  const [isPrivateMode, setIsPrivateMode] = useLocalStorageState<boolean>(STORAGE_KEYS.privacy, false);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [selectedRange, setSelectedRange] = useState<RangeKey>("ALL");
  const [response, setResponse] = useState<DataResponse | null>(null);
  const [statusText, setStatusText] = useState("Ready");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeEntry, setActiveEntry] = useState<Entry | null>(null);
  const [incomeSipOpen, setIncomeSipOpen] = useState(false);
  const [incomeSipEntry, setIncomeSipEntry] = useState<Entry | null>(null);
  const [xirrLoading, setXirrLoading] = useState(false);
  const [xirrData, setXirrData] = useState<XirrResponse | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "table">("table");
  const [banner, setBanner] = useState<{ kind: "info" | "error" | "success"; message: string } | null>(null);

  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => setBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
  }, [themeMode]);

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (dataset.entries.length > 0) {
      setResponse(buildLocalDataResponse(dataset, selectedRange, response?.sync ?? null));
      setDatasetTimestamp(new Date().toISOString());
      setXirrData(null);
    }
  }, [dataset, selectedRange]);

  async function hydrate() {
    try {
      const backend = await fetch("/api/data?range=ALL").then((res) => res.json() as Promise<DataResponse>);
      if (dataset.entries.length > 0) {
        const isDifferent = JSON.stringify(dataset.entries) !== JSON.stringify(backend.dataset.entries);
        setMismatch(isDifferent);
        setStatusText(isDifferent ? "Out of sync" : "Synced");
        setResponse(buildLocalDataResponse(dataset, selectedRange, backend.sync));
        return;
      }
      setDataset(backend.dataset);
      setMismatch(false);
      setStatusText("Ready");
      setResponse(buildLocalDataResponse(backend.dataset, selectedRange, backend.sync));
    } catch {
      setStatusText("Offline");
      setBanner({ kind: "error", message: "Could not reach the local backend." });
    }
  }

  async function handleSave() {
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataset)
      });
      if (!res.ok) {
        const error = await res.json() as ApiError;
        throw new Error(error.error || "Failed to save dataset.");
      }
      const result = await res.json() as DataResponse;
      setDataset(result.dataset);
      setResponse(buildLocalDataResponse(result.dataset, selectedRange, result.sync));
      setMismatch(false);
      setStatusText("Saved");
      setBanner({ kind: "success", message: "Saved working state to data.json." });
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed to save dataset." });
    }
  }

  async function handleLoad() {
    try {
      setStatusText("Syncing...");
      const res = await fetch(`/api/data?range=ALL`);
      if (!res.ok) {
        const error = await res.json() as ApiError;
        throw new Error(error.error || "Failed to load dataset.");
      }
      const result = await res.json() as DataResponse;
      setDataset(result.dataset);
      setResponse(buildLocalDataResponse(result.dataset, selectedRange, result.sync));
      setMismatch(false);
      setStatusText("Synced");
      setBanner({ kind: "info", message: "Data reloaded from data.json." });
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed to load dataset." });
      setStatusText("Sync failed");
    }
  }

  const handleSystemFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content) as Dataset;
        if (!parsed.entries || !Array.isArray(parsed.entries) || !parsed.meta) {
          throw new Error("Invalid schema.");
        }
        setDataset(parsed);
        setMismatch(true);
        setStatusText("Custom data");
        setBanner({ kind: "success", message: "System file loaded." });
      } catch (err) {
        setBanner({ kind: "error", message: "Failed to parse file." });
      }
    };
    reader.readAsText(file);
  };

  async function handleAnalyze() {
    setXirrLoading(true);
    try {
      const res = await fetch(`/api/xirr?range=${selectedRange}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataset)
      });
      if (!res.ok) {
        const error = await res.json() as ApiError;
        throw new Error(error.error || "Failed to analyze XIRR.");
      }
      const result = await res.json() as XirrResponse;
      setXirrData(result);
    } catch (error) {
      setBanner({ kind: "error", message: "Failed to analyze XIRR." });
    } finally {
      setXirrLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "analytics" && !xirrLoading) {
      void handleAnalyze();
    }
  }, [activeTab, selectedRange]);

  const visibleEntries = useMemo(() => {
    if (!response) return dataset.entries;
    return response.dataset.entries.filter((e) => response.visibleEntryIds.includes(e.id));
  }, [response]);

  const latestVisible = useMemo(() => {
    if (!response) return null;
    const id = response.visibleEntryIds[response.visibleEntryIds.length - 1];
    return id ? response.derived[id] : null;
  }, [response]);

  const latestMonthLabel = response?.summary.latestMonth
    ? formatMonthLabel(response.summary.latestMonth)
    : "No snapshot yet";

  return (
    <div className="findash-app">
      <input id="system-file-input" type="file" accept=".json" className="hidden" onChange={handleSystemFileLoad} />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="findash-workspace">
        <div className="workspace-toolbar-row">
          <ControlBar
            selectedRange={selectedRange}
            onRangeChange={setSelectedRange}
            isPrivateMode={isPrivateMode}
            onTogglePrivate={() => setIsPrivateMode((current) => !current)}
            themeMode={themeMode}
            onToggleTheme={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
            onSave={handleSave}
            onLoad={handleLoad}
            onSystemLoad={() => document.getElementById("system-file-input")?.click()}
            statusText={statusText}
            fileUpdated={response?.sync?.fileUpdated}
          />
        </div>

        <main className="page-main">
          {activeTab === "dashboard" && response ? (
            <div className="dashboard-page page-enter">
              <section className="overview-grid" aria-labelledby="quick-stats-title">
                <div className="overview-intro">
                  <p className="section-eyebrow">Personal finance · {latestMonthLabel}</p>
                  <h1 id="quick-stats-title">Quick Stats</h1>
                  <p>Your latest wealth snapshot, balances and investments in one view.</p>
                </div>
                <div className="metrics-grid">
                  <MetricCard
                    label="Net Worth"
                    value={formatCompactCurrency(response.summary.latestNetWorth, isPrivateMode)}
                    hint={latestMonthLabel}
                    info="Total current value across liquid balances, hard assets and market holdings."
                    featured
                  />
                  <MetricCard
                    label="Hard Capital"
                    value={formatCompactCurrency(response.summary.latestHardCapital, isPrivateMode)}
                    hint="Cash + invested principal"
                    info="Liquid balances, hard assets and principal invested across market holdings."
                  />
                  <MetricCard
                    label="Liquid Buffer"
                    value={formatCompactCurrency(response.summary.latestLiquidBuffer, isPrivateMode)}
                    hint="Bank + Sodexo"
                    info="Easily accessible cash from bank balances and Sodexo."
                  />
                  <MetricCard
                    label="Market Portfolio"
                    value={formatCompactCurrency(latestVisible?.marketExposure ?? 0, isPrivateMode)}
                    hint="Current market value"
                    info="Current value of mutual funds, NPS, stocks and crypto holdings."
                  />
                  <MetricCard
                    label="Unrealized Gain"
                    value={formatCompactCurrency(response.summary.totalUnrealized, isPrivateMode)}
                    hint="Current value less principal"
                    info="Current net worth minus hard capital. This is an unrealized portfolio gain or loss."
                  />
                  <MetricCard
                    label="Snapshots"
                    value={String(response.summary.entryCount)}
                    hint={response.range.label}
                    info="Recorded balance snapshots in the selected date range."
                  />
                </div>
              </section>

              <Charts response={response} dataset={response.dataset} masked={isPrivateMode} themeMode={themeMode} primaryOnly />

              <section className="recent-snapshots" aria-labelledby="recent-snapshots-title">
                <div className="section-heading-row">
                  <div>
                    <h2 id="recent-snapshots-title">Snapshot History</h2>
                    <p>Recent balances recorded in your wealth file</p>
                  </div>
                  <button type="button" className="text-action" onClick={() => setActiveTab("history")}>View all snapshots <span aria-hidden="true">↗</span></button>
                </div>
                <TableView
                  entries={visibleEntries}
                  masked={isPrivateMode}
                  maxRows={4}
                  onEdit={(entry) => { setActiveEntry(entry); setModalOpen(true); }}
                  onEditIncomeSip={(entry) => { setIncomeSipEntry(entry); setIncomeSipOpen(true); }}
                />
              </section>
            </div>
          ) : null}

          {activeTab === "dashboard" && !response ? (
            <div className="page-empty-state"><span className="empty-mark" aria-hidden="true">◌</span><h1>Preparing your dashboard</h1><p>{statusText === "Offline" ? "The local backend is offline. Start it to load your wealth data." : "Loading your latest snapshot."}</p></div>
          ) : null}

          {activeTab === "analytics" ? (
            <div className="analytics-page page-enter">
              <div className="page-section-header">
                <p className="section-eyebrow">Portfolio performance</p>
                <h1>Returns &amp; insights</h1>
                <p>Annualized returns and the patterns behind your portfolio.</p>
              </div>
              <XirrPanel data={xirrData} loading={xirrLoading} range={selectedRange} masked={isPrivateMode} />
              {response ? <Charts response={response} dataset={response.dataset} masked={isPrivateMode} themeMode={themeMode} /> : null}
            </div>
          ) : null}

          {activeTab === "history" ? (
            <div className="history-page page-enter">
              <div className="history-page-header">
                <div className="page-section-header">
                  <p className="section-eyebrow">Your money over time</p>
                  <h1>Snapshot History</h1>
                  <p>Review balances and contributions across your saved snapshots.</p>
                </div>
                <button type="button" className="primary-action" onClick={() => { setActiveEntry(null); setModalOpen(true); }}>Add snapshot <span aria-hidden="true">＋</span></button>
              </div>

              <div className="history-toolbar">
                <div className="view-toggle" role="group" aria-label="History view">
                  <button type="button" className={viewMode === "table" ? "is-selected" : ""} aria-pressed={viewMode === "table"} onClick={() => setViewMode("table")}>Table</button>
                  <button type="button" className={viewMode === "list" ? "is-selected" : ""} aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}>Snapshots</button>
                </div>
                <span className="range-summary">{response?.range.label ?? "All time"} · {visibleEntries.length} entries</span>
              </div>

              {viewMode === "list" ? (
                <SnapshotList
                  entries={visibleEntries}
                  onEdit={(entry) => { setActiveEntry(entry); setModalOpen(true); }}
                  onEditIncomeSip={(entry) => { setIncomeSipEntry(entry); setIncomeSipOpen(true); }}
                />
              ) : (
                <TableView
                  entries={visibleEntries}
                  masked={isPrivateMode}
                  onEdit={(entry) => { setActiveEntry(entry); setModalOpen(true); }}
                  onEditIncomeSip={(entry) => { setIncomeSipEntry(entry); setIncomeSipOpen(true); }}
                />
              )}
            </div>
          ) : null}
        </main>
      </div>

      {banner ? <StatusBanner kind={banner.kind} message={banner.message} onDismiss={() => setBanner(null)} /> : null}

      {mismatch ? (
        <StatusBanner
          kind="info"
          message="Local state differs from file. Sync to resolve."
          onDismiss={() => setMismatch(false)}
        />
      ) : null}

      <DataEntryModal
        open={modalOpen}
        entry={activeEntry}
        onClose={() => setModalOpen(false)}
        onSave={(entry) => {
          setDataset((current) => {
            const nextEntries = [...current.entries];
            const index = nextEntries.findIndex((item) => item.id === entry.id);
            if (index >= 0) {
              nextEntries[index] = entry;
            } else {
              nextEntries.push(entry);
            }
            nextEntries.sort((a, b) => a.date.localeCompare(b.date));
            return {
              ...current,
              entries: nextEntries,
              meta: {
                ...current.meta,
                currency: "INR",
                last_updated: new Date().toISOString().slice(0, 10)
              }
            };
          });
          setBanner({ kind: "success", message: `Updated snapshot for ${entry.id}.` });
        }}
      />
      <IncomeSipModal
        open={incomeSipOpen}
        entry={incomeSipEntry}
        onClose={() => setIncomeSipOpen(false)}
        onSave={(entry) => {
          setDataset((current) => {
            const nextEntries = current.entries.map((item) => item.id === entry.id ? entry : item);
            return {
              ...current,
              entries: nextEntries,
              meta: {
                ...current.meta,
                last_updated: new Date().toISOString().slice(0, 10)
              }
            };
          });
          setBanner({ kind: "success", message: `Updated income for ${entry.id}.` });
        }}
      />
    </div>
  );
}
