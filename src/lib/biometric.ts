import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './platform';

export enum BiometryType {
  None = 0,
  TouchID = 1,
  FaceID = 2,
  Iris = 3,
}

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: BiometryType;
  error?: string;
  errorCode?: string;
}

export async function checkBiometricStatus(): Promise<BiometricStatus> {
  if (!isTauri()) {
    return { isAvailable: false, biometryType: BiometryType.None };
  }

  try {
    return await invoke<BiometricStatus>('plugin:biometric|status');
  } catch (error) {
    return {
      isAvailable: false,
      biometryType: BiometryType.None,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function authenticateWithBiometrics() {
  if (!isTauri()) throw new Error('Biometria disponível apenas no aplicativo instalado.');

  await invoke('plugin:biometric|authenticate', {
    reason: 'Desbloquear o Conta Certa',
    allowDeviceCredential: false,
    cancelTitle: 'Usar senha',
    fallbackTitle: 'Usar senha',
    title: 'Conta Certa',
    subtitle: 'Confirme sua biometria para entrar',
    confirmationRequired: false,
  });
}

export function biometricButtonLabel(type: BiometryType) {
  if (type === BiometryType.FaceID) return 'Desbloquear com reconhecimento facial';
  if (type === BiometryType.TouchID) return 'Desbloquear com impressão digital';
  if (type === BiometryType.Iris) return 'Desbloquear com reconhecimento de íris';
  return 'Desbloquear com biometria';
}
