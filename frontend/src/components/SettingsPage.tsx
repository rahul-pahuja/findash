import type { Dataset, LandingPageKey } from "../lib/types";
import { FormInput, FormSelect, SettingsRow, SwitchControl } from "./FormControls";

interface Props {
  dataset: Dataset;
  onChange: (dataset: Dataset) => void;
  onSave: () => void;
  onReload: () => void;
  onImport: () => void;
  onExport: () => void;
  statusText: string;
  isDirty: boolean;
  fileUpdated?: string;
  privateMode: boolean;
  onTogglePrivate: () => void;
}

const LANDING_PAGES: Array<{ value: LandingPageKey; label: string }> = [
  { value: "dashboard", label: "Dashboard" }, { value: "snapshots", label: "Snapshots" },
  { value: "analytics-overview", label: "Analytics overview" }, { value: "plan", label: "Plan" }
];

export function SettingsPage({ dataset, onChange, onSave, onReload, onImport, onExport, statusText, isDirty, fileUpdated, privateMode, onTogglePrivate }: Props) {
  const settings = dataset.settings;
  function setSetting<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    onChange({ ...dataset, settings: { ...settings, [key]: value } });
  }
  const savedText = fileUpdated ? new Date(fileUpdated).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not saved yet";

  return <div className="page-content settings-page page-enter">
    <section className="settings-section" aria-labelledby="settings-profile-heading">
      <div className="settings-section-heading"><h2 id="settings-profile-heading">Profile</h2></div>
      <SettingsRow label="Name" description="Used in the greeting.">
        <FormInput aria-label="Profile name" className="settings-compact-input" value={settings.profileName} onChange={(event) => setSetting("profileName", event.target.value)} placeholder="Optional" />
      </SettingsRow>
      <SettingsRow label="Default page">
        <FormSelect aria-label="Default page" className="settings-compact-select" value={settings.defaultLandingPage} onChange={(event) => setSetting("defaultLandingPage", event.target.value as LandingPageKey)} options={LANDING_PAGES} />
      </SettingsRow>
    </section>

    <section className="settings-section" aria-labelledby="settings-display-heading">
      <div className="settings-section-heading"><h2 id="settings-display-heading">Display</h2></div>
      <SettingsRow label="Appearance">
        <FormSelect aria-label="Appearance" className="settings-compact-select" value={settings.appearance} onChange={(event) => setSetting("appearance", event.target.value as typeof settings.appearance)} options={[{ value: "auto", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      </SettingsRow>
      <SettingsRow label="Number format">
        <FormSelect aria-label="Number format" className="settings-compact-select" value={settings.numberFormat} onChange={(event) => setSetting("numberFormat", event.target.value as typeof settings.numberFormat)} options={[{ value: "indian", label: "Indian (₹1,00,000)" }, { value: "international", label: "International (₹100,000)" }]} />
      </SettingsRow>
    </section>

    <section className="settings-section" aria-labelledby="settings-privacy-heading">
      <div className="settings-section-heading"><h2 id="settings-privacy-heading">Privacy</h2></div>
      <SwitchControl label="Hide amounts by default" description="Mask values when the app opens." checked={settings.hideAmountsByDefault} onChange={(checked) => setSetting("hideAmountsByDefault", checked)} />
      <SwitchControl label="Hide amounts when the app loses focus" description="Mask values when you switch windows." checked={settings.autoHideOnBlur} onChange={(checked) => setSetting("autoHideOnBlur", checked)} />
      <SettingsRow label="Hide amounts now" description="Temporarily mask values on this screen.">
        <button className="settings-row-action" type="button" onClick={onTogglePrivate}>{privateMode ? "On" : "Off"}<span aria-hidden="true">›</span></button>
      </SettingsRow>
    </section>

    <section className="settings-section" aria-labelledby="settings-reminders-heading">
      <div className="settings-section-heading"><h2 id="settings-reminders-heading">Reminders</h2></div>
      <SettingsRow label="Snapshot reminder day" description="Drives the “No snapshot yet” prompt.">
        <FormInput aria-label="Snapshot reminder day" fieldClassName="settings-day-field" className="settings-compact-input settings-day-input" type="number" min="1" max="28" step="1" value={settings.reminderDayOfMonth} onChange={(event) => setSetting("reminderDayOfMonth", Math.min(28, Math.max(1, Number(event.target.value))))} />
      </SettingsRow>
    </section>

    <section className="settings-section settings-data-section" aria-labelledby="settings-data-heading">
      <div className="settings-section-heading"><h2 id="settings-data-heading">Data</h2><p>Your snapshot history stays in the local data.json file.</p></div>
      <SettingsRow label="Last saved" description={isDirty ? "Unsaved changes are on this device." : statusText === "Offline" ? "The file service is offline; your browser copy is available." : undefined}>
        <span className="settings-readonly-value">{savedText}</span>
      </SettingsRow>
      <p className="settings-data-hint">Use the JSON file controls in the navigation; on mobile, they appear below.</p>
      <div className="settings-data-actions"><button className="primary-action" type="button" onClick={onSave}>Save to data.json</button><button className="quiet-button" type="button" onClick={onReload}>Reload file</button><button className="quiet-button" type="button" onClick={onImport}>Import JSON</button><button className="quiet-button" type="button" onClick={onExport}>Export JSON</button></div>
    </section>
  </div>;
}
