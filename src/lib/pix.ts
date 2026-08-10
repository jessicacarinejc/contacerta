const PIX_GUI = 'BR.GOV.BCB.PIX';

function emv(id: string, value: string) {
  const length = new TextEncoder().encode(value).length;
  return `${id}${String(length).padStart(2, '0')}${value}`;
}

function normalizeMerchantText(value: string, maxLength: number, fallback: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
  return normalized || fallback;
}

function crc16Ccitt(payload: string) {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function parseFields(payload: string) {
  const fields = new Map<string, string>();
  let offset = 0;
  while (offset + 4 <= payload.length) {
    const id = payload.slice(offset, offset + 2);
    const length = Number(payload.slice(offset + 2, offset + 4));
    if (!Number.isFinite(length) || length < 0) break;
    const start = offset + 4;
    const end = start + length;
    if (end > payload.length) break;
    fields.set(id, payload.slice(start, end));
    offset = end;
  }
  return fields;
}

export interface PixPayloadOptions {
  key: string;
  merchantName: string;
  merchantCity?: string;
  amount?: number;
  description?: string;
  transactionId?: string;
}

export interface ParsedPixPayload {
  key: string;
  merchantName?: string;
  merchantCity?: string;
  amount?: number;
  transactionId?: string;
}

export function sanitizePixKey(key: string, keyType?: string) {
  const value = key.trim();
  if (keyType === 'cpf' || keyType === 'cnpj' || keyType === 'phone') {
    return value.replace(/\D/g, '');
  }
  return value;
}

export function detectPixKeyType(key: string) {
  const trimmed = key.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && !trimmed.includes('@')) return 'cpf' as const;
  if (digits.length === 14 && !trimmed.includes('@')) return 'cnpj' as const;
  if (trimmed.includes('@')) return 'email' as const;
  if (/^\+?\d{10,15}$/.test(trimmed.replace(/[\s()-]/g, ''))) return 'phone' as const;
  return 'random' as const;
}

export function parsePixPayload(payload: string): ParsedPixPayload | undefined {
  const cleaned = payload.replace(/[\r\n\t]+/g, '').trim();
  if (!cleaned.startsWith('000201')) return undefined;

  const fields = parseFields(cleaned);
  const merchantAccount = fields.get('26');
  if (!merchantAccount) return undefined;
  const accountFields = parseFields(merchantAccount);
  if (accountFields.get('00')?.toLowerCase() !== 'br.gov.bcb.pix') return undefined;
  const key = accountFields.get('01');
  if (!key) return undefined;

  const amountText = fields.get('54');
  const additional = fields.get('62');
  const transactionId = additional ? parseFields(additional).get('05') : undefined;

  return {
    key,
    merchantName: fields.get('59'),
    merchantCity: fields.get('60'),
    amount: amountText ? Number(amountText) : undefined,
    transactionId,
  };
}

export function buildPixPayload(options: PixPayloadOptions) {
  const key = options.key.trim();
  if (!key) return '';

  const merchantAccount = [
    emv('00', PIX_GUI),
    emv('01', key),
    options.description?.trim() ? emv('02', options.description.trim().slice(0, 72)) : '',
  ].join('');

  const merchantName = normalizeMerchantText(options.merchantName, 25, 'CONTA CERTA');
  const merchantCity = normalizeMerchantText(options.merchantCity || 'SALVADOR', 15, 'SALVADOR');
  const transactionId = (options.transactionId || '***').replace(/[^A-Za-z0-9*]/g, '').slice(0, 25) || '***';

  const payloadWithoutCrc = [
    emv('00', '01'),
    emv('26', merchantAccount),
    emv('52', '0000'),
    emv('53', '986'),
    options.amount && options.amount > 0 ? emv('54', options.amount.toFixed(2)) : '',
    emv('58', 'BR'),
    emv('59', merchantName),
    emv('60', merchantCity),
    emv('62', emv('05', transactionId)),
    '6304',
  ].join('');

  return `${payloadWithoutCrc}${crc16Ccitt(payloadWithoutCrc)}`;
}
