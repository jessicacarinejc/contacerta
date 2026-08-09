import { useState, type FormEvent } from 'react';
import type { Goal } from '../../types/finance';
import { useFinanceStore } from '../../store/useFinanceStore';
import { Button } from '../ui';

interface GoalFormProps {
  goal?: Goal;
  onDone: () => void;
}

export function GoalForm({ goal, onDone }: GoalFormProps) {
  const addGoal = useFinanceStore((state) => state.addGoal);
  const updateGoal = useFinanceStore((state) => state.updateGoal);

  const [name, setName] = useState(goal?.name || '');
  const [target, setTarget] = useState(goal ? String(goal.target) : '');
  const [current, setCurrent] = useState(goal ? String(goal.current) : '0');
  const [deadline, setDeadline] = useState(goal?.deadline || '');
  const [icon, setIcon] = useState(goal?.icon || 'target');
  const [error, setError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();

    const targetValue = Number(target.replace(',', '.'));
    const currentValue = Number(current.replace(',', '.'));

    if (!name.trim()) {
      setError('Informe o nome da meta.');
      return;
    }
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      setError('Informe um valor-alvo maior que zero.');
      return;
    }
    if (!Number.isFinite(currentValue) || currentValue < 0) {
      setError('O valor já acumulado não pode ser negativo.');
      return;
    }
    if (!deadline) {
      setError('Informe o prazo da meta.');
      return;
    }

    const payload = {
      name: name.trim(),
      target: targetValue,
      current: currentValue,
      deadline,
      icon,
    };

    if (goal) updateGoal(goal.id, payload);
    else addGoal(payload);

    onDone();
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="span-2">
        Nome da meta
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Reserva de emergência, viagem, carro..."
          autoFocus
          required
        />
      </label>

      <label>
        Valor-alvo
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="0,00"
          required
        />
      </label>

      <label>
        Valor já acumulado
        <input
          type="number"
          min="0"
          step="0.01"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          placeholder="0,00"
          required
        />
      </label>

      <label>
        Prazo
        <input
          type="date"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          required
        />
      </label>

      <label>
        Tipo de objetivo
        <select value={icon} onChange={(event) => setIcon(event.target.value)}>
          <option value="target">Objetivo geral</option>
          <option value="shield">Reserva de emergência</option>
          <option value="plane">Viagem</option>
          <option value="car">Veículo</option>
          <option value="home">Imóvel</option>
        </select>
      </label>

      {error && <div className="form-error span-2">{error}</div>}

      <div className="form-actions span-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">{goal ? 'Salvar alterações' : 'Criar meta'}</Button>
      </div>
    </form>
  );
}
