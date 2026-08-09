import { CalendarClock, Download, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { PageHeader } from '../components/PageHeader';
import { TransactionForm } from '../components/forms/TransactionForm';
import { Badge, Button, Card, Modal } from '../components/ui';
import { toCurrency } from '../lib/currency';
import { useFinanceStore } from '../store/useFinanceStore';

export function TransactionsPage() {
  const navigate = useNavigate();
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const categories = useFinanceStore((state) => state.categories);
  const remove = useFinanceStore((state) => state.deleteTransaction);
  const [modal, setModal] = useState(false);
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
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Movimentações');
    XLSX.writeFile(book, 'conta-certa-movimentacoes.xlsx');
  }

  return (
    <div className="page">
      <PageHeader
        title="Movimentações"
        description="Receitas, despesas e transferências realizadas ou referentes à fatura atual. Parcelas futuras ficam em uma aba própria."
        action={
          <>
            <Button variant="secondary" onClick={() => navigate('/lancamentos-futuros')}>
              <CalendarClock size={17} /> Futuros
            </Button>
            <Button variant="secondary" onClick={exportXlsx}>
              <Download size={17} /> Exportar
            </Button>
            <Button onClick={() => setModal(true)}>
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
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <strong>{item.description}</strong>
                    {item.installment && (
                      <small>{item.installment.current}/{item.installment.total}</small>
                    )}
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
                            : 'warning'
                      }
                    >
                      {item.status === 'paid'
                        ? 'Realizado'
                        : item.status === 'pending'
                          ? 'Pendente'
                          : 'Vencido'}
                    </Badge>
                  </td>
                  <td className={`right amount ${item.type}`}>
                    {item.type === 'expense' ? '-' : item.type === 'income' ? '+' : ''}
                    {toCurrency(item.amount)}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      onClick={() => remove(item.id)}
                      aria-label="Excluir"
                    >
                      <Trash2 size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title="Novo lançamento">
        <TransactionForm onDone={() => setModal(false)} />
      </Modal>
    </div>
  );
}
