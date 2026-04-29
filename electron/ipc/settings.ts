import { ipcMain } from 'electron';
import { getDatabase, saveDatabase, query } from '../database';

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
    const tables = ['income_distributions', 'income_sources', 'debts', 'accounts', 'budget_categories', 'account_history'];
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
    }
    saveDatabase();
  });
}
