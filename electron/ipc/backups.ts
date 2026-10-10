import { app, BrowserWindow, ipcMain } from 'electron';
import {
  createBackup,
  listBackups,
  openBackupFolder,
  restoreBackup
} from '../app-backups';
import { startPlaidScheduler, stopPlaidScheduler } from '../plaid-scheduler';

export function registerBackupHandlers(): void {
  ipcMain.handle('backups:getAll', () => listBackups());
  ipcMain.handle('backups:create', () => createBackup('manual'));
  ipcMain.handle('backups:openFolder', () => openBackupFolder());
  ipcMain.handle('backups:restore', (_event, id: string) => {
    stopPlaidScheduler();
    let restored;
    try {
      restored = restoreBackup(id);
    } catch (error) {
      startPlaidScheduler();
      throw error;
    }
    const watchdog = setTimeout(() => process.exit(0), 2000);
    watchdog.unref();
    setTimeout(() => {
      for (const window of BrowserWindow.getAllWindows()) window.hide();
      try {
        app.relaunch();
      } finally {
        app.exit(0);
      }
    }, 50);
    return restored;
  });
}
