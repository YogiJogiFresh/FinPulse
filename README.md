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
