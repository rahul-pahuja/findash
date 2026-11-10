import { useState } from "react";
import { createPortal } from "react-dom";
import type { Dataset, LandingPageKey } from "../lib/types";
import { SettingsRow, SwitchControl } from "./FormControls";

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

type SettingsModal = "profileName" | "defaultPage" | "appearance" | "numberFormat" | "reminderDay" | null;

const LANDING_PAGES: Array<{ value: LandingPageKey; label: string; desc: string }> = [
  { value: "dashboard", label: "Dashboard", desc: "Overview of wealth, metrics and recent activity." },
  { value: "snapshots", label: "Snapshots", desc: "Complete timeline of all recorded wealth entries." },
  { value: "analytics-overview", label: "Analytics overview", desc: "Portfolio trajectory and liquidity breakdown." },
  { value: "plan", label: "Plan", desc: "Goal targets, timelines, and pace projections." }
];

function computeNextReminderDate(reminderDay: number): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  let targetYear = currentYear;
  let targetMonth = currentMonth;
  if (currentDay >= reminderDay) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  const d = new Date(Date.UTC(targetYear, targetMonth, reminderDay));
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export function SettingsPage({
  dataset,
  onChange,
  onSave,
  onReload,
  onImport,
  onExport,
  statusText,
  isDirty,
  fileUpdated,
  privateMode,
  onTogglePrivate
}: Props) {
  const settings = dataset.settings;
  const [activeModal, setActiveModal] = useState<SettingsModal>(null);

  // Draft states for modals with Save buttons
  const [nameDraft, setNameDraft] = useState(settings.profileName);
  const [reminderDayDraft, setReminderDayDraft] = useState(settings.reminderDayOfMonth);

  function setSetting<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    onChange({ ...dataset, settings: { ...settings, [key]: value } });
  }

  function openProfileNameModal() {
    setNameDraft(settings.profileName);
    setActiveModal("profileName");
  }

  function saveProfileName() {
    setSetting("profileName", nameDraft);
    setActiveModal(null);
  }

  function openReminderDayModal() {
    setReminderDayDraft(settings.reminderDayOfMonth);
    setActiveModal("reminderDay");
  }

  function saveReminderDay() {
    setSetting("reminderDayOfMonth", reminderDayDraft);
    setActiveModal(null);
  }

  const savedText = fileUpdated
    ? new Date(fileUpdated).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "Not saved yet";

  const appearanceLabel =
    settings.appearance === "auto" ? "System" : settings.appearance === "dark" ? "Dark" : "Light";

  const numberFormatLabel =
    settings.numberFormat === "indian" ? "Indian (₹1,00,000)" : "International (₹100,000)";

  const landingPageLabel =
    LANDING_PAGES.find((p) => p.value === settings.defaultLandingPage)?.label ?? "Dashboard";

  return (
    <div className="page-content settings-page page-enter">
      <section className="settings-section" aria-labelledby="settings-profile-heading">
        <div className="settings-section-heading">
          <h2 id="settings-profile-heading">Profile</h2>
        </div>
        <SettingsRow label="Name" description="Used in the greeting.">
          <button className="settings-row-action" type="button" onClick={openProfileNameModal}>
            <span>{settings.profileName ? settings.profileName : "Optional"}</span>
            <span aria-hidden="true">›</span>
          </button>
        </SettingsRow>
        <SettingsRow label="Default page">
          <button className="settings-row-action" type="button" onClick={() => setActiveModal("defaultPage")}>
            <span>{landingPageLabel}</span>
            <span aria-hidden="true">›</span>
          </button>
        </SettingsRow>
      </section>

      <section className="settings-section" aria-labelledby="settings-display-heading">
        <div className="settings-section-heading">
          <h2 id="settings-display-heading">Display</h2>
        </div>
        <SettingsRow label="Appearance">
          <button className="settings-row-action" type="button" onClick={() => setActiveModal("appearance")}>
            <span>{appearanceLabel}</span>
            <span aria-hidden="true">›</span>
          </button>
        </SettingsRow>
        <SettingsRow label="Number format">
          <button className="settings-row-action" type="button" onClick={() => setActiveModal("numberFormat")}>
            <span>{numberFormatLabel}</span>
            <span aria-hidden="true">›</span>
          </button>
        </SettingsRow>
      </section>

      <section className="settings-section" aria-labelledby="settings-privacy-heading">
        <div className="settings-section-heading">
          <h2 id="settings-privacy-heading">Privacy</h2>
        </div>
        <SwitchControl
          label="Hide amounts by default"
          description="Mask values when the app opens."
          checked={settings.hideAmountsByDefault}
          onChange={(checked) => setSetting("hideAmountsByDefault", checked)}
        />
        <SwitchControl
          label="Hide amounts when the app loses focus"
          description="Mask values when you switch windows."
          checked={settings.autoHideOnBlur}
          onChange={(checked) => setSetting("autoHideOnBlur", checked)}
        />
        <SettingsRow label="Hide amounts now" description="Temporarily mask values on this screen.">
          <button className="settings-row-action" type="button" onClick={onTogglePrivate}>
            {privateMode ? "On" : "Off"}
            <span aria-hidden="true">›</span>
          </button>
        </SettingsRow>
      </section>

      <section className="settings-section" aria-labelledby="settings-reminders-heading">
        <div className="settings-section-heading">
          <h2 id="settings-reminders-heading">Reminders</h2>
        </div>
        <SettingsRow label="Snapshot reminder day" description="Drives the “No snapshot yet” prompt.">
          <button className="settings-row-action" type="button" onClick={openReminderDayModal}>
            <span>{settings.reminderDayOfMonth}th of each month</span>
            <span aria-hidden="true">›</span>
          </button>
        </SettingsRow>
      </section>

      <section className="settings-section settings-data-section" aria-labelledby="settings-data-heading">
        <div className="settings-section-heading">
          <h2 id="settings-data-heading">Data</h2>
          <p>Your data is stored locally on this device.</p>
        </div>
        <SettingsRow
          label="Last saved"
          description={
            isDirty
              ? "Unsaved changes are on this device."
              : statusText === "Offline"
              ? "The file service is offline; your browser copy is available."
              : undefined
          }
        >
          <span className="settings-readonly-value">{savedText}</span>
        </SettingsRow>
        <p className="settings-data-hint">Use data controls to save, reload, import, or export your financial history.</p>
        <div className="settings-data-actions">
          <button className="primary-action" type="button" onClick={onSave}>
            Save changes
          </button>
          <button className="quiet-button" type="button" onClick={onReload}>
            Reload saved data
          </button>
          <button className="quiet-button" type="button" onClick={onImport}>
            Import data
          </button>
          <button className="quiet-button" type="button" onClick={onExport}>
            Export data
          </button>
        </div>
      </section>

      {/* Settings Modal Sheets (Page 13) */}
      {activeModal
        ? createPortal(
            <div
              className="modal-backdrop apple-modal-backdrop"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setActiveModal(null);
              }}
            >
              <section className="apple-card-dialog settings-modal-dialog" role="dialog" aria-modal="true">
                {/* 1. Profile Name Modal */}
                {activeModal === "profileName" && (
                  <>
                    <header className="apple-sheet-header">
                      <button className="settings-modal-close-btn" type="button" onClick={() => setActiveModal(null)}>
                        Close
                      </button>
                      <h2>Profile name</h2>
                      <div />
                    </header>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveProfileName();
                      }}
                    >
                      <div className="apple-list-group">
                        <label className="apple-list-row">
                          <div>
                            <span className="apple-list-label">Name</span>
                            <small className="apple-list-label-sub">Used in the greeting.</small>
                          </div>
                          <input
                            className="apple-list-input"
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            placeholder="Optional"
                            autoFocus
                          />
                        </label>
                      </div>
                      <button className="apple-modal-footer-save" type="submit">
                        Save
                      </button>
                    </form>
                  </>
                )}

                {/* 2. Default Page Modal */}
                {activeModal === "defaultPage" && (
                  <>
                    <header className="apple-sheet-header">
                      <button className="settings-modal-close-btn" type="button" onClick={() => setActiveModal(null)}>
                        Close
                      </button>
                      <h2>Default page</h2>
                      <div />
                    </header>
                    <div className="apple-radio-list">
                      {LANDING_PAGES.map((page) => {
                        const isSelected = settings.defaultLandingPage === page.value;
                        return (
                          <button
                            key={page.value}
                            type="button"
                            className={`apple-radio-item ${isSelected ? "is-selected" : ""}`}
                            onClick={() => {
                              setSetting("defaultLandingPage", page.value);
                              setActiveModal(null);
                            }}
                          >
                            <div className="apple-radio-copy">
                              <span className="apple-radio-title">{page.label}</span>
                              <span className="apple-radio-desc">{page.desc}</span>
                            </div>
                            <span className="apple-radio-circle">
                              {isSelected && <span className="apple-radio-dot" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* 3. Appearance Modal */}
                {activeModal === "appearance" && (
                  <>
                    <header className="apple-sheet-header">
                      <button className="settings-modal-close-btn" type="button" onClick={() => setActiveModal(null)}>
                        Close
                      </button>
                      <h2>Appearance</h2>
                      <div />
                    </header>
                    <div className="apple-radio-list">
                      {[
                        { value: "auto", title: "System", desc: "Follows your device" },
                        { value: "light", title: "Light", desc: "Always light" },
                        { value: "dark", title: "Dark", desc: "Always dark" }
                      ].map((item) => {
                        const isSelected = settings.appearance === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            className={`apple-radio-item ${isSelected ? "is-selected" : ""}`}
                            onClick={() => {
                              setSetting("appearance", item.value as typeof settings.appearance);
                              setActiveModal(null);
                            }}
                          >
                            <div className="apple-radio-copy">
                              <span className="apple-radio-title">{item.title}</span>
                              <span className="apple-radio-desc">{item.desc}</span>
                            </div>
                            <span className="apple-radio-circle">
                              {isSelected && <span className="apple-radio-dot" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* 4. Number Format Modal */}
                {activeModal === "numberFormat" && (
                  <>
                    <header className="apple-sheet-header">
                      <button className="settings-modal-close-btn" type="button" onClick={() => setActiveModal(null)}>
                        Close
                      </button>
                      <h2>Number format</h2>
                      <div />
                    </header>
                    <div className="apple-radio-list">
                      {[
                        { value: "indian", title: "Indian", desc: "₹1,14,39,069 · ₹1.14 Cr" },
                        { value: "international", title: "International", desc: "₹11,439,069 · ₹11.4 M" }
                      ].map((item) => {
                        const isSelected = settings.numberFormat === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            className={`apple-radio-item ${isSelected ? "is-selected" : ""}`}
                            onClick={() => {
                              setSetting("numberFormat", item.value as typeof settings.numberFormat);
                              setActiveModal(null);
                            }}
                          >
                            <div className="apple-radio-copy">
                              <span className="apple-radio-title">{item.title}</span>
                              <span className="apple-radio-desc">{item.desc}</span>
                            </div>
                            <span className="apple-radio-circle">
                              {isSelected && <span className="apple-radio-dot" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* 5. Snapshot Reminder Day Modal */}
                {activeModal === "reminderDay" && (
                  <>
                    <header className="apple-sheet-header">
                      <button className="settings-modal-close-btn" type="button" onClick={() => setActiveModal(null)}>
                        Close
                      </button>
                      <h2>Snapshot reminder day</h2>
                      <div />
                    </header>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveReminderDay();
                      }}
                    >
                      <div className="reminder-stepper-box">
                        <div className="reminder-stepper-row">
                          <button
                            type="button"
                            className="apple-stepper-btn"
                            onClick={() => setReminderDayDraft((d) => Math.max(1, d - 1))}
                            aria-label="Decrease day"
                          >
                            −
                          </button>
                          <div className="reminder-day-display">
                            <span className="reminder-big-num">{reminderDayDraft}</span>
                            <span className="reminder-sublabel">Day of each month</span>
                          </div>
                          <button
                            type="button"
                            className="apple-stepper-btn"
                            onClick={() => setReminderDayDraft((d) => Math.min(28, d + 1))}
                            aria-label="Increase day"
                          >
                            +
                          </button>
                        </div>
                        <div className="apple-preset-pills" style={{ marginTop: "18px", marginBottom: "6px" }}>
                          {[1, 10, 15, 25, 28].map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={`apple-preset-pill ${reminderDayDraft === d ? "is-active" : ""}`}
                              onClick={() => setReminderDayDraft(d)}
                            >
                              {d === 1 ? "1st" : d === 2 ? "2nd" : d === 3 ? "3rd" : `${d}th`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="money-modal-hint" style={{ textAlign: "center", marginBottom: "16px" }}>
                        Next reminder: {computeNextReminderDate(reminderDayDraft)}. Days 29–31 are not offered.
                      </p>
                      <button className="apple-modal-footer-save" type="submit">
                        Save
                      </button>
                    </form>
                  </>
                )}
              </section>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
