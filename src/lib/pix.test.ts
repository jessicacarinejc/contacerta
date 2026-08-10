import { describe, expect, it } from 'vitest';
import { buildPixPayload, parsePixPayload } from './pix';

describe('PIX', () => {
  it('gera e reimporta um PIX Copia e Cola estático', () => {
    const payload = buildPixPayload({
      key: '12345678901',
      merchantName: 'Pessoa Teste',
      merchantCity: 'Salvador',
      amount: 125.5,
      transactionId: 'TESTE123',
    });

    expect(payload.startsWith('000201')).toBe(true);
    const parsed = parsePixPayload(payload);
    expect(parsed?.key).toBe('12345678901');
    expect(parsed?.merchantName).toBe('PESSOA TESTE');
    expect(parsed?.merchantCity).toBe('SALVADOR');
    expect(parsed?.amount).toBe(125.5);
    expect(parsed?.transactionId).toBe('TESTE123');
  });
});
