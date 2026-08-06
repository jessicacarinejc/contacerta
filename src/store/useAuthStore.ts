import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createPasswordHash, normalizeEmail, verifyPassword } from '../lib/password';
import { platformStorage } from '../lib/platform-storage';
import type {
  AuthResult,
  CredentialRecord,
  RegistrationInput,
  UserProfile,
} from '../types/auth';

interface AuthState {
  profile?: UserProfile;
  credential?: CredentialRecord;
  isAuthenticated: boolean;
  rememberSession: boolean;
  hasHydrated: boolean;
  authError?: string;
  setHydrated: (value: boolean) => void;
  register: (input: RegistrationInput) => Promise<AuthResult>;
  login: (email: string, password: string, rememberSession: boolean) => Promise<AuthResult>;
  logout: () => void;
  clearError: () => void;
  updateProfile: (input: Pick<UserProfile, 'name' | 'email'>) => AuthResult;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
}

type PersistedAuthState = Pick<
  AuthState,
  'profile' | 'credential' | 'isAuthenticated' | 'rememberSession'
>;

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/i.test(password)) return 'A senha deve conter letras.';
  if (!/\d/.test(password)) return 'A senha deve conter pelo menos um número.';
  return undefined;
}

export const useAuthStore = create<AuthState>()(
  persist<AuthState, [], [], PersistedAuthState>(
    (set, get) => ({
      profile: undefined,
      credential: undefined,
      isAuthenticated: false,
      rememberSession: false,
      hasHydrated: false,
      authError: undefined,

      setHydrated(value) {
        set({ hasHydrated: value });
      },

      async register(input) {
        const name = input.name.trim();
        const email = normalizeEmail(input.email);
        const passwordError = validatePassword(input.password);

        if (name.length < 2) return { ok: false, error: 'Informe seu nome completo.' };
        if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Informe um e-mail válido.' };
        if (passwordError) return { ok: false, error: passwordError };

        const password = await createPasswordHash(input.password);
        const now = new Date().toISOString();
        const profile: UserProfile = {
          id: crypto.randomUUID(),
          name,
          email,
          role: 'owner',
          createdAt: now,
          lastLoginAt: now,
        };
        const credential: CredentialRecord = {
          email,
          passwordHash: password.hash,
          salt: password.salt,
          iterations: password.iterations,
        };

        set({
          profile,
          credential,
          isAuthenticated: true,
          rememberSession: input.rememberSession,
          authError: undefined,
        });

        return { ok: true };
      },

      async login(emailInput, password, rememberSession) {
        const credential = get().credential;
        const profile = get().profile;
        const email = normalizeEmail(emailInput);

        if (!credential || !profile) {
          return { ok: false, error: 'Nenhum perfil foi cadastrado neste dispositivo.' };
        }

        const validEmail = credential.email === email;
        const validPassword = validEmail
          ? await verifyPassword(
              password,
              credential.passwordHash,
              credential.salt,
              credential.iterations,
            )
          : false;

        if (!validEmail || !validPassword) {
          const error = 'E-mail ou senha incorretos.';
          set({ authError: error });
          return { ok: false, error };
        }

        set({
          profile: { ...profile, lastLoginAt: new Date().toISOString() },
          isAuthenticated: true,
          rememberSession,
          authError: undefined,
        });
        return { ok: true };
      },

      logout() {
        set({ isAuthenticated: false, rememberSession: false, authError: undefined });
      },

      clearError() {
        set({ authError: undefined });
      },

      updateProfile(input) {
        const current = get().profile;
        const credential = get().credential;
        if (!current || !credential) return { ok: false, error: 'Perfil não encontrado.' };

        const name = input.name.trim();
        const email = normalizeEmail(input.email);
        if (name.length < 2) return { ok: false, error: 'Informe seu nome completo.' };
        if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Informe um e-mail válido.' };

        set({
          profile: { ...current, name, email },
          credential: { ...credential, email },
          authError: undefined,
        });
        return { ok: true };
      },

      async changePassword(currentPassword, newPassword) {
        const credential = get().credential;
        if (!credential) return { ok: false, error: 'Credencial não encontrada.' };

        const validCurrent = await verifyPassword(
          currentPassword,
          credential.passwordHash,
          credential.salt,
          credential.iterations,
        );
        if (!validCurrent) return { ok: false, error: 'A senha atual está incorreta.' };

        const passwordError = validatePassword(newPassword);
        if (passwordError) return { ok: false, error: passwordError };

        const password = await createPasswordHash(newPassword);
        set({
          credential: {
            ...credential,
            passwordHash: password.hash,
            salt: password.salt,
            iterations: password.iterations,
          },
          authError: undefined,
        });
        return { ok: true };
      },
    }),
    {
      name: 'conta-certa-auth-state',
      storage: createJSONStorage(() => platformStorage),
      version: 1,
      partialize: (state) => ({
        profile: state.profile,
        credential: state.credential,
        isAuthenticated: state.rememberSession ? state.isAuthenticated : false,
        rememberSession: state.rememberSession,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
