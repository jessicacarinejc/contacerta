import { CreditCard, GaugeCircle, Plus } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, Modal, Progress } from '../components/ui';
import { toCurrency } from '../lib/currency';
import { useFinanceStore } from '../store/useFinanceStore';

const cardColors = ['#092144', '#279B48', '#5B4BC4', '#B76A1B', '#9E355A'];

export function CardsPage() {
  const cards = useFinanceStore((state) => state.cards);
  const addCard = useFinanceStore((state) => state.addCard);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [lastDigits, setLastDigits] = useState('');
  const [limit, setLimit] = useState('');
  const [used, setUsed] = useState('0');
  const [closingDay, setClosingDay] = useState('10');
  const [dueDay, setDueDay] = useState('17');
  const [color, setColor] = useState(cardColors[0]);
  const [error, setError] = useState('');

  function closeModal() {
    setOpen(false);
    setError('');
  }

  function resetForm() {
    setName('');
    setInstitution('');
    setLastDigits('');
    setLimit('');
    setUsed('0');
    setClosingDay('10');
    setDueDay('17');
    setColor(cardColors[0]);
    setError('');
  }

  return (
    <div className="page">
      <PageHeader
        title="Cartões"
        description="Limites, faturas e datas importantes."
        action={
          <Button
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus size={17} /> Novo cartão
          </Button>
        }
      />

      <div className="credit-card-grid">
        {cards.map((card) => {
          const usagePercent = card.limit > 0 ? (card.used / card.limit) * 100 : 0;
          return (
            <Card key={card.id} className="credit-card-panel">
              <div className="visual-card" style={{ background: card.color }}>
                <div>
                  <CreditCard />
                  <span>Conta Certa</span>
                </div>
                <strong>•••• •••• •••• {card.lastDigits}</strong>
                <small>{card.name}</small>
              </div>
              <div className="card-stats">
                <div>
                  <small>Fatura atual</small>
                  <strong>{toCurrency(card.used)}</strong>
                </div>
                <div>
                  <small>Disponível</small>
                  <strong>{toCurrency(Math.max(card.limit - card.used, 0))}</strong>
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
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="feature-callout">
          <GaugeCircle />
          <div>
            <h3>Sem duplicidade</h3>
            <p>Compras e quitação da fatura são tratadas separadamente.</p>
          </div>
        </div>
      </Card>

      <Modal open={open} onClose={closeModal} title="Novo cartão de crédito">
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

            addCard({
              name: name.trim(),
              institution: institution.trim(),
              lastDigits,
              limit: parsedLimit,
              used: parsedUsed,
              closingDay: parsedClosingDay,
              dueDay: parsedDueDay,
              color,
            });
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
              placeholder="5000,00"
              required
            />
          </label>
          <label>
            Fatura atual
            <input
              type="number"
              min="0"
              step="0.01"
              value={used}
              onChange={(event) => setUsed(event.target.value)}
            />
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
            <Button type="submit">Salvar cartão</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
