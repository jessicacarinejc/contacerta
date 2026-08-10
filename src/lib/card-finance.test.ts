import { describe, expect, it } from 'vitest';
import { cardInvoiceSummaries, resolveTransactionCard, transactionsForCard } from './card-finance';
import type { CreditCard, DocumentRecord, Transaction } from '../types/finance';

const card: CreditCard = {
  id: 'card-1',
  name: 'Cartão Teste',
  institution: 'Banco Teste',
  lastDigits: '4321',
  limit: 5000,
  used: 0,
  closingDay: 10,
  dueDay: 17,
  color: '#092144',
};

const document: DocumentRecord = {
  id: 'doc-1',
  name: 'fatura.pdf',
  mimeType: 'application/pdf',
  size: 100,
  hash: 'hash',
  status: 'approved',
  progress: 100,
  createdAt: '2026-08-01T00:00:00.000Z',
  extracted: {
    documentType: 'invoice',
    confidence: 0.95,
    dueDate: '2026-08-17',
    items: [{ description: 'Supermercado', amount: 120, cardLastDigits: '4321' }],
  },
};

const transaction: Transaction = {
  id: 'tx-1',
  description: 'Supermercado',
  type: 'expense',
  amount: 120,
  date: '2026-08-02',
  dueDate: '2026-08-17',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  status: 'pending',
  documentId: 'doc-1',
  createdAt: '2026-08-02T00:00:00.000Z',
};

describe('visão financeira por cartão', () => {
  it('identifica o cartão pelo final extraído da fatura', () => {
    expect(resolveTransactionCard(transaction, [card], [document])?.id).toBe('card-1');
    expect(transactionsForCard(card, [transaction], [card], [document])).toHaveLength(1);
  });

  it('agrupa as despesas pela fatura de vencimento', () => {
    const summaries = cardInvoiceSummaries(card, [{ ...transaction, cardId: card.id }]);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].month).toBe('2026-08');
    expect(summaries[0].amount).toBe(120);
    expect(summaries[0].pending).toBe(120);
  });
});
