# FinPulse 💰

A standalone desktop application for tracking personal finances and managing budgets. No server, no database setup — just install and run.

## Features

- Track multiple financial accounts (checking, savings, credit cards, investments)
- Record and categorize transactions (income, expenses, transfers)
- Set monthly budget limits by category with visual progress tracking
- Dashboard with spending charts, budget progress, and financial overview
- All data stored locally in a SQLite database file

## Tech Stack

- **Desktop:** Electron
- **Frontend:** Vue 3 + TypeScript + PrimeVue + Chart.js
- **Database:** SQLite (via sql.js, stored in `%APPDATA%/FinPulse/finpulse.db`)
- **IPC:** Electron contextBridge (no HTTP server needed)

## Prerequisites

- Node.js 18+

## Getting Started

### Install dependencies

```bash
cd client && npm install
cd ../electron && npm install
```

### Development

```bash
# Start the Vite dev server
cd client && npm run dev

# In a separate terminal, launch Electron
cd electron && npm run dev
```

### Production Build

```bash
npm run electron:build
```

The installer is created at `electron/release/FinPulse Setup X.X.X.exe`.

## Distributing

To share the app with others, just send them the **`FinPulse Setup 1.0.0.exe`** file from `electron/release/`. They double-click it to install — no Node.js, no database, no setup required.

- The installer creates a desktop shortcut and start menu entry
- Data is stored per-user in `%APPDATA%/FinPulse/finpulse.db`
- To uninstall, use Windows "Add or Remove Programs"

## How to Share

Share FinPulse with friends and family — they'll get automatic update prompts whenever you release a new version.

### First-time setup for your friend

1. Go to the [latest release](https://github.com/YogiJogiFresh/FinPulse/releases/latest)
2. Download **`FinPulse Setup X.X.X.exe`**
3. Run the installer — no Node.js, database, or other setup required
4. Data is stored locally in `%APPDATA%/FinPulse/finpulse.db`

### How auto-update works

When the app launches, it checks GitHub Releases for a newer version:

1. If an update is found → a dialog asks **"Download"** or **"Later"**
2. After downloading → a dialog asks **"Restart Now"** or **"Later"**
3. If they choose "Later", the update installs automatically the next time the app closes

### Publishing a new version

When you're ready to release an update:

1. Bump the version in `electron/package.json`
2. Build the installer:
   ```bash
   npm run electron:build
   ```
3. Create a GitHub release with the artifacts:
   ```bash
   gh release create vX.X.X \
     "electron/release/FinPulse Setup X.X.X.exe" \
     "electron/release/latest.yml" \
     "electron/release/FinPulse Setup X.X.X.exe.blockmap" \
     --title "FinPulse vX.X.X" \
     --notes "Release notes here"
   ```
4. Everyone running the app will be prompted to update on their next launch

## Project Structure

```
FinPulse/
├── package.json              # Root workspace scripts
├── tsconfig.base.json        # Shared TypeScript config
├── client/                   # Vue 3 frontend
│   ├── src/
│   │   ├── main.ts           # App entry point
│   │   ├── App.vue           # Root component
│   │   ├── components/       # Reusable components
│   │   ├── views/            # Page components (Dashboard, Accounts, Transactions, Budget)
│   │   ├── router/           # Vue Router config
│   │   ├── services/         # IPC API service layer
│   │   └── types/            # TypeScript type definitions
│   └── package.json
└── electron/                 # Electron main process
    ├── main.ts               # Window creation, SQLite init
    ├── preload.ts            # Exposes IPC API to renderer
    ├── database.ts           # SQLite setup and helpers
    ├── ipc/                  # IPC handlers
    │   ├── accounts.ts       # Account CRUD
    │   ├── transactions.ts   # Transaction CRUD + summaries
    │   ├── budget.ts         # Budget CRUD + progress
    │   └── index.ts          # Handler registration
    └── package.json
```
