import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { isRestoreInProgress } from './app-backups';

interface PlaidSecretData {
  clientId?: string;
  secret?: string;
  environment?: 'sandbox' | 'production';
  accessTokens?: Record<string, string>;
}

interface EncryptedSecretFile {
  version: 1;
  payload: string;
}

function secretPath(): string {
  return path.join(app.getPath('userData'), 'plaid-secrets.json');
}

function requireEncryption(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is not available on this device.');
  }
}

export function readPlaidSecrets(): PlaidSecretData {
  const filePath = secretPath();
  if (!fs.existsSync(filePath)) return {};

  requireEncryption();
  try {
    const file = JSON.parse(fs.readFileSync(filePath, 'utf8')) as EncryptedSecretFile;
    const decrypted = safeStorage.decryptString(Buffer.from(file.payload, 'base64'));
    return JSON.parse(decrypted) as PlaidSecretData;
  } catch {
    throw new Error('Plaid credentials could not be decrypted. Reconfigure Plaid in Settings.');
  }
}

export function writePlaidSecrets(data: PlaidSecretData): void {
  if (isRestoreInProgress()) throw new Error('Plaid credentials cannot change during a restore.');
  requireEncryption();
  const encrypted = safeStorage.encryptString(JSON.stringify(data));
  const file: EncryptedSecretFile = {
    version: 1,
    payload: encrypted.toString('base64')
  };
  fs.writeFileSync(secretPath(), JSON.stringify(file), { encoding: 'utf8', mode: 0o600 });
}

export function savePlaidCredentials(
  clientId: string,
  secret: string,
  environment: 'sandbox' | 'production'
): void {
  const current = readPlaidSecrets();
  writePlaidSecrets({ ...current, clientId, secret, environment });
}

export function savePlaidAccessToken(itemId: string, accessToken: string): void {
  const current = readPlaidSecrets();
  writePlaidSecrets({
    ...current,
    accessTokens: { ...current.accessTokens, [itemId]: accessToken }
  });
}

export function removePlaidAccessToken(itemId: string): void {
  const current = readPlaidSecrets();
  const accessTokens = { ...current.accessTokens };
  delete accessTokens[itemId];
  writePlaidSecrets({ ...current, accessTokens });
}

export function clearPlaidSecrets(): void {
  if (isRestoreInProgress()) throw new Error('Plaid credentials cannot change during a restore.');
  const filePath = secretPath();
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
