import {
  Building2,
  Car,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, Modal } from '../components/ui';
import { toCurrency } from '../lib/currency';
import { useFinanceStore } from '../store/useFinanceStore';
import type { Asset } from '../types/finance';

const icons = {
  cash: Wallet,
  investment: Landmark,
  vehicle: Car,
  property: Building2,
  debt: TrendingDown,
  other: Wallet,
};

const assetTypeLabels: Record<Asset['type'], string> = {
  cash: 'Dinheiro / saldo',
  investment: 'Investimento',
  vehicle: 'Veículo',
  property: 'Imóvel',
  debt: 'Dívida / obrigação',
  other: 'Outro bem',
};

export function AssetsPage() {
  const assets = useFinanceStore((state) => state.assets);
  const addAsset = useFinanceStore((state) => state.addAsset);
  const updateAsset = useFinanceStore((state) => state.updateAsset);
  const deleteAsset = useFinanceStore((state) => state.deleteAsset);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<Asset['type']>('cash');
  const [value, setValue] = useState('0');

  const total = assets.reduce((sum, item) => sum + item.value, 0);

  function resetForm() {
    setEditingId(null);
    setName('');
    setType('cash');
    setValue('0');
  }

  function openNewAsset() {
    resetForm();
    setOpen(true);
  }

  function openEditAsset(asset: Asset) {
    setEditingId(asset.id);
    setName(asset.name);
    setType(asset.type);
    setValue(String(Math.abs(asset.value)));
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  return (
    <div className="page">
      <PageHeader
        title="Patrimônio"
        description="Bens, reservas, investimentos e obrigações."
        action={
          <Button onClick={openNewAsset}>
            <Plus size={17} /> Novo item
          </Button>
        }
      />

      <Card className="patrimony-hero">
        <small>Patrimônio líquido</small>
        <strong>{toCurrency(total)}</strong>
        <span>Ativos menos dívidas e obrigações cadastradas.</span>
      </Card>

      {assets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 />}
            title="Nenhum patrimônio cadastrado"
            description="Inclua saldos, investimentos, veículos, imóveis e dívidas para acompanhar seu patrimônio líquido."
          />
        </Card>
      ) : (
        <div className="asset-grid">
          {assets.map((asset) => {
            const Icon = icons[asset.type];
            return (
              <Card key={asset.id} className={`asset-card ${asset.value < 0 ? 'negative' : ''}`}>
                <span>
                  <Icon />
                </span>
                <div className="entity-card-main">
                  <small>{asset.type === 'debt' ? 'Obrigação' : 'Ativo'}</small>
                  <h3>{asset.name}</h3>
                  <strong>{toCurrency(asset.value)}</strong>
                </div>
                <div className="entity-card-actions">
                  <Button variant="ghost" onClick={() => openEditAsset(asset)}>
                    <Pencil size={15} /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Excluir “${asset.name}” do patrimônio?`)) deleteAsset(asset.id);
                    }}
                  >
                    <Trash2 size={15} /> Excluir
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={closeModal}
        title={editingId ? 'Editar patrimônio' : 'Novo item de patrimônio'}
      >
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const numericValue = Math.abs(Number(value));
            const normalizedValue = type === 'debt' ? -numericValue : numericValue;
            const assetData = { name: name.trim(), type, value: normalizedValue };

            if (editingId) updateAsset(editingId, assetData);
            else addAsset(assetData);

            closeModal();
          }}
        >
          <label className="span-2">
            Descrição
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Tipo
            <select value={type} onChange={(event) => setType(event.target.value as Asset['type'])}>
              {Object.entries(assetTypeLabels).map(([optionValue, label]) => (
                <option key={optionValue} value={optionValue}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor
            <input
              type="number"
              min="0"
              step=".01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              required
            />
          </label>
          {type === 'debt' && (
            <p className="form-hint span-2">
              Informe o valor positivo. O Conta Certa descontará a dívida automaticamente do patrimônio líquido.
            </p>
          )}
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
