import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '../ui';
import { useFinanceStore } from '../../store/useFinanceStore';
import type { TransactionStatus, TransactionType } from '../../types/finance';

export function TransactionForm({ onDone }: { onDone: () => void }) {
  const accounts = useFinanceStore((state) => state.accounts);
  const categories = useFinanceStore((state) => state.categories);
  const addTransaction = useFinanceStore((state) => state.addTransaction);

  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [categoryId, setCategoryId] = useState('cat_other');
  const [status, setStatus] = useState<TransactionStatus>('paid');

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

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount.replace(',', '.'));
    const normalizedDescription = description.trim();

    if (!normalizedDescription || value <= 0) return;

    addTransaction({
      description: normalizedDescription,
      type,
      amount: value,
      date,
      dueDate: dueDate || undefined,
      paidAt: status === 'paid' ? date : undefined,
      accountId,
      categoryId,
      status,
    });
    onDone();
  }

  return (
    <form className="form-grid" onSubmit={submit}>
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

      <label className="span-2">
        {isOtherExpense ? 'Qual é a outra despesa?' : 'Descrição'}
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={
            isOtherExpense
              ? 'Ex.: material de limpeza, presente, manutenção, taxa...'
              : 'Informe uma descrição para o lançamento'
          }
          required
        />
        {isOtherExpense && (
          <small className="form-field-hint">
            Descreva livremente a despesa para ela aparecer identificada nas movimentações e relatórios.
          </small>
        )}
      </label>

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
        <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
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
        </select>
      </label>

      <div className="form-actions span-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Salvar lançamento</Button>
      </div>
    </form>
  );
}
