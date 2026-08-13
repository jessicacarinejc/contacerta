import { describe, expect, it } from 'vitest';
import {
  AUTH_STATE_KEY,
  buildDatabaseBackupFileName,
  FINANCE_STATE_KEY,
  formatBackupSize,
  parseLegacyStoreText,
} from './database-backup';

describe('database backup helpers', () => {
  it('gera nome estável para a cópia SQLite', () => {
    const date = new Date(2026, 7, 13, 8, 48);
    expect(buildDatabaseBackupFileName(date)).toBe('Conta-Certa-Backup-20260813-0848.sqlite3');
  });

  it('formata o tamanho do backup sem esconder arquivos pequenos', () => {
    expect(formatBackupSize(512)).toBe('1 KB');
    expect(formatBackupSize(2048)).toBe('2 KB');
    expect(formatBackupSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('reconhece os estados financeiro e de acesso no store legado', () => {
    const finance = JSON.stringify({ state: { transactions: [{ id: 'tx-1' }] }, version: 1 });
    const auth = JSON.stringify({ state: { user: { id: 'user-1' } }, version: 0 });
    const entries = parseLegacyStoreText(
      JSON.stringify({
        [FINANCE_STATE_KEY]: finance,
        [AUTH_STATE_KEY]: auth,
        unrelated: 'ignorar',
      }),
    );

    expect(entries).toEqual({
      [FINANCE_STATE_KEY]: finance,
      [AUTH_STATE_KEY]: auth,
    });
  });

  it('aceita valores JSON já materializados pelo arquivo antigo', () => {
    const entries = parseLegacyStoreText(
      JSON.stringify({
        [FINANCE_STATE_KEY]: { state: { accounts: [] }, version: 1 },
      }),
    );
    expect(JSON.parse(entries[FINANCE_STATE_KEY])).toMatchObject({ version: 1 });
  });

  it('rejeita arquivo que não pertence ao armazenamento do Conta Certa', () => {
    expect(() => parseLegacyStoreText(JSON.stringify({ other: true }))).toThrow(
      'Nenhum dado financeiro ou perfil compatível',
    );
  });
});
