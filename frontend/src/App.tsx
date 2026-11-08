import { useEffect, useMemo, useState } from "react";
import { Charts } from "./components/Charts";
import { DataEntryModal } from "./components/DataEntryModal";
import { ControlBar } from "./components/FloatingNav";
import { IncomeSipModal } from "./components/IncomeSipModal";
import { MetricCard } from "./components/MetricCard";
import { SnapshotList } from "./components/SnapshotList";
import { TableView } from "./components/TableView";
import { StatusBanner } from "./components/StatusBanner";
import { XirrPanel } from "./components/XirrPanel";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import type { ApiError, DataResponse, Dataset, Entry, RangeKey, XirrResponse, TabKey } from "./lib/types";
import { buildLocalDataResponse } from "./utils/derive";
import { formatCurrency, formatPercent } from "./utils/format";

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
  const [themeMode, setThemeMode] = useLocalStorageState<"light" | "dark">(STORAGE_KEYS.theme, "dark");
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

  const trends = useMemo(() => {
    if (!response || response.visibleEntryIds.length < 2) return null;
    const ids = response.visibleEntryIds;
    const curr = response.derived[ids[ids.length - 1]];
    const prev = response.derived[ids[ids.length - 2]];
    if (!curr || !prev) return null;

    const calcPct = (c: number, p: number) => (p === 0 ? 0 : ((c - p) / Math.abs(p)) * 100);

    return {
      netWorth: { 
        isPositive: curr.currentNetWorth >= prev.currentNetWorth, 
        value: curr.currentNetWorth - prev.currentNetWorth,
        percentage: calcPct(curr.currentNetWorth, prev.currentNetWorth)
      },
      hardCapital: { 
        isPositive: curr.hardCapital >= prev.hardCapital, 
        value: curr.hardCapital - prev.hardCapital,
        percentage: calcPct(curr.hardCapital, prev.hardCapital)
      },
      liquidBuffer: { 
        isPositive: curr.liquidBuffer >= prev.liquidBuffer, 
        value: curr.liquidBuffer - prev.liquidBuffer,
        percentage: calcPct(curr.liquidBuffer, prev.liquidBuffer)
      },
      unrealizedGain: { 
        isPositive: curr.unrealizedGain >= prev.unrealizedGain, 
        value: curr.unrealizedGain - prev.unrealizedGain,
        percentage: calcPct(curr.unrealizedGain, prev.unrealizedGain)
      }
    };
  }, [response]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="flex flex-col pb-32">
        <input id="system-file-input" type="file" accept=".json" className="hidden" onChange={handleSystemFileLoad} />

        <main className="mx-auto w-full max-w-7xl space-y-12 p-6 lg:p-12">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold tracking-tighter text-foreground">FinDash</h1>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Local-First Wealth Studio</p>
          </div>

          {activeTab === "dashboard" && response && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard 
                  label="Net Worth" 
                  value={formatCurrency(response?.summary.latestNetWorth, isPrivateMode)} 
                  hint={response?.summary.latestMonth} 
                  info="Total assets minus liabilities. Sum of liquid, hard assets, and market portfolio current values."
                  trend={trends?.netWorth}
                />
                <MetricCard 
                  label="Hard Capital" 
                  value={formatCurrency(response?.summary.latestHardCapital, isPrivateMode)} 
                  hint="Total invested + savings" 
                  info="Principal you've put in: liquid cash + FD + wallet + all market invested amounts. Excludes gains."
                  trend={trends?.hardCapital}
                />
                <MetricCard 
                  label="Liquid Buffer" 
                  value={formatCurrency(response?.summary.latestLiquidBuffer, isPrivateMode)} 
                  hint={latestVisible ? formatPercent(latestVisible.liquidBufferRatio, isPrivateMode) : "N/A"} 
                  info="Easily accessible cash: bank balance + Sodexo. Ratio shows how many months of salary this covers."
                  trend={trends?.liquidBuffer}
                />
                <MetricCard 
                  label="Unrealized Gain" 
                  value={formatCurrency(response?.summary.totalUnrealized, isPrivateMode)} 
                  hint={latestVisible ? formatPercent(latestVisible.investmentVelocity, isPrivateMode) : "N/A"} 
                  info="Paper profit: current net worth minus hard capital. Not realized until you sell. Velocity shows SIP as % of income."
                  trend={trends?.unrealizedGain}
                />
              </section>
              <Charts response={response} dataset={response.dataset} masked={isPrivateMode} themeMode={themeMode} />
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <XirrPanel
                data={xirrData}
                loading={xirrLoading}
                range={selectedRange}
                masked={isPrivateMode}
              />
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                      viewMode === "list" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Snapshot List
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                      viewMode === "table" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Tabular View
                  </button>
                </div>
                <button
                  className="rounded-full bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
                  onClick={() => {
                    setActiveEntry(null);
                    setModalOpen(true);
                  }}
                >
                  + Add Snapshot
                </button>
              </div>

              {viewMode === "list" ? (
                <SnapshotList
                  entries={visibleEntries}
                  onAdd={() => {
                    setActiveEntry(null);
                    setModalOpen(true);
                  }}
                  onEdit={(entry) => {
                    setActiveEntry(entry);
                    setModalOpen(true);
                  }}
                  onEditIncomeSip={(entry) => {
                    setIncomeSipEntry(entry);
                    setIncomeSipOpen(true);
                  }}
                />
              ) : (
                <TableView 
                  entries={visibleEntries} 
                  masked={isPrivateMode} 
                  onEdit={(entry) => {
                    setActiveEntry(entry);
                    setModalOpen(true);
                  }}
                  onEditIncomeSip={(entry) => {
                    setIncomeSipEntry(entry);
                    setIncomeSipOpen(true);
                  }}
                />
              )}
            </div>
          )}
        </main>
      </div>

      <ControlBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedRange={selectedRange}
        onRangeChange={setSelectedRange}
        isPrivateMode={isPrivateMode}
        onTogglePrivate={() => setIsPrivateMode((current) => !current)}
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
        onSave={handleSave}
        onLoad={handleLoad}
        onSystemLoad={() => document.getElementById("system-file-input")?.click()}
      />

      {/* Sync Status Overlay */}
      <div className="fixed bottom-8 right-8 z-40 hidden xl:block animate-in fade-in slide-in-from-right-4 duration-700">
        <div className="rounded-full border border-border bg-background/60 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shadow-lg backdrop-blur-xl">
          {statusText} • {response?.sync?.fileExists ? `Sync: ${new Date(response.sync.fileUpdated).toLocaleTimeString()}` : "Offline"}
        </div>
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
