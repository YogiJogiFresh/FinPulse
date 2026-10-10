import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import { initDatabase, saveDatabase } from './database';
import { registerAllHandlers } from './ipc/index';
import {
  registerPlaidScheduleHandlers,
  startPlaidScheduler,
  stopPlaidScheduler
} from './plaid-scheduler';
import { createAutomaticBackupIfDue, isRestoreInProgress } from './app-backups';
import { createAppNotification } from './app-notifications';
import { configureRuntimeProfile, getRuntimeProfile } from './runtime-profile';

const isDev = !app.isPackaged;
const runtimeProfile = configureRuntimeProfile();
let mainWindow: BrowserWindow | null = null;
let backupTimer: NodeJS.Timeout | null = null;

function isTrustedRendererUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (isDev) {
      return parsed.protocol === 'http:' && parsed.hostname === 'localhost' && parsed.port === '5173';
    }
    return parsed.protocol === 'file:' && parsed.pathname.endsWith('/client/index.html');
  } catch {
    return false;
  }
}

function secureIpcHandlers(): void {
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = ((channel: string, listener: Parameters<typeof ipcMain.handle>[1]) => {
    handle(channel, (event, ...args) => {
      const senderUrl = event.senderFrame?.url || event.sender.getURL();
      if (!isTrustedRendererUrl(senderUrl)) {
        throw new Error(`Blocked IPC request from an untrusted renderer.`);
      }
      if (isRestoreInProgress()) {
        throw new Error('FinPulse is restarting to complete a restore.');
      }
      return listener(event, ...args);
    });
  }) as typeof ipcMain.handle;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: runtimeProfile.appName,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    autoHideMenuBar: true
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const clientPath = path.join(process.resourcesPath, 'client', 'index.html');
    mainWindow.loadFile(clientPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdater(): void {
  if (isDev) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) of FinPulse is available. Would you like to download it?`,
      buttons: ['Download', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate().catch((err) => {
          console.error('Download failed:', err);
          if (mainWindow) {
            dialog.showMessageBox(mainWindow, {
              type: 'error',
              title: 'Download Failed',
              message: `Failed to download update: ${err.message}`,
              buttons: ['OK']
            });
          }
        });
      }
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) {
      mainWindow.setProgressBar(progress.percent / 100);
    }
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) {
      mainWindow.setProgressBar(-1);
    }
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. FinPulse will restart to install it.',
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
    if (mainWindow) {
      mainWindow.setProgressBar(-1);
    }
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Update check failed:', err.message);
  });
}

app.whenReady().then(async () => {
  try {
    createAutomaticBackupIfDue(new Date(), undefined, false);
  } catch (error) {
    console.error('Pre-migration backup failed:', error);
  }
  await initDatabase();
  secureIpcHandlers();
  registerAllHandlers();
  registerPlaidScheduleHandlers();

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getRuntimeProfile', () => ({
    kind: runtimeProfile.kind,
    displayName: runtimeProfile.displayName,
    requiredPlaidEnvironment: runtimeProfile.requiredPlaidEnvironment
  }));

  createWindow();
  setupAutoUpdater();
  startPlaidScheduler();
  try {
    createAutomaticBackupIfDue();
  } catch (error) {
    console.error('Automatic backup failed:', error);
    try {
      createAppNotification({
        severity: 'error',
        summary: 'Automatic Backup Failed',
        detail: error instanceof Error ? error.message : 'Unable to create the daily backup.',
        source: 'backup_scheduler'
      });
    } catch (notificationError) {
      console.error('Unable to persist backup failure notification:', notificationError);
    }
  }
  backupTimer = setInterval(() => {
    try {
      createAutomaticBackupIfDue();
    } catch (error) {
      console.error('Automatic backup failed:', error);
      try {
        createAppNotification({
          severity: 'error',
          summary: 'Automatic Backup Failed',
          detail: error instanceof Error ? error.message : 'Unable to create the daily backup.',
          source: 'backup_scheduler'
        });
      } catch (notificationError) {
        console.error('Unable to persist backup failure notification:', notificationError);
      }
    }
  }, 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Periodic save every 30s to protect against crash data loss
setInterval(() => saveDatabase(), 30000);

app.on('before-quit', () => {
  stopPlaidScheduler();
  if (backupTimer) clearInterval(backupTimer);
  saveDatabase();
});
