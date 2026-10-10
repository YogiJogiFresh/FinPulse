import { ipcMain } from 'electron';
import {
  clearAppNotifications,
  createAppNotification,
  dismissAppNotification,
  listAppNotifications,
  markAllAppNotificationsRead,
  type CreateAppNotification
} from '../app-notifications';

export function registerNotificationHandlers(): void {
  ipcMain.handle('notifications:getAll', () => listAppNotifications());

  ipcMain.handle('notifications:create', (_event, data: CreateAppNotification) => {
    if (!data || typeof data !== 'object') throw new Error('Invalid notification payload.');
    return createAppNotification({ ...data, source: 'renderer' });
  });

  ipcMain.handle('notifications:markAllRead', () => {
    markAllAppNotificationsRead();
  });

  ipcMain.handle('notifications:dismiss', (_event, id: string) => {
    dismissAppNotification(id);
  });

  ipcMain.handle('notifications:clearAll', () => {
    clearAppNotifications();
  });
}
