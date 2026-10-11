# FinPulse 💰

A standalone desktop application for tracking personal finances and managing budgets. No server, no database setup — just install and run.

## Features

- Track multiple financial accounts (checking, savings, credit cards, investments)
- Record and categorize transactions (income, expenses, transfers)
- Set monthly budget limits by category with visual progress tracking
- Dashboard with spending charts, budget progress, and financial overview
- Optional Plaid bank linking for account balances and transaction sync
- All data stored locally in a SQLite database file

## Tech Stack

- **Desktop:** Electron
- **Frontend:** Vue 3 + TypeScript + PrimeVue + Chart.js
- **Database:** SQLite (via sql.js, stored in `%APPDATA%/FinPulse/finpulse.db`)
- **IPC:** Electron contextBridge (no HTTP server needed)

## Development and Production Profiles

FinPulse isolates development and packaged Production data before Electron initializes any local
storage:

- Development uses `%APPDATA%\FinPulse-Dev` and permits Plaid Sandbox credentials only.
- The packaged app uses `%APPDATA%\FinPulse` and permits Plaid Production credentials only.

The first development start after this separation moves the legacy
`%APPDATA%\finpulse-electron` profile to `%APPDATA%\FinPulse-Dev` when the Development target does
not already exist. This keeps the existing Sandbox database, encrypted Plaid tokens, notifications,
and backups in Development. Production does not copy the legacy profile and starts with its own
clean data.

If both the legacy and Development directories already exist, FinPulse leaves both untouched and
logs a warning instead of merging or overwriting data. Backups and restores remain inside the
active profile and cannot cross the Development/Production boundary through the app.

## Plaid Bank Sync

FinPulse supports standalone, bring-your-own-credentials Plaid integration. Each user supplies
credentials from their own Plaid developer account; FinPulse does not require a hosted backend.
The active runtime profile fixes the allowed Plaid environment: Sandbox in Development and
Production in the packaged app.

1. Create a Plaid developer account and open **Team Settings → Keys** in the
   [Plaid Dashboard](https://dashboard.plaid.com/team/keys).
2. Start with the Sandbox Client ID and Sandbox secret.
3. In FinPulse, open **Settings → Plaid Bank Sync**, save the credentials, and select
   **Connect Institution**.
4. For Sandbox institutions, use Plaid's test credentials: `user_good` / `pass_good`.

Plaid credentials and access tokens are encrypted using Electron `safeStorage` and remain on the
local machine. They are never stored in the SQLite database or exposed back to the renderer.
**Connect Institution** opens Plaid Hosted Link in the default system browser. FinPulse waits up to
two minutes for completion and can stop waiting with **Cancel**; cancelling does not close the
external browser tab. Imported balances and transactions are stored in the local FinPulse database.
Clearing Plaid revokes each Item before deleting its local token; failed revocations retain the token
so removal can be retried.

Each successful sync records the latest balance snapshot for every linked account on the current
local calendar day. Syncing again on the same day updates that day's point; syncing on a later day
adds a new point. Snapshots are retained indefinitely and remain available in **Historical Net
Worth** after an institution is disconnected.

Automatic sync can run on the first day, last day, or both at a configurable local time. Both
boundaries default to enabled at 9:00 AM. FinPulse must be open to run at the selected time. If the
app was closed or asleep, it performs one catch-up sync with current data on the next launch or
resume; it never backdates a current balance to a missed date. Manual Sync All and per-institution
sync remain available.

Automatic and manual runs retrieve balances through `/accounts/balance/get` and incremental
transactions through `/transactions/sync`. Plaid implements these read operations as HTTP POST
requests so credentials can be sent in the request body, but FinPulse does not invoke payment,
transfer, or institution-modification products. Transaction webhooks are not used because a
desktop-only app has no continuously reachable public HTTPS endpoint; transactions are polled
during scheduled and manual syncs instead.

Plaid's Accounts and Balance APIs do not provide older balance history, so FinPulse does not
estimate prior balances. Users with true historical records can import them from Excel. Plaid Asset
Reports are intentionally not used: they are limited to 731 days, require institutions to be linked
with the Assets product, and Production or Additional History usage may incur fees.

Plaid credit cards, loans, and mortgages are classified as liabilities. They appear as positive
amounts owed in the Accounts **Liabilities** section and on the Debts page, but are subtracted from
Dashboard, Historical Net Worth, and Projection totals. When a manually entered debt appears to
match a Plaid liability, FinPulse asks before merging them. A merged row uses Plaid's live balance
and type while retaining the manual monthly payment, APR, and notes, so the liability is counted
only once. FinPulse does not enable Plaid's separate Liabilities product; payment and APR metadata
remain manually managed.

Credit cards are presented separately from loans and mortgages because they are revolving
liabilities. FinPulse shows the live current balance, Plaid credit limit and utilization when
available, a manually entered statement balance, payment strategy, APR, and notes. New cards default
to **Pay in full**:

- A statement balance entered during the current month is used as the planned payment.
- If no current statement balance exists, the live current balance is used.
- Older statement balances remain visible but are marked stale and are not used for budgeting.
- A card can instead use a custom monthly target or be excluded from the monthly payment budget.

Dashboard shows credit-card balances separately from loan debt. Both still reduce net worth, while
Monthly Debt Payments combines fixed loan payments with each card's calculated planned payment.

> [!WARNING]
> A distributed desktop app cannot protect an API secret as strongly as a hosted backend. This mode
> is intended for personal use where each user owns the Plaid credentials. Live institutions require
> Plaid Production approval. OAuth and non-OAuth authentication are handled by Plaid Hosted Link in
> the user's default browser.

## Notification History

FinPulse keeps the newest 100 app notifications in the local database so short-lived pop-up toasts
can be reviewed later. Use the bell in the global header to open the notification drawer from any
page.

- Success, information, warning, and error toasts are stored across app restarts.
- Important background events, such as an automatic Plaid sync failure, are also stored.
- Plaid sync notifications show generic account and transaction change totals immediately. Use
  **Details** to view the specific accounts and dated transactions that changed.
- Opening the drawer marks all notifications read and clears the unread badge.
- Dismissing a notification permanently removes that entry.
- **Clear All** requires confirmation and permanently removes the full notification history.
- Settings **Clear All Data** intentionally preserves notifications for auditability.

Pop-up toasts retain their existing short duration; the drawer is the persistent record.

## Local Backups

FinPulse creates one automatic local backup per day while the app is running and retains 30 daily
versions, 10 manual versions, and 5 pre-restore safety versions. Open
**Settings → Local Backup & Restore** to create a backup immediately, inspect the backup folder, or
restore a prior version.

Each version is stored under the Electron user-data `backups` directory and contains:

- the complete `finpulse.db` SQLite database;
- `plaid-secrets.json` when Plaid is configured, still encrypted by Electron `safeStorage`;
- a versioned manifest containing file sizes and SHA-256 integrity hashes.

Before restoring, FinPulse validates the backup and creates a separate pre-restore safety backup of
the current state. It then replaces both the database and encrypted Plaid secret file and restarts
the app. Restoring a version without Plaid credentials removes the current encrypted credential
file. Because Plaid credentials are protected by the operating-system account, a backup copied to
another computer or user account may restore the financial database but may not be able to decrypt
the Plaid credentials.

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

Share FinPulse with friends and family — they'll get automatic update prompts whenever you publish
a stable version.

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

Run `npm run electron:release`, choose the semantic version bump, and let the release script build,
commit the version bump, and publish the installer.

Every release includes `latest.yml` and the blockmap for automatic updates. When `CSC_LINK` and
`CSC_KEY_PASSWORD` are configured, the script verifies the Authenticode signature before
publishing. You may set `FINPULSE_SIGNING_SUBJECT` to require an exact certificate subject.

Without signing configuration, the script publishes an unsigned stable release with automatic
update metadata. Windows may show an unknown-publisher or SmartScreen warning. If signing was
configured but did not produce a valid signature, publishing still stops rather than silently
downgrading the release.

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
