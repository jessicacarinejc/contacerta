import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types/finance';
import { collectThirdParties, filterThirdPartyTransactions } from './third-party-report';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id || crypto.randomUUID(),
    description: partial.description || 'Compra',
    type: partial.type || 'expense',
    amount: partial.amount || 10,
    date: partial.date || '2026-08-09',
    accountId: partial.accountId || 'acc-1',
    categoryId: partial.categoryId || 'cat_other',
    status: partial.status || 'paid',
    createdAt: partial.createdAt || '2026-08-09T12:00:00.000Z',
    ...partial,
  };
}

describe('relatório de terceiros', () => {
  const transactions = [
    tx({ id: '1', thirdParty: ' Maria ', amount: 100 }),
    tx({ id: '2', thirdParty: 'maria', amount: 50, futureInstallment: true, status: 'pending' }),
    tx({ id: '3', thirdParty: 'João', amount: 80 }),
    tx({ id: '4', thirdParty: 'Maria', amount: 30, status: 'cancelled' }),
    tx({ id: '5', type: 'income', thirdParty: 'Maria', amount: 500 }),
  ];

  it('normaliza nomes no filtro', () => {
    const rows = filterThirdPartyTransactions(transactions, 'MARIA');
    expect(rows.map((item) => item.id)).toEqual(['1', '2']);
    expect(rows.reduce((sum, item) => sum + item.amount, 0)).toBe(150);
  });

  it('não duplica terceiro por caixa ou espaços', () => {
    expect(collectThirdParties(transactions)).toEqual(['João', 'Maria']);
  });
});
