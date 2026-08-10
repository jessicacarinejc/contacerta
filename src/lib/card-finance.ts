import { normalizeInvoiceDescription } from './invoice-refinement';
import type { CreditCard, DocumentRecord, Transaction } from '../types/finance';

export interface CardInvoiceSummary {
  month: string;
  amount: number;
  pending: number;
  paid: number;
  future: number;
  transactions: Transaction[];
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function inferredInvoiceMonth(transaction: Transaction, card: CreditCard) {
  if (transaction.dueDate) return transaction.dueDate.slice(0, 7);

  const date = new Date(`${transaction.date}T12:00:00`);
  let closingMonth = date.getMonth();
  let closingYear = date.getFullYear();
  if (date.getDate() > card.closingDay) closingMonth += 1;

  const closingDate = new Date(closingYear, closingMonth, Math.min(card.closingDay, 28), 12);
  closingMonth = closingDate.getMonth();
  closingYear = closingDate.getFullYear();

  const dueMonthOffset = card.dueDay <= card.closingDay ? 1 : 0;
  return monthKey(new Date(closingYear, closingMonth + dueMonthOffset, 1, 12));
}

function sameInstallment(
  item: { installment?: { current: number; total: number } },
  transaction: Transaction,
) {
  if (!item.installment && !transaction.installment) return true;
  return (
    item.installment?.current === transaction.installment?.current &&
    item.installment?.total === transaction.installment?.total
  );
}

function rawTextCardDigits(rawText?: string) {
  if (!rawText) return [];
  const patterns = [
    /\bfinal\s+(\d{4})\b/gi,
    /\bcart[aã]o(?:\s+n[ºo.]*)?\s*(?:final\s*)?(\d{4})\b/gi,
    /\b(?:visa|mastercard|elo|amex|american\s+express)\b[^\n\r]{0,45}?\b(\d{4})\b/gi,
  ];
  const values = new Set<string>();
  for (const pattern of patterns) {
    for (const match of rawText.matchAll(pattern)) values.add(match[1]);
  }
  return [...values];
}

function cardLastDigitsForTransaction(transaction: Transaction, document?: DocumentRecord) {
  if (!document?.extracted || document.extracted.documentType !== 'invoice') return undefined;

  const allItems = [...(document.extracted.items || []), ...(document.extracted.futureItems || [])];
  const normalizedDescription = normalizeInvoiceDescription(transaction.description);
  const matchingItems = allItems.filter(
    (item) =>
      item.cardLastDigits &&
      normalizeInvoiceDescription(item.description) === normalizedDescription &&
      sameInstallment(item, transaction),
  );

  const matchingDigits = [
    ...new Set(matchingItems.map((item) => item.cardLastDigits).filter(Boolean)),
  ];
  if (matchingDigits.length === 1) return matchingDigits[0];

  const documentDigits = [
    ...new Set(allItems.map((item) => item.cardLastDigits).filter(Boolean)),
  ];
  if (documentDigits.length === 1) return documentDigits[0];

  const rawDigits = rawTextCardDigits(document.rawText);
  return rawDigits.length === 1 ? rawDigits[0] : undefined;
}

export function resolveTransactionCard(
  transaction: Transaction,
  cards: CreditCard[],
  documents: DocumentRecord[],
) {
  if (transaction.cardId) {
    const explicit = cards.find((card) => card.id === transaction.cardId);
    if (explicit) return explicit;
  }

  if (!transaction.documentId) return undefined;
  const document = documents.find((item) => item.id === transaction.documentId);
  const lastDigits = cardLastDigitsForTransaction(transaction, document);
  if (!lastDigits) return undefined;
  return cards.find((card) => card.lastDigits === lastDigits);
}

export function transactionsForCard(
  card: CreditCard,
  transactions: Transaction[],
  cards: CreditCard[],
  documents: DocumentRecord[],
) {
  return transactions.filter(
    (transaction) =>
      transaction.type === 'expense' &&
      transaction.status !== 'cancelled' &&
      resolveTransactionCard(transaction, cards, documents)?.id === card.id,
  );
}

export function cardInvoiceSummaries(card: CreditCard, transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    const key = transaction.cardInvoiceMonth || inferredInvoiceMonth(transaction, card);
    groups.set(key, [...(groups.get(key) || []), transaction]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map<CardInvoiceSummary>(([month, items]) => ({
      month,
      amount: items.reduce((sum, item) => sum + item.amount, 0),
      pending: items
        .filter((item) => item.status !== 'paid')
        .reduce((sum, item) => sum + item.amount, 0),
      paid: items
        .filter((item) => item.status === 'paid')
        .reduce((sum, item) => sum + item.amount, 0),
      future: items
        .filter((item) => item.futureInstallment)
        .reduce((sum, item) => sum + item.amount, 0),
      transactions: items,
    }));
}

export function currentCardInvoice(summaries: CardInvoiceSummary[], now = new Date()) {
  const todayMonth = monthKey(now);
  return (
    summaries.find((summary) => summary.month >= todayMonth && summary.pending > 0) ||
    [...summaries].reverse().find((summary) => summary.pending > 0) ||
    summaries.find((summary) => summary.month >= todayMonth) ||
    summaries.at(-1)
  );
}

export function formatInvoiceMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1, 12),
  );
}
