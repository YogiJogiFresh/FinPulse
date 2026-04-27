import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { getDatabase, saveDatabase, generateId, query } from '../database';

function parseWorkbook(fileBuffer: Buffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (raw.length < 2 || raw[0].length < 2) {
    throw new Error('Excel must have dates in row 1 and account names in column A');
  }

  const dates: string[] = raw[0].slice(1).map((d: any) => {
    if (typeof d === 'number') {
      const parsed = XLSX.SSF.parse_date_code(d);
      return `${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}-${parsed.y}`;
    }
    const dateObj = new Date(String(d));
    if (!isNaN(dateObj.getTime())) {
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const y = dateObj.getFullYear();
      return `${m}-${day}-${y}`;
    }
    return String(d);
  });

  const accounts: string[] = [];
  const values: number[][] = [];

  for (let r = 1; r < raw.length; r++) {
    const row = raw[r];
    const name = String(row[0] || '').trim();
    if (!name) continue;
    accounts.push(name);
    const rowValues: number[] = [];
    for (let c = 1; c < row.length && c <= dates.length; c++) {
      const v = row[c];
      const num = typeof v === 'number' ? v : parseFloat(v) || 0;
      rowValues.push(Math.round(num * 100) / 100);
    }
    while (rowValues.length < dates.length) {
      rowValues.push(0);
    }
    values.push(rowValues);
  }

  return { accounts, dates, values };
}

export function registerHistoryHandlers(): void {
  ipcMain.handle('history:openAndParse', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const opts = {
      title: 'Import Excel File',
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile' as const]
    };
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
    if (result.canceled || result.filePaths.length === 0) return null;
    const fileBuffer = fs.readFileSync(result.filePaths[0]);
    const parsed = parseWorkbook(fileBuffer);
    return JSON.parse(JSON.stringify(parsed));
  });

  ipcMain.handle('history:parseExcelBase64', (_event, base64: string) => {
    const fileBuffer = Buffer.from(base64, 'base64');
    const parsed = parseWorkbook(fileBuffer);
    return JSON.parse(JSON.stringify(parsed));
  });


  ipcMain.handle('history:import', (_event, data: { accounts: string[]; dates: string[]; values: number[][] }) => {
    const db = getDatabase();
    const { accounts, dates, values } = data;

    for (let a = 0; a < accounts.length; a++) {
      for (let d = 0; d < dates.length; d++) {
        const existing = query(
          'SELECT id FROM account_history WHERE account_name = ? AND date = ?',
          [accounts[a], dates[d]]
        );
        if (existing.length > 0) {
          db.run('UPDATE account_history SET value = ? WHERE id = ?', [values[a][d], existing[0].id]);
        } else {
          db.run(
            'INSERT INTO account_history (id, account_name, date, value) VALUES (?, ?, ?, ?)',
            [generateId(), accounts[a], dates[d], values[a][d]]
          );
        }
      }
    }

    // Auto-create accounts that don't already exist, and update existing accounts' updated_at
    for (let a = 0; a < accounts.length; a++) {
      const existingAccount = query('SELECT id FROM accounts WHERE name = ?', [accounts[a]]);
      // Find the most recent date and its value for this account
      const sortedDates = [...dates].sort((x, y) => {
        const [xm, xd, xy] = x.split('-').map(Number);
        const [ym, yd, yy] = y.split('-').map(Number);
        return new Date(yy, ym - 1, yd).getTime() - new Date(xy, xm - 1, xd).getTime();
      });
      const latestIdx = dates.indexOf(sortedDates[0]);
      const balance = latestIdx >= 0 ? values[a][latestIdx] : 0;

      // Convert the most recent MM-DD-YYYY date to ISO datetime for updated_at
      const [lm, ld, ly] = sortedDates[0].split('-').map(Number);
      const latestDateISO = new Date(ly, lm - 1, ld).toISOString().replace('T', ' ').slice(0, 19);

      if (existingAccount.length === 0) {
        db.run(
          'INSERT INTO accounts (id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), accounts[a], 'other', balance, latestDateISO, latestDateISO]
        );
      } else {
        db.run(
          'UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?',
          [balance, latestDateISO, existingAccount[0].id]
        );
      }
    }

    saveDatabase();
  });

  ipcMain.handle('history:getAll', () => {
    const rows = query('SELECT account_name, date, value, tag FROM account_history ORDER BY date ASC, account_name ASC');
    return rows;
  });

  ipcMain.handle('history:updateEntry', (_event, data: { account_name: string; date: string; value: number; tag: string }) => {
    const db = getDatabase();
    db.run(
      'UPDATE account_history SET value = ?, tag = ? WHERE account_name = ? AND date = ?',
      [data.value, data.tag, data.account_name, data.date]
    );
    db.run("UPDATE accounts SET updated_at = datetime('now') WHERE name = ?", [data.account_name]);
    saveDatabase();
  });

  ipcMain.handle('history:delete', () => {
    const db = getDatabase();
    db.run('DELETE FROM account_history');
    saveDatabase();
  });

  ipcMain.handle('history:clearAccountTags', (_event, accountName: string) => {
    const db = getDatabase();
    db.run('UPDATE account_history SET tag = \'\' WHERE account_name = ?', [accountName]);
    saveDatabase();
  });

  ipcMain.handle('history:addEntry', (_event, data: { account_name: string; date: string; value: number }) => {
    const db = getDatabase();
    const existing = query(
      'SELECT id FROM account_history WHERE account_name = ? AND date = ?',
      [data.account_name, data.date]
    );
    if (existing.length > 0) {
      db.run('UPDATE account_history SET value = ? WHERE id = ?', [data.value, existing[0].id]);
    } else {
      db.run(
        'INSERT INTO account_history (id, account_name, date, value) VALUES (?, ?, ?, ?)',
        [generateId(), data.account_name, data.date, data.value]
      );
    }
    db.run("UPDATE accounts SET updated_at = datetime('now') WHERE name = ?", [data.account_name]);
    saveDatabase();
  });

  ipcMain.handle('history:deleteEntry', (_event, data: { account_name: string; date: string }) => {
    const db = getDatabase();
    db.run('DELETE FROM account_history WHERE account_name = ? AND date = ?', [data.account_name, data.date]);
    db.run("UPDATE accounts SET updated_at = datetime('now') WHERE name = ?", [data.account_name]);
    saveDatabase();
  });

  ipcMain.handle('history:export', async () => {
    const rows = query('SELECT account_name, date, value FROM account_history ORDER BY date ASC, account_name ASC');

    const wb = XLSX.utils.book_new();
    let hasData = false;

    // ── Sheet 1: Account History (pivot format) ──
    if (rows.length > 0) {
      hasData = true;
      const accountSet = new Set<string>();
      const dateSet = new Set<string>();
      const valueMap: Record<string, Record<string, number>> = {};

      for (const row of rows) {
        accountSet.add(row.account_name);
        dateSet.add(row.date);
        if (!valueMap[row.account_name]) valueMap[row.account_name] = {};
        valueMap[row.account_name][row.date] = row.value;
      }

      const accounts = [...accountSet].sort();
      const dates = [...dateSet].sort((a, b) => {
        const [am, ad, ay] = a.split('-').map(Number);
        const [bm, bd, by] = b.split('-').map(Number);
        return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
      });

      const wsData: any[][] = [['', ...dates]];
      for (const acct of accounts) {
        const row2 = [acct, ...dates.map(d => valueMap[acct]?.[d] ?? 0)];
        wsData.push(row2);
      }

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'Account History');
    }

    // ── Sheet 2: Properties ──
    const properties = query('SELECT * FROM properties ORDER BY name');
    if (properties.length > 0) {
      hasData = true;
      const propData: any[][] = [['Property', 'Designation', 'Address', 'Purchase Date', 'Purchase Price', 'Notes']];
      const detailData: any[][] = [['Property', 'Category', 'Label', 'Value']];
      const expenseData: any[][] = [['Property', 'Date', 'Description', 'Category', 'Amount', 'Notes']];
      const contractorData: any[][] = [['Property', 'Name', 'Specialty', 'Phone', 'Email', 'Notes']];

      for (const prop of properties) {
        const name = prop.name;
        const designation = prop.designation === 'primary_residence' ? 'Primary Residence' : 'Rental';
        propData.push([name, designation, prop.address, prop.purchase_date, prop.purchase_price, prop.notes]);

        const details = query('SELECT * FROM property_details WHERE property_id = ? ORDER BY category, label', [prop.id]);
        for (const d of details) {
          detailData.push([name, d.category, d.label, d.value]);
        }

        const expenses = query('SELECT * FROM property_expenses WHERE property_id = ? ORDER BY date DESC', [prop.id]);
        for (const e of expenses) {
          expenseData.push([name, e.date, e.description, e.category, e.amount, e.notes]);
        }

        const contractors = query('SELECT * FROM property_contractors WHERE property_id = ? ORDER BY name', [prop.id]);
        for (const c of contractors) {
          contractorData.push([name, c.name, c.specialty, c.phone, c.email, c.notes]);
        }
      }

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(propData), 'Properties');
      if (detailData.length > 1) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailData), 'Property Details');
      if (expenseData.length > 1) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expenseData), 'Property Expenses');
      if (contractorData.length > 1) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(contractorData), 'Property Contractors');
    }

    if (!hasData) return false;

    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export FinPulse Data',
      defaultPath: 'FinPulse_Export.xlsx',
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (result.canceled || !result.filePath) return false;

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(result.filePath, buffer);
    return true;
  });
}
