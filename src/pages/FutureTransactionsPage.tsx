import { CalendarClock } from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Badge, Card, EmptyState } from '../components/ui';
import { toCurrency } from '../lib/currency';
import { useFinanceStore } from '../store/useFinanceStore';

export function FutureTransactionsPage() {
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const categories = useFinanceStore((state) => state.categories);

  const future = useMemo(
    () =>
      transactions
        .filter((item) => item.type === 'expense' && item.futureInstallment)
        .sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date)),
    [transactions],
  );

  const total = future.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="page">
      <PageHeader
        title="Lançamentos futuros"
        description="Parcelas que ainda vencerão nos próximos meses, projetadas a partir das compras parceladas."
      />

      <div className="summary-strip">
        <Card>
          <small>Parcelas futuras</small>
          <strong>{future.length}</strong>
        </Card>
        <Card>
          <small>Total comprometido</small>
          <strong>{toCurrency(total)}</strong>
        </Card>
      </div>

      <Card>
        {future.length === 0 ? (
          <EmptyState
            icon={<CalendarClock />}
            title="Nenhuma parcela futura"
            description="Ao importar ou cadastrar compras parceladas, as parcelas seguintes aparecerão aqui."
          />
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Descrição</th>
                  <th>Parcela</th>
                  <th>Terceiro</th>
                  <th>Conta</th>
                  <th>Categoria</th>
                  <th>Situação</th>
                  <th className="right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {future.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {new Date(`${item.dueDate || item.date}T12:00:00`).toLocaleDateString('pt-BR')}
                    </td>
                    <td><strong>{item.description}</strong></td>
                    <td>
                      {item.installment
                        ? `${item.installment.current}/${item.installment.total}`
                        : '—'}
                    </td>
                    <td>{item.thirdParty || '—'}</td>
                    <td>{accounts.find((account) => account.id === item.accountId)?.name || '—'}</td>
                    <td>{categories.find((category) => category.id === item.categoryId)?.name || '—'}</td>
                    <td><Badge tone="warning">Pendente</Badge></td>
                    <td className="right amount expense">-{toCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
