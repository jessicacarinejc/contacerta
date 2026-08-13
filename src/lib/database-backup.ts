import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './platform';

export const SQLITE_BACKUP_MAX_BYTES = 100 * 1024 * 1024;
export const FINANCE_STATE_KEY = 'conta-certa-finance-state';
export const AUTH_STATE_KEY = 'conta-certa-auth';

export type DatabaseBackupInfo = {
  schemaVersion: number;
  stateEntries: number;
  hasFinanceState: boolean;
  hasAuthState: boolean;
  updatedAt: string;
  byteSize: number;
};

type DatabaseBackupPayload = {
  dataBase64: string;
  info: DatabaseBackupInfo;
};

type OpenFileResult = {
  dataBase64: string;
  byteSize: number;
  fileName?: string | null;
};

export type SelectedDatabaseBackup = {
  fileName: string;
  dataBase64: string;
  info: DatabaseBackupInfo;
};

export type LegacyStorePreview = {
  fileName: string;
  entries: Record<string, string>;
  hasFinanceState: boolean;
  hasAuthState: boolean;
};

function requireNativeApp() {
  if (!isTauri()) {
    throw new Error('Backup SQLite está disponível no aplicativo instalado.');
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function buildDatabaseBackupFileName(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('');
  return `Conta-Certa-Backup-${stamp}.sqlite3`;
}

export function formatBackupSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function saveDatabaseBackupToDrive() {
  requireNativeApp();
  const backup = await invoke<DatabaseBackupPayload>('database_backup');
  await invoke('plugin:file-access|save_file', {
    fileName: buildDatabaseBackupFileName(),
    dataBase64: backup.dataBase64,
    mimeType: 'application/vnd.sqlite3',
    title: 'Salvar backup do Conta Certa',
    allowedExtensions: ['sqlite3'],
    filterName: 'Backup SQLite do Conta Certa',
  });
  return backup.info;
}

export async function selectDatabaseBackupFromDrive(): Promise<SelectedDatabaseBackup | null> {
  requireNativeApp();
  const selected = await invoke<OpenFileResult | null>('plugin:file-access|open_file', {
    minBytes: 16,
    maxBytes: SQLITE_BACKUP_MAX_BYTES,
    allowedExtensions: ['sqlite3'],
    mimeType: 'application/vnd.sqlite3',
    filterName: 'Backup SQLite do Conta Certa',
  });
  if (!selected) return null;

  const info = await invoke<DatabaseBackupInfo>('database_inspect_backup', {
    dataBase64: selected.dataBase64,
  });
  return {
    fileName: selected.fileName || 'backup.sqlite3',
    dataBase64: selected.dataBase64,
    info,
  };
}

export async function restoreDatabaseBackup(dataBase64: string) {
  requireNativeApp();
  return invoke<DatabaseBackupInfo>('database_restore_backup', { dataBase64 });
}

function base64ToUtf8(dataBase64: string) {
  const binary = atob(dataBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function parseLegacyStoreText(text: string): Record<string, string> {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('O arquivo antigo não contém um armazenamento válido do Conta Certa.');
  }

  const source = parsed as Record<string, unknown>;
  const entries: Record<string, string> = {};
  for (const key of [FINANCE_STATE_KEY, AUTH_STATE_KEY]) {
    const value = source[key];
    if (typeof value === 'string') {
      JSON.parse(value);
      entries[key] = value;
    } else if (value && typeof value === 'object') {
      entries[key] = JSON.stringify(value);
    }
  }

  if (!entries[FINANCE_STATE_KEY] && !entries[AUTH_STATE_KEY]) {
    throw new Error('Nenhum dado financeiro ou perfil compatível foi encontrado no arquivo antigo.');
  }
  return entries;
}

export async function selectLegacyStoreFile(): Promise<LegacyStorePreview | null> {
  requireNativeApp();
  const selected = await invoke<OpenFileResult | null>('plugin:file-access|open_file', {
    minBytes: 2,
    maxBytes: SQLITE_BACKUP_MAX_BYTES,
    allowedExtensions: ['json'],
    mimeType: 'application/json',
    filterName: 'Base antiga do Conta Certa',
  });
  if (!selected) return null;

  const entries = parseLegacyStoreText(base64ToUtf8(selected.dataBase64));
  return {
    fileName: selected.fileName || 'conta-certa.store.json',
    entries,
    hasFinanceState: Boolean(entries[FINANCE_STATE_KEY]),
    hasAuthState: Boolean(entries[AUTH_STATE_KEY]),
  };
}

export async function importLegacyStore(entries: Record<string, string>) {
  requireNativeApp();
  for (const [key, value] of Object.entries(entries)) {
    if (key !== FINANCE_STATE_KEY && key !== AUTH_STATE_KEY) continue;
    await invoke('database_write_state', { key, value });
  }
}

export function clearBrowserStateMirrors() {
  try {
    localStorage.removeItem(FINANCE_STATE_KEY);
    localStorage.removeItem(AUTH_STATE_KEY);
  } catch {
    // O SQLite já foi restaurado; o espelho será reconstruído na próxima abertura.
  }
}
