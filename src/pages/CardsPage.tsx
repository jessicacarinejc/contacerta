import { CreditCard, FileText, GaugeCircle, Pencil, Plus, ReceiptText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, CardHeader, Modal, Progress } from '../components/ui';
import {
  cardInvoiceSummaries,
  currentCardInvoice,
  formatInvoiceMonth,
  transactionsForCard,
} from '../lib/card-finance';
import { toCurrency } from '../lib/currency';
import { useFinanceStore } from '../store/useFinanceStore';

const cardColors = ['#092144', '#279B48', '#5B4BC4', '#B76A1B', '#9E355A'];

export function CardsPage() {
  const cards = useFinanceStore((state) => state.cards);
  const transactions = useFinanceStore((state) => state.transactions);
  const documents = useFinanceStore((state) => state.documents);
  const accounts = useFinanceStore((state) => state.accounts);
  const addCard = useFinanceStore((state) => state.addCard);
  const updateCard = useFinanceStore((state) => state.updateCard);
  const [open, setOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [brand, setBrand] = useState('');
  const [holder, setHolder] = useState('');
  const [lastDigits, setLastDigits] = useState('');
  const [limit, setLimit] = useState('');
  const [used, setUsed] = useState('0');
  const [closingDay, setClosingDay] = useState('10');
  const [dueDay, setDueDay] = useState('17');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [color, setColor] = useState(cardColors[0]);
  const [error, setError] = useState('');

  const cardViews = useMemo(
    () =>
      cards.map((card) => {
        const cardTransactions = transactionsForCard(card, transactions, cards, documents);
        const invoices = cardInvoiceSummaries(card, cardTransactions);
        const currentInvoice = currentCardInvoice(invoices);
        const futureCommitment = cardTransactions
          .filter((item) => item.futureInstallment)
          .reduce((sum, item) => sum + item.amount, 0);
        const invoiceAmount = currentInvoice?.amount ?? card.used;
        return { card, cardTransactions, invoices, currentInvoice, futureCommitment, invoiceAmount };
      }),
    [cards, documents, transactions],
  );

  const totalOpenInvoices = cardViews.reduce(
    (sum, view) => sum + (view.currentInvoice?.pending ?? view.invoiceAmount),
    0,
  );
  const selectedView = cardViews.find((view) => view.card.id === selectedCardId);

  function closeModal() {
    setOpen(false);
    setEditingCardId(null);
    setError('');
  }

  function resetForm() {
    setName('');
    setInstitution('');
    setBrand('');
    setHolder('');
    setLastDigits('');
    setLimit('');
    setUsed('0');
    setClosingDay('10');
    setDueDay('17');
    setPaymentAccountId(accounts[0]?.id || '');
    setColor(cardColors[0]);
    setError('');
  }

  function openNewCard() {
    resetForm();
    setEditingCardId(null);
    setOpen(true);
  }

  function openEditCard(card: (typeof cards)[number]) {
    setEditingCardId(card.id);
    setName(card.name);
    setInstitution(card.institution);
    setBrand(card.brand || '');
    setHolder(card.holder || '');
    setLastDigits(card.lastDigits);
    setLimit(String(card.limit));
    setUsed(String(card.used || 0));
    setClosingDay(String(card.closingDay));
    setDueDay(String(card.dueDay));
    setPaymentAccountId(card.paymentAccountId || '');
    setColor(card.color || cardColors[0]);
    setError('');
    setOpen(true);
  }

  return (
    <div className="page">
      <PageHeader
        title="Cartões"
        description="Faturas, limites, parcelas e despesas separadas por cartão."
        action={
          <Button onClick={openNewCard}>
            <Plus size={17} /> Novo cartão
          </Button>
        }
      />

      <div className="summary-strip">
        <Card>
          <small>Cartões cadastrados</small>
          <strong>{cards.length}</strong>
        </Card>
        <Card>
          <small>Faturas em aberto</small>
          <strong>{toCurrency(totalOpenInvoices)}</strong>
        </Card>
        <Card>
          <small>Parcelas futuras</small>
          <strong>{toCurrency(cardViews.reduce((sum, view) => sum + view.futureCommitment, 0))}</strong>
        </Card>
      </div>

      <div className="credit-card-grid">
        {cardViews.map(({ card, invoices, currentInvoice, futureCommitment, invoiceAmount }) => {
          const usagePercent = card.limit > 0 ? (invoiceAmount / card.limit) * 100 : 0;
          const nextInvoice = currentInvoice
            ? invoices.find((invoice) => invoice.month > currentInvoice.month)
            : invoices[0];
          return (
            <Card key={card.id} className="credit-card-panel">
              <div className="visual-card" style={{ background: card.color }}>
                <div>
                  <CreditCard />
                  <span>{card.institution || 'Conta Certa'}</span>
                </div>
                <strong>•••• •••• •••• {card.lastDigits}</strong>
                <small>
                  {card.name}
                  {card.brand ? ` · ${card.brand}` : ''}
                </small>
              </div>
              <div className="card-stats">
                <div>
                  <small>Fatura atual</small>
                  <strong>{toCurrency(invoiceAmount)}</strong>
                  {currentInvoice && <span>{formatInvoiceMonth(currentInvoice.month)}</span>}
                </div>
                <div>
                  <small>Disponível</small>
                  <strong>{toCurrency(Math.max(card.limit - invoiceAmount, 0))}</strong>
                </div>
                <Progress value={usagePercent} label={`${Math.round(usagePercent)}% utilizado`} />
                <div className="card-dates">
                  <span>
                    Fecha <b>{card.closingDay}</b>
                  </span>
                  <span>
                    Vence <b>{card.dueDay}</b>
                  </span>
                </div>
                <div className="card-dates">
                  <span>
                    Próxima fatura <b>{toCurrency(nextInvoice?.amount || 0)}</b>
                  </span>
                  <span>
                    Parcelas futuras <b>{toCurrency(futureCommitment)}</b>
                  </span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedCardId((current) => (current === card.id ? null : card.id))}
                >
                  <ReceiptText size={16} />
                  {selectedCardId === card.id ? 'Fechar detalhes' : 'Ver faturas e despesas'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => openEditCard(card)}>
                  <Pencil size={16} /> Editar cartão
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {selectedView && (
        <Card>
          <CardHeader title={`${selectedView.card.name} •••• ${selectedView.card.lastDigits}`} />
          <div className="summary-strip">
            <Card>
              <small>Fatura atual</small>
              <strong>{toCurrency(selectedView.currentInvoice?.amount || selectedView.invoiceAmount)}</strong>
            </Card>
            <Card>
              <small>Em aberto</small>
              <strong>{toCurrency(selectedView.currentInvoice?.pending || 0)}</strong>
            </Card>
            <Card>
              <small>Comprometimento futuro</small>
              <strong>{toCurrency(selectedView.futureCommitment)}</strong>
            </Card>
          </div>

          {selectedView.invoices.length === 0 ? (
            <div className="feature-callout">
              <FileText />
              <div>
                <h3>Nenhuma despesa vinculada ainda</h3>
                <p>
                  Ao importar uma fatura com o final deste cartão, as compras aparecerão aqui automaticamente.
                </p>
              </div>
            </div>
          ) : (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Fatura</th>
                    <th>Compras</th>
                    <th className="right">Realizado</th>
                    <th className="right">Pendente</th>
                    <th className="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedView.invoices.map((invoice) => (
                    <tr key={invoice.month}>
                      <td>
                        <strong>{formatInvoiceMonth(invoice.month)}</strong>
                      </td>
                      <td>{invoice.transactions.length}</td>
                      <td className="right">{toCurrency(invoice.paid)}</td>
                      <td className="right">{toCurrency(invoice.pending)}</td>
                      <td className="right">
                        <strong>{toCurrency(invoice.amount)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedView.currentInvoice && (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Parcela</th>
                    <th>Situação</th>
                    <th className="right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedView.currentInvoice.transactions.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                      <td>{item.description}</td>
                      <td>
                        {item.installment
                          ? `${item.installment.current}/${item.installment.total}`
                          : '—'}
                      </td>
                      <td>
                        {item.status === 'paid'
                          ? 'Realizado'
                          : item.futureInstallment
                            ? 'Futuro'
                            : 'Pendente'}
                      </td>
                      <td className="right">
                        <strong>{toCurrency(item.amount)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="feature-callout">
          <GaugeCircle />
          <div>
            <h3>Sem duplicidade</h3>
            <p>
              As compras ficam vinculadas ao cartão e à fatura; o pagamento da fatura continua sendo apenas a liquidação da obrigação.
            </p>
          </div>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={closeModal}
        title={editingCardId ? 'Editar cartão de crédito' : 'Novo cartão de crédito'}
      >
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');

            const parsedLimit = Number(limit);
            const parsedUsed = Number(used || '0');
            const parsedClosingDay = Number(closingDay);
            const parsedDueDay = Number(dueDay);

            if (!/^\d{4}$/.test(lastDigits)) {
              setError('Informe exatamente os 4 últimos dígitos do cartão.');
              return;
            }
            if (
              cards.some(
                (card) =>
                  card.id !== editingCardId &&
                  card.lastDigits === lastDigits &&
                  card.institution.toLowerCase() === institution.trim().toLowerCase(),
              )
            ) {
              setError('Já existe um cartão desta instituição com os mesmos 4 últimos dígitos.');
              return;
            }
            if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
              setError('Informe um limite maior que zero.');
              return;
            }
            if (!Number.isFinite(parsedUsed) || parsedUsed < 0 || parsedUsed > parsedLimit) {
              setError('A fatura atual deve ficar entre zero e o limite do cartão.');
              return;
            }
            if (
              !Number.isInteger(parsedClosingDay) ||
              parsedClosingDay < 1 ||
              parsedClosingDay > 31 ||
              !Number.isInteger(parsedDueDay) ||
              parsedDueDay < 1 ||
              parsedDueDay > 31
            ) {
              setError('Os dias de fechamento e vencimento devem estar entre 1 e 31.');
              return;
            }

            const cardData = {
              name: name.trim(),
              institution: institution.trim(),
              brand: brand.trim() || undefined,
              holder: holder.trim() || undefined,
              lastDigits,
              limit: parsedLimit,
              used: parsedUsed,
              closingDay: parsedClosingDay,
              dueDay: parsedDueDay,
              paymentAccountId: paymentAccountId || undefined,
              active: editingCardId
                ? (cards.find((card) => card.id === editingCardId)?.active ?? true)
                : true,
              color,
            };

            if (editingCardId) {
              updateCard(editingCardId, cardData);
            } else {
              addCard(cardData);
            }
            closeModal();
          }}
        >
          <label>
            Nome do cartão
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Visa Platinum"
              required
            />
          </label>
          <label>
            Instituição
            <input
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
              placeholder="Ex.: Banco do Brasil"
              required
            />
          </label>
          <label>
            Bandeira
            <input
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder="Ex.: Visa, Mastercard, Elo"
            />
          </label>
          <label>
            Titular
            <input
              value={holder}
              onChange={(event) => setHolder(event.target.value)}
              placeholder="Opcional"
            />
          </label>
          <label>
            Últimos 4 dígitos
            <input
              inputMode="numeric"
              maxLength={4}
              value={lastDigits}
              onChange={(event) => setLastDigits(event.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              required
            />
          </label>
          <label>
            Limite
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              required
            />
          </label>
          <label>
            Fatura atual inicial
            <input
              type="number"
              min="0"
              step="0.01"
              value={used}
              onChange={(event) => setUsed(event.target.value)}
            />
          </label>
          <label>
            Conta padrão para pagamento
            <select
              value={paymentAccountId}
              onChange={(event) => setPaymentAccountId(event.target.value)}
            >
              <option value="">Não definida</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cor do cartão
            <select value={color} onChange={(event) => setColor(event.target.value)}>
              {cardColors.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dia de fechamento
            <input
              type="number"
              min="1"
              max="31"
              value={closingDay}
              onChange={(event) => setClosingDay(event.target.value)}
              required
            />
          </label>
          <label>
            Dia de vencimento
            <input
              type="number"
              min="1"
              max="31"
              value={dueDay}
              onChange={(event) => setDueDay(event.target.value)}
              required
            />
          </label>

          {error && (
            <div className="form-error span-2" role="alert">
              {error}
            </div>
          )}

          <div className="form-actions span-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit">{editingCardId ? 'Salvar alterações' : 'Salvar cartão'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
