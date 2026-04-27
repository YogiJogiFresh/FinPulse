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

export function registerDebtHandlers(): void {
  ipcMain.handle('debts:getAll', () => {
    const rows = query('SELECT * FROM debts ORDER BY created_at DESC');
    return rows.map(formatRow);
  });

  ipcMain.handle('debts:create', (_event, data: {
    name: string;
    type: string;
    totalDebt: number;
    monthlyPayment: number;
    interestRate?: number;
    notes?: string;
  }) => {
    const db = getDatabase();
    const id = generateId();
    db.run(
      'INSERT INTO debts (id, name, type, total_debt, monthly_payment, interest_rate, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.name, data.type, data.totalDebt, data.monthlyPayment, data.interestRate ?? 0, data.notes ?? null]
    );
    saveDatabase();
    const rows = query('SELECT * FROM debts WHERE id = ?', [id]);
    return formatRow(rows[0]);
  });

  ipcMain.handle('debts:update', (_event, data: { id: string; [key: string]: any }) => {
    const db = getDatabase();
    const { id, _id, ...fields } = data;
    const debtId = id || _id;

    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      sets.push(`${col} = ?`);
      values.push(value);
    }
    sets.push("updated_at = datetime('now')");
    db.run(`UPDATE debts SET ${sets.join(', ')} WHERE id = ?`, [...values, debtId]);
    saveDatabase();

    const rows = query('SELECT * FROM debts WHERE id = ?', [debtId]);
    return formatRow(rows[0]);
  });

  ipcMain.handle('debts:delete', (_event, data: { id: string }) => {
    const db = getDatabase();
    db.run('DELETE FROM debts WHERE id = ?', [data.id]);
    saveDatabase();
  });

  ipcMain.handle('debts:total', () => {
    const rows = query('SELECT COALESCE(SUM(total_debt), 0) as total_debt, COALESCE(SUM(monthly_payment), 0) as total_monthly FROM debts');
    return {
      totalDebt: rows[0]?.total_debt ?? 0,
      totalMonthly: rows[0]?.total_monthly ?? 0
    };
  });
}
