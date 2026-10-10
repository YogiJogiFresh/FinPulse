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

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isCurrentMonth(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.slice(0, 7) === today().slice(0, 7);
}

function enrichDebt<T extends Record<string, any>>(debt: T): T & {
  plannedPayment: number;
  statementIsStale: boolean;
  utilization: number | null;
} {
  const isCreditCard = debt.type === 'credit_card';
  const strategy = isCreditCard ? (debt.paymentStrategy || 'pay_in_full') : 'fixed';
  const statementCurrent = isCurrentMonth(debt.statementBalanceAsOf);
  let plannedPayment = debt.monthlyPayment || 0;
  if (isCreditCard) {
    if (strategy === 'exclude') plannedPayment = 0;
    else if (strategy === 'pay_in_full') {
      plannedPayment = statementCurrent && debt.statementBalance != null
        ? debt.statementBalance
        : debt.currentBalance;
    }
  }
  const utilization = debt.creditLimit > 0
    ? (debt.currentBalance / debt.creditLimit) * 100
    : null;
  return {
    ...debt,
    paymentStrategy: strategy,
    plannedPayment,
    statementIsStale: debt.statementBalance != null && !statementCurrent,
    utilization
  };
}

function getUnifiedDebts(): any[] {
  const manual = query(`
    SELECT * FROM debts
    WHERE linked_account_id IS NULL OR linked_account_id = ''
    ORDER BY created_at DESC
  `).map(row => enrichDebt({
      ...formatRow(row),
      source: 'manual',
      linkedAccountId: null,
      institutionName: '',
      plaidConnected: 0,
      hasManualMetadata: true,
      creditLimit: null,
      availableCredit: null
    }));

  const plaid = query(`
    SELECT a.id AS account_id, a.name, a.balance, a.liability_type,
           a.institution_name, a.mask, a.credit_limit, a.available_credit,
           CASE WHEN pa.plaid_account_id IS NOT NULL THEN 1 ELSE 0 END AS plaid_connected,
           d.id AS debt_id, d.monthly_payment, d.interest_rate, d.notes,
           d.payment_strategy, d.statement_balance, d.statement_balance_as_of,
           d.created_at, d.updated_at
    FROM accounts a
    LEFT JOIN plaid_accounts pa ON pa.local_account_id = a.id
    LEFT JOIN debts d ON d.linked_account_id = a.id
    WHERE a.is_liability = 1
    ORDER BY a.name
  `).map(row => enrichDebt({
    _id: row.debt_id || `plaid:${row.account_id}`,
    name: row.name,
    type: row.liability_type || 'other',
    currentBalance: Math.abs(row.balance || 0),
    monthlyPayment: row.monthly_payment || 0,
    interestRate: row.interest_rate || 0,
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    source: 'plaid',
    linkedAccountId: row.account_id,
    institutionName: row.institution_name || '',
    mask: row.mask || '',
    creditLimit: row.credit_limit,
    availableCredit: row.available_credit,
    plaidConnected: row.plaid_connected,
    hasManualMetadata: Boolean(row.debt_id),
    paymentStrategy: row.payment_strategy || (row.liability_type === 'credit_card' ? 'pay_in_full' : 'fixed'),
    statementBalance: row.statement_balance,
    statementBalanceAsOf: row.statement_balance_as_of
  }));

  return [...plaid, ...manual];
}

function normalizeLiabilityName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(credit|card|loan|mortgage|account|bank|platinum|rewards)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function registerDebtHandlers(): void {
  ipcMain.handle('debts:getAll', () => {
    return getUnifiedDebts();
  });

  ipcMain.handle('debts:create', (_event, data: {
    name: string;
    type: string;
    currentBalance: number;
    monthlyPayment: number;
    interestRate?: number;
    notes?: string;
    linkedAccountId?: string;
    paymentStrategy?: string;
    statementBalance?: number | null;
  }) => {
    const db = getDatabase();
    const id = generateId();
    if (data.linkedAccountId) {
      const account = query(
        'SELECT id FROM accounts WHERE id = ? AND is_liability = 1',
        [data.linkedAccountId]
      );
      if (account.length === 0) throw new Error('Linked liability account was not found.');
    }
    db.run(
      `INSERT INTO debts (
        id, name, type, current_balance, monthly_payment, interest_rate, notes,
        linked_account_id, payment_strategy, statement_balance, statement_balance_as_of
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.name, data.type, data.currentBalance, data.monthlyPayment,
        data.interestRate ?? 0, data.notes ?? null, data.linkedAccountId || null,
        data.type === 'credit_card' ? (data.paymentStrategy || 'pay_in_full') : 'fixed',
        data.statementBalance ?? null,
        data.statementBalance != null ? today() : null
      ]
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
    const columns: Record<string, string> = {
      name: 'name',
      type: 'type',
      currentBalance: 'current_balance',
      monthlyPayment: 'monthly_payment',
      interestRate: 'interest_rate',
      notes: 'notes',
      paymentStrategy: 'payment_strategy',
      statementBalance: 'statement_balance'
    };
    for (const [key, column] of Object.entries(columns)) {
      if (!(key in fields)) continue;
      sets.push(`${column} = ?`);
      values.push(fields[key]);
    }
    if ('statementBalance' in fields) {
      const current = query('SELECT statement_balance FROM debts WHERE id = ?', [debtId]);
      if (current[0]?.statement_balance !== fields.statementBalance) {
        sets.push('statement_balance_as_of = ?');
        values.push(fields.statementBalance == null ? null : today());
      }
    }
    if (sets.length === 0) return;
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
    const debts = getUnifiedDebts();
    const creditCardBalance = debts
      .filter(debt => debt.type === 'credit_card')
      .reduce((sum, debt) => sum + debt.currentBalance, 0);
    const loanBalance = debts
      .filter(debt => debt.type !== 'credit_card')
      .reduce((sum, debt) => sum + debt.currentBalance, 0);
    return {
      currentBalance: creditCardBalance + loanBalance,
      totalMonthly: debts.reduce((sum, debt) => sum + debt.plannedPayment, 0),
      creditCardBalance,
      loanBalance
    };
  });

  ipcMain.handle('debts:getLinkSuggestions', () => {
    const accounts = query(`
      SELECT a.id, a.name, a.liability_type, a.institution_name, a.mask
      FROM accounts a
      LEFT JOIN debts linked ON linked.linked_account_id = a.id
      WHERE a.is_liability = 1 AND linked.id IS NULL
    `);
    const debts = query(`
      SELECT id, name, type FROM debts
      WHERE linked_account_id IS NULL OR linked_account_id = ''
    `);
    const ignored = new Set(
      query('SELECT account_id, debt_id FROM liability_match_ignores')
        .map(row => `${row.account_id}:${row.debt_id}`)
    );
    const suggestions: any[] = [];
    for (const account of accounts) {
      const accountName = normalizeLiabilityName(account.name);
      for (const debt of debts) {
        if (ignored.has(`${account.id}:${debt.id}`)) continue;
        const compatibleType = account.liability_type === debt.type
          || account.liability_type === 'other'
          || debt.type === 'other';
        if (!compatibleType) continue;
        const debtName = normalizeLiabilityName(debt.name);
        const nameMatches = accountName.length > 0
          && debtName.length > 0
          && (accountName === debtName || accountName.includes(debtName) || debtName.includes(accountName));
        const maskMatches = account.mask && debtName.endsWith(account.mask);
        if (!nameMatches && !maskMatches) continue;
        suggestions.push({
          accountId: account.id,
          accountName: account.name,
          institutionName: account.institution_name || '',
          debtId: debt.id,
          debtName: debt.name,
          liabilityType: account.liability_type || debt.type
        });
      }
    }
    return suggestions;
  });

  ipcMain.handle('debts:linkAccount', (_event, data: { debtId: string; accountId: string }) => {
    const debt = query('SELECT id FROM debts WHERE id = ?', [data.debtId]);
    const account = query('SELECT id FROM accounts WHERE id = ? AND is_liability = 1', [data.accountId]);
    if (debt.length === 0 || account.length === 0) {
      throw new Error('The debt or Plaid liability no longer exists.');
    }
    getDatabase().run(
      'UPDATE debts SET linked_account_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [data.accountId, data.debtId]
    );
    getDatabase().run(
      'DELETE FROM liability_match_ignores WHERE account_id = ? OR debt_id = ?',
      [data.accountId, data.debtId]
    );
    saveDatabase();
  });

  ipcMain.handle('debts:unlinkAccount', (_event, debtId: string) => {
    getDatabase().run(
      'UPDATE debts SET linked_account_id = NULL, updated_at = datetime(\'now\') WHERE id = ?',
      [debtId]
    );
    saveDatabase();
  });

  ipcMain.handle('debts:dismissLinkSuggestion', (_event, data: { debtId: string; accountId: string }) => {
    getDatabase().run(
      'INSERT OR IGNORE INTO liability_match_ignores (account_id, debt_id) VALUES (?, ?)',
      [data.accountId, data.debtId]
    );
    saveDatabase();
  });
}
