import { Landmark, Pencil, Plus, Trash2, WalletCards } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, Modal } from '../components/ui';
import { toCurrency } from '../lib/currency';
import { totalBalance } from '../lib/finance';
import { useFinanceStore } from '../store/useFinanceStore';
import type { Account, AccountType } from '../types/finance';

const accountTypeLabels: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança / reserva',
  wallet: 'Carteira / dinheiro',
  investment: 'Investimento',
};

export function AccountsPage() {
  const accounts = useFinanceStore((state) => state.accounts);
  const addAccount = useFinanceStore((state) => state.addAccount);
  const updateAccount = useFinanceStore((state) => state.updateAccount);
  const deleteAccount = useFinanceStore((state) => state.deleteAccount);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [balance, setBalance] = useState('0');
  const [type, setType] = useState<AccountType>('checking');
  const [active, setActive] = useState(true);

  function resetForm() {
    setEditingId(null);
    setName('');
    setInstitution('');
    setBalance('0');
    setType('checking');
    setActive(true);
  }

  function openNewAccount() {
    resetForm();
    setOpen(true);
  }

  function openEditAccount(account: Account) {
    setEditingId(account.id);
    setName(account.name);
    setInstitution(account.institution);
    setBalance(String(account.balance));
    setType(account.type);
    setActive(account.active);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  function removeAccount(account: Account) {
    if (!confirm(`Excluir a conta “${account.name}”?`)) return;
    const removed = deleteAccount(account.id);
    if (!removed) {
      alert(
        'Esta conta possui lançamentos vinculados. Exclua ou transfira esses lançamentos antes de remover a conta.',
      );
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Contas"
        description="Saldos, instituições e disponibilidade financeira."
        action={
          <Button onClick={openNewAccount}>
            <Plus size={17} /> Nova conta
          </Button>
        }
      />

      <Card className="accounts-total">
        <span>
          <WalletCards />
        </span>
        <div>
          <small>Saldo consolidado</small>
          <strong>{toCurrency(totalBalance(accounts))}</strong>
        </div>
      </Card>

      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Landmark />}
            title="Nenhuma conta cadastrada"
            description="Cadastre sua primeira conta para começar a registrar lançamentos e importar documentos."
          />
        </Card>
      ) : (
        <div className="cards-grid">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="account-card"
              style={{ '--account-color': account.color } as CSSProperties}
            >
              <div className="account-icon">
                <Landmark />
              </div>
              <div className="entity-card-main">
                <small>{account.institution}</small>
                <h3>{account.name}</h3>
                <strong>{toCurrency(account.balance)}</strong>
                <span>
                  {accountTypeLabels[account.type]}
                  {!account.active ? ' • inativa' : ''}
                </span>
              </div>
              <div className="entity-card-actions">
                <Button variant="ghost" onClick={() => openEditAccount(account)}>
                  <Pencil size={15} /> Editar
                </Button>
                <Button variant="ghost" onClick={() => removeAccount(account)}>
                  <Trash2 size={15} /> Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={closeModal}
        title={editingId ? 'Editar conta' : 'Nova conta'}
      >
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const accountData = {
              name: name.trim(),
              institution: institution.trim(),
              balance: Number(balance),
              type,
              color: '#16a567',
              active,
            };

            if (editingId) {
              updateAccount(editingId, accountData);
            } else {
              addAccount(accountData);
            }
            closeModal();
          }}
        >
          <label className="span-2">
            Nome
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="span-2">
            Instituição
            <input
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
              required
            />
          </label>
          <label>
            Saldo
            <input
              type="number"
              step=".01"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
            />
          </label>
          <label>
            Tipo
            <select value={type} onChange={(event) => setType(event.target.value as AccountType)}>
              {Object.entries(accountTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2 inline-check">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Considerar esta conta no saldo consolidado
          </label>
          <div className="form-actions span-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit">{editingId ? 'Salvar alterações' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
