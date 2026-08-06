export type UserRole = 'owner';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt?: string;
}

export interface CredentialRecord {
  email: string;
  passwordHash: string;
  salt: string;
  iterations: number;
}

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  rememberSession: boolean;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}
