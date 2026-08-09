import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '../ui';
import { useFinanceStore } from '../../store/useFinanceStore';
import type { Transaction, TransactionStatus, TransactionType } from '../../types/finance';

interface TransactionFormProps {
  onDone: () => void;
  transaction?: Transaction;
}

export function TransactionForm({ onDone, transaction }: TransactionFormProps) {
  const accounts = useFinanceStore((state) => state.accounts);
  const categories = useFinanceStore((state) => state.categories);
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const updateTransaction = useFinanceStore((state) => state.updateTransaction);

  const editing = Boolean(transaction);
  const [type, setType] = useState<TransactionType>(transaction?.type || 'expense');
  const [description, setDescription] = useState(
    transaction?.categoryId === 'cat_other' ? '' : transaction?.description || '',
  );
  const [otherExpenseDescription, setOtherExpenseDescription] = useState(
    transaction?.categoryId === 'cat_other' ? transaction.description : '',
  );
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [date, setDate] = useState(
    transaction?.date || new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState(transaction?.dueDate || '');
  const [accountId, setAccountId] = useState(transaction?.accountId || accounts[0]?.id || '');
  const [categoryId, setCategoryId] = useState(transaction?.categoryId || 'cat_other');
  const [status, setStatus] = useState<TransactionStatus>(transaction?.status || 'paid');
  const [thirdParty, setThirdParty] = useState(transaction?.thirdParty || '');

  const filtered = useMemo(
    () => categories.filter((category) => category.type === type || category.type === 'both'),
    [categories, type],
  );

  const isOtherExpense = type === 'expense' && categoryId === 'cat_other';

  useEffect(() => {
    if (!filtered.some((category) => category.id === categoryId)) {
      setCategoryId(filtered[0]?.id || 'cat_other');
    }
  }, [categoryId, filtered]);

  useEffect(() => {
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accountId, accounts]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount.replace(',', '.'));
    const normalizedDescription = isOtherExpense
      ? otherExpenseDescription.trim()
      : description.trim();

    if (!normalizedDescription || value <= 0 || !accountId) return;

    const editableData = {
      description: normalizedDescription,
      type,
      amount: value,
      date,
      dueDate: dueDate || undefined,
      paidAt:
        status === 'paid'
          ? transaction?.status === 'paid' && transaction.paidAt
            ? transaction.paidAt
            : date
          : undefined,
      accountId,
      categoryId,
      status,
      thirdParty: type === 'expense' ? thirdParty.trim() || undefined : undefined,
    };

    if (transaction) {
      // Atualiza somente os campos editáveis. Metadados da importação, documento de origem,
      // parcela, observações e demais vínculos permanecem preservados.
      updateTransaction(transaction.id, editableData);
    } else {
      addTransaction(editableData);
    }

    onDone();
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {editing && transaction?.documentId && (
        <div className="form-hint span-2">
          Este lançamento veio de um documento importado. Você pode corrigir os dados abaixo sem perder o vínculo com o documento original.
        </div>
      )}

      <label>
        Tipo
        <select value={type} onChange={(event) => setType(event.target.value as TransactionType)}>
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
          <option value="transfer">Transferência</option>
        </select>
      </label>

      <label>
        Categoria
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          {filtered.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      {isOtherExpense ? (
        <label className="span-2 other-expense-field">
          Descreva qual é a outra despesa
          <input
            value={otherExpenseDescription}
            onChange={(event) => setOtherExpenseDescription(event.target.value)}
            placeholder="Ex.: material de limpeza, presente, manutenção, taxa, pet..."
            autoFocus
            required
          />
          <small className="form-field-hint">
            Este campo é livre. O texto digitado será a descrição exibida nas movimentações,
            relatórios e exportações.
          </small>
        </label>
      ) : (
        <label className="span-2">
          Descrição
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Informe uma descrição para o lançamento"
            required
          />
        </label>
      )}

      {type === 'expense' && (
        <label className="span-2">
          Compra para terceiro (opcional)
          <input
            value={thirdParty}
            onChange={(event) => setThirdParty(event.target.value)}
            placeholder="Ex.: Maria, João, Empresa X"
          />
          <small className="form-field-hint">
            Use este campo quando a despesa foi paga por você, mas pertence a outra pessoa. Depois será possível filtrar e gerar relatório por terceiro.
          </small>
        </label>
      )}

      <label>
        Valor
        <input
          type="number"
          min=".01"
          step=".01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </label>

      <label>
        Data
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>

      <label>
        Vencimento
        <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </label>

      <label>
        Conta
        <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
          <option value="" disabled>
            Selecione uma conta
          </option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Situação
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as TransactionStatus)}
        >
          <option value="paid">Pago/recebido</option>
          <option value="pending">Pendente</option>
          <option value="overdue">Vencido</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </label>

      <div className="form-actions span-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={accounts.length === 0}>
          {editing ? 'Atualizar lançamento' : 'Salvar lançamento'}
        </Button>
      </div>
    </form>
  );
}
