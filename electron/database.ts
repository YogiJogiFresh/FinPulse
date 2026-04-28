import initSqlJs, { Database } from 'sql.js';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

let db: Database | null = null;

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

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

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
    CREATE TABLE IF NOT EXISTS account_history (
      id TEXT PRIMARY KEY,
      account_name TEXT NOT NULL,
      date TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      tag TEXT NOT NULL DEFAULT '',
      UNIQUE(account_name, date)
    )
  `);

  // Migrate: add tag column to account_history if missing
  try {
    db.run('ALTER TABLE account_history ADD COLUMN tag TEXT NOT NULL DEFAULT \'\'');
  } catch {
    // Column already exists
  }

  // Migrate: add 'retirement' to accounts type CHECK constraint
  try {
    const rows = db.exec('SELECT id, name, type, balance, currency, created_at FROM accounts');
    if (rows.length > 0) {
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
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      for (const row of existingRows) {
        db.run('INSERT INTO accounts (id, name, type, balance, currency, created_at) VALUES (?, ?, ?, ?, ?, ?)', row as any[]);
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

  // Indexes for frequently queried columns
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_date_type ON transactions(date, type)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_date_category ON transactions(date, category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_income_distributions_income_id ON income_distributions(income_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_property_details_property_id ON property_details(property_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_property_expenses_property_id ON property_expenses(property_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_property_contractors_property_id ON property_contractors(property_id)');

  // Insert default settings if not present
  const defaults: [string, string][] = [
    ['theme', 'dark'],
    ['federal_tax_rate', '22'],
    ['state_tax_rate', '5']
  ];
  for (const [key, value] of defaults) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  return db;
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function saveDatabase(): void {
  if (!db) return;
  const dbPath = path.join(app.getPath('userData'), 'finpulse.db');
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
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
