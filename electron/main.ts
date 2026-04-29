import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import { initDatabase, saveDatabase } from './database';
import { registerAllHandlers } from './ipc/index';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true
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
  await initDatabase();
  registerAllHandlers();

  ipcMain.handle('app:getVersion', () => app.getVersion());

  createWindow();
  setupAutoUpdater();

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
  saveDatabase();
});
