import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
};

type StoredCredential = {
  salt: string;
  hash: string;
};

type AuthState = {
  user: UserProfile | null;
  credential: StoredCredential | null;
  isAuthenticated: boolean;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<Pick<UserProfile, 'name' | 'email' | 'avatar'>>) => void;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<boolean>;
};

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

async function derivePasswordHash(password: string, salt: ArrayBuffer): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 210_000,
      hash: 'SHA-256',
    },
    material,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function createCredential(password: string): Promise<StoredCredential> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: bytesToBase64(salt),
    hash: await derivePasswordHash(password, toArrayBuffer(salt)),
  };
}

async function verifyCredential(password: string, credential: StoredCredential): Promise<boolean> {
  const salt = toArrayBuffer(base64ToBytes(credential.salt));
  const candidate = await derivePasswordHash(password, salt);
  if (candidate.length !== credential.hash.length) return false;

  let difference = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    difference |= candidate.charCodeAt(index) ^ credential.hash.charCodeAt(index);
  }
  return difference === 0;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      credential: null,
      isAuthenticated: false,

      async register({ name, email, password }) {
        const credential = await createCredential(password);
        set({
          user: {
            id: crypto.randomUUID(),
            name: name.trim(),
            email: email.trim().toLowerCase(),
            createdAt: new Date().toISOString(),
          },
          credential,
          isAuthenticated: true,
        });
      },

      async login(email, password) {
        const { user, credential } = get();
        if (!user || !credential || user.email !== email.trim().toLowerCase()) return false;

        const valid = await verifyCredential(password, credential);
        if (valid) set({ isAuthenticated: true });
        return valid;
      },

      logout() {
        set({ isAuthenticated: false });
      },

      updateProfile(data) {
        set((state) => ({ user: state.user ? { ...state.user, ...data } : null }));
      },

      async changePassword(currentPassword, nextPassword) {
        const { credential } = get();
        if (!credential || !(await verifyCredential(currentPassword, credential))) return false;
        set({ credential: await createCredential(nextPassword) });
        return true;
      },
    }),
    {
      name: 'conta-certa-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        credential: state.credential,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<AuthState>),
        isAuthenticated: false,
      }),
    },
  ),
);
