import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  CreditCard,
  Lightbulb,
  PiggyBank,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui';
import {
  budgetProgress,
  categoryTotals,
  generateInsights,
  goalProgress,
  monthTransactions,
  totalBalance,
  totals,
} from '../lib/finance';
import { toCurrency } from '../lib/currency';
import { useFinanceStore } from '../store/useFinanceStore';

interface FinancialTip {
  icon: ReactNode;
  title: string;
  text: string;
}

export function IntelligencePage() {
  const { transactions, accounts, budgets, goals, categories, cards, settings } = useFinanceStore();
  const insights = generateInsights(transactions, accounts, budgets, goals);
  const currentTransactions = monthTransactions(transactions);
  const summary = totals(currentTransactions);
  const [monthly, setMonthly] = useState(500);
  const [target, setTarget] = useState(20000);
  const months = useMemo(
    () => Math.max(1, Math.ceil(target / Math.max(monthly, 1))),
    [monthly, target],
  );

  const tips = useMemo<FinancialTip[]>(() => {
    const result: FinancialTip[] = [];
    const savingsRate = summary.income > 0 ? (summary.result / summary.income) * 100 : 0;
    const categoryRanking = categoryTotals(currentTransactions, categories);
    const topCategory = categoryRanking[0];
    const installmentExpenses = transactions.filter(
      (item) => item.type === 'expense' && item.status !== 'cancelled' && item.installment,
    );
    const installmentAmount = installmentExpenses.reduce((sum, item) => sum + item.amount, 0);
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextSevenDays = transactions.filter((item) => {
      if (item.type !== 'expense' || item.status !== 'pending' || !item.dueDate) return false;
      const due = new Date(`${item.dueDate}T12:00:00`);
      return due >= now && due <= nextWeek;
    });
    const nextSevenDaysTotal = nextSevenDays.reduce((sum, item) => sum + item.amount, 0);
    const activeBalance = totalBalance(accounts);
    const reserveCoverage = summary.expense > 0 ? activeBalance / summary.expense : 0;
    const exceededBudgets = budgets.filter((budget) => budgetProgress(budget, transactions).percentage >= 100);
    const nearLimitBudgets = budgets
      .map((budget) => ({ budget, progress: budgetProgress(budget, transactions) }))
      .filter(({ progress }) => progress.percentage >= 80 && progress.percentage < 100)
      .sort((a, b) => b.progress.percentage - a.progress.percentage);
    const highestCard = [...cards]
      .filter((card) => card.limit > 0)
      .map((card) => ({ card, usage: (card.used / card.limit) * 100 }))
      .sort((a, b) => b.usage - a.usage)[0];

    if (summary.income > 0) {
      if (savingsRate >= 20) {
        result.push({
          icon: <PiggyBank />,
          title: `Taxa de poupança de ${Math.round(savingsRate)}%`,
          text: `Seu resultado do mês é ${toCurrency(summary.result)}. Considere direcionar parte desse valor automaticamente para suas metas e reserva.`,
        });
      } else if (savingsRate >= 0) {
        const targetSavings = summary.income * 0.2;
        result.push({
          icon: <TrendingUp />,
          title: 'Há espaço para aumentar sua poupança',
          text: `Você está preservando ${Math.round(savingsRate)}% da renda. Para chegar a 20%, o resultado mensal precisaria alcançar cerca de ${toCurrency(targetSavings)}.`,
        });
      } else {
        result.push({
          icon: <TrendingDown />,
          title: 'O mês está consumindo mais do que entra',
          text: `As despesas superam as receitas em ${toCurrency(Math.abs(summary.result))}. Priorize gastos variáveis e vencimentos antes de assumir novas parcelas.`,
        });
      }
    }

    if (topCategory && summary.expense > 0) {
      const share = (topCategory.value / summary.expense) * 100;
      result.push({
        icon: <Lightbulb />,
        title: `${topCategory.name} concentra ${Math.round(share)}% das despesas`,
        text: `Foram ${toCurrency(topCategory.value)} neste mês. Uma redução de 10% nessa categoria liberaria aproximadamente ${toCurrency(topCategory.value * 0.1)}.`,
      });
    }

    if (installmentExpenses.length > 0) {
      result.push({
        icon: <CreditCard />,
        title: `${installmentExpenses.length} compra(s) parcelada(s) em andamento`,
        text: `As parcelas registradas somam ${toCurrency(installmentAmount)} no período controlado. Avalie o comprometimento antes de iniciar novos parcelamentos.`,
      });
    }

    if (nextSevenDays.length > 0) {
      result.push({
        icon: <ShieldAlert />,
        title: `${nextSevenDays.length} vencimento(s) nos próximos 7 dias`,
        text: `Os compromissos próximos totalizam ${toCurrency(nextSevenDaysTotal)}. Compare esse valor com seu saldo disponível de ${toCurrency(activeBalance)}.`,
      });
    }

    if (exceededBudgets.length > 0) {
      result.push({
        icon: <AlertTriangle />,
        title: `${exceededBudgets.length} orçamento(s) ultrapassado(s)`,
        text: 'Revise os limites e os gastos dessas categorias. O orçamento deve funcionar como alerta antecipado, não apenas como histórico.',
      });
    } else if (nearLimitBudgets[0]) {
      const category = categories.find((item) => item.id === nearLimitBudgets[0].budget.categoryId);
      result.push({
        icon: <Target />,
        title: `${category?.name || 'Uma categoria'} está perto do limite`,
        text: `Já foram utilizados ${Math.round(nearLimitBudgets[0].progress.percentage)}% do orçamento. Restam ${toCurrency(Math.max(nearLimitBudgets[0].budget.limit - nearLimitBudgets[0].progress.spent, 0))}.`,
      });
    }

    if (highestCard && highestCard.usage >= 70) {
      result.push({
        icon: <CreditCard />,
        title: `${highestCard.card.name} está com ${Math.round(highestCard.usage)}% do limite usado`,
        text: `O cartão registra ${toCurrency(highestCard.card.used)} de ${toCurrency(highestCard.card.limit)}. Acompanhe novas compras para evitar pressão na próxima fatura.`,
      });
    }

    if (summary.expense > 0) {
      result.push({
        icon: <PiggyBank />,
        title: `Sua reserva cobre cerca de ${reserveCoverage.toFixed(1).replace('.', ',')} mês(es)`,
        text: `Usando o gasto deste mês como referência, o alvo configurado é ${settings.emergencyReserveMonths} meses. O valor indicativo para esse alvo seria ${toCurrency(summary.expense * settings.emergencyReserveMonths)}.`,
      });
    }

    if (!result.length) {
      result.push({
        icon: <Lightbulb />,
        title: 'Cadastre movimentações para receber dicas personalizadas',
        text: 'Quanto mais receitas, despesas, orçamentos e metas forem registrados, mais específicas serão as recomendações do Conta Certa.',
      });
    }

    return result.slice(0, 7);
  }, [accounts, budgets, cards, categories, currentTransactions, settings.emergencyReserveMonths, summary, transactions]);

  return (
    <div className="page">
      <PageHeader
        title="Inteligência financeira"
        description="Insights, alertas e recomendações calculados a partir dos seus próprios dados financeiros."
      />
      <div className="insights-hero">
        <Sparkles />
        <div>
          <small>Assistente Conta Certa</small>
          <h2>Decisões mais claras, antes que o problema apareça.</h2>
          <p>As recomendações são explicáveis e nunca criam lançamentos sem confirmação.</p>
        </div>
      </div>
      <div className="intelligence-grid">
        <Card className="span-2">
          <h2 className="section-title">Insights para você</h2>
          <div className="large-insight-list">
            {insights.map((insight) => (
              <div key={insight.title} className={`large-insight ${insight.level}`}>
                {insight.level === 'critical' ? <AlertTriangle /> : <CheckCircle2 />}
                <div>
                  <strong>{insight.title}</strong>
                  <p>{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="section-title">Sua meta de economia</h2>
          {goals.length ? (
            goals.slice(0, 1).map((goal) => (
              <div className="goal-mini" key={goal.id}>
                <div
                  className="circular-progress"
                  style={{ '--progress': `${goalProgress(goal) * 3.6}deg` } as CSSProperties}
                >
                  <span>{Math.round(goalProgress(goal))}%</span>
                </div>
                <div>
                  <strong>{goal.name}</strong>
                  <span>Economizado {toCurrency(goal.current)}</span>
                  <span>Faltam {toCurrency(Math.max(goal.target - goal.current, 0))}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="form-hint">Cadastre uma meta para acompanhar o progresso aqui.</p>
          )}
        </Card>

        <Card className="span-2">
          <h2 className="section-title">
            <Calculator /> Simulador de objetivo
          </h2>
          <div className="simulator">
            <label>
              Valor da meta
              <input type="number" value={target} onChange={(event) => setTarget(Number(event.target.value))} />
            </label>
            <label>
              Aporte mensal
              <input type="number" value={monthly} onChange={(event) => setMonthly(Number(event.target.value))} />
            </label>
            <div className="simulation-result">
              <small>Prazo estimado</small>
              <strong>{months} meses</strong>
              <span>Sem considerar rendimento</span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="section-title">
            <Lightbulb /> Dicas financeiras personalizadas
          </h2>
          <div className="tips-list">
            {tips.map((tip) => (
              <div key={tip.title}>
                <span>{tip.icon}</span>
                <div>
                  <strong>{tip.title}</strong>
                  <p>{tip.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
