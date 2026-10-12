import { format, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Transaction } from '../types/finance';
import { monthTransactions, totals } from './finance';

export interface MonthlyFinanceSummary {
  month: string;
  income: number;
  expense: number;
  result: number;
}

/** Série financeira calculada exclusivamente a partir dos lançamentos do usuário. */
export function buildMonthlyFinanceHistory(
  transactions: Transaction[],
  referenceDate = new Date(),
  months = 6,
): MonthlyFinanceSummary[] {
  const monthCount = Math.max(1, Math.min(24, Math.trunc(months) || 6));
  const validTransactions = transactions.filter((transaction) => !transaction.futureInstallment);

  return Array.from({ length: monthCount }, (_, index) => {
    const date = startOfMonth(subMonths(referenceDate, monthCount - index - 1));
    const summary = totals(monthTransactions(validTransactions, date));
    const label = format(date, 'MMM/yy', { locale: ptBR }).replace('.', '');
    return {
      month: label.charAt(0).toUpperCase() + label.slice(1),
      ...summary,
    };
  });
}
