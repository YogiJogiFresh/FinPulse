const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finpulse-backups-'));
app.setPath('userData', tempDir);

function hash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

app.whenReady().then(async () => {
  const { getDatabase, initDatabase, saveDatabase } = require('../dist/database.js');
  const {
    createAutomaticBackupIfDue,
    createBackup,
    listBackups,
    restoreBackup
  } = require('../dist/app-backups.js');

  await initDatabase();
  const database = getDatabase();
  database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('backup_test', 'version-one')");
  saveDatabase();
  fs.writeFileSync(
    path.join(tempDir, 'plaid-secrets.json'),
    JSON.stringify({ version: 1, payload: 'encrypted-test-payload' })
  );

  const first = createBackup('manual');
  assert.equal(first.reason, 'manual');
  assert.equal(first.includesPlaidSecrets, true);
  assert.equal(listBackups().length, 1);
  const firstDirectory = path.join(tempDir, 'backups', first.id);
  assert.equal(fs.existsSync(path.join(firstDirectory, 'finpulse.db')), true);
  assert.equal(fs.existsSync(path.join(firstDirectory, 'plaid-secrets.json')), true);
  const firstDatabaseHash = hash(path.join(firstDirectory, 'finpulse.db'));

  database.run("UPDATE settings SET value = 'version-two' WHERE key = 'backup_test'");
  saveDatabase();
  fs.writeFileSync(
    path.join(tempDir, 'plaid-secrets.json'),
    JSON.stringify({ version: 1, payload: 'new-encrypted-payload' })
  );
  restoreBackup(first.id, tempDir);
  assert.equal(hash(path.join(tempDir, 'finpulse.db')), firstDatabaseHash);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(tempDir, 'plaid-secrets.json'), 'utf8')),
    { version: 1, payload: 'encrypted-test-payload' }
  );
  assert.equal(listBackups().some(backup => backup.reason === 'pre_restore'), true);

  fs.rmSync(path.join(tempDir, 'plaid-secrets.json'), { force: true });
  const withoutSecrets = createBackup('manual');
  fs.writeFileSync(
    path.join(tempDir, 'plaid-secrets.json'),
    JSON.stringify({ version: 1, payload: 'should-be-removed' })
  );
  restoreBackup(withoutSecrets.id, tempDir);
  assert.equal(fs.existsSync(path.join(tempDir, 'plaid-secrets.json')), false);
  assert.throws(() => restoreBackup('invalid', tempDir), /Invalid backup ID/);

  const automaticDate = new Date('2026-05-12T15:00:00.000Z');
  const automatic = createAutomaticBackupIfDue(automaticDate);
  assert.ok(automatic);
  assert.equal(createAutomaticBackupIfDue(new Date('2026-05-12T20:00:00.000Z')), null);

  const tampered = createBackup('manual');
  fs.appendFileSync(path.join(tempDir, 'backups', tampered.id, 'finpulse.db'), 'tampered');
  assert.throws(() => restoreBackup(tampered.id, tempDir), /integrity validation/);

  for (let index = 0; index < 35; index++) {
    createBackup('manual', { now: new Date(Date.UTC(2027, 0, 1, 0, 0, index)) });
  }
  assert.equal(listBackups().filter(backup => backup.reason === 'manual').length, 10);
  assert.equal(listBackups().filter(backup => backup.reason === 'automatic').length, 1);
  assert.ok(listBackups().filter(backup => backup.reason === 'pre_restore').length <= 5);

  fs.rmSync(tempDir, { recursive: true, force: true });
  app.quit();
}).catch(error => {
  console.error(error);
  fs.rmSync(tempDir, { recursive: true, force: true });
  app.exit(1);
});
