import {
  CalendarDays,
  Car,
  Home,
  Pencil,
  Plane,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { GoalForm } from '../components/forms/GoalForm';
import { Button, Card, EmptyState, Modal, Progress } from '../components/ui';
import { toCurrency } from '../lib/currency';
import { goalProgress } from '../lib/finance';
import { useFinanceStore } from '../store/useFinanceStore';
import type { Goal } from '../types/finance';

function GoalIcon({ icon }: { icon: string }) {
  if (icon === 'plane') return <Plane />;
  if (icon === 'shield') return <ShieldCheck />;
  if (icon === 'car') return <Car />;
  if (icon === 'home') return <Home />;
  return <Target />;
}

export function GoalsPage() {
  const goals = useFinanceStore((state) => state.goals);
  const deleteGoal = useFinanceStore((state) => state.deleteGoal);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();

  function openNewGoal() {
    setEditingGoal(undefined);
    setModalOpen(true);
  }

  function openEditGoal(goal: Goal) {
    setEditingGoal(goal);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingGoal(undefined);
  }

  return (
    <div className="page">
      <PageHeader
        title="Metas financeiras"
        description="Cadastre seus objetivos, acompanhe o progresso e saiba quanto precisa aportar por mês."
        action={
          <Button onClick={openNewGoal}>
            <Plus size={17} /> Nova meta
          </Button>
        }
      />

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target />}
            title="Nenhuma meta cadastrada"
            description="Crie sua primeira meta financeira para acompanhar valor, prazo e aporte mensal sugerido."
          />
          <div className="empty-state-action">
            <Button onClick={openNewGoal}>
              <Plus size={17} /> Cadastrar primeira meta
            </Button>
          </div>
        </Card>
      ) : (
        <div className="goal-grid">
          {goals.map((goal) => {
            const progress = goalProgress(goal);
            const deadlineDate = new Date(`${goal.deadline}T12:00:00`);
            const months = Math.max(
              1,
              Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)),
            );
            const monthly = Math.max(0, (goal.target - goal.current) / months);

            return (
              <Card key={goal.id} className="goal-card">
                <div className="goal-icon">
                  <GoalIcon icon={goal.icon} />
                </div>
                <div className="goal-main">
                  <div className="goal-title-row">
                    <div>
                      <small>Objetivo</small>
                      <h2>{goal.name}</h2>
                    </div>
                    <div className="entity-card-actions goal-actions">
                      <Button variant="secondary" onClick={() => openEditGoal(goal)}>
                        <Pencil size={15} /> Editar
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (confirm(`Excluir a meta “${goal.name}”?`)) deleteGoal(goal.id);
                        }}
                      >
                        <Trash2 size={15} /> Excluir
                      </Button>
                    </div>
                  </div>

                  <div className="goal-amount">
                    <strong>{toCurrency(goal.current)}</strong>
                    <span>de {toCurrency(goal.target)}</span>
                  </div>
                  <Progress value={progress} label={`${Math.round(progress)}% concluído`} />
                  <div className="goal-meta">
                    <span>
                      <CalendarDays /> Prazo {deadlineDate.toLocaleDateString('pt-BR')}
                    </span>
                    <span>
                      <Target /> Aporte sugerido {toCurrency(monthly)}/mês
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingGoal ? 'Editar meta financeira' : 'Nova meta financeira'}
      >
        <GoalForm goal={editingGoal} onDone={closeModal} />
      </Modal>
    </div>
  );
}
