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

export function registerBudgetHandlers(): void {
  ipcMain.handle('budget:getAll', () => {
    const rows = query('SELECT * FROM budget_categories ORDER BY name');
    return rows.map(formatRow);
  });

  ipcMain.handle('budget:create', (_event, data: { name: string; monthlyLimit: number; color?: string }) => {
    const db = getDatabase();
    const id = generateId();
    db.run(
      'INSERT INTO budget_categories (id, name, monthly_limit, color) VALUES (?, ?, ?, ?)',
      [id, data.name, data.monthlyLimit, data.color ?? '#3B82F6']
    );
    saveDatabase();
    const rows = query('SELECT * FROM budget_categories WHERE id = ?', [id]);
    return formatRow(rows[0]);
  });

  ipcMain.handle('budget:update', (_event, data: { id: string; [key: string]: any }) => {
    const db = getDatabase();
    const { id, _id, ...fields } = data;
    const budgetId = id || _id;
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      sets.push(`${col} = ?`);
      values.push(value);
    }
    sets.push("updated_at = datetime('now')");
    db.run(`UPDATE budget_categories SET ${sets.join(', ')} WHERE id = ?`, [...values, budgetId]);
    saveDatabase();
    const rows = query('SELECT * FROM budget_categories WHERE id = ?', [budgetId]);
    return formatRow(rows[0]);
  });

  ipcMain.handle('budget:delete', (_event, data: { id: string }) => {
    const db = getDatabase();
    db.run('DELETE FROM budget_categories WHERE id = ?', [data.id]);
    saveDatabase();
  });

  ipcMain.handle('budget:progress', () => {
    const { startOfMonth, endOfMonth } = getMonthRange();
    const rows = query(
      `SELECT bc.*, COALESCE(SUM(ABS(t.amount)), 0) as spent
       FROM budget_categories bc
       LEFT JOIN transactions t ON t.category = bc.name
         AND t.amount < 0
         AND t.date >= ? AND t.date <= ?
       GROUP BY bc.id`,
      [startOfMonth, endOfMonth]
    );

    return rows.map((row) => {
      const formatted = formatRow(row);
      const spent = formatted.spent ?? 0;
      const monthlyLimit = formatted.monthlyLimit ?? 0;
      return {
        ...formatted,
        spent,
        remaining: monthlyLimit - spent,
        percentage: monthlyLimit > 0 ? (spent / monthlyLimit) * 100 : 0,
      };
    });
  });
}
