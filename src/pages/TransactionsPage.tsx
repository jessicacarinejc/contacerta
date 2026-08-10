import { CalendarClock, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { PageHeader } from '../components/PageHeader';
import { TransactionForm } from '../components/forms/TransactionForm';
import { Badge, Button, Card, Modal } from '../components/ui';
import { toCurrency } from '../lib/currency';
import { useFinanceStore } from '../store/useFinanceStore';
import type { Transaction } from '../types/finance';

export function TransactionsPage() {
  const navigate = useNavigate();
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const categories = useFinanceStore((state) => state.categories);
  const remove = useFinanceStore((state) => state.deleteTransaction);
  const [createModal, setCreateModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(
    () =>
      transactions
        .filter((item) => !item.futureInstallment)
        .filter((item) => filter === 'all' || item.type === filter)
        .filter((item) =>
          `${item.description} ${item.thirdParty || ''}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, filter, query],
  );

  function exportXlsx() {
    const rows = filtered.map((item) => ({
      Data: item.date,
      Descrição: item.description,
      Tipo: item.type,
      Valor: item.amount,
      Situação: item.status,
      Parcela: item.installment ? `${item.installment.current}/${item.installment.total}` : '',
      Terceiro: item.thirdParty || '',
      Conta: accounts.find((account) => account.id === item.accountId)?.name,
      Categoria: categories.find((category) => category.id === item.categoryId)?.name,
      Origem: item.documentId ? 'Documento importado' : 'Lançamento manual',
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Movimentações');
    XLSX.writeFile(book, 'conta-certa-movimentacoes.xlsx');
  }

  function closeEditModal() {
    setEditingTransaction(null);
  }

  function confirmDelete() {
    if (!transactionToDelete) return;
    remove(transactionToDelete.id);
    setTransactionToDelete(null);
  }

  return (
    <div className="page">
      <PageHeader
        title="Movimentações"
        description="Receitas, despesas e transferências realizadas ou referentes à fatura atual. Os dados podem ser corrigidos mesmo quando vieram de documentos importados."
        action={
          <>
            <Button variant="secondary" onClick={() => navigate('/lancamentos-futuros')}>
              <CalendarClock size={17} /> Futuros
            </Button>
            <Button variant="secondary" onClick={exportXlsx}>
              <Download size={17} /> Exportar
            </Button>
            <Button onClick={() => setCreateModal(true)}>
              <Plus size={17} /> Novo lançamento
            </Button>
          </>
        }
      />
      <Card>
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              placeholder="Buscar movimentação ou terceiro"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Todos os tipos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
            <option value="transfer">Transferências</option>
          </select>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Terceiro</th>
                <th>Categoria</th>
                <th>Conta</th>
                <th>Situação</th>
                <th className="right">Valor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <strong>{item.description}</strong>
                    {item.installment && (
                      <small>
                        Parcela {item.installment.current}/{item.installment.total}
                      </small>
                    )}
                    {item.documentId && <small>Importado de documento</small>}
                  </td>
                  <td>{item.thirdParty || '—'}</td>
                  <td>{categories.find((category) => category.id === item.categoryId)?.name}</td>
                  <td>{accounts.find((account) => account.id === item.accountId)?.name}</td>
                  <td>
                    <Badge
                      tone={
                        item.status === 'paid'
                          ? 'positive'
                          : item.status === 'overdue'
                            ? 'danger'
                            : item.status === 'cancelled'
                              ? 'neutral'
                              : 'warning'
                      }
                    >
                      {item.status === 'paid'
                        ? 'Realizado'
                        : item.status === 'pending'
                          ? 'Pendente'
                          : item.status === 'cancelled'
                            ? 'Cancelado'
                            : 'Vencido'}
                    </Badge>
                  </td>
                  <td className={`right amount ${item.type}`}>
                    {item.type === 'expense' ? '-' : item.type === 'income' ? '+' : ''}
                    {toCurrency(item.amount)}
                  </td>
                  <td>
                    <div className="transaction-row-actions">
                      <button
                        className="icon-button"
                        onClick={() => setEditingTransaction(item)}
                        aria-label={`Editar ${item.description}`}
                        title="Editar movimentação"
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => setTransactionToDelete(item)}
                        aria-label={`Excluir ${item.description}`}
                        title="Excluir movimentação"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Novo lançamento">
        <TransactionForm onDone={() => setCreateModal(false)} />
      </Modal>

      <Modal
        open={Boolean(editingTransaction)}
        onClose={closeEditModal}
        title={editingTransaction?.documentId ? 'Corrigir lançamento importado' : 'Editar lançamento'}
      >
        {editingTransaction && (
          <TransactionForm transaction={editingTransaction} onDone={closeEditModal} />
        )}
      </Modal>

      <Modal
        open={Boolean(transactionToDelete)}
        onClose={() => setTransactionToDelete(null)}
        title="Confirmar exclusão"
      >
        {transactionToDelete && (
          <div className="form-stack">
            <p>
              Confirma a exclusão desta movimentação? Esta ação remove o lançamento da sua base financeira.
            </p>
            <Card>
              <strong>{transactionToDelete.description}</strong>
              <p>
                {new Date(`${transactionToDelete.date}T12:00:00`).toLocaleDateString('pt-BR')} ·{' '}
                {toCurrency(transactionToDelete.amount)}
                {transactionToDelete.installment
                  ? ` · Parcela ${transactionToDelete.installment.current}/${transactionToDelete.installment.total}`
                  : ''}
              </p>
              {transactionToDelete.thirdParty && (
                <small>Compra para terceiro: {transactionToDelete.thirdParty}</small>
              )}
            </Card>
            <div className="form-actions">
              <Button variant="secondary" type="button" onClick={() => setTransactionToDelete(null)}>
                Cancelar
              </Button>
              <Button variant="danger" type="button" onClick={confirmDelete}>
                <Trash2 size={17} /> Confirmar exclusão
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
