import { app, BrowserWindow, dialog } from 'electron';
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
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) of FinPulse is available. Would you like to download it?`,
      buttons: ['Download', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-downloaded', () => {
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
    // Silently ignore update errors — don't disrupt the user
    console.log('Auto-updater error:', err.message);
  });

  autoUpdater.checkForUpdates();
}

app.whenReady().then(async () => {
  await initDatabase();
  registerAllHandlers();
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
