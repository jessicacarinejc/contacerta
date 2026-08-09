import { AlertTriangle, CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, Progress } from '../components/ui';
import { toCurrency } from '../lib/currency';
import { budgetProgress } from '../lib/finance';
import { useFinanceStore } from '../store/useFinanceStore';
import type { Budget } from '../types/finance';

const currentMonth = () => new Date().toISOString().slice(0, 7);

export function BudgetsPage() {
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const addBudget = useFinanceStore((state) => state.addBudget);
  const updateBudget = useFinanceStore((state) => state.updateBudget);
  const deleteBudget = useFinanceStore((state) => state.deleteBudget);

  const [editing, setEditing] = useState<Budget | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [categoryId, setCategoryId] = useState('cat_food');
  const [month, setMonth] = useState(currentMonth());
  const [limit, setLimit] = useState('');
  const [error, setError] = useState('');

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type !== 'income'),
    [categories],
  );

  function resetForm() {
    setEditing(null);
    setShowForm(false);
    setCategoryId(expenseCategories[0]?.id || 'cat_other');
    setMonth(currentMonth());
    setLimit('');
    setError('');
  }

  function openNew() {
    setEditing(null);
    setCategoryId(expenseCategories[0]?.id || 'cat_other');
    setMonth(currentMonth());
    setLimit('');
    setError('');
    setShowForm(true);
  }

  function openEdit(budget: Budget) {
    setEditing(budget);
    setCategoryId(budget.categoryId);
    setMonth(budget.month);
    setLimit(String(budget.limit));
    setError('');
    setShowForm(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedLimit = Number(limit.replace(',', '.'));
    if (!categoryId || !month || !Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setError('Informe categoria, mês e um limite maior que zero.');
      return;
    }

    const duplicate = budgets.some(
      (budget) => budget.id !== editing?.id && budget.categoryId === categoryId && budget.month === month,
    );
    if (duplicate) {
      setError('Já existe um orçamento para esta categoria neste mês. Edite o orçamento existente.');
      return;
    }

    if (editing) {
      updateBudget(editing.id, { categoryId, month, limit: parsedLimit });
    } else {
      addBudget({ categoryId, month, limit: parsedLimit });
    }
    resetForm();
  }

  return (
    <div className="page">
      <PageHeader
        title="Orçamentos"
        description="Defina limites por categoria e acompanhe automaticamente quanto já foi utilizado."
        action={
          <Button onClick={openNew}>
            <Plus size={17} /> Novo orçamento
          </Button>
        }
      />

      {showForm && (
        <Card className="budget-editor-card">
          <form className="form-grid" onSubmit={submit}>
            <label>
              Categoria
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                {expenseCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mês do orçamento
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </label>
            <label className="span-2">
              Limite mensal
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                placeholder="Ex.: 1500,00"
                required
              />
            </label>
            {error && <div className="form-error span-2">{error}</div>}
            <div className="form-actions span-2">
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit">{editing ? 'Salvar alterações' : 'Criar orçamento'}</Button>
            </div>
          </form>
        </Card>
      )}

      {budgets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 />}
            title="Nenhum orçamento cadastrado"
            description="Crie limites mensais para alimentação, transporte, saúde, lazer e outras categorias."
          />
          <div className="empty-state-action">
            <Button onClick={openNew}>
              <Plus size={16} /> Criar primeiro orçamento
            </Button>
          </div>
        </Card>
      ) : (
        <div className="budget-grid">
          {budgets.map((budget) => {
            const category = categories.find((item) => item.id === budget.categoryId);
            const progress = budgetProgress(budget, transactions);
            const exceeded = progress.percentage >= 100;
            const monthLabel = new Date(`${budget.month}-01T12:00:00`).toLocaleDateString('pt-BR', {
              month: 'long',
              year: 'numeric',
            });

            return (
              <Card key={budget.id} className="budget-card budget-card-editable">
                <header>
                  <span style={{ background: category?.color }}>
                    {exceeded ? <AlertTriangle /> : <CheckCircle2 />}
                  </span>
                  <div>
                    <small>Categoria · {monthLabel}</small>
                    <h3>{category?.name || 'Categoria'}</h3>
                  </div>
                  <strong>{Math.round(progress.percentage)}%</strong>
                </header>
                <div className="budget-values">
                  <span>
                    Realizado <b>{toCurrency(progress.spent)}</b>
                  </span>
                  <span>
                    Limite <b>{toCurrency(budget.limit)}</b>
                  </span>
                </div>
                <Progress
                  value={progress.percentage}
                  label={
                    exceeded
                      ? `Excedido ${toCurrency(progress.spent - budget.limit)}`
                      : `Disponível ${toCurrency(budget.limit - progress.spent)}`
                  }
                />
                <div className="entity-card-actions budget-actions">
                  <Button variant="secondary" onClick={() => openEdit(budget)}>
                    <Pencil size={15} /> Editar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (window.confirm('Excluir este orçamento?')) deleteBudget(budget.id);
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
    </div>
  );
}
