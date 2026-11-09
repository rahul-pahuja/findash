# FinDash redesign and implementation plan

**Status:** implementation and migration complete; core verification passed
**Updated:** 8 November 2026
**Storage decision:** `data.json` remains the only backend source of truth. No database is being introduced.

## Product decisions

- Replace the current tab state with addressable routes. `/` is Dashboard; `/snapshots` is Snapshots; `/analytics/overview` and `/analytics/investments` are Analytics sections; `/plan` and `/settings` are first-class destinations. `/analytics` redirects to `/analytics/overview`.
- Keep one persistent 72px desktop rail. On screens narrower than 760px, use a five-slot bottom bar: Dashboard, Snapshots, Add, Analytics, Plan. Settings remains a gear action in the page toolbar.
- Keep the date range contextual to Analytics. Store it in the URL for shareable/reloadable views and in local storage as the return default. Dashboard has its own chart-only 3M/1Y/All control. Snapshot filters only affect the records list.
- Use the same page toolbar, section rules, typography, spacing, asset colors, buttons, and dialog treatment across every route. The Add Snapshot dialog is brought into this system; it no longer owns a separate income/SIP editor.
- Keep recurring income, recurring expenses, market-return assumptions, reminder day, and emergency-fund target in Settings. Snapshot entries record balances, investments, optional notes, and structured one-off events.
- Save user inputs and preferences with the JSON dataset. Browser local storage remains a working draft/cache, not a server-side database.

## Information architecture and page hierarchy

| Route | Main job | Content order |
| --- | --- | --- |
| `/` | Understand latest recorded wealth | Latest snapshot amount and prior-snapshot change → peak drawdown pill → four supporting measures → date-based wealth chart and latest allocation → latest three snapshots |
| `/snapshots` | Review and edit records | All / With notes / Big moves → fully elapsed missing-month prompt → newest-first table → pagination |
| `/analytics/overview` | Explain change over time | Period and comparison anchor → selected-period net worth/chart → capital change vs unrealized movement → liquidity breakdown |
| `/analytics/investments` | Review portfolio performance | Period → annualized market XIRR with caveat → four asset unrealized-gain/loss charts → exact-value table |
| `/plan` | Track goals and financial pace | Multiple goals and explicit projections → savings-rate and runway states → links to inputs in Settings |
| `/settings` | Manage assumptions and local data | Profile/display/privacy → dated income and expense history → planning assumptions/reminder → save/reload/import/export |

The repeated reading order is **location and period → primary value → change and comparison → supporting measures → chart or records → next action**. Charts are oldest-to-newest. Snapshot lists are newest-to-oldest. Every delta names the prior snapshot or selected-period anchor.

## Design language

### Tokens

| Purpose | Light theme | Dark theme | Use |
| --- | --- | --- | --- |
| Canvas / base surface | `#F4F2ED` | `#1B1C19` | App background and page surfaces |
| Raised surface | `#FFFFFF` | `#252622` | Menus, dialogs, form controls |
| Primary ink | `#111111` | `#F4F2ED` | Headlines and values |
| Muted ink | `#6B6860` | `#A8A69E` | Labels, dates, helper text |
| Rule | `#DAD6CD` | `#41413A` | Section and table separators |
| Action / mutual funds | `#2447F5` | `#91A3FF` | Primary action, selected item, mutual funds |
| Stocks | `#FF6A3D` | `#FF9A78` | Stocks everywhere |
| NPS | `#B58CFF` | `#D0B6FF` | NPS everywhere |
| Crypto | `#E24C8B` | `#FF83B5` | Crypto everywhere |
| Liquid / other | `#1FB5A8` / `#9A968C` | `#69D1C1` / `#AAA69C` | Cash and other assets |
| Financial gain / loss | `#0B7A43` / `#C62828` | `#61D394` / `#FF8179` | Financial direction only |
| Pending notification | `#D7263D` | `#FF6378` | Bell dot only |

Typography uses the system SF stack with Inter fallback, tabular numerals, 400/500/600/700 weights, 56–88px display values, 28–34px section headings, 15–17px body, and 12px uppercase eyebrows. Use 4px spacing steps, 12px control radius, 20px surface radius, 28px feature radius, a 12-column content grid, flush-left type, and a 2px ink rule above major sections. Prefer whitespace and rules over a card for every block.

## Data schema v2

```json
{
  "schemaVersion": 2,
  "entries": [
    {
      "id": "YYYY-MM-DD",
      "date": "YYYY-MM-DD",
      "liquid": { "bank": 0, "sodexo": 0 },
      "hard_assets": { "stocks_wallet": 0, "fd": 0 },
      "market_assets": {},
      "oneOffs": [],
      "expenses_note": ""
    }
  ],
  "meta": { "currency": "INR", "created": "", "last_updated": "" },
  "incomeHistory": [{ "from": "YYYY-MM-DD", "monthlyAmount": 0 }],
  "expenseHistory": [{ "from": "YYYY-MM-DD", "monthlyAmount": 0 }],
  "goals": [],
  "settings": {},
  "preferences": { "version": 2, "notifications": {} }
}
```

`incomeHistory` and `expenseHistory` are dated, effective monthly amounts. `settings` holds profile/display/privacy preferences, default landing page, expected annual market return (optional), emergency-fund target months, and snapshot reminder day. `goals` stores user-entered target name, amount, optional target date, and timestamps. `oneOffs` contains an ID, inflow/outflow type, amount, and label associated with a snapshot. Estimated dates, savings rates, drawdowns, and runway are derived and are never stored as user facts.

### Migration from the current file

1. Decode existing records and preserve their dates, balances, investment values, notes, and metadata.
2. Drop per-snapshot `income.in_hand` and `sip` fields as explicitly requested. Do not guess a monthly income schedule or infer regular SIPs from invested-principal deltas; those inputs will be re-entered in Settings if needed.
3. If the old optional `preferences.shortTermGoal` exists, move it to `goals[]` while preserving its amount/date. Keep notification dismissals.
4. Initialize missing `oneOffs`, histories, preferences, and settings defaults. Set `schemaVersion` to 2; reject files from a future unsupported version.
5. Validate dates, IDs, amounts, settings, and goal records. Save atomically through the existing temporary-file-and-rename path.

The working `data.json` has been migrated to schema v2. It retains all 49 snapshot dates, balances, investment values, notes, and metadata; per-snapshot in-hand and SIP fields are absent. Income and expense histories and goals start empty so they can be entered in Settings and Plan. The file remains local and is not uploaded to an external service.

## Implementation sequence and acceptance checks

### 1. JSON schema and migration

- [x] Define v2 types and initialize defaults in Go and TypeScript.
- [x] Migrate old goal preferences, drop per-entry income/SIP, and retain notification state.
- [x] Add validation for goals, histories, and structured one-off events.
- [x] Apply the migration to the working `data.json` after the migration tests pass; inspect only schema, field names, and counts after writing.

### 2. Routing and application shell

- [x] Add deep routes and `/analytics` redirect.
- [x] Add 72px rail, five-slot responsive bottom navigation, shared toolbar, notification center, settings entry point, and data/status menu.
- [x] Add `g` then `d/s/a/p`, `Cmd/Ctrl+K` search, and `?` shortcut help; ignore shortcut keys in form controls.
- [x] Verify direct analytics route load, browser back/forward, custom-range URL persistence, and mobile scroll restoration; route links were also checked at phone width.

### 3. Dashboard and Snapshots

- [x] Keep the dashboard tied to the latest snapshot and reduce the support strip to four measures.
- [x] Move peak drawdown into the hero; show largest allocation in the Allocation section without a fixed concentration threshold.
- [x] Add local 3M/1Y/All chart control and limit recent history to three records.
- [x] Keep percentage-ranked Top 5/Top 10 big moves, note filtering, editing, and missing-month prompts.
- [x] Remove the income/SIP modal; add structured one-off events to the snapshot editor.
- [x] Review the Add Snapshot editor at 390px and confirm a structured one-off event persists with the snapshot in a synthetic JSON fixture. The browser viewport does not emulate a phone's on-screen keyboard.

### 4. Analytics

- [x] Split overview and investments into route-backed tabs and lazy-load the analytics page.
- [x] Use exact calendar cutoffs and the nearest saved snapshot on/before a cutoff for comparison.
- [x] Keep date range contextual to Analytics, including custom dates in the URL.
- [x] Retain capital-vs-market reconciliation, liquidity, money-weighted XIRR, and four per-asset unrealized-gain/loss charts.
- [ ] Confirm empty and one-snapshot states. Short-history, custom-date, and masked states were reviewed; the custom period remained in the URL through route navigation and browser back/forward.

### 5. Plan and Settings

- [x] Add multiple goals with amount, optional user target date, and distinct calculated scenario dates.
- [x] Render goals as an Apple-style horizontal scroll-snap card rail with the add-goal action in the section header.
- [x] Add dated income/expense history and assumption inputs in Settings.
- [x] Derive savings rate and emergency runway only when the corresponding input exists; otherwise explain what to enter.
- [x] Include JSON save, reload, import, and export actions.
- [x] Confirm goal progress with a positive pace, missing-input guidance, goal-prompt completion, and notification snooze/dismiss behavior using synthetic data. A negative-pace fixture remains unreviewed.

### 6. Verification and finish

- [x] Add route, range parsing, and frontend migration tests.
- [x] Update Go tests for the v2 migration and exact range anchor behavior.
- [x] Run `go test ./...`, `npm test`, and `npm run build` after final changes.
- [x] Review layouts at 1440px, 1024px, and 390px; check for horizontal overflow and inspect the light/dark theme treatment.
- [x] Re-check the final `data.json` schema and confirm old per-snapshot income/SIP fields are absent.

