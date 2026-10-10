const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finpulse-notifications-'));
app.setPath('userData', tempDir);

app.whenReady().then(async () => {
  const { initDatabase } = require('../dist/database.js');
  const {
    clearAppNotifications,
    createAppNotification,
    dismissAppNotification,
    listAppNotifications,
    markAllAppNotificationsRead
  } = require('../dist/app-notifications.js');

  await initDatabase();

  for (let index = 0; index < 105; index++) {
    createAppNotification({
      severity: index % 2 === 0 ? 'success' : 'error',
      summary: `Notification ${index}`,
      detail: 'Stored integration test notification.',
      expandedDetail: 'Specific stored integration test details.',
      source: 'test'
    });
  }

  let notifications = listAppNotifications();
  assert.equal(notifications.length, 100);
  assert.equal(notifications[0].summary, 'Notification 104');
  assert.equal(notifications.some(notification => notification.summary === 'Notification 0'), false);
  assert.equal(notifications.filter(notification => notification.readAt === null).length, 100);
  assert.equal(notifications[0].expandedDetail, 'Specific stored integration test details.');

  markAllAppNotificationsRead();
  notifications = listAppNotifications();
  assert.equal(notifications.every(notification => notification.readAt !== null), true);

  const dismissedId = notifications[0].id;
  dismissAppNotification(dismissedId);
  notifications = listAppNotifications();
  assert.equal(notifications.length, 99);
  assert.equal(notifications.some(notification => notification.id === dismissedId), false);

  clearAppNotifications();
  assert.equal(listAppNotifications().length, 0);

  const normalized = createAppNotification({
    severity: 'unknown',
    summary: 'S'.repeat(200),
    detail: 'D'.repeat(1200),
    expandedDetail: 'E'.repeat(9000),
    source: 'T'.repeat(100)
  });
  assert.equal(normalized.severity, 'info');
  assert.equal(normalized.summary.length, 120);
  assert.equal(normalized.detail.length, 1000);
  assert.equal(normalized.expandedDetail.length, 8000);
  assert.equal(normalized.source.length, 64);
  assert.throws(() => dismissAppNotification('invalid'), /Invalid notification ID/);

  fs.rmSync(tempDir, { recursive: true, force: true });
  app.quit();
}).catch(error => {
  console.error(error);
  fs.rmSync(tempDir, { recursive: true, force: true });
  app.exit(1);
});
