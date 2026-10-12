import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types/finance';
import { buildMonthlyFinanceHistory } from './dashboard-history';

const base = {
  accountId: 'conta-a',
  categoryId: 'categoria-a',
  status: 'paid' as const,
  createdAt: '2026-07-01',
};

function transaction(
  id: string,
  type: Transaction['type'],
  amount: number,
  date: string,
  extra: Partial<Transaction> = {},
): Transaction {
  return { ...base, id, description: id, type, amount, date, ...extra };
}

describe('buildMonthlyFinanceHistory', () => {
  it('calcula a série cronológica utilizando somente transações cadastradas', () => {
    const rows: Transaction[] = [
      transaction('salario', 'income', 2500, '2026-07-01'),
      transaction('aluguel', 'expense', 900, '2026-07-10'),
      transaction('compra', 'expense', 300, '2026-08-05'),
      transaction('transferencia', 'transfer', 1000, '2026-08-06'),
      transaction('cancelada', 'expense', 150, '2026-08-07', { status: 'cancelled' }),
      transaction('projecao', 'expense', 99, '2026-09-10', { futureInstallment: true }),
    ];

    expect(buildMonthlyFinanceHistory(rows, new Date(2026, 8, 15), 3)).toEqual([
      { month: 'Jul/26', income: 2500, expense: 900, result: 1600 },
      { month: 'Ago/26', income: 0, expense: 300, result: -300 },
      { month: 'Set/26', income: 0, expense: 0, result: 0 },
    ]);
  });

  it('não inventa valores quando o período não possui lançamentos', () => {
    const history = buildMonthlyFinanceHistory([], new Date(2026, 8, 15), 2);
    expect(history).toHaveLength(2);
    expect(history.every((month) => month.income === 0 && month.expense === 0)).toBe(true);
  });

  it('limita a quantidade de meses para evitar séries excessivas', () => {
    expect(buildMonthlyFinanceHistory([], new Date(2026, 8, 15), 50)).toHaveLength(24);
  });
});
