import { app, shell } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { saveDatabase, setDatabaseSavesSuspended } from './database';

export type BackupReason = 'automatic' | 'manual' | 'pre_restore';

export interface BackupRecord {
  id: string;
  createdAt: string;
  reason: BackupReason;
  sizeBytes: number;
  includesPlaidSecrets: boolean;
}

interface BackupFileManifest {
  name: string;
  sizeBytes: number;
  sha256: string;
}

interface BackupManifest {
  version: 1;
  id: string;
  createdAt: string;
  reason: BackupReason;
  files: BackupFileManifest[];
}

interface BackupPaths {
  userDataDir: string;
  backupRoot: string;
  database: string;
  plaidSecrets: string;
}

const BACKUP_ID_PATTERN = /^\d{8}T\d{6}\d{3}Z-(automatic|manual|pre_restore)-[a-f0-9]{8}$/;
const DATABASE_FILE = 'finpulse.db';
const PLAID_SECRETS_FILE = 'plaid-secrets.json';
const MANIFEST_FILE = 'manifest.json';
const RETENTION: Record<BackupReason, number> = {
  automatic: 30,
  manual: 10,
  pre_restore: 5
};
let backupInProgress = false;
let restoreInProgress = false;

export function isRestoreInProgress(): boolean {
  return restoreInProgress;
}

function paths(userDataDir = app.getPath('userData')): BackupPaths {
  return {
    userDataDir,
    backupRoot: path.join(userDataDir, 'backups'),
    database: path.join(userDataDir, DATABASE_FILE),
    plaidSecrets: path.join(userDataDir, PLAID_SECRETS_FILE)
  };
}

function sha256(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function backupId(reason: BackupReason, now: Date): string {
  const timestamp = now.toISOString().replace(/[-:.]/g, '');
  return `${timestamp}-${reason}-${crypto.randomBytes(4).toString('hex')}`;
}

function writeFileManifest(directory: string, name: string, data: Buffer): BackupFileManifest {
  fs.writeFileSync(path.join(directory, name), data, { mode: 0o600 });
  return { name, sizeBytes: data.length, sha256: sha256(data) };
}

function readManifest(directory: string, expectedId = path.basename(directory)): BackupManifest {
  const manifestPath = path.join(directory, MANIFEST_FILE);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest;
  if (
    manifest.version !== 1 ||
    !BACKUP_ID_PATTERN.test(manifest.id) ||
    manifest.id !== expectedId ||
    !['automatic', 'manual', 'pre_restore'].includes(manifest.reason) ||
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error('Backup manifest is invalid.');
  }
  return manifest;
}

function validateSqlite(data: Buffer): void {
  if (data.length < 100 || data.subarray(0, 16).toString('utf8') !== 'SQLite format 3\u0000') {
    throw new Error('Backup database is not a valid SQLite file.');
  }
}

function validatePlaidSecrets(data: Buffer): void {
  const parsed = JSON.parse(data.toString('utf8')) as { version?: unknown; payload?: unknown };
  if (parsed.version !== 1 || typeof parsed.payload !== 'string' || parsed.payload.length === 0) {
    throw new Error('Backup Plaid secret file is invalid.');
  }
}

function validateBackupDirectory(directory: string, expectedId?: string): {
  manifest: BackupManifest;
  database: Buffer;
  plaidSecrets: Buffer | null;
} {
  const manifest = readManifest(directory, expectedId);
  const allowedNames = new Set([DATABASE_FILE, PLAID_SECRETS_FILE]);
  if (
    manifest.files.length < 1 ||
    manifest.files.length > 2 ||
    manifest.files.some(file => !allowedNames.has(file.name)) ||
    !manifest.files.some(file => file.name === DATABASE_FILE)
  ) {
    throw new Error('Backup file list is invalid.');
  }

  const buffers = new Map<string, Buffer>();
  for (const file of manifest.files) {
    const filePath = path.join(directory, file.name);
    const data = fs.readFileSync(filePath);
    if (data.length !== file.sizeBytes || sha256(data) !== file.sha256) {
      throw new Error(`Backup file ${file.name} failed integrity validation.`);
    }
    buffers.set(file.name, data);
  }

  const database = buffers.get(DATABASE_FILE)!;
  validateSqlite(database);
  const plaidSecrets = buffers.get(PLAID_SECRETS_FILE) || null;
  if (plaidSecrets) validatePlaidSecrets(plaidSecrets);
  return { manifest, database, plaidSecrets };
}

function backupRecord(manifest: BackupManifest): BackupRecord {
  return {
    id: manifest.id,
    createdAt: manifest.createdAt,
    reason: manifest.reason,
    sizeBytes: manifest.files.reduce((total, file) => total + file.sizeBytes, 0),
    includesPlaidSecrets: manifest.files.some(file => file.name === PLAID_SECRETS_FILE)
  };
}

function pruneBackups(backupRoot: string): void {
  const backups = listBackups(path.dirname(backupRoot));
  for (const reason of Object.keys(RETENTION) as BackupReason[]) {
    const matching = backups.filter(backup => backup.reason === reason);
    for (const backup of matching.slice(RETENTION[reason])) {
      fs.rmSync(path.join(backupRoot, backup.id), { recursive: true, force: true });
    }
  }
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(backupRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(backupRoot, entry.name);
    if (entry.name.startsWith('.') && entry.name.endsWith('.tmp')) {
      if (fs.statSync(directory).mtimeMs < cutoff) {
        fs.rmSync(directory, { recursive: true, force: true });
      }
      continue;
    }
    if (BACKUP_ID_PATTERN.test(entry.name)) {
      try {
        readManifest(directory);
      } catch {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    }
  }
}

export function createBackup(
  reason: BackupReason,
  options: { userDataDir?: string; now?: Date; saveCurrentDatabase?: boolean } = {}
): BackupRecord {
  if (backupInProgress) throw new Error('A backup is already in progress.');
  backupInProgress = true;
  try {
    const backupPaths = paths(options.userDataDir);
    const now = options.now || new Date();
    if (options.saveCurrentDatabase !== false) saveDatabase();
    if (!fs.existsSync(backupPaths.database)) {
      throw new Error('FinPulse database file is unavailable.');
    }

    fs.mkdirSync(backupPaths.backupRoot, { recursive: true });
    const id = backupId(reason, now);
    const temporaryDirectory = path.join(backupPaths.backupRoot, `.${id}.tmp`);
    const finalDirectory = path.join(backupPaths.backupRoot, id);
    fs.mkdirSync(temporaryDirectory, { recursive: false });

    try {
      const files = [
        writeFileManifest(
          temporaryDirectory,
          DATABASE_FILE,
          fs.readFileSync(backupPaths.database)
        )
      ];
      if (fs.existsSync(backupPaths.plaidSecrets)) {
        files.push(writeFileManifest(
          temporaryDirectory,
          PLAID_SECRETS_FILE,
          fs.readFileSync(backupPaths.plaidSecrets)
        ));
      }
      const manifest: BackupManifest = {
        version: 1,
        id,
        createdAt: now.toISOString(),
        reason,
        files
      };
      fs.writeFileSync(
        path.join(temporaryDirectory, MANIFEST_FILE),
        JSON.stringify(manifest, null, 2),
        { encoding: 'utf8', mode: 0o600 }
      );
      validateBackupDirectory(temporaryDirectory, id);
      fs.renameSync(temporaryDirectory, finalDirectory);
      pruneBackups(backupPaths.backupRoot);
      return backupRecord(manifest);
    } catch (error) {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
  } finally {
    backupInProgress = false;
  }
}

export function listBackups(userDataDir?: string): BackupRecord[] {
  const backupRoot = paths(userDataDir).backupRoot;
  if (!fs.existsSync(backupRoot)) return [];
  const records: BackupRecord[] = [];
  for (const entry of fs.readdirSync(backupRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !BACKUP_ID_PATTERN.test(entry.name)) continue;
    try {
      records.push(backupRecord(readManifest(path.join(backupRoot, entry.name))));
    } catch (error) {
      console.error(`Ignoring invalid backup ${entry.name}:`, error);
    }
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createAutomaticBackupIfDue(
  now = new Date(),
  userDataDir?: string,
  saveCurrentDatabase = true
): BackupRecord | null {
  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
  const existing = listBackups(userDataDir).some(backup => {
    const created = new Date(backup.createdAt);
    const createdLocalDate = [
      created.getFullYear(),
      String(created.getMonth() + 1).padStart(2, '0'),
      String(created.getDate()).padStart(2, '0')
    ].join('-');
    return backup.reason === 'automatic' && createdLocalDate === localDate;
  });
  if (existing) return null;
  if (!saveCurrentDatabase && !fs.existsSync(paths(userDataDir).database)) return null;
  return createBackup('automatic', { userDataDir, now, saveCurrentDatabase });
}

function replaceFile(destination: string, data: Buffer): void {
  const temporaryPath = `${destination}.restore-${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, data, { mode: 0o600 });
  try {
    fs.renameSync(temporaryPath, destination);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

export function restoreBackup(id: string, userDataDir?: string): BackupRecord {
  if (!BACKUP_ID_PATTERN.test(id)) throw new Error('Invalid backup ID.');
  const liveRestore = userDataDir === undefined;
  if (liveRestore && restoreInProgress) throw new Error('A restore is already in progress.');
  if (liveRestore) restoreInProgress = true;
  const backupPaths = paths(userDataDir);
  try {
    const validated = validateBackupDirectory(path.join(backupPaths.backupRoot, id));
    const safetyBackup = createBackup('pre_restore', {
      userDataDir,
      saveCurrentDatabase: userDataDir ? false : true
    });
    const current = validateBackupDirectory(
      path.join(backupPaths.backupRoot, safetyBackup.id)
    );
    if (liveRestore) setDatabaseSavesSuspended(true);
    try {
      replaceFile(backupPaths.database, validated.database);
      if (validated.plaidSecrets) {
        replaceFile(backupPaths.plaidSecrets, validated.plaidSecrets);
      } else {
        fs.rmSync(backupPaths.plaidSecrets, { force: true });
      }
    } catch (error) {
      try {
        replaceFile(backupPaths.database, current.database);
        if (current.plaidSecrets) replaceFile(backupPaths.plaidSecrets, current.plaidSecrets);
        else fs.rmSync(backupPaths.plaidSecrets, { force: true });
      } catch (rollbackError) {
        console.error('Unable to roll back failed restore:', rollbackError);
        throw new Error(
          `Restore failed and automatic rollback also failed. Use safety backup ${safetyBackup.id} from the backup folder.`
        );
      } finally {
        if (liveRestore) setDatabaseSavesSuspended(false);
      }
      throw error;
    }
    return backupRecord(validated.manifest);
  } catch (error) {
    if (liveRestore) restoreInProgress = false;
    throw error;
  }
}

export async function openBackupFolder(): Promise<void> {
  const backupRoot = paths().backupRoot;
  fs.mkdirSync(backupRoot, { recursive: true });
  const error = await shell.openPath(backupRoot);
  if (error) throw new Error(error);
}
