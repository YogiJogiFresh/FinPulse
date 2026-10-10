import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type RuntimeProfileKind = 'development' | 'production';
export type PlaidEnvironment = 'sandbox' | 'production';

export interface RuntimeProfile {
  kind: RuntimeProfileKind;
  appName: string;
  displayName: string;
  userDataPath: string;
  requiredPlaidEnvironment: PlaidEnvironment;
}

export interface ProfileMigrationResult {
  migrated: boolean;
  warning: string | null;
  fallbackUserDataPath: string | null;
}

let activeProfile: RuntimeProfile | null = null;

export function resolveRuntimeProfile(isPackaged: boolean, appDataPath: string): RuntimeProfile {
  if (isPackaged) {
    return {
      kind: 'production',
      appName: 'FinPulse',
      displayName: 'Production',
      userDataPath: path.join(appDataPath, 'FinPulse'),
      requiredPlaidEnvironment: 'production'
    };
  }
  return {
    kind: 'development',
    appName: 'FinPulse Dev',
    displayName: 'Development / Sandbox',
    userDataPath: path.join(appDataPath, 'FinPulse-Dev'),
    requiredPlaidEnvironment: 'sandbox'
  };
}

export function migrateLegacyDevelopmentProfile(
  appDataPath: string,
  isPackaged: boolean
): ProfileMigrationResult {
  if (isPackaged) return { migrated: false, warning: null, fallbackUserDataPath: null };

  const legacyPath = path.join(appDataPath, 'finpulse-electron');
  const developmentPath = path.join(appDataPath, 'FinPulse-Dev');
  const legacyExists = fs.existsSync(legacyPath);
  const developmentExists = fs.existsSync(developmentPath);

  if (!legacyExists) return { migrated: false, warning: null, fallbackUserDataPath: null };
  if (!fs.statSync(legacyPath).isDirectory()) {
    return {
      migrated: false,
      warning: `The legacy FinPulse profile path is not a directory: ${legacyPath}`,
      fallbackUserDataPath: null
    };
  }
  if (developmentExists) {
    return {
      migrated: false,
      warning: `Both legacy and Development profiles exist. FinPulse left them unchanged: ${legacyPath} and ${developmentPath}`,
      fallbackUserDataPath: null
    };
  }

  try {
    fs.renameSync(legacyPath, developmentPath);
    return { migrated: true, warning: null, fallbackUserDataPath: null };
  } catch (error) {
    return {
      migrated: false,
      warning: `Unable to move the legacy profile to ${developmentPath}. Development will continue using ${legacyPath} for this run: ${error instanceof Error ? error.message : String(error)}`,
      fallbackUserDataPath: legacyPath
    };
  }
}

export function configureRuntimeProfile(): RuntimeProfile {
  if (activeProfile) return activeProfile;
  const appDataPath = app.getPath('appData');
  const migration = migrateLegacyDevelopmentProfile(appDataPath, app.isPackaged);
  if (migration.migrated) {
    console.log('Migrated the legacy FinPulse profile to the Development profile.');
  }
  if (migration.warning) console.warn(migration.warning);

  activeProfile = resolveRuntimeProfile(app.isPackaged, appDataPath);
  if (migration.fallbackUserDataPath) {
    activeProfile = { ...activeProfile, userDataPath: migration.fallbackUserDataPath };
  }
  app.setName(activeProfile.appName);
  app.setPath('userData', activeProfile.userDataPath);
  return activeProfile;
}

export function getRuntimeProfile(): RuntimeProfile {
  if (!activeProfile) throw new Error('Runtime profile has not been configured.');
  return activeProfile;
}

export function isPlaidEnvironmentAllowed(
  profile: RuntimeProfile,
  environment: PlaidEnvironment
): boolean {
  return environment === profile.requiredPlaidEnvironment;
}

export function assertPlaidEnvironment(environment: PlaidEnvironment): void {
  const profile = getRuntimeProfile();
  if (!isPlaidEnvironmentAllowed(profile, environment)) {
    throw new Error(
      `${profile.displayName} only allows Plaid ${profile.requiredPlaidEnvironment} credentials.`
    );
  }
}
