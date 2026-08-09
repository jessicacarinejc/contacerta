import { beforeEach, describe, expect, it } from 'vitest';
import { useFinanceStore } from './useFinanceStore';

describe('thirdParty em movimentações', () => {
  beforeEach(() => {
    useFinanceStore.setState({ transactions: [] });
  });

  it('grava o terceiro ao criar uma despesa', () => {
    const id = useFinanceStore.getState().addTransaction({
      description: 'Compra para terceiro',
      type: 'expense',
      amount: 150,
      date: '2026-08-09',
      accountId: 'acc-test',
      categoryId: 'cat_other',
      status: 'paid',
      thirdParty: 'Maria',
    });

    const transaction = useFinanceStore.getState().transactions.find((item) => item.id === id);
    expect(transaction?.thirdParty).toBe('Maria');
  });

  it('grava a alteração do terceiro em lançamento já existente ou importado', () => {
    const id = useFinanceStore.getState().addTransaction({
      description: 'Despesa importada',
      type: 'expense',
      amount: 94,
      date: '2026-08-09',
      accountId: 'acc-test',
      categoryId: 'cat_other',
      status: 'paid',
      documentId: 'doc-test',
    });

    useFinanceStore.getState().updateTransaction(id, { thirdParty: 'João' });

    const transaction = useFinanceStore.getState().transactions.find((item) => item.id === id);
    expect(transaction?.thirdParty).toBe('João');
    expect(transaction?.documentId).toBe('doc-test');
  });
});
