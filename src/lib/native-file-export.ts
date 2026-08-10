import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './platform';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

export async function exportPdfNative(
  buffer: ArrayBuffer,
  fileName: string,
  title: string,
): Promise<boolean> {
  if (!isTauri()) return false;

  await invoke('plugin:file-access|save_file', {
    fileName,
    dataBase64: arrayBufferToBase64(buffer),
    mimeType: 'application/pdf',
    title,
    allowedExtensions: ['pdf'],
    filterName: 'Arquivo PDF',
  });

  return true;
}
