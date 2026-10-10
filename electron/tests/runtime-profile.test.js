const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');

app.whenReady().then(() => {
  const {
    isPlaidEnvironmentAllowed,
    migrateLegacyDevelopmentProfile,
    resolveRuntimeProfile
  } = require('../dist/runtime-profile.js');

  const appData = fs.mkdtempSync(path.join(os.tmpdir(), 'finpulse-profiles-'));
  const development = resolveRuntimeProfile(false, appData);
  const production = resolveRuntimeProfile(true, appData);

  assert.equal(development.kind, 'development');
  assert.equal(development.appName, 'FinPulse Dev');
  assert.equal(development.userDataPath, path.join(appData, 'FinPulse-Dev'));
  assert.equal(development.requiredPlaidEnvironment, 'sandbox');
  assert.equal(production.kind, 'production');
  assert.equal(production.appName, 'FinPulse');
  assert.equal(production.userDataPath, path.join(appData, 'FinPulse'));
  assert.equal(production.requiredPlaidEnvironment, 'production');
  assert.equal(isPlaidEnvironmentAllowed(development, 'sandbox'), true);
  assert.equal(isPlaidEnvironmentAllowed(development, 'production'), false);
  assert.equal(isPlaidEnvironmentAllowed(production, 'production'), true);
  assert.equal(isPlaidEnvironmentAllowed(production, 'sandbox'), false);

  const legacy = path.join(appData, 'finpulse-electron');
  fs.mkdirSync(legacy);
  fs.writeFileSync(path.join(legacy, 'finpulse.db'), 'sandbox-data');
  const migrated = migrateLegacyDevelopmentProfile(appData, false);
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.fallbackUserDataPath, null);
  assert.equal(fs.existsSync(legacy), false);
  assert.equal(
    fs.readFileSync(path.join(appData, 'FinPulse-Dev', 'finpulse.db'), 'utf8'),
    'sandbox-data'
  );

  fs.mkdirSync(legacy);
  fs.writeFileSync(path.join(legacy, 'legacy.txt'), 'leave-me');
  const conflict = migrateLegacyDevelopmentProfile(appData, false);
  assert.equal(conflict.migrated, false);
  assert.match(conflict.warning, /Both legacy and Development profiles exist/);
  assert.equal(conflict.fallbackUserDataPath, null);
  assert.equal(fs.existsSync(path.join(legacy, 'legacy.txt')), true);

  const productionOnlyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'finpulse-prod-profile-'));
  const productionLegacy = path.join(productionOnlyRoot, 'finpulse-electron');
  fs.mkdirSync(productionLegacy);
  fs.writeFileSync(path.join(productionLegacy, 'finpulse.db'), 'do-not-migrate');
  const productionMigration = migrateLegacyDevelopmentProfile(productionOnlyRoot, true);
  assert.equal(productionMigration.migrated, false);
  assert.equal(productionMigration.fallbackUserDataPath, null);
  assert.equal(fs.existsSync(productionLegacy), true);
  assert.equal(fs.existsSync(path.join(productionOnlyRoot, 'FinPulse')), false);

  fs.rmSync(appData, { recursive: true, force: true });
  fs.rmSync(productionOnlyRoot, { recursive: true, force: true });
  app.quit();
}).catch(error => {
  console.error(error);
  app.exit(1);
});
