# FinDash

FinDash is a privacy-first, local-first financial dashboard for macOS.
It runs as a single Go binary that serves an embedded React frontend, stores data in a human-readable local `data.json`, and keeps the browser working state in `localStorage` for fast edits and near-real-time chart updates.

## What It Does

- Tracks financial snapshots at day-level (`YYYY-MM-DD`)
- Maintains income and expense history as effective-dated monthly amounts
- Manages goal tracking with target amounts and dates
- Computes derived metrics such as net worth, hard capital, liquid buffer, unrealized gain, and contribution analytics
- Computes XIRR on demand across:
  - life portfolio
  - market portfolio
  - per-asset lenses
- Supports privacy mode for masking financial values
- Supports date-range views like `1M`, `3M`, `6M`, `1Y`, `3Y`, `5Y`, and `All`
- Saves explicitly to `data.json` with atomic file replacement

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS + Chart.js
- Backend: Go + `net/http`
- Storage: local `data.json`
- Packaging: React bundle embedded into the Go binary
- Build and run workflows: `Makefile`

## Project Layout

```text
financial-dashboard/
├── api/                 # HTTP handlers and routes
├── calc/                # Metrics and XIRR engine
├── store/               # Data model, validation, atomic persistence
├── frontend/            # React app source and production build
├── Makefile             # Common workflow commands
├── main.go              # App entrypoint and asset embed
└── README.md
```

The app creates a dataset with sample data at the configured data file
on first run. Build outputs, local data, and machine-specific files are
not part of the source tree.

## Quick Start

### 1. Install frontend dependencies

```bash
make install
```

### 2. Build the production app

```bash
make build
```

### 3. Configure (optional)

```bash
cp .env.example .env
```

With `.env` in place, `make run` serves the tracked `data.example.json` demo
dataset. For real data, point `DATA_FILE` at a location outside the repo.

### 4. Run it locally

```bash
make run
```

Then open:

```text
http://localhost:8080
```

## Common Commands

```bash
make help            # Show available commands
make install         # Install frontend dependencies
make frontend-build  # Build the React production bundle
make backend-build   # Build the Go binary
make build           # Build frontend and backend
make rebuild         # Clean and rebuild everything
make test            # Run Go tests
make run             # Build and run in foreground
make run-backend     # Run existing binary in foreground
make clean           # Remove build artifacts
make clean-cache     # Remove Go cache
```

The Makefile also defines `start`, `stop`, `status`, and `logs` targets for a
macOS `launchctl` wrapper. The `./findash` wrapper is not included in this
checkout, so those daemon targets need that script before they can be used.

## Configuration

The Makefile loads machine-specific settings from a git-ignored `.env` file.
Copy the tracked example to get started:

```bash
cp .env.example .env
```

| Variable | Forwards as | Example |
| --- | --- | --- |
| `PORT` | `FINDASH_PORT` server env | `8080` |
| `DATA_FILE` | `FINDASH_DATA` server env | `data.example.json` demo default; `$(HOME)/your/folder/data.json` for personal data |

`DATA_FILE` accepts a make expression, so an absolute path like `$(HOME)/findash/data.json` works as written. Precedence: inline `make` overrides (e.g. `make run PORT=8081`) win over `.env`. Without `.env` the server falls back to its own built-in defaults.

## Data Model

The canonical dataset lives in `data.json`, stored outside this repository so personal data can never be committed — set the location with `DATA_FILE` in `.env` (for example `$(HOME)/findash/data.json`), or override per run with `make run DATA_FILE=/path/to/data.json`. The file is never committed.

```json
{
  "schemaVersion": 2,
  "entries": [
    {
      "id": "2025-03-31",
      "date": "2025-03-31",
      "liquid": { "bank": 52000, "sodexo": 3500 },
      "hardAssets": { "stocksWallet": 15000, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 200000, "current": 231000 },
        "nps": { "invested": 80000, "current": 88500 },
        "stockMarket": { "invested": 60000, "current": 54200 },
        "crypto": { "invested": 20000, "current": 27400 }
      },
      "oneOffs": [],
      "expensesNote": "Paid insurance premium"
    }
  ],
  "incomeHistory": [],
  "expenseHistory": [],
  "goals": [],
  "meta": {
    "currency": "INR",
    "created": "2025-01-01",
    "lastUpdated": "2025-03-31"
  }
}
```

### Field Notes

- all dataset keys are lowerCamelCase (`hardAssets`, `marketAssets`, `expensesNote`, `lastUpdated`)
- `marketAssets[*].invested` and `marketAssets[*].current` are cumulative snapshot values
- `incomeHistory` and `expenseHistory` store effective-dated monthly amounts (`from`, `monthlyAmount`)
- `data.json` is only updated when the user explicitly saves
- browser `localStorage` is the active working state during editing

## Local-First Behavior

On startup, the app:

1. Loads the browser working dataset from `localStorage` if available
2. Falls back to `data.json` from the backend if browser storage is empty
3. Keeps the browser copy active if browser and file data differ
4. Requires explicit `Save to File` or `Load File` to reconcile differences

Charts and summary cards update immediately when data is added or edited in the browser.
XIRR can be computed from the current in-browser dataset without requiring a file save first.

## API Endpoints

- `GET /api/data?range=<key>`
  - returns dataset, derived metrics, visible range entry ids, summary, and sync metadata
- `POST /api/save`
  - validates and persists the full dataset to `data.json`
- `GET /api/xirr?range=<key>`
  - computes XIRR from the saved dataset
- `POST /api/xirr?range=<key>`
  - computes XIRR from the current browser dataset payload

## Production Notes

- `data.json` writes are atomic through temp-file replacement
- the frontend bundle is embedded into the Go binary
- the app is intended for local use only
- the default currency is `INR`
- the default local port is `8080`

## Testing

Run the backend test suite with:

```bash
make test
```

This currently covers:

- dataset save/load behavior
- dataset seeding
- validation guardrails
- range filtering
- XIRR response structure

## Current Status

This repo includes:

- production frontend build
- embedded Go server
- sample dataset
- working local dashboard UI
- `Makefile`

Open the app at `http://localhost:8080` after `make run`.
