import { describe, expect, it } from 'vitest';
import { parseInstallment } from './installment-parser';

describe('parseInstallment', () => {
  it.each([
    ['PARC 01/05', { current: 1, total: 5 }],
    ['PARC. 02 / 05', { current: 2, total: 5 }],
    ['PARCELA 3 DE 4', { current: 3, total: 4 }],
    ['Parcela: 4/12', { current: 4, total: 12 }],
  ])('lê %s', (value, expected) => {
    expect(parseInstallment(value)).toEqual(expected);
  });

  it('não confunde uma data com parcela', () => {
    expect(parseInstallment('30/06/2026')).toBeUndefined();
    expect(parseInstallment('30/06 L.R. MODA LTD')).toBeUndefined();
  });

  it('rejeita parcela impossível', () => {
    expect(parseInstallment('PARC 06/05')).toBeUndefined();
    expect(parseInstallment('PARCELA 0/4')).toBeUndefined();
  });
});
