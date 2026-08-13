import { invoke } from '@tauri-apps/api/core';
import type { StateStorage } from 'zustand/middleware';
import { isTauri } from './platform';

let nativeStorePromise: Promise<import('@tauri-apps/plugin-store').LazyStore> | undefined;

async function nativeStore() {
  nativeStorePromise ??= import('@tauri-apps/plugin-store').then(
    ({ LazyStore }) => new LazyStore('conta-certa.store.json', { autoSave: 250 }),
  );
  return nativeStorePromise;
}

async function sqliteGet(name: string) {
  return invoke<string | null>('database_read_state', { key: name });
}

async function sqliteSet(name: string, value: string) {
  await invoke('database_write_state', { key: name, value });
}

async function sqliteRemove(name: string) {
  await invoke('database_delete_state', { key: name });
}

function localGet(name: string) {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function localSet(name: string, value: string) {
  try {
    localStorage.setItem(name, value);
    return true;
  } catch {
    try {
      localStorage.removeItem(name);
    } catch {
      // A base SQLite continua sendo a fonte principal no aplicativo nativo.
    }
    return false;
  }
}

function localRemove(name: string) {
  try {
    localStorage.removeItem(name);
  } catch {
    // Ignora falhas do espelho do WebView.
  }
}

async function migrateLegacyValue(name: string, value: string) {
  try {
    await sqliteSet(name, value);
  } catch (error) {
    console.warn('Conta Certa: não foi possível migrar o estado antigo para SQLite.', error);
  }
}

export const platformStorage: StateStorage = {
  async getItem(name) {
    if (!isTauri()) return localGet(name);

    // SQLite é a fonte canônica. Na primeira abertura desta versão, se ainda não
    // houver registro no banco, o valor antigo do localStorage/plugin-store é
    // migrado automaticamente e sem apagar a origem.
    try {
      const sqliteValue = await sqliteGet(name);
      if (sqliteValue !== null) {
        localSet(name, sqliteValue);
        return sqliteValue;
      }
    } catch (error) {
      console.warn('Conta Certa: SQLite indisponível; tentando armazenamento legado.', error);
    }

    const localValue = localGet(name);
    if (localValue !== null) {
      await migrateLegacyValue(name, localValue);
      return localValue;
    }

    try {
      const value = await (await nativeStore()).get<string>(name);
      if (value != null) {
        localSet(name, value);
        await migrateLegacyValue(name, value);
      }
      return value ?? null;
    } catch (error) {
      console.warn('Conta Certa: armazenamento legado indisponível.', error);
      return null;
    }
  },

  async setItem(name, value) {
    localSet(name, value);
    if (!isTauri()) return;

    let sqliteSaved = false;
    try {
      await sqliteSet(name, value);
      sqliteSaved = true;
    } catch (error) {
      console.warn('Conta Certa: não foi possível gravar na base SQLite.', error);
    }

    // Mantém o plugin-store como espelho de compatibilidade durante a migração.
    try {
      const store = await nativeStore();
      await store.set(name, value);
      await store.save();
    } catch (error) {
      if (!sqliteSaved) {
        console.error('Conta Certa: falha nas duas fontes nativas de persistência.', error);
      } else {
        console.warn('Conta Certa: espelho legado não pôde ser atualizado.', error);
      }
    }
  },

  async removeItem(name) {
    localRemove(name);
    if (!isTauri()) return;

    try {
      await sqliteRemove(name);
    } catch (error) {
      console.warn('Conta Certa: não foi possível remover o registro da base SQLite.', error);
    }

    try {
      const store = await nativeStore();
      await store.delete(name);
      await store.save();
    } catch (error) {
      console.warn('Conta Certa: não foi possível limpar o espelho legado.', error);
    }
  },
};
