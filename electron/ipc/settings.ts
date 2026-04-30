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
  return obj;
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getAll', () => {
    const rows = query('SELECT key, value FROM settings');
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  });

  ipcMain.handle('settings:get', (_event, key: string) => {
    const rows = query('SELECT value FROM settings WHERE key = ?', [key]);
    return rows.length > 0 ? rows[0].value : null;
  });

  ipcMain.handle('settings:set', (_event, data: { key: string; value: string }) => {
    const db = getDatabase();
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [data.key, data.value]);
    saveDatabase();
  });

  ipcMain.handle('settings:setBatch', (_event, settings: Record<string, string>) => {
    const db = getDatabase();
    for (const [key, value] of Object.entries(settings)) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
    saveDatabase();
  });

  ipcMain.handle('settings:clearAllData', () => {
    const db = getDatabase();
    const tables = ['income_distributions', 'income_sources', 'debts', 'accounts', 'budget_categories', 'account_history', 'transactions', 'category_rules'];
    for (const table of tables) {
      db.run(`DELETE FROM ${table}`);
    }
    // Reset settings to defaults
    db.run('DELETE FROM settings');
    db.run("INSERT INTO settings (key, value) VALUES ('theme', 'dark')");
    db.run("INSERT INTO settings (key, value) VALUES ('federal_tax_rate', '22')");
    db.run("INSERT INTO settings (key, value) VALUES ('state_tax_rate', '5')");
    saveDatabase();
  });

  ipcMain.handle('settings:clearByPage', (_event, page: string) => {
    const db = getDatabase();
    switch (page) {
      case 'accounts':
        db.run('DELETE FROM accounts');
        break;
      case 'income':
        db.run('DELETE FROM income_distributions');
        db.run('DELETE FROM income_sources');
        break;
      case 'debts':
        db.run('DELETE FROM debts');
        break;
      case 'budget':
        db.run('DELETE FROM budget_categories');
        break;
      case 'history':
        db.run('DELETE FROM account_history');
        break;
      case 'properties':
        db.run('DELETE FROM property_contractors');
        db.run('DELETE FROM property_expenses');
        db.run('DELETE FROM property_details');
        db.run('DELETE FROM properties');
        break;
      case 'transactions':
        db.run('DELETE FROM transactions');
        db.run('DELETE FROM category_rules');
        break;
    }
    saveDatabase();
  });

  // ── Bank Configs ──

  ipcMain.handle('bankConfigs:getAll', () => {
    return query('SELECT * FROM bank_configs ORDER BY name').map(row => {
      const formatted = formatRow(row);
      // Parse custom_columns JSON
      try {
        formatted.customColumns = JSON.parse(formatted.customColumns || '[]');
      } catch {
        formatted.customColumns = [];
      }
      return formatted;
    });
  });

  ipcMain.handle('bankConfigs:create', (_event, data: {
    name: string; dateColumn: string; postDateColumn?: string;
    descriptionColumn: string; amountType: string; amountColumn?: string;
    debitColumn?: string; creditColumn?: string; detectionFields: string;
    customColumns?: { csvHeader: string; displayName: string }[];
  }) => {
    const db = getDatabase();
    const id = generateId();
    const customColumnsJson = JSON.stringify(data.customColumns || []);
    db.run(
      `INSERT INTO bank_configs (id, name, date_column, post_date_column, description_column, amount_type, amount_column, debit_column, credit_column, detection_fields, custom_columns)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.dateColumn, data.postDateColumn || '', data.descriptionColumn, data.amountType, data.amountColumn || '', data.debitColumn || '', data.creditColumn || '', data.detectionFields, customColumnsJson]
    );
    saveDatabase();
    return { id };
  });

  ipcMain.handle('bankConfigs:update', (_event, id: string, data: {
    name?: string; dateColumn?: string; postDateColumn?: string;
    descriptionColumn?: string; amountType?: string; amountColumn?: string;
    debitColumn?: string; creditColumn?: string; detectionFields?: string;
    customColumns?: { csvHeader: string; displayName: string }[];
  }) => {
    const sets: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.dateColumn !== undefined) { sets.push('date_column = ?'); params.push(data.dateColumn); }
    if (data.postDateColumn !== undefined) { sets.push('post_date_column = ?'); params.push(data.postDateColumn); }
    if (data.descriptionColumn !== undefined) { sets.push('description_column = ?'); params.push(data.descriptionColumn); }
    if (data.amountType !== undefined) { sets.push('amount_type = ?'); params.push(data.amountType); }
    if (data.amountColumn !== undefined) { sets.push('amount_column = ?'); params.push(data.amountColumn); }
    if (data.debitColumn !== undefined) { sets.push('debit_column = ?'); params.push(data.debitColumn); }
    if (data.creditColumn !== undefined) { sets.push('credit_column = ?'); params.push(data.creditColumn); }
    if (data.detectionFields !== undefined) { sets.push('detection_fields = ?'); params.push(data.detectionFields); }
    if (data.customColumns !== undefined) { sets.push('custom_columns = ?'); params.push(JSON.stringify(data.customColumns)); }

    if (sets.length === 0) return;
    params.push(id);

    const db = getDatabase();
    db.run(`UPDATE bank_configs SET ${sets.join(', ')} WHERE id = ?`, params);
    saveDatabase();
  });

  ipcMain.handle('bankConfigs:delete', (_event, id: string) => {
    const db = getDatabase();
    db.run('DELETE FROM bank_configs WHERE id = ?', [id]);
    saveDatabase();
  });
}
