import type { StateStorage } from 'zustand/middleware';
import { isTauri } from './platform';

let nativeStorePromise: Promise<import('@tauri-apps/plugin-store').LazyStore> | undefined;

async function nativeStore() {
  nativeStorePromise ??= import('@tauri-apps/plugin-store').then(
    ({ LazyStore }) => new LazyStore('conta-certa.store.json', { autoSave: 250 }),
  );
  return nativeStorePromise;
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
  } catch {
    // O armazenamento nativo continua disponível como segunda fonte.
  }
}

function localRemove(name: string) {
  try {
    localStorage.removeItem(name);
  } catch {
    // Ignora falhas do WebView; o armazenamento nativo será limpo logo abaixo.
  }
}

export const platformStorage: StateStorage = {
  async getItem(name) {
    if (!isTauri()) return localGet(name);

    // O espelho do WebView é consultado primeiro. Isso evita que um estado nativo
    // antigo reapareça depois de uma restauração quando o plugin-store falhou em
    // gravar/excluir durante uma instalação anterior.
    const localValue = localGet(name);
    if (localValue !== null) return localValue;

    try {
      const value = await (await nativeStore()).get<string>(name);
      if (value != null) localSet(name, value);
      return value ?? null;
    } catch (error) {
      console.warn('Conta Certa: armazenamento nativo indisponível; usando fallback local.', error);
      return null;
    }
  },

  async setItem(name, value) {
    // Mantém um espelho local no Android para que um erro pontual do plugin-store
    // não impeça a edição/restauração dos dados financeiros.
    localSet(name, value);
    if (!isTauri()) return;

    try {
      const store = await nativeStore();
      await store.set(name, value);
      await store.save();
    } catch (error) {
      console.warn('Conta Certa: não foi possível gravar no armazenamento nativo.', error);
    }
  },

  async removeItem(name) {
    localRemove(name);
    if (!isTauri()) return;

    try {
      const store = await nativeStore();
      await store.delete(name);
      await store.save();
    } catch (error) {
      console.warn('Conta Certa: não foi possível limpar o armazenamento nativo.', error);
    }
  },
};
