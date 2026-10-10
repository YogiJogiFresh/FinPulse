import { BrowserWindow } from 'electron';
import { generateId, getDatabase, query, saveDatabase } from './database';

export type AppNotificationSeverity = 'success' | 'info' | 'warn' | 'error';

export interface CreateAppNotification {
  severity?: string;
  summary?: string;
  detail?: string;
  expandedDetail?: string;
  source?: string;
}

export interface AppNotificationRecord {
  id: string;
  severity: AppNotificationSeverity;
  summary: string;
  detail: string;
  expandedDetail: string;
  source: string;
  createdAt: string;
  readAt: string | null;
}

const MAX_NOTIFICATIONS = 100;
const MAX_SUMMARY_LENGTH = 120;
const MAX_DETAIL_LENGTH = 1000;
const MAX_EXPANDED_DETAIL_LENGTH = 8000;
const MAX_SOURCE_LENGTH = 64;
const ID_PATTERN = /^[a-f0-9]{24}$/;

function limitedText(value: unknown, fallback: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, maxLength);
}

function normalizeSeverity(value: unknown): AppNotificationSeverity {
  return value === 'success' || value === 'warn' || value === 'error' ? value : 'info';
}

function emitNotificationsChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('notifications:changed');
  }
}

export function createAppNotification(input: CreateAppNotification): AppNotificationRecord {
  const record: AppNotificationRecord = {
    id: generateId(),
    severity: normalizeSeverity(input.severity),
    summary: limitedText(input.summary, 'Notification', MAX_SUMMARY_LENGTH),
    detail: limitedText(input.detail, '', MAX_DETAIL_LENGTH),
    expandedDetail: limitedText(input.expandedDetail, '', MAX_EXPANDED_DETAIL_LENGTH),
    source: limitedText(input.source, 'app', MAX_SOURCE_LENGTH),
    createdAt: new Date().toISOString(),
    readAt: null
  };
  const db = getDatabase();
  db.run(
    `INSERT INTO app_notifications (
      id, severity, summary, detail, expanded_detail, source, created_at, read_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      record.id,
      record.severity,
      record.summary,
      record.detail,
      record.expandedDetail,
      record.source,
      record.createdAt
    ]
  );
  db.run(
    `DELETE FROM app_notifications
     WHERE id NOT IN (
       SELECT id FROM app_notifications
       ORDER BY created_at DESC, rowid DESC
       LIMIT ?
     )`,
    [MAX_NOTIFICATIONS]
  );
  saveDatabase();
  emitNotificationsChanged();
  return record;
}

export function listAppNotifications(): AppNotificationRecord[] {
  return query(
    `SELECT id, severity, summary, detail, expanded_detail AS expandedDetail, source,
            created_at AS createdAt, read_at AS readAt
     FROM app_notifications
     ORDER BY created_at DESC, rowid DESC
     LIMIT ?`,
    [MAX_NOTIFICATIONS]
  ) as AppNotificationRecord[];
}

export function markAllAppNotificationsRead(): void {
  getDatabase().run(
    `UPDATE app_notifications
     SET read_at = ?
     WHERE read_at IS NULL`,
    [new Date().toISOString()]
  );
  saveDatabase();
  emitNotificationsChanged();
}

export function dismissAppNotification(id: string): void {
  if (!ID_PATTERN.test(id)) throw new Error('Invalid notification ID.');
  getDatabase().run('DELETE FROM app_notifications WHERE id = ?', [id]);
  saveDatabase();
  emitNotificationsChanged();
}

export function clearAppNotifications(): void {
  getDatabase().run('DELETE FROM app_notifications');
  saveDatabase();
  emitNotificationsChanged();
}
