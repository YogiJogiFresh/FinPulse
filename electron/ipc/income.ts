import { ipcMain } from 'electron';
import { getDatabase, saveDatabase, generateId, query } from '../database';

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function formatRow(row: any): any {
  const obj: any = {};
  for (const key of Object.keys(row)) {
    obj[snakeToCamel(key)] = row[key];
  }
  if (obj.id !== undefined) {
    obj._id = obj.id;
  }
  return obj;
}

export function registerIncomeHandlers(): void {
  ipcMain.handle('income:getAll', () => {
    const rows = query('SELECT * FROM income_sources ORDER BY created_at DESC');
    return rows.map(formatRow);
  });

  ipcMain.handle('income:create', (_event, data: {
    name: string;
    yearlySalary: number;
    monthlyTakeHome: number;
    notes?: string;
  }) => {
    const db = getDatabase();
    const id = generateId();
    db.run(
      'INSERT INTO income_sources (id, name, yearly_salary, monthly_take_home, notes) VALUES (?, ?, ?, ?, ?)',
      [id, data.name, data.yearlySalary, data.monthlyTakeHome, data.notes ?? null]
    );
    saveDatabase();
    const rows = query('SELECT * FROM income_sources WHERE id = ?', [id]);
    return formatRow(rows[0]);
  });

  ipcMain.handle('income:update', (_event, data: { id: string; [key: string]: any }) => {
    const db = getDatabase();
    const { id, _id, ...fields } = data;
    const incomeId = id || _id;

    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      sets.push(`${col} = ?`);
      values.push(value);
    }
    sets.push("updated_at = datetime('now')");
    db.run(`UPDATE income_sources SET ${sets.join(', ')} WHERE id = ?`, [...values, incomeId]);
    saveDatabase();

    const rows = query('SELECT * FROM income_sources WHERE id = ?', [incomeId]);
    return formatRow(rows[0]);
  });

  ipcMain.handle('income:delete', (_event, data: { id: string }) => {
    const db = getDatabase();
    db.run('DELETE FROM income_sources WHERE id = ?', [data.id]);
    saveDatabase();
  });

  ipcMain.handle('income:getDistributions', (_event, incomeId: string) => {
    const rows = query('SELECT * FROM income_distributions WHERE income_id = ? ORDER BY created_at', [incomeId]);
    return rows.map(formatRow);
  });

  ipcMain.handle('income:setDistributions', (_event, data: {
    incomeId: string;
    distributions: { label: string; amount: number }[];
  }) => {
    const db = getDatabase();
    db.run('DELETE FROM income_distributions WHERE income_id = ?', [data.incomeId]);
    for (const dist of data.distributions) {
      const id = generateId();
      db.run(
        'INSERT INTO income_distributions (id, income_id, label, amount) VALUES (?, ?, ?, ?)',
        [id, data.incomeId, dist.label, dist.amount]
      );
    }
    saveDatabase();
    const rows = query('SELECT * FROM income_distributions WHERE income_id = ? ORDER BY created_at', [data.incomeId]);
    return rows.map(formatRow);
  });

  ipcMain.handle('income:getMonthlyTotal', () => {
    const rows = query('SELECT COALESCE(SUM(monthly_take_home), 0) as total FROM income_sources');
    return rows[0]?.total ?? 0;
  });
}
