import initSqlJs, { Database } from 'sql.js';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

let db: Database | null = null;
let databaseSavesSuspended = false;

export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      if (app.isPackaged) {
        return path.join(process.resourcesPath, file);
      }
      return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file);
    }
  });

  const dbPath = path.join(app.getPath('userData'), 'finpulse.db');

  let fileBuffer: Buffer | null = null;
  if (fs.existsSync(dbPath)) {
    fileBuffer = fs.readFileSync(dbPath);
  }

  db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('checking','savings','credit_card','investment','retirement','cash','other')),
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const accountMetadataColumns = [
    "source TEXT NOT NULL DEFAULT 'manual'",
    "institution_name TEXT NOT NULL DEFAULT ''",
    "plaid_account_id TEXT NOT NULL DEFAULT ''",
    "plaid_type TEXT NOT NULL DEFAULT ''",
    "plaid_subtype TEXT NOT NULL DEFAULT ''",
    "mask TEXT NOT NULL DEFAULT ''",
    "credit_limit REAL",
    "available_credit REAL",
    "is_liability INTEGER NOT NULL DEFAULT 0",
    "liability_type TEXT NOT NULL DEFAULT ''"
  ];
  for (const column of accountMetadataColumns) {
    try {
      db.run(`ALTER TABLE accounts ADD COLUMN ${column}`);
    } catch {
      // Column already exists
    }
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS budget_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      monthly_limit REAL NOT NULL,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('student_loan','car_loan','mortgage','credit_card','personal_loan','medical','other')),
      current_balance REAL NOT NULL DEFAULT 0,
      monthly_payment REAL NOT NULL DEFAULT 0,
      interest_rate REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  try {
    db.run("ALTER TABLE debts ADD COLUMN linked_account_id TEXT");
  } catch {
    // Column already exists
  }
  try {
    db.run("ALTER TABLE debts ADD COLUMN payment_strategy TEXT NOT NULL DEFAULT 'fixed'");
  } catch {
    // Column already exists
  }
  try {
    db.run('ALTER TABLE debts ADD COLUMN statement_balance REAL');
  } catch {
    // Column already exists
  }
  try {
    db.run('ALTER TABLE debts ADD COLUMN statement_balance_as_of TEXT');
  } catch {
    // Column already exists
  }
  db.run(`
    UPDATE debts SET payment_strategy = 'pay_in_full'
    WHERE type = 'credit_card' AND payment_strategy = 'fixed'
  `);
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_debts_linked_account
    ON debts(linked_account_id)
    WHERE linked_account_id IS NOT NULL AND linked_account_id != ''
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS liability_match_ignores (
      account_id TEXT NOT NULL,
      debt_id TEXT NOT NULL,
      PRIMARY KEY (account_id, debt_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS income_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      yearly_salary REAL NOT NULL DEFAULT 0,
      monthly_take_home REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS income_distributions (
      id TEXT PRIMARY KEY,
      income_id TEXT NOT NULL REFERENCES income_sources(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS app_notifications (
      id TEXT PRIMARY KEY,
      severity TEXT NOT NULL CHECK(severity IN ('success', 'info', 'warn', 'error')),
      summary TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      expanded_detail TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'app',
      created_at TEXT NOT NULL,
      read_at TEXT
    )
  `);
  try {
    db.run("ALTER TABLE app_notifications ADD COLUMN expanded_detail TEXT NOT NULL DEFAULT ''");
  } catch { /* Column already exists */ }
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_app_notifications_created
    ON app_notifications(created_at DESC)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_app_notifications_unread
    ON app_notifications(read_at)
    WHERE read_at IS NULL
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS account_history (
      id TEXT PRIMARY KEY,
      account_name TEXT NOT NULL,
      date TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      tag TEXT NOT NULL DEFAULT ''
    )
  `);

  // Migrate: add tag column to account_history if missing
  try {
    db.run('ALTER TABLE account_history ADD COLUMN tag TEXT NOT NULL DEFAULT \'\'');
  } catch {
    // Column already exists
  }

  try {
    db.run("ALTER TABLE account_history ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
  } catch {
    // Column already exists
  }
  try {
    db.run("ALTER TABLE account_history ADD COLUMN source_account_id TEXT NOT NULL DEFAULT ''");
  } catch {
    // Column already exists
  }
  try {
    db.run('ALTER TABLE account_history ADD COLUMN balance_effect REAL NOT NULL DEFAULT 1');
  } catch {
    // Column already exists
  }

  const historySchema = db.exec(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'account_history'"
  );
  const historyColumns = db.exec('PRAGMA table_info(account_history)');
  const historyColumnNames = historyColumns[0]?.values.map(row => String(row[1])) || [];
  const needsHistoryRebuild =
    String(historySchema[0]?.values[0]?.[0] || '').includes('UNIQUE(account_name, date)') ||
    !historyColumnNames.includes('captured_at') ||
    !historyColumnNames.includes('sync_run_id') ||
    !historyColumnNames.includes('sync_trigger');

  if (needsHistoryRebuild) {
    db.run('ALTER TABLE account_history RENAME TO account_history_legacy');
    db.run(`
      CREATE TABLE account_history (
        id TEXT PRIMARY KEY,
        account_name TEXT NOT NULL,
        date TEXT NOT NULL,
        value REAL NOT NULL DEFAULT 0,
        tag TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'manual',
        source_account_id TEXT NOT NULL DEFAULT '',
        balance_effect REAL NOT NULL DEFAULT 1,
        captured_at TEXT NOT NULL DEFAULT (datetime('now')),
        sync_run_id TEXT NOT NULL DEFAULT '',
        sync_trigger TEXT NOT NULL DEFAULT 'manual'
      )
    `);
    db.run(`
      INSERT INTO account_history (
        id, account_name, date, value, tag, source, source_account_id, balance_effect,
        captured_at, sync_run_id, sync_trigger
      )
      SELECT
        id, account_name, date, value, tag, source, source_account_id, balance_effect,
        substr(date, 7, 4) || '-' || substr(date, 1, 2) || '-' || substr(date, 4, 2) || 'T00:00:00',
        '',
        CASE WHEN source = 'plaid' THEN 'legacy' ELSE 'manual' END
      FROM account_history_legacy
    `);
    db.run('DROP TABLE account_history_legacy');
  }

  db.run(`
    UPDATE account_history
    SET source = 'plaid', source_account_id = substr(tag, 7)
    WHERE tag LIKE 'plaid:%' AND source_account_id = ''
  `);

  db.run('DROP INDEX IF EXISTS idx_account_history_plaid_month');
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_account_history_plaid_day
    ON account_history(source_account_id, date)
    WHERE source = 'plaid' AND source_account_id != ''
  `);
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_account_history_manual_day
    ON account_history(account_name, date)
    WHERE source != 'plaid'
  `);

  // Migrate: add 'retirement' to accounts type CHECK constraint
  try {
    const schema = db.exec("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'accounts'");
    const needsRebuild = schema.length > 0 && !String(schema[0].values[0][0]).includes("'retirement'");
    if (needsRebuild) {
      const rows = db.exec(`
        SELECT id, name, type, balance, currency, created_at, updated_at, source,
               institution_name, plaid_account_id, plaid_type, plaid_subtype, mask,
               credit_limit, available_credit, is_liability, liability_type
        FROM accounts
      `);
      const existingRows = rows[0].values;
      db.run('DROP TABLE accounts');
      db.run(`
        CREATE TABLE accounts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('checking','savings','credit_card','investment','retirement','cash','other')),
          balance REAL NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'USD',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          source TEXT NOT NULL DEFAULT 'manual',
          institution_name TEXT NOT NULL DEFAULT '',
          plaid_account_id TEXT NOT NULL DEFAULT '',
          plaid_type TEXT NOT NULL DEFAULT '',
          plaid_subtype TEXT NOT NULL DEFAULT '',
          mask TEXT NOT NULL DEFAULT '',
          credit_limit REAL,
          available_credit REAL,
          is_liability INTEGER NOT NULL DEFAULT 0,
          liability_type TEXT NOT NULL DEFAULT ''
        )
      `);
      for (const row of existingRows) {
        db.run(
          `INSERT INTO accounts (
            id, name, type, balance, currency, created_at, updated_at, source,
            institution_name, plaid_account_id, plaid_type, plaid_subtype, mask,
            credit_limit, available_credit, is_liability, liability_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          row as any[]
        );
      }
    }
  } catch {
    // Table already has correct constraint or doesn't exist yet
  }

  // Migrate: add updated_at column if missing
  try {
    db.run("ALTER TABLE accounts ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))");
  } catch {
    // Column already exists
  }

  // Migrate: rename total_debt to current_balance in debts table
  try {
    db.run('ALTER TABLE debts RENAME COLUMN total_debt TO current_balance');
  } catch {
    // Column already renamed or doesn't exist
  }

  // Properties tables
  db.run(`
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      designation TEXT NOT NULL CHECK(designation IN ('primary_residence','rental')) DEFAULT 'primary_residence',
      address TEXT NOT NULL DEFAULT '',
      purchase_date TEXT NOT NULL DEFAULT '',
      purchase_price REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS property_details (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL CHECK(category IN ('systems','structure','appliances','other')) DEFAULT 'other',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS property_expenses (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      category TEXT NOT NULL CHECK(category IN ('maintenance','repair','improvement','tax','insurance','utility','hoa','other')) DEFAULT 'other',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS property_contractors (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL CHECK(specialty IN ('plumber','electrician','hvac','roofer','general','landscaper','painter','other')) DEFAULT 'other',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Drop legacy transactions table (old schema without bank/import columns)
  try {
    const cols = db.exec("PRAGMA table_info(transactions)");
    if (cols.length > 0) {
      const colNames = cols[0].values.map((r: any) => r[1]);
      if (!colNames.includes('bank')) {
        db.run('DROP TABLE transactions');
      }
    }
  } catch { /* table doesn't exist yet */ }

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      post_date TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      original_description TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      bank TEXT NOT NULL DEFAULT 'manual',
      account_label TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      import_batch TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS category_rules (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      category TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_bank ON transactions(bank)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_import_batch ON transactions(import_batch)');
  db.run('CREATE INDEX IF NOT EXISTS idx_category_rules_priority ON category_rules(priority DESC)');

  db.run(`
    CREATE TABLE IF NOT EXISTS plaid_items (
      item_id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL DEFAULT '',
      institution_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_synced_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS plaid_accounts (
      plaid_account_id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES plaid_items(item_id) ON DELETE CASCADE,
      local_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE(local_account_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS plaid_sync_state (
      item_id TEXT PRIMARY KEY REFERENCES plaid_items(item_id) ON DELETE CASCADE,
      cursor TEXT NOT NULL DEFAULT ''
    )
  `);

  try {
    db.run("ALTER TABLE transactions ADD COLUMN plaid_transaction_id TEXT");
  } catch { /* Column already exists */ }
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_plaid_id ON transactions(plaid_transaction_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item_id ON plaid_accounts(item_id)');
  db.run(`
    UPDATE accounts
    SET source = 'plaid',
        institution_name = COALESCE((
          SELECT pi.institution_name
          FROM plaid_accounts pa
          JOIN plaid_items pi ON pi.item_id = pa.item_id
          WHERE pa.local_account_id = accounts.id
        ), institution_name),
        plaid_account_id = COALESCE((
          SELECT pa.plaid_account_id
          FROM plaid_accounts pa
          WHERE pa.local_account_id = accounts.id
        ), plaid_account_id),
        is_liability = CASE WHEN type = 'credit_card' THEN 1 ELSE is_liability END,
        liability_type = CASE
          WHEN type = 'credit_card' AND liability_type = '' THEN 'credit_card'
          ELSE liability_type
        END
    WHERE id IN (SELECT local_account_id FROM plaid_accounts)
  `);
  db.run(`
    UPDATE account_history
    SET balance_effect = -1
    WHERE source = 'plaid'
      AND source_account_id IN (SELECT id FROM accounts WHERE is_liability = 1)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bank_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date_column TEXT NOT NULL DEFAULT 'Transaction Date',
      post_date_column TEXT NOT NULL DEFAULT '',
      description_column TEXT NOT NULL DEFAULT 'Description',
      amount_type TEXT NOT NULL DEFAULT 'signed',
      amount_column TEXT NOT NULL DEFAULT 'Amount',
      debit_column TEXT NOT NULL DEFAULT '',
      credit_column TEXT NOT NULL DEFAULT '',
      detection_fields TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migrate: add recurring columns to property_expenses
  try {
    db.run("ALTER TABLE property_expenses ADD COLUMN recurring TEXT NOT NULL DEFAULT ''");
  } catch { /* Column already exists */ }
  try {
    db.run("ALTER TABLE property_expenses ADD COLUMN recurring_end_date TEXT NOT NULL DEFAULT ''");
  } catch { /* Column already exists */ }

  // Migrate: add custom_columns to bank_configs
  try {
    db.run("ALTER TABLE bank_configs ADD COLUMN custom_columns TEXT NOT NULL DEFAULT '[]'");
  } catch { /* Column already exists */ }

  // Migrate: add custom_data to transactions
  try {
    db.run("ALTER TABLE transactions ADD COLUMN custom_data TEXT NOT NULL DEFAULT '{}'");
  } catch { /* Column already exists */ }

  // Indexes for frequently queried columns
  db.run('CREATE INDEX IF NOT EXISTS idx_income_distributions_income_id ON income_distributions(income_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_property_details_property_id ON property_details(property_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_property_expenses_property_id ON property_expenses(property_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_property_contractors_property_id ON property_contractors(property_id)');

  // Insert default settings if not present
  const defaults: [string, string][] = [
    ['theme', 'dark'],
    ['federal_tax_rate', '22'],
    ['state_tax_rate', '5'],
    ['plaid_auto_sync_first_enabled', 'true'],
    ['plaid_auto_sync_last_enabled', 'true'],
    ['plaid_auto_sync_time', '09:00']
  ];
  for (const [key, value] of defaults) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  // Seed default bank configs if empty
  const bankCount = db.exec('SELECT COUNT(*) FROM bank_configs');
  const count = bankCount.length > 0 ? (bankCount[0].values[0][0] as number) : 0;
  if (count === 0) {
    const defaultBanks = [
      { id: 'capital_one', name: 'Capital One', date_column: 'Transaction Date', post_date_column: 'Posted Date', description_column: 'Description', amount_type: 'split', amount_column: '', debit_column: 'Debit', credit_column: 'Credit', detection_fields: 'Debit,Credit,Posted Date', custom_columns: JSON.stringify([
        { csvHeader: 'Transaction Date', displayName: 'Date' },
        { csvHeader: 'Posted Date', displayName: 'Post Date' },
        { csvHeader: 'Description', displayName: 'Description' },
        { csvHeader: 'Card No.', displayName: 'Card No.' },
        { csvHeader: 'Category', displayName: 'Category' },
        { csvHeader: 'Debit', displayName: 'Debit' },
        { csvHeader: 'Credit', displayName: 'Credit' }
      ]) },
      { id: 'chase', name: 'Chase', date_column: 'Transaction Date', post_date_column: 'Post Date', description_column: 'Description', amount_type: 'signed', amount_column: 'Amount', debit_column: '', credit_column: '', detection_fields: 'Transaction Date,Post Date,Type,Amount', custom_columns: JSON.stringify([
        { csvHeader: 'Transaction Date', displayName: 'Date' },
        { csvHeader: 'Post Date', displayName: 'Post Date' },
        { csvHeader: 'Description', displayName: 'Description' },
        { csvHeader: 'Category', displayName: 'Category' },
        { csvHeader: 'Type', displayName: 'Type' },
        { csvHeader: 'Amount', displayName: 'Amount' },
        { csvHeader: 'Memo', displayName: 'Memo' }
      ]) },
      { id: 'citi', name: 'Citi', date_column: 'Date', post_date_column: '', description_column: 'Description', amount_type: 'split', amount_column: '', debit_column: 'Debit', credit_column: 'Credit', detection_fields: 'Status,Debit,Credit', custom_columns: JSON.stringify([
        { csvHeader: 'Status', displayName: 'Status' },
        { csvHeader: 'Date', displayName: 'Date' },
        { csvHeader: 'Description', displayName: 'Description' },
        { csvHeader: 'Debit', displayName: 'Debit' },
        { csvHeader: 'Credit', displayName: 'Credit' }
      ]) },
      { id: 'synchrony', name: 'Synchrony', date_column: 'Date', post_date_column: '', description_column: 'Description', amount_type: 'signed', amount_column: 'Amount', debit_column: '', credit_column: '', detection_fields: 'Date,Description,Amount', custom_columns: JSON.stringify([
        { csvHeader: 'Date', displayName: 'Date' },
        { csvHeader: 'Description', displayName: 'Description' },
        { csvHeader: 'Amount', displayName: 'Amount' }
      ]) },
    ];
    for (const b of defaultBanks) {
      db.run(
        `INSERT INTO bank_configs (id, name, date_column, post_date_column, description_column, amount_type, amount_column, debit_column, credit_column, detection_fields, custom_columns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.id, b.name, b.date_column, b.post_date_column, b.description_column, b.amount_type, b.amount_column, b.debit_column, b.credit_column, b.detection_fields, b.custom_columns]
      );
    }
    saveDatabase();
  } else {
    // Migrate existing default banks to include custom_columns if empty
    const defaultMappings: Record<string, { csvHeader: string; displayName: string }[]> = {
      capital_one: [
        { csvHeader: 'Transaction Date', displayName: 'Date' },
        { csvHeader: 'Posted Date', displayName: 'Post Date' },
        { csvHeader: 'Description', displayName: 'Description' },
        { csvHeader: 'Card No.', displayName: 'Card No.' },
        { csvHeader: 'Category', displayName: 'Category' },
        { csvHeader: 'Debit', displayName: 'Debit' },
        { csvHeader: 'Credit', displayName: 'Credit' }
      ],
      chase: [
        { csvHeader: 'Transaction Date', displayName: 'Date' },
        { csvHeader: 'Post Date', displayName: 'Post Date' },
        { csvHeader: 'Description', displayName: 'Description' },
        { csvHeader: 'Category', displayName: 'Category' },
        { csvHeader: 'Type', displayName: 'Type' },
        { csvHeader: 'Amount', displayName: 'Amount' },
        { csvHeader: 'Memo', displayName: 'Memo' }
      ],
      citi: [
        { csvHeader: 'Status', displayName: 'Status' },
        { csvHeader: 'Date', displayName: 'Date' },
        { csvHeader: 'Description', displayName: 'Description' },
        { csvHeader: 'Debit', displayName: 'Debit' },
        { csvHeader: 'Credit', displayName: 'Credit' }
      ],
      synchrony: [
        { csvHeader: 'Date', displayName: 'Date' },
        { csvHeader: 'Description', displayName: 'Description' },
        { csvHeader: 'Amount', displayName: 'Amount' }
      ]
    };
    for (const [id, cols] of Object.entries(defaultMappings)) {
      db.run(
        `UPDATE bank_configs SET custom_columns = ? WHERE id = ? AND (custom_columns = '[]' OR custom_columns = '')`,
        [JSON.stringify(cols), id]
      );
    }
    saveDatabase();
  }

  return db;
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function saveDatabase(): void {
  if (!db || databaseSavesSuspended) return;
  const dbPath = path.join(app.getPath('userData'), 'finpulse.db');
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export function setDatabaseSavesSuspended(suspended: boolean): void {
  databaseSavesSuspended = suspended;
}

export function generateId(): string {
  return crypto.randomBytes(12).toString('hex');
}

/** Execute a parameterized SELECT and return rows as objects */
export function query(sql: string, params: any[] = []): any[] {
  const d = getDatabase();
  const stmt = d.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}
