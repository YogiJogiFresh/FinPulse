import { getDatabase, query, saveDatabase } from './database';

export type PlaidSyncTrigger = 'link' | 'manual' | 'scheduled' | 'catch_up';

export interface PlaidScheduleConfig {
  firstDayEnabled: boolean;
  lastDayEnabled: boolean;
  localTime: string;
}

export interface PlaidScheduleSlot {
  id: string;
  kind: 'first' | 'last';
  at: Date;
}

export interface PlaidScheduleStatus extends PlaidScheduleConfig {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastTrigger: PlaidSyncTrigger | null;
  lastError: string | null;
  lastCompletedSlot: string | null;
  nextRunAt: string | null;
}

const KEYS = {
  firstEnabled: 'plaid_auto_sync_first_enabled',
  lastEnabled: 'plaid_auto_sync_last_enabled',
  time: 'plaid_auto_sync_time',
  lastAttemptAt: 'plaid_auto_sync_last_attempt_at',
  lastSuccessAt: 'plaid_auto_sync_last_success_at',
  lastTrigger: 'plaid_auto_sync_last_trigger',
  lastError: 'plaid_auto_sync_last_error',
  lastCompletedSlot: 'plaid_auto_sync_last_completed_slot'
} as const;

const STATE_KEYS = [
  KEYS.lastAttemptAt,
  KEYS.lastSuccessAt,
  KEYS.lastTrigger,
  KEYS.lastError,
  KEYS.lastCompletedSlot
];

function setting(key: string): string | null {
  return query('SELECT value FROM settings WHERE key = ?', [key])[0]?.value ?? null;
}

function setSetting(key: string, value: string): void {
  getDatabase().run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

function validTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function getPlaidScheduleConfig(): PlaidScheduleConfig {
  const localTime = setting(KEYS.time) || '09:00';
  return {
    firstDayEnabled: setting(KEYS.firstEnabled) !== 'false',
    lastDayEnabled: setting(KEYS.lastEnabled) !== 'false',
    localTime: validTime(localTime) ? localTime : '09:00'
  };
}

export function updatePlaidScheduleConfig(config: PlaidScheduleConfig): PlaidScheduleConfig {
  if (typeof config.firstDayEnabled !== 'boolean' || typeof config.lastDayEnabled !== 'boolean') {
    throw new Error('Plaid automatic sync toggles must be true or false.');
  }
  if (typeof config.localTime !== 'string' || !validTime(config.localTime)) {
    throw new Error('Plaid automatic sync time must use 24-hour HH:mm format.');
  }
  setSetting(KEYS.firstEnabled, String(config.firstDayEnabled));
  setSetting(KEYS.lastEnabled, String(config.lastDayEnabled));
  setSetting(KEYS.time, config.localTime);
  saveDatabase();
  return getPlaidScheduleConfig();
}

function slotFor(
  year: number,
  month: number,
  kind: 'first' | 'last',
  localTime: string
): PlaidScheduleSlot {
  const [hour, minute] = localTime.split(':').map(Number);
  const day = kind === 'first' ? 1 : new Date(year, month + 1, 0).getDate();
  return {
    id: `${kind}:${year}-${String(month + 1).padStart(2, '0')}`,
    kind,
    at: new Date(year, month, day, hour, minute, 0, 0)
  };
}

export function scheduleSlotsNear(now: Date, config: PlaidScheduleConfig): PlaidScheduleSlot[] {
  const slots: PlaidScheduleSlot[] = [];
  for (let offset = -1; offset <= 1; offset++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    if (config.firstDayEnabled) {
      slots.push(slotFor(monthDate.getFullYear(), monthDate.getMonth(), 'first', config.localTime));
    }
    if (config.lastDayEnabled) {
      slots.push(slotFor(monthDate.getFullYear(), monthDate.getMonth(), 'last', config.localTime));
    }
  }
  return slots.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function slotOrder(id: string | null, config: PlaidScheduleConfig): number {
  if (!id) return Number.NEGATIVE_INFINITY;
  const match = /^(first|last):(\d{4})-(\d{2})$/.exec(id);
  if (!match) return Number.NEGATIVE_INFINITY;
  return slotFor(Number(match[2]), Number(match[3]) - 1, match[1] as 'first' | 'last', config.localTime)
    .at.getTime();
}

export function findDueScheduleSlot(
  now: Date,
  config: PlaidScheduleConfig,
  lastCompletedSlot: string | null
): PlaidScheduleSlot | null {
  const lastOrder = slotOrder(lastCompletedSlot, config);
  const elapsed = scheduleSlotsNear(now, config).filter(
    slot => slot.at.getTime() <= now.getTime() && slot.at.getTime() > lastOrder
  );
  return elapsed[elapsed.length - 1] || null;
}

export function findNextScheduleSlot(
  now: Date,
  config: PlaidScheduleConfig,
  lastCompletedSlot: string | null
): PlaidScheduleSlot | null {
  const due = findDueScheduleSlot(now, config, lastCompletedSlot);
  if (due) return due;
  return scheduleSlotsNear(now, config).find(slot => slot.at.getTime() > now.getTime()) || null;
}

export function getPlaidScheduleStatus(now = new Date()): PlaidScheduleStatus {
  const config = getPlaidScheduleConfig();
  const lastCompletedSlot = setting(KEYS.lastCompletedSlot);
  const next = findNextScheduleSlot(now, config, lastCompletedSlot);
  const trigger = setting(KEYS.lastTrigger);
  return {
    ...config,
    lastAttemptAt: setting(KEYS.lastAttemptAt),
    lastSuccessAt: setting(KEYS.lastSuccessAt),
    lastTrigger: ['link', 'manual', 'scheduled', 'catch_up'].includes(trigger || '')
      ? trigger as PlaidSyncTrigger
      : null,
    lastError: setting(KEYS.lastError),
    lastCompletedSlot,
    nextRunAt: next?.at.toISOString() || null
  };
}

export function recordPlaidScheduleAttempt(
  slot: PlaidScheduleSlot,
  trigger: 'scheduled' | 'catch_up',
  attemptedAt: Date,
  error?: string
): void {
  setSetting(KEYS.lastAttemptAt, attemptedAt.toISOString());
  setSetting(KEYS.lastTrigger, trigger);
  setSetting(KEYS.lastCompletedSlot, slot.id);
  if (error) {
    setSetting(KEYS.lastError, error);
  } else {
    setSetting(KEYS.lastSuccessAt, attemptedAt.toISOString());
    setSetting(KEYS.lastError, '');
  }
  saveDatabase();
}

export function clearPlaidScheduleState(): void {
  for (const key of STATE_KEYS) {
    getDatabase().run('DELETE FROM settings WHERE key = ?', [key]);
  }
  saveDatabase();
}
