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
  // Map id to _id for client compatibility
  if (obj.id !== undefined) {
    obj._id = obj.id;
  }
  return obj;
}

export function registerAccountHandlers(): void {
  ipcMain.handle('accounts:getAll', () => {
    const rows = query('SELECT * FROM accounts ORDER BY name');
    return rows.map(formatRow);
  });

  ipcMain.handle('accounts:create', (_event, data: { name: string; type: string; balance?: number; currency?: string }) => {
    const db = getDatabase();
    const id = generateId();
    db.run(
      'INSERT INTO accounts (id, name, type, balance, currency) VALUES (?, ?, ?, ?, ?)',
      [id, data.name, data.type, data.balance ?? 0, data.currency ?? 'USD']
    );
    saveDatabase();
    const rows = query('SELECT * FROM accounts WHERE id = ?', [id]);
    return formatRow(rows[0]);
  });

  ipcMain.handle('accounts:update', (_event, data: { id: string; [key: string]: any }) => {
    const db = getDatabase();
    const { id, _id, ...fields } = data;
    const accountId = id || _id;

    // Check if balance is being changed
    const balanceChanging = 'balance' in fields;
    let oldBalance: number | null = null;
    if (balanceChanging) {
      const current = query('SELECT balance, name FROM accounts WHERE id = ?', [accountId]);
      if (current.length > 0) oldBalance = current[0].balance;
    }

    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      sets.push(`${col} = ?`);
      values.push(value);
    }

    // Only update updated_at if balance changed
    const balanceActuallyChanged = balanceChanging && oldBalance !== null && oldBalance !== fields.balance;
    if (balanceActuallyChanged) {
      sets.push("updated_at = datetime('now')");
    }

    db.run(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, [...values, accountId]);

    // If balance changed, add a history entry with today's date
    if (balanceActuallyChanged) {
      const acct = query('SELECT name FROM accounts WHERE id = ?', [accountId]);
      if (acct.length > 0) {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const yyyy = now.getFullYear();
        const dateStr = `${mm}-${dd}-${yyyy}`;
        const accountName = acct[0].name;

        const existing = query(
          'SELECT id FROM account_history WHERE account_name = ? AND date = ?',
          [accountName, dateStr]
        );
        if (existing.length > 0) {
          db.run('UPDATE account_history SET value = ? WHERE id = ?', [fields.balance, existing[0].id]);
        } else {
          db.run(
            'INSERT INTO account_history (id, account_name, date, value) VALUES (?, ?, ?, ?)',
            [generateId(), accountName, dateStr, fields.balance]
          );
        }
      }
    }

    saveDatabase();
    const rows = query('SELECT * FROM accounts WHERE id = ?', [accountId]);
    return formatRow(rows[0]);
  });

  ipcMain.handle('accounts:delete', (_event, data: { id: string }) => {
    const db = getDatabase();
    db.run('DELETE FROM accounts WHERE id = ?', [data.id]);
    saveDatabase();
  });
}
