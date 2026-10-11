import { BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type AccountBase,
  type Transaction
} from 'plaid';
import { generateId, getDatabase, query, saveDatabase } from '../database';
import {
  clearPlaidSecrets,
  readPlaidSecrets,
  removePlaidAccessToken,
  savePlaidAccessToken,
  savePlaidCredentials
} from '../plaid-secrets';
import { clearPlaidScheduleState, type PlaidSyncTrigger } from '../plaid-schedule-settings';
import {
  assertPlaidEnvironment,
  getRuntimeProfile,
  type PlaidEnvironment
} from '../runtime-profile';
import { isPlaidOAuthPopup, startPlaidLinkPage } from './plaid-link-page';

export interface PlaidSyncResult {
  added: number;
  modified: number;
  removed: number;
  items: number;
  institutions: PlaidInstitutionSyncResult[];
}

interface PlaidInstitutionSyncResult {
  institutionName: string;
  accountsAddedCount: number;
  accountsUpdatedCount: number;
  accountsAdded: string[];
  accountsUpdated: string[];
  transactionsAddedCount: number;
  transactionsModifiedCount: number;
  transactionsRemovedCount: number;
  transactionsAdded: string[];
  transactionsModified: string[];
  transactionsRemoved: string[];
}

interface BalanceSnapshot {
  localAccountId: string;
  accountName: string;
  balance: number;
  isLiability: boolean;
}

let syncInProgress = false;
const MAX_SYNC_DETAIL_ITEMS = 25;

export function isPlaidSyncInProgress(): boolean {
  return syncInProgress;
}

function plaidError(error: unknown): Error {
  const response = (error as any)?.response?.data;
  const message = response?.error_message || response?.display_message || (error as Error)?.message;
  return new Error(message || 'Plaid request failed.');
}

function buildClient(clientId: string, secret: string, environment: PlaidEnvironment): PlaidApi {
  const configuration = new Configuration({
    basePath: PlaidEnvironments[environment],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret
      }
    }
  });
  return new PlaidApi(configuration);
}

function getClient(): PlaidApi {
  const credentials = readPlaidSecrets();
  if (!credentials.clientId || !credentials.secret || !credentials.environment) {
    throw new Error('Configure Plaid credentials in Settings first.');
  }
  assertPlaidEnvironment(credentials.environment);
  return buildClient(credentials.clientId, credentials.secret, credentials.environment);
}

function getClientUserId(): string {
  const existing = query("SELECT value FROM settings WHERE key = 'plaid_client_user_id'");
  if (existing.length > 0) return existing[0].value;

  const value = generateId();
  getDatabase().run('INSERT INTO settings (key, value) VALUES (?, ?)', ['plaid_client_user_id', value]);
  saveDatabase();
  return value;
}

async function createLinkToken(): Promise<string> {
  const response = await getClient().linkTokenCreate({
    user: { client_user_id: getClientUserId() },
    client_name: 'FinPulse',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en'
  });
  return response.data.link_token;
}

interface PlaidLinkResult {
  publicToken: string;
  institutionId?: string;
  institutionName?: string;
}

async function openPlaidLink(linkToken: string): Promise<PlaidLinkResult | null> {
  if (!/^link-(sandbox|production)-/.test(linkToken) || linkToken.length > 512) {
    throw new Error('Plaid returned an invalid Link token.');
  }

  const page = await startPlaidLinkPage(linkToken);
  return new Promise((resolve, reject) => {
    let settled = false;
    const parent = BrowserWindow.getFocusedWindow() || undefined;
    const linkWindow = new BrowserWindow({
      parent,
      modal: Boolean(parent),
      width: 520,
      height: 760,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true
      }
    });

    linkWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false);
    });
    linkWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
      if (!isPlaidOAuthPopup(url, frameName)) return { action: 'deny' };
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          parent: linkWindow,
          width: 800,
          height: 600,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true
          }
        }
      };
    });
    linkWindow.webContents.on('did-create-window', (oauthWindow) => {
      oauthWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      oauthWindow.webContents.on('will-navigate', (event, targetUrl) => {
        try {
          if (new URL(targetUrl).protocol === 'https:') return;
        } catch {
          // Block malformed navigation targets.
        }
        event.preventDefault();
      });
    });
    linkWindow.webContents.on('will-navigate', (event, targetUrl) => {
      if (!targetUrl.startsWith('finpulse-plaid://')) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      const url = new URL(targetUrl);
      settled = true;
      linkWindow.close();
      if (url.hostname === 'success') {
        resolve({
          publicToken: url.searchParams.get('public_token') || '',
          institutionId: url.searchParams.get('institution_id') || undefined,
          institutionName: url.searchParams.get('institution_name') || undefined
        });
      } else {
        resolve(null);
      }
    });
    linkWindow.on('closed', () => {
      page.close();
      if (!settled) resolve(null);
    });
    linkWindow.webContents.on('did-fail-load', (_event, _code, description) => {
      if (settled) return;
      settled = true;
      page.close();
      reject(new Error(`Unable to load Plaid Link: ${description}`));
    });

    void linkWindow.loadURL(page.url);
    linkWindow.once('ready-to-show', () => linkWindow.show());
  });
}

async function exchangeAndSync(data: PlaidLinkResult): Promise<{
  itemId: string;
  added: number;
  modified: number;
  removed: number;
}> {
  const client = getClient();
  const exchange = await client.itemPublicTokenExchange({ public_token: data.publicToken });
  const { access_token: accessToken, item_id: itemId } = exchange.data;
  const institutionName = data.institutionName || 'Linked institution';

  savePlaidAccessToken(itemId, accessToken);
  getDatabase().run(
    `INSERT INTO plaid_items (item_id, institution_id, institution_name)
     VALUES (?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       institution_id = excluded.institution_id,
       institution_name = excluded.institution_name`,
    [itemId, data.institutionId || '', institutionName]
  );
  getDatabase().run(
    'INSERT OR IGNORE INTO plaid_sync_state (item_id, cursor) VALUES (?, ?)',
    [itemId, '']
  );
  saveDatabase();

  try {
    const sync = await runPlaidSync([itemId], 'link');
    return { itemId, ...sync };
  } catch (error) {
    throw new Error(`Institution connected, but initial sync failed: ${plaidError(error).message}`);
  }
}

export async function revokeAllPlaidItems(
  allowStoredEnvironment = false
): Promise<{ revocationErrors: string[] }> {
  const credentials = readPlaidSecrets();
  const itemIds = query('SELECT item_id FROM plaid_items').map(row => row.item_id as string);
  const revocationErrors: string[] = [];
  let client: PlaidApi | null = null;
  if (itemIds.length > 0) {
    if (
      allowStoredEnvironment &&
      credentials.clientId &&
      credentials.secret &&
      credentials.environment
    ) {
      client = buildClient(credentials.clientId, credentials.secret, credentials.environment);
    } else {
      client = getClient();
    }
  }

  for (const itemId of itemIds) {
    const accessToken = credentials.accessTokens?.[itemId];
    if (!accessToken) {
      revocationErrors.push(`The access token for Plaid Item ${itemId} is unavailable.`);
      continue;
    }
    try {
      await client!.itemRemove({ access_token: accessToken });
      getDatabase().run('DELETE FROM plaid_items WHERE item_id = ?', [itemId]);
      removePlaidAccessToken(itemId);
    } catch (error) {
      revocationErrors.push(`${itemId}: ${plaidError(error).message}`);
    }
  }

  if (revocationErrors.length === 0) clearPlaidSecrets();
  saveDatabase();
  return { revocationErrors };
}

interface AccountClassification {
  accountType: string;
  isLiability: boolean;
  liabilityType: string;
}

function classifyAccount(account: AccountBase): AccountClassification {
  const type = String(account.type);
  const subtype = String(account.subtype || '');
  if (type === 'depository') {
    return { accountType: subtype === 'savings' ? 'savings' : 'checking', isLiability: false, liabilityType: '' };
  }
  if (type === 'credit') {
    return { accountType: 'credit_card', isLiability: true, liabilityType: 'credit_card' };
  }
  if (type === 'loan') {
    let liabilityType = 'other';
    if (subtype === 'mortgage' || subtype === 'home equity' || subtype === 'home_equity') liabilityType = 'mortgage';
    else if (subtype.includes('student')) liabilityType = 'student_loan';
    else if (subtype === 'auto' || subtype === 'auto loan' || subtype === 'auto_loan') liabilityType = 'car_loan';
    else if (['consumer', 'loan'].includes(subtype)) liabilityType = 'personal_loan';
    return { accountType: 'other', isLiability: true, liabilityType };
  }
  if (type === 'investment') {
    const accountType = subtype.includes('retirement') || subtype === '401k' || subtype === 'ira'
      ? 'retirement'
      : 'investment';
    return { accountType, isLiability: false, liabilityType: '' };
  }
  return { accountType: 'other', isLiability: false, liabilityType: '' };
}

function accountBalance(account: AccountBase): number {
  return account.balances.current ?? account.balances.available ?? 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function importAccounts(
  itemId: string,
  accounts: AccountBase[]
): {
  snapshots: BalanceSnapshot[];
  addedCount: number;
  updatedCount: number;
  added: string[];
  updated: string[];
} {
  const db = getDatabase();
  const item = query('SELECT institution_name FROM plaid_items WHERE item_id = ?', [itemId]);
  const institutionName = item[0]?.institution_name || '';
  const snapshots: BalanceSnapshot[] = [];
  const added: string[] = [];
  const updated: string[] = [];
  let addedCount = 0;
  let updatedCount = 0;
  for (const account of accounts) {
    let mapping = query(
      'SELECT local_account_id FROM plaid_accounts WHERE plaid_account_id = ?',
      [account.account_id]
    );
    if (mapping.length === 0) {
      const retained = query(
        "SELECT id AS local_account_id FROM accounts WHERE source = 'plaid' AND plaid_account_id = ?",
        [account.account_id]
      );
      if (retained.length > 0) {
        db.run(
          'INSERT INTO plaid_accounts (plaid_account_id, item_id, local_account_id) VALUES (?, ?, ?)',
          [account.account_id, itemId, retained[0].local_account_id]
        );
        mapping = retained;
      }
    }
    const balance = accountBalance(account);
    const classification = classifyAccount(account);
    const normalizedBalance = classification.isLiability ? Math.abs(balance) : balance;

    if (mapping.length > 0) {
      const localAccountId = mapping[0].local_account_id;
      const current = query(
        `SELECT name, type, balance, currency, institution_name, plaid_type, plaid_subtype,
                mask, credit_limit, available_credit, is_liability, liability_type
         FROM accounts WHERE id = ?`,
        [localAccountId]
      )[0];
      const changed = !current ||
        current.name !== account.name ||
        current.type !== classification.accountType ||
        Number(current.balance) !== normalizedBalance ||
        current.currency !== (account.balances.iso_currency_code || 'USD') ||
        current.institution_name !== institutionName ||
        current.plaid_type !== String(account.type) ||
        current.plaid_subtype !== String(account.subtype || '') ||
        current.mask !== (account.mask || '') ||
        nullableNumber(current.credit_limit) !== nullableNumber(account.balances.limit) ||
        nullableNumber(current.available_credit) !== nullableNumber(account.balances.available) ||
        Number(current.is_liability) !== (classification.isLiability ? 1 : 0) ||
        current.liability_type !== classification.liabilityType;
      db.run(
        `UPDATE accounts
         SET name = ?, type = ?, balance = ?, currency = ?, source = 'plaid',
             institution_name = ?, plaid_account_id = ?, plaid_type = ?, plaid_subtype = ?, mask = ?,
             credit_limit = ?, available_credit = ?, is_liability = ?, liability_type = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
        [
          account.name,
          classification.accountType,
          normalizedBalance,
          account.balances.iso_currency_code || 'USD',
          institutionName,
          account.account_id,
          String(account.type),
          String(account.subtype || ''),
          account.mask || '',
          account.balances.limit,
          account.balances.available,
          classification.isLiability ? 1 : 0,
          classification.liabilityType,
          localAccountId
        ]
      );
      snapshots.push({
        localAccountId,
        accountName: account.name,
        balance: normalizedBalance,
        isLiability: classification.isLiability
      });
      if (changed) {
        updatedCount += 1;
        if (updated.length < MAX_SYNC_DETAIL_ITEMS) updated.push(account.name);
      }
      continue;
    }

    const localAccountId = generateId();
    db.run(
      `INSERT INTO accounts (
        id, name, type, balance, currency, source, institution_name, plaid_account_id,
        plaid_type, plaid_subtype, mask, credit_limit, available_credit, is_liability, liability_type
      ) VALUES (?, ?, ?, ?, ?, 'plaid', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        localAccountId,
        account.name,
        classification.accountType,
        normalizedBalance,
        account.balances.iso_currency_code || 'USD',
        institutionName,
        account.account_id,
        String(account.type),
        String(account.subtype || ''),
        account.mask || '',
        account.balances.limit,
        account.balances.available,
        classification.isLiability ? 1 : 0,
        classification.liabilityType
      ]
    );
    db.run(
      'INSERT INTO plaid_accounts (plaid_account_id, item_id, local_account_id) VALUES (?, ?, ?)',
      [account.account_id, itemId, localAccountId]
    );
    snapshots.push({
      localAccountId,
      accountName: account.name,
      balance: normalizedBalance,
      isLiability: classification.isLiability
    });
    addedCount += 1;
    if (added.length < MAX_SYNC_DETAIL_ITEMS) added.push(account.name);
  }
  return {
    snapshots,
    addedCount,
    updatedCount,
    added,
    updated
  };
}

function saveBalanceHistory(
  snapshot: BalanceSnapshot,
  capturedAt: Date,
  syncRunId: string,
  trigger: PlaidSyncTrigger
): void {
  const db = getDatabase();
  const month = String(capturedAt.getMonth() + 1).padStart(2, '0');
  const day = String(capturedAt.getDate()).padStart(2, '0');
  const year = String(capturedAt.getFullYear());
  const date = `${month}-${day}-${year}`;
  const existing = query(
    `SELECT id
     FROM account_history
     WHERE source = 'plaid' AND source_account_id = ? AND date = ?`,
    [snapshot.localAccountId, date]
  );
  const tag = trigger === 'catch_up'
    ? 'Plaid Catch-up'
    : trigger === 'scheduled'
      ? 'Plaid Scheduled'
      : trigger === 'link'
        ? 'Plaid Link'
        : 'Plaid Manual';
  const balanceEffect = snapshot.isLiability ? -1 : 1;

  if (existing.length > 0) {
    db.run(
      `UPDATE account_history
       SET account_name = ?, value = ?, tag = ?, balance_effect = ?,
           captured_at = ?, sync_run_id = ?, sync_trigger = ?
       WHERE id = ?`,
      [
        snapshot.accountName,
        snapshot.balance,
        tag,
        balanceEffect,
        capturedAt.toISOString(),
        syncRunId,
        trigger,
        existing[0].id
      ]
    );
  } else {
    db.run(
      `INSERT INTO account_history (
        id, account_name, date, value, tag, source, source_account_id, balance_effect,
        captured_at, sync_run_id, sync_trigger
      ) VALUES (?, ?, ?, ?, ?, 'plaid', ?, ?, ?, ?, ?)`,
      [
        generateId(),
        snapshot.accountName,
        date,
        snapshot.balance,
        tag,
        snapshot.localAccountId,
        balanceEffect,
        capturedAt.toISOString(),
        syncRunId,
        trigger
      ]
    );
  }
  db.run(
    `UPDATE account_history SET balance_effect = ?
     WHERE source = 'plaid' AND source_account_id = ?`,
    [balanceEffect, snapshot.localAccountId]
  );
}

function categoryName(transaction: Transaction): string {
  const primary = transaction.personal_finance_category?.primary;
  if (!primary) return transaction.category?.[0] || '';
  return primary
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function upsertTransaction(itemId: string, transaction: Transaction): 'added' | 'modified' {
  const db = getDatabase();
  const account = query(
    `SELECT a.name
     FROM plaid_accounts pa
     JOIN accounts a ON a.id = pa.local_account_id
     WHERE pa.plaid_account_id = ? AND pa.item_id = ?`,
    [transaction.account_id, itemId]
  );
  const accountLabel = account[0]?.name || '';
  const category = categoryName(transaction);
  const existing = query(
    'SELECT id FROM transactions WHERE plaid_transaction_id = ?',
    [transaction.transaction_id]
  );

  if (existing.length > 0) {
    db.run(
      `UPDATE transactions
       SET date = ?, description = ?, original_description = ?, amount = ?,
           category = CASE WHEN category = '' THEN ? ELSE category END,
           bank = 'Plaid', account_label = ?, custom_data = ?
       WHERE plaid_transaction_id = ?`,
      [
        transaction.date,
        transaction.name,
        transaction.merchant_name || transaction.name,
        transaction.amount,
        category,
        accountLabel,
        JSON.stringify({ pending: transaction.pending }),
        transaction.transaction_id
      ]
    );
    return 'modified';
  }

  db.run(
    `INSERT INTO transactions (
      id, date, description, original_description, amount, category, bank,
      account_label, import_batch, custom_data, plaid_transaction_id
    ) VALUES (?, ?, ?, ?, ?, ?, 'Plaid', ?, ?, ?, ?)`,
    [
      generateId(),
      transaction.date,
      transaction.name,
      transaction.merchant_name || transaction.name,
      transaction.amount,
      category,
      accountLabel,
      `plaid:${itemId}`,
      JSON.stringify({ pending: transaction.pending }),
      transaction.transaction_id
    ]
  );
  return 'added';
}

async function syncItem(
  itemId: string,
  trigger: PlaidSyncTrigger,
  syncRunId: string,
  capturedAt: Date
): Promise<PlaidInstitutionSyncResult & { added: number; modified: number; removed: number }> {
  const credentials = readPlaidSecrets();
  const accessToken = credentials.accessTokens?.[itemId];
  if (!accessToken) throw new Error('The access token for this Plaid connection is unavailable.');

  const client = getClient();
  const oldestAcceptedBalance = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');
  const balanceResponse = await client.accountsBalanceGet({
    access_token: accessToken,
    options: { min_last_updated_datetime: oldestAcceptedBalance }
  });
  const accountChanges = importAccounts(itemId, balanceResponse.data.accounts);

  const state = query('SELECT cursor FROM plaid_sync_state WHERE item_id = ?', [itemId]);
  let cursor = state[0]?.cursor || undefined;
  let hasMore = true;
  let added = 0;
  let modified = 0;
  let removed = 0;
  const transactionsAdded: string[] = [];
  const transactionsModified: string[] = [];
  const transactionsRemoved: string[] = [];

  while (hasMore) {
    const response = await client.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500
    });
    for (const transaction of [...response.data.added, ...response.data.modified]) {
      const mutation = upsertTransaction(itemId, transaction);
      const label = `${transaction.date}: ${transaction.name}`;
      if (mutation === 'added') {
        added += 1;
        if (transactionsAdded.length < MAX_SYNC_DETAIL_ITEMS) transactionsAdded.push(label);
      } else {
        modified += 1;
        if (transactionsModified.length < MAX_SYNC_DETAIL_ITEMS) transactionsModified.push(label);
      }
    }
    for (const transaction of response.data.removed) {
      const existing = query(
        'SELECT date, description FROM transactions WHERE plaid_transaction_id = ?',
        [transaction.transaction_id]
      )[0];
      if (!existing) continue;
      removed += 1;
      if (transactionsRemoved.length < MAX_SYNC_DETAIL_ITEMS) {
        transactionsRemoved.push(`${existing.date}: ${existing.description}`);
      }
      getDatabase().run(
        'DELETE FROM transactions WHERE plaid_transaction_id = ?',
        [transaction.transaction_id]
      );
    }
    cursor = response.data.next_cursor;
    hasMore = response.data.has_more;
  }

  getDatabase().run(
    `INSERT INTO plaid_sync_state (item_id, cursor) VALUES (?, ?)
     ON CONFLICT(item_id) DO UPDATE SET cursor = excluded.cursor`,
    [itemId, cursor || '']
  );
  getDatabase().run(
    "UPDATE plaid_items SET last_synced_at = datetime('now') WHERE item_id = ?",
    [itemId]
  );
  for (const snapshot of accountChanges.snapshots) {
    saveBalanceHistory(snapshot, capturedAt, syncRunId, trigger);
  }
  saveDatabase();
  const item = query('SELECT institution_name FROM plaid_items WHERE item_id = ?', [itemId])[0];
  return {
    institutionName: item?.institution_name || 'Linked institution',
    accountsAddedCount: accountChanges.addedCount,
    accountsUpdatedCount: accountChanges.updatedCount,
    accountsAdded: accountChanges.added,
    accountsUpdated: accountChanges.updated,
    transactionsAddedCount: added,
    transactionsModifiedCount: modified,
    transactionsRemovedCount: removed,
    transactionsAdded,
    transactionsModified,
    transactionsRemoved,
    added,
    modified,
    removed
  };
}

export async function runPlaidSync(
  requestedItemIds?: string[],
  trigger: PlaidSyncTrigger = 'manual'
): Promise<PlaidSyncResult> {
  if (syncInProgress) throw new Error('A Plaid sync is already in progress.');
  syncInProgress = true;
  try {
    const itemIds = requestedItemIds ||
      query('SELECT item_id FROM plaid_items ORDER BY created_at').map(row => row.item_id as string);
    const result: PlaidSyncResult = {
      added: 0,
      modified: 0,
      removed: 0,
      items: itemIds.length,
      institutions: []
    };
    const failures: string[] = [];
    const syncRunId = generateId();
    const capturedAt = new Date();

    for (const itemId of itemIds) {
      try {
        const itemResult = await syncItem(itemId, trigger, syncRunId, capturedAt);
        result.added += itemResult.added;
        result.modified += itemResult.modified;
        result.removed += itemResult.removed;
        result.institutions.push(itemResult);
      } catch (error) {
        const item = query(
          'SELECT institution_name FROM plaid_items WHERE item_id = ?',
          [itemId]
        );
        failures.push(`${item[0]?.institution_name || itemId}: ${plaidError(error).message}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Plaid sync failed for ${failures.join('; ')}`);
    }
    return result;
  } finally {
    syncInProgress = false;
  }
}

export function registerPlaidHandlers(): void {
  ipcMain.handle('plaid:openDashboard', () => {
    return shell.openExternal('https://dashboard.plaid.com/team/keys');
  });

  ipcMain.handle('plaid:getStatus', () => {
    let configured = false;
    let environment: PlaidEnvironment | null = null;
    let environmentMismatch = false;
    const profile = getRuntimeProfile();
    try {
      const credentials = readPlaidSecrets();
      environment = credentials.environment || null;
      environmentMismatch = Boolean(
        credentials.clientId &&
        credentials.secret &&
        environment &&
        environment !== profile.requiredPlaidEnvironment
      );
      configured = Boolean(credentials.clientId && credentials.secret) && !environmentMismatch;
    } catch {
      configured = false;
    }

    return {
      configured,
      environment,
      environmentMismatch,
      requiredEnvironment: profile.requiredPlaidEnvironment,
      profileKind: profile.kind,
      profileDisplayName: profile.displayName,
      secureStorageAvailable: safeStorage.isEncryptionAvailable(),
      items: query(
        `SELECT item_id AS itemId, institution_name AS institutionName,
                created_at AS createdAt, last_synced_at AS lastSyncedAt
         FROM plaid_items ORDER BY institution_name`
      )
    };
  });

  ipcMain.handle('plaid:configure', async (_event, data: {
    clientId: string;
    secret: string;
    environment: PlaidEnvironment;
  }) => {
    const clientId = data.clientId.trim();
    const secret = data.secret.trim();
    if (!clientId || !secret) throw new Error('Plaid Client ID and Secret are required.');
    if (data.environment !== 'sandbox' && data.environment !== 'production') {
      throw new Error('Unsupported Plaid environment.');
    }
    assertPlaidEnvironment(data.environment);
    const linkedItems = query('SELECT COUNT(*) AS count FROM plaid_items')[0]?.count || 0;
    const currentEnvironment = readPlaidSecrets().environment;
    if (linkedItems > 0 && currentEnvironment && currentEnvironment !== data.environment) {
      throw new Error('Disconnect all institutions before changing the Plaid environment.');
    }

    try {
      await buildClient(clientId, secret, data.environment).linkTokenCreate({
        user: { client_user_id: getClientUserId() },
        client_name: 'FinPulse',
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: 'en'
      });
      savePlaidCredentials(clientId, secret, data.environment);
    } catch (error) {
      throw plaidError(error);
    }
  });

  ipcMain.handle('plaid:openLink', async () => {
    try {
      const result = await openPlaidLink(await createLinkToken());
      return result ? await exchangeAndSync(result) : null;
    } catch (error) {
      throw plaidError(error);
    }
  });

  ipcMain.handle('plaid:sync', async (_event, itemId?: string) => {
    try {
      return await runPlaidSync(itemId ? [itemId] : undefined, 'manual');
    } catch (error) {
      throw plaidError(error);
    }
  });

  ipcMain.handle('plaid:disconnect', async (_event, itemId: string) => {
    const credentials = readPlaidSecrets();
    const accessToken = credentials.accessTokens?.[itemId];
    if (!accessToken) throw new Error('The access token for this Plaid connection is unavailable.');

    try {
      await getClient().itemRemove({ access_token: accessToken });
      getDatabase().run('DELETE FROM plaid_items WHERE item_id = ?', [itemId]);
      removePlaidAccessToken(itemId);
      saveDatabase();
    } catch (error) {
      throw plaidError(error);
    }
  });

  ipcMain.handle('plaid:clear', async () => {
    const profile = getRuntimeProfile();
    const credentials = readPlaidSecrets();
    if (credentials.environment && credentials.environment !== profile.requiredPlaidEnvironment) {
      const result = await revokeAllPlaidItems(true);
      if (result.revocationErrors.length === 0) clearPlaidScheduleState();
      return result;
    }
    const result = await revokeAllPlaidItems();
    if (result.revocationErrors.length === 0) clearPlaidScheduleState();
    return result;
  });

  ipcMain.handle('plaid:clearLocal', () => {
    getDatabase().run('DELETE FROM plaid_items');
    clearPlaidSecrets();
    clearPlaidScheduleState();
    saveDatabase();
  });
}
