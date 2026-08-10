import type { Transaction } from '../types/finance';

export function normalizeThirdPartyName(value?: string) {
  return (value || '').trim().replace(/\s+/g, ' ');
}

export function thirdPartyKey(value?: string) {
  return normalizeThirdPartyName(value).toLocaleLowerCase('pt-BR');
}

export function collectThirdParties(transactions: Transaction[]) {
  const names = new Map<string, string>();

  for (const item of transactions) {
    if (item.type !== 'expense' || item.status === 'cancelled') continue;
    const name = normalizeThirdPartyName(item.thirdParty);
    if (!name) continue;
    const key = thirdPartyKey(name);
    if (!names.has(key)) names.set(key, name);
  }

  return Array.from(names.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function filterThirdPartyTransactions(
  transactions: Transaction[],
  selectedThirdParty?: string,
) {
  const selectedKey = thirdPartyKey(selectedThirdParty);

  return transactions
    .filter((item) => {
      if (item.type !== 'expense' || item.status === 'cancelled') return false;
      const key = thirdPartyKey(item.thirdParty);
      if (!key) return false;
      return !selectedKey || key === selectedKey;
    })
    .sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date));
}

export function thirdPartyStatusLabel(transaction: Transaction) {
  if (transaction.futureInstallment) return 'Futuro';
  if (transaction.status === 'paid') return 'Pago';
  if (transaction.status === 'overdue') return 'Vencido';
  if (transaction.status === 'pending') return 'Pendente';
  return 'Cancelado';
}
