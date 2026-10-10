import { BrowserWindow, ipcMain, Notification, powerMonitor } from 'electron';
import { createAppNotification } from './app-notifications';
import { query } from './database';
import { isPlaidSyncInProgress, runPlaidSync } from './ipc/plaid';
import { readPlaidSecrets } from './plaid-secrets';
import { getRuntimeProfile } from './runtime-profile';
import {
  findDueScheduleSlot,
  getPlaidScheduleConfig,
  getPlaidScheduleStatus,
  recordPlaidScheduleAttempt,
  updatePlaidScheduleConfig,
  type PlaidScheduleConfig
} from './plaid-schedule-settings';

let timer: NodeJS.Timeout | null = null;
let checking = false;

function emitScheduleChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('plaid:scheduleChanged');
  }
}

async function evaluateSchedule(now = new Date()): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    const config = getPlaidScheduleConfig();
    const status = getPlaidScheduleStatus(now);
    const slot = findDueScheduleSlot(now, config, status.lastCompletedSlot);
    if (!slot) return;

    const itemCount = Number(query('SELECT COUNT(*) AS count FROM plaid_items')[0]?.count || 0);
    if (itemCount === 0) return;
    let storedEnvironment;
    try {
      storedEnvironment = readPlaidSecrets().environment;
    } catch {
      return;
    }
    if (storedEnvironment !== getRuntimeProfile().requiredPlaidEnvironment) return;
    if (isPlaidSyncInProgress()) return;

    const trigger = now.getTime() - slot.at.getTime() <= 90_000 ? 'scheduled' : 'catch_up';
    try {
      await runPlaidSync(undefined, trigger);
      recordPlaidScheduleAttempt(slot, trigger, now);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Plaid automatic sync failed.';
      recordPlaidScheduleAttempt(slot, trigger, now, message);
      try {
        createAppNotification({
          severity: 'error',
          summary: 'Automatic Plaid Sync Failed',
          detail: message,
          source: 'plaid_scheduler'
        });
      } catch (notificationError) {
        console.error('Unable to persist automatic Plaid sync notification:', notificationError);
      }
      try {
        if (Notification.isSupported()) {
          new Notification({
            title: 'FinPulse Plaid Sync Failed',
            body: message
          }).show();
        }
      } catch (notificationError) {
        console.error('Unable to show automatic Plaid sync notification:', notificationError);
      }
    }
    emitScheduleChanged();
  } finally {
    checking = false;
  }
}

const resumeHandler = (): void => {
  void evaluateSchedule();
};

export function registerPlaidScheduleHandlers(): void {
  ipcMain.handle('plaid:getSchedule', () => getPlaidScheduleStatus());
  ipcMain.handle('plaid:setSchedule', (_event, config: PlaidScheduleConfig) => {
    const updated = updatePlaidScheduleConfig(config);
    emitScheduleChanged();
    void evaluateSchedule();
    return { ...getPlaidScheduleStatus(), ...updated };
  });
}

export function startPlaidScheduler(): void {
  if (timer) return;
  void evaluateSchedule();
  timer = setInterval(() => void evaluateSchedule(), 30_000);
  powerMonitor.on('resume', resumeHandler);
}

export function stopPlaidScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  powerMonitor.removeListener('resume', resumeHandler);
}
