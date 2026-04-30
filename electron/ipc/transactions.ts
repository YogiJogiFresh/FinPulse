import { ipcMain } from 'electron';
import { getDatabase, saveDatabase, generateId, query } from '../database';
import { parseCSV, ParseResult } from '../parsers/csv-parser';

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

export function registerTransactionHandlers(): void {

  // ── Parse CSV ──
  ipcMain.handle('transactions:parseCSV', (_event, csvContent: string): ParseResult => {
    return parseCSV(csvContent);
  });

  // ── Import transactions ──
  ipcMain.handle('transactions:import', (_event, data: {
    transactions: Array<{
      date: string;
      postDate?: string;
      description: string;
      amount: number;
      category?: string;
    }>;
    bank: string;
    accountLabel: string;
  }) => {
    const db = getDatabase();
    const batchId = generateId();
    let imported = 0;
    let skipped = 0;

    for (const txn of data.transactions) {
      // Duplicate detection: same date + description + amount
      const existing = query(
        'SELECT id FROM transactions WHERE date = ? AND description = ? AND amount = ?',
        [txn.date, txn.description, txn.amount]
      );

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const id = generateId();
      db.run(
        `INSERT INTO transactions (id, date, post_date, description, original_description, amount, category, bank, account_label, import_batch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          txn.date,
          txn.postDate || '',
          txn.description,
          txn.description,
          txn.amount,
          txn.category || '',
          data.bank,
          data.accountLabel,
          batchId
        ]
      );
      imported++;
    }

    saveDatabase();
    return { imported, skipped, batchId };
  });

  // ── Get all transactions (with filters) ──
  ipcMain.handle('transactions:getAll', (_event, filters?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    bank?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params: any[] = [];

    if (filters?.startDate) {
      sql += ' AND date >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      sql += ' AND date <= ?';
      params.push(filters.endDate);
    }
    if (filters?.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters?.bank) {
      sql += ' AND bank = ?';
      params.push(filters.bank);
    }
    if (filters?.search) {
      sql += ' AND (description LIKE ? OR original_description LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
      if (filters?.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    return query(sql, params).map(formatRow);
  });

  // ── Get transaction count (for pagination) ──
  ipcMain.handle('transactions:getCount', (_event, filters?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    bank?: string;
    search?: string;
  }) => {
    let sql = 'SELECT COUNT(*) as count FROM transactions WHERE 1=1';
    const params: any[] = [];

    if (filters?.startDate) { sql += ' AND date >= ?'; params.push(filters.startDate); }
    if (filters?.endDate) { sql += ' AND date <= ?'; params.push(filters.endDate); }
    if (filters?.category) { sql += ' AND category = ?'; params.push(filters.category); }
    if (filters?.bank) { sql += ' AND bank = ?'; params.push(filters.bank); }
    if (filters?.search) {
      sql += ' AND (description LIKE ? OR original_description LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const result = query(sql, params);
    return result[0]?.count || 0;
  });

  // ── Update transaction ──
  ipcMain.handle('transactions:update', (_event, id: string, data: {
    description?: string;
    category?: string;
    notes?: string;
    amount?: number;
    date?: string;
  }) => {
    const sets: string[] = [];
    const params: any[] = [];

    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
    if (data.category !== undefined) { sets.push('category = ?'); params.push(data.category); }
    if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }
    if (data.amount !== undefined) { sets.push('amount = ?'); params.push(data.amount); }
    if (data.date !== undefined) { sets.push('date = ?'); params.push(data.date); }

    if (sets.length === 0) return;

    params.push(id);
    const db = getDatabase();
    db.run(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`, params);
    saveDatabase();
  });

  // ── Delete transaction ──
  ipcMain.handle('transactions:delete', (_event, id: string) => {
    const db = getDatabase();
    db.run('DELETE FROM transactions WHERE id = ?', [id]);
    saveDatabase();
  });

  // ── Bulk categorize ──
  ipcMain.handle('transactions:bulkCategorize', (_event, ids: string[], category: string) => {
    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    db.run(`UPDATE transactions SET category = ? WHERE id IN (${placeholders})`, [category, ...ids]);
    saveDatabase();
  });

  // ── Apply category rules to uncategorized transactions ──
  ipcMain.handle('transactions:applyRules', () => {
    const rules = query('SELECT * FROM category_rules ORDER BY priority DESC');
    const uncategorized = query("SELECT id, description FROM transactions WHERE category = '' OR category IS NULL");

    const db = getDatabase();
    let categorized = 0;

    for (const txn of uncategorized) {
      for (const rule of rules) {
        if (txn.description.toLowerCase().includes(rule.pattern.toLowerCase())) {
          db.run('UPDATE transactions SET category = ? WHERE id = ?', [rule.category, txn.id]);
          categorized++;
          break;
        }
      }
    }

    saveDatabase();
    return { categorized };
  });

  // ── Get unique banks/accounts ──
  ipcMain.handle('transactions:getBanks', () => {
    return query('SELECT DISTINCT bank, account_label FROM transactions ORDER BY bank, account_label')
      .map(formatRow);
  });

  // ── Category Rules CRUD ──

  ipcMain.handle('categoryRules:getAll', () => {
    return query('SELECT * FROM category_rules ORDER BY priority DESC').map(formatRow);
  });

  ipcMain.handle('categoryRules:create', (_event, data: {
    pattern: string;
    category: string;
    priority?: number;
  }) => {
    const db = getDatabase();
    const id = generateId();
    db.run(
      'INSERT INTO category_rules (id, pattern, category, priority) VALUES (?, ?, ?, ?)',
      [id, data.pattern, data.category, data.priority || 0]
    );
    saveDatabase();
    return { id };
  });

  ipcMain.handle('categoryRules:update', (_event, id: string, data: {
    pattern?: string;
    category?: string;
    priority?: number;
  }) => {
    const sets: string[] = [];
    const params: any[] = [];

    if (data.pattern !== undefined) { sets.push('pattern = ?'); params.push(data.pattern); }
    if (data.category !== undefined) { sets.push('category = ?'); params.push(data.category); }
    if (data.priority !== undefined) { sets.push('priority = ?'); params.push(data.priority); }

    if (sets.length === 0) return;
    params.push(id);

    const db = getDatabase();
    db.run(`UPDATE category_rules SET ${sets.join(', ')} WHERE id = ?`, params);
    saveDatabase();
  });

  ipcMain.handle('categoryRules:delete', (_event, id: string) => {
    const db = getDatabase();
    db.run('DELETE FROM category_rules WHERE id = ?', [id]);
    saveDatabase();
  });

  // ── Auto-generate rules from categorized transactions ──
  ipcMain.handle('categoryRules:autoGenerate', () => {
    // Find common description patterns from already-categorized transactions
    const categorized = query(`
      SELECT description, category, COUNT(*) as cnt
      FROM transactions
      WHERE category != '' AND category IS NOT NULL
      GROUP BY description, category
      HAVING cnt >= 2
      ORDER BY cnt DESC
      LIMIT 50
    `);

    const db = getDatabase();
    let created = 0;

    for (const row of categorized) {
      // Extract a meaningful pattern (first 2+ words or significant portion)
      const words = row.description.trim().split(/\s+/);
      const pattern = words.slice(0, Math.min(3, words.length)).join(' ');

      // Skip if rule already exists for this pattern
      const existing = query('SELECT id FROM category_rules WHERE pattern = ?', [pattern]);
      if (existing.length > 0) continue;

      const id = generateId();
      db.run(
        'INSERT INTO category_rules (id, pattern, category, priority) VALUES (?, ?, ?, ?)',
        [id, pattern, row.category, row.cnt]
      );
      created++;
    }

    saveDatabase();
    return { created };
  });

  // ── Get monthly spending by category (for budget integration) ──
  ipcMain.handle('transactions:getMonthlySummary', (_event, year: number, month: number) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    return query(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM transactions
      WHERE date >= ? AND date < ? AND amount > 0 AND category != ''
      GROUP BY category
      ORDER BY total DESC
    `, [startDate, endDate]).map(formatRow);
  });
}
