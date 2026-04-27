import { ipcMain } from 'electron';
import { getDatabase, saveDatabase, generateId, query } from '../database';

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function formatRow(row: any): any {
  const obj: any = {};
  for (const key of Object.keys(row)) {
    const camelKey = snakeToCamel(key);
    obj[camelKey] = row[key];
  }
  if (obj.id !== undefined) {
    obj._id = obj.id;
  }
  return obj;
}

function getMonthRange(): { startOfMonth: string; endOfMonth: string } {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  return { startOfMonth, endOfMonth };
}

export function registerTransactionHandlers(): void {
  ipcMain.handle('transactions:getAll', (_event, filters?: {
    accountId?: string;
    category?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.accountId) {
      conditions.push('t.account_id = ?');
      params.push(filters.accountId);
    }
    if (filters?.category) {
      conditions.push('t.category = ?');
      params.push(filters.category);
    }
    if (filters?.type) {
      conditions.push('t.type = ?');
      params.push(filters.type);
    }
    if (filters?.startDate) {
      conditions.push('t.date >= ?');
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push('t.date <= ?');
      params.push(filters.endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit ? `LIMIT ${Number(filters.limit)}` : '';

    const sql = `
      SELECT t.*, a.name as account_name
      FROM transactions t
      LEFT JOIN accounts a ON a.id = t.account_id
      ${where}
      ORDER BY t.date DESC
      ${limit}
    `;

    const rows = query(sql, params);
    return rows.map(formatRow);
  });

  ipcMain.handle('transactions:create', (_event, data: {
    accountId: string;
    date: string;
    description: string;
    amount: number;
    category: string;
    type: string;
    notes?: string;
  }) => {
    const db = getDatabase();
    const id = generateId();
    db.run(
      'INSERT INTO transactions (id, account_id, date, description, amount, category, type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.accountId, data.date, data.description, data.amount, data.category, data.type, data.notes ?? null]
    );
    // Update account balance
    db.run('UPDATE accounts SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?', [data.amount, data.accountId]);
    saveDatabase();
    const rows = query('SELECT t.*, a.name as account_name FROM transactions t LEFT JOIN accounts a ON a.id = t.account_id WHERE t.id = ?', [id]);
    return formatRow(rows[0]);
  });

  ipcMain.handle('transactions:update', (_event, data: { id: string; [key: string]: any }) => {
    const db = getDatabase();
    const { id, _id, ...fields } = data;
    const txnId = id || _id;

    // Get old transaction to reverse its amount
    const oldRows = query('SELECT * FROM transactions WHERE id = ?', [txnId]);
    if (oldRows.length === 0) throw new Error('Transaction not found');
    const oldTxn = oldRows[0];

    // Reverse old amount from account
    db.run('UPDATE accounts SET balance = balance - ?, updated_at = datetime(\'now\') WHERE id = ?', [oldTxn.amount, oldTxn.account_id]);

    // Build update
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      sets.push(`${col} = ?`);
      values.push(value);
    }
    sets.push("updated_at = datetime('now')");
    db.run(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`, [...values, txnId]);

    // Apply new amount to account
    const updatedRows = query('SELECT * FROM transactions WHERE id = ?', [txnId]);
    const newTxn = updatedRows[0];
    db.run('UPDATE accounts SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?', [newTxn.amount, newTxn.account_id]);

    saveDatabase();
    const rows = query('SELECT t.*, a.name as account_name FROM transactions t LEFT JOIN accounts a ON a.id = t.account_id WHERE t.id = ?', [txnId]);
    return formatRow(rows[0]);
  });

  ipcMain.handle('transactions:delete', (_event, data: { id: string }) => {
    const db = getDatabase();
    const oldRows = query('SELECT * FROM transactions WHERE id = ?', [data.id]);
    if (oldRows.length > 0) {
      const txn = oldRows[0];
      // Reverse amount from account balance
      db.run('UPDATE accounts SET balance = balance - ?, updated_at = datetime(\'now\') WHERE id = ?', [txn.amount, txn.account_id]);
    }
    db.run('DELETE FROM transactions WHERE id = ?', [data.id]);
    saveDatabase();
  });

  ipcMain.handle('transactions:summary', () => {
    const { startOfMonth, endOfMonth } = getMonthRange();
    const rows = query(
      `SELECT category, SUM(ABS(amount)) as total, COUNT(*) as count
       FROM transactions
       WHERE date >= ? AND date <= ? AND amount < 0
       GROUP BY category
       ORDER BY total DESC`,
      [startOfMonth, endOfMonth]
    );
    return rows;
  });

  ipcMain.handle('transactions:dashboard', () => {
    const { startOfMonth, endOfMonth } = getMonthRange();

    const balanceRows = query('SELECT SUM(balance) as total FROM accounts');
    const totalBalance = balanceRows[0]?.total ?? 0;

    const incomeRows = query(
      "SELECT SUM(amount) as total FROM transactions WHERE type = 'income' AND date >= ? AND date <= ?",
      [startOfMonth, endOfMonth]
    );
    const monthlyIncome = incomeRows[0]?.total ?? 0;

    const expenseRows = query(
      "SELECT SUM(ABS(amount)) as total FROM transactions WHERE type = 'expense' AND date >= ? AND date <= ?",
      [startOfMonth, endOfMonth]
    );
    const monthlyExpenses = expenseRows[0]?.total ?? 0;

    return {
      totalBalance,
      monthlyIncome,
      monthlyExpenses,
      netSavings: monthlyIncome - monthlyExpenses,
    };
  });
}
