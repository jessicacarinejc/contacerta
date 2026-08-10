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
    return true;
  } catch {
    // Se o WebView ficar sem espaço, não podemos manter um espelho antigo: na
    // próxima inicialização ele teria prioridade sobre o valor novo gravado no
    // plugin-store. Remover a cópia obsoleta força a leitura da fonte nativa.
    try {
      localStorage.removeItem(name);
    } catch {
      // O armazenamento nativo continua sendo a fonte persistente no Tauri.
    }
    return false;
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

    // O espelho do WebView é consultado primeiro quando está íntegro. Se uma
    // gravação local falhar, localSet remove a cópia obsoleta e esta leitura cai
    // automaticamente para o armazenamento nativo.
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
