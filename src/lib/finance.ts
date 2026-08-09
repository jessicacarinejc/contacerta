import { endOfMonth, format, isAfter, isBefore, parseISO, startOfMonth } from 'date-fns';
import type { Account, Budget, Category, Goal, Transaction } from '../types/finance';

export function monthTransactions(transactions: Transaction[], date = new Date()) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return transactions.filter((item) => {
    const current = parseISO(item.date);
    return !isBefore(current, start) && !isAfter(current, end) && item.status !== 'cancelled';
  });
}

export function totals(transactions: Transaction[]) {
  return transactions.reduce(
    (accumulator, item) => {
      if (item.status === 'cancelled' || item.type === 'transfer') return accumulator;
      if (item.type === 'income') accumulator.income += item.amount;
      if (item.type === 'expense') accumulator.expense += item.amount;
      accumulator.result = accumulator.income - accumulator.expense;
      return accumulator;
    },
    { income: 0, expense: 0, result: 0 },
  );
}

export const totalBalance = (accounts: Account[]) =>
  accounts.filter((item) => item.active).reduce((sum, item) => sum + item.balance, 0);

export function categoryTotals(transactions: Transaction[], categories: Category[]) {
  const expenses = transactions.filter(
    (item) => item.type === 'expense' && item.status !== 'cancelled',
  );
  return categories
    .map((category) => ({
      name: category.name,
      color: category.color,
      value: expenses
        .filter((item) => item.categoryId === category.id)
        .reduce((sum, item) => sum + item.amount, 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function upcomingBills(transactions: Transaction[], limit = 8) {
  const today = new Date();
  return transactions
    .filter((item) => item.type === 'expense' && item.status === 'pending' && item.dueDate)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    .filter(
      (item) =>
        !item.dueDate ||
        isAfter(parseISO(item.dueDate), today) ||
        format(parseISO(item.dueDate), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'),
    )
    .slice(0, limit);
}

export const spentByCategory = (
  transactions: Transaction[],
  categoryId: string,
  month: string,
) =>
  transactions
    .filter(
      (item) =>
        item.type === 'expense' &&
        item.categoryId === categoryId &&
        item.date.startsWith(month) &&
        item.status !== 'cancelled',
    )
    .reduce((sum, item) => sum + item.amount, 0);

export function budgetProgress(budget: Budget, transactions: Transaction[]) {
  const spent = spentByCategory(transactions, budget.categoryId, budget.month);
  return {
    spent,
    percentage: budget.limit > 0 ? Math.min((spent / budget.limit) * 100, 999) : 0,
  };
}

export const goalProgress = (goal: Goal) =>
  goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;

export function forecastBalance(accounts: Account[], transactions: Transaction[], days = 30) {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + days);
  return transactions
    .filter(
      (item) =>
        item.status === 'pending' &&
        item.dueDate &&
        !isBefore(parseISO(item.dueDate), now) &&
        !isAfter(parseISO(item.dueDate), horizon),
    )
    .reduce(
      (balance, item) =>
        item.type === 'income'
          ? balance + item.amount
          : item.type === 'expense'
            ? balance - item.amount
            : balance,
      totalBalance(accounts),
    );
}

export function generateInsights(
  transactions: Transaction[],
  accounts: Account[],
  budgets: Budget[],
  goals: Goal[],
) {
  const current = monthTransactions(transactions);
  const currentTotals = totals(current);
  const forecast = forecastBalance(accounts, transactions);
  const output: Array<{
    level: 'positive' | 'warning' | 'critical';
    title: string;
    text: string;
  }> = [];

  if (current.length === 0) {
    output.push({
      level: 'warning',
      title: 'Ainda faltam dados deste mês',
      text: 'Cadastre ou importe movimentações para o Conta Certa gerar análises realmente personalizadas.',
    });
  } else if (currentTotals.income > 0 && currentTotals.result >= 0) {
    const rate = (currentTotals.result / currentTotals.income) * 100;
    output.push({
      level: rate >= 20 ? 'positive' : 'warning',
      title: `Taxa de poupança de ${Math.round(rate)}%`,
      text:
        rate >= 20
          ? 'O resultado mensal está saudável. Direcione o excedente para metas e reserva.'
          : 'O mês está positivo, mas há pouco espaço entre receitas e despesas. Monitore gastos variáveis.',
    });
  } else if (currentTotals.expense > currentTotals.income) {
    output.push({
      level: 'critical',
      title: 'Despesas acima das receitas',
      text: `O déficit mensal é de ${Math.abs(currentTotals.result).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Revise despesas variáveis e vencimentos.`,
    });
  }

  if (forecast < 0) {
    output.push({
      level: 'critical',
      title: 'Saldo negativo projetado',
      text: 'Os compromissos dos próximos 30 dias superam o saldo disponível registrado.',
    });
  } else if (transactions.some((item) => item.status === 'pending' && item.dueDate)) {
    output.push({
      level: 'positive',
      title: 'Caixa projetado permanece positivo',
      text: `Após os compromissos previstos dos próximos 30 dias, o saldo projetado é ${forecast.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    });
  }

  const exceeded = budgets.filter((budget) => budgetProgress(budget, transactions).percentage >= 100);
  if (exceeded.length) {
    output.push({
      level: 'warning',
      title: 'Orçamento ultrapassado',
      text: `${exceeded.length} categoria(s) já ultrapassaram o limite mensal configurado.`,
    });
  } else {
    const near = budgets
      .map((budget) => ({ budget, progress: budgetProgress(budget, transactions) }))
      .filter(({ progress }) => progress.percentage >= 80)
      .sort((a, b) => b.progress.percentage - a.progress.percentage)[0];
    if (near) {
      output.push({
        level: 'warning',
        title: 'Orçamento próximo do limite',
        text: `Uma categoria já utilizou ${Math.round(near.progress.percentage)}% do limite mensal.`,
      });
    }
  }

  const installmentCount = transactions.filter(
    (item) => item.type === 'expense' && item.status !== 'cancelled' && item.installment,
  ).length;
  if (installmentCount >= 3) {
    output.push({
      level: 'warning',
      title: `${installmentCount} compras parceladas registradas`,
      text: 'Considere o impacto das parcelas futuras antes de assumir novos compromissos no cartão.',
    });
  }

  const closest = [...goals].sort((a, b) => goalProgress(b) - goalProgress(a))[0];
  if (closest) {
    const progress = goalProgress(closest);
    output.push({
      level: progress >= 100 ? 'positive' : 'positive',
      title: progress >= 100 ? `Meta “${closest.name}” atingida` : `${Math.round(progress)}% da meta concluída`,
      text:
        progress >= 100
          ? 'Objetivo concluído. Você pode definir uma nova meta para o próximo ciclo.'
          : `Continue reservando recursos para “${closest.name}”.`,
    });
  }

  return output.slice(0, 6);
}
