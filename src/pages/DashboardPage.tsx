import type { ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  FileScan,
  Lightbulb,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BalanceChart, CategoryChart, IncomeExpenseChart } from '../components/charts/FinanceCharts';
import { Card, CardHeader } from '../components/ui';
import { toCurrency } from '../lib/currency';
import { buildMonthlyFinanceHistory } from '../lib/dashboard-history';
import {
  categoryTotals,
  generateInsights,
  monthTransactions,
  totalBalance,
  totals,
  upcomingBills,
} from '../lib/finance';
import { useFinanceStore } from '../store/useFinanceStore';

function Metric({
  icon,
  title,
  value,
  subtitle,
  tone,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  subtitle: string;
  tone: string;
}) {
  return (
    <Card className={'metric-card ' + tone}>
      <span className="metric-icon">{icon}</span>
      <div className="metric-content">
        <small>{title}</small>
        <strong>{value}</strong>
        <em>{subtitle}</em>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const { transactions, accounts, categories, budgets, goals, documents } = useFinanceStore();
  const recorded = transactions.filter((item) => !item.futureInstallment);
  const current = monthTransactions(recorded);
  const summary = totals(current);
  const balance = totalBalance(accounts);
  const categoriesData = categoryTotals(current, categories);
  const bills = upcomingBills(transactions, 5);
  const insights = generateInsights(recorded, accounts, budgets, goals);
  const history = buildMonthlyFinanceHistory(transactions);
  const recent = recorded
    .filter((item) => item.status !== 'cancelled')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const pendingDocuments = documents.filter((document) => document.status === 'review').length;
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(),
  );

  return (
    <div className="page dashboard-page">
      <section className="overview-hero" aria-label="Resumo financeiro">
        <div className="overview-intro">
          <span className="overview-eyebrow">PAINEL FINANCEIRO · {monthLabel}</span>
          <h1>Seu dinheiro, com mais clareza.</h1>
          <p>Acompanhe o que entrou, o que saiu e seus próximos compromissos.</p>
          <div className="overview-actions">
            <Link className="overview-action-primary" to="/movimentacoes">
              <Plus size={18} aria-hidden="true" /> Lançamentos <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="overview-action-secondary" to="/documentos">
              <FileScan size={18} aria-hidden="true" /> Importar documento
            </Link>
          </div>
        </div>
        <div className="overview-balance">
          <span className="balance-label"><Wallet size={17} aria-hidden="true" /> Saldo disponível</span>
          <strong>{toCurrency(balance)}</strong>
          <small>Saldo informado nas contas ativas</small>
          <Link to="/contas">Ver minhas contas <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>

      <div className="dashboard-section-heading">
        <div>
          <h2>Resumo do mês</h2>
          <p>Valores dos lançamentos registrados em {monthLabel}.</p>
        </div>
        <Link to="/relatorios">Ver relatórios <ArrowRight size={15} /></Link>
      </div>

      <div className="metrics-grid">
        <Metric icon={<TrendingUp />} title="Receitas" value={toCurrency(summary.income)} subtitle="Entradas registradas" tone="green-soft" />
        <Metric icon={<TrendingDown />} title="Despesas" value={toCurrency(summary.expense)} subtitle="Saídas registradas" tone="red" />
        <Metric icon={<CircleDollarSign />} title="Resultado do mês" value={toCurrency(summary.result)} subtitle="Receitas menos despesas" tone="blue" />
        <Metric icon={<CalendarClock />} title="Próximos vencimentos" value={toCurrency(bills.reduce((sum, bill) => sum + bill.amount, 0))} subtitle={bills.length + ' compromisso(s) exibido(s)'} tone="amber" />
      </div>

      <div className="dashboard-grid">
        <Card className="span-2">
          <CardHeader title="Receitas e despesas" description="Últimos seis meses · lançamentos cadastrados" />
          <IncomeExpenseChart data={history} />
        </Card>
        <Card>
          <CardHeader title="Despesas por categoria" description="Distribuição dos gastos do mês" />
          <CategoryChart data={categoriesData} />
        </Card>

        <Card>
          <CardHeader title="Próximos vencimentos" action={<Link to="/contas-a-pagar">Ver todos</Link>} />
          {bills.length ? (
            <div className="due-list">
              {bills.map((bill) => (
                <div key={bill.id}>
                  <span className="due-icon"><CalendarClock /></span>
                  <span>
                    <strong>{bill.description}</strong>
                    <small>{bill.dueDate ? new Date(bill.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}</small>
                  </span>
                  <em>{toCurrency(bill.amount)}</em>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-inline-empty">Nenhum vencimento futuro pendente.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Resultado por mês" description="Diferença entre receitas e despesas registradas" />
          <BalanceChart data={history} />
        </Card>
        <Card>
          <CardHeader title="Insights para você" action={<Link to="/inteligencia">Ver todos</Link>} />
          {insights.length ? (
            <div className="insight-list">
              {insights.slice(0, 3).map((insight) => (
                <div key={insight.title} className={'insight ' + insight.level}>
                  <Lightbulb />
                  <span><strong>{insight.title}</strong><small>{insight.text}</small></span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-inline-empty">Sem alertas financeiros no momento.</p>
          )}
        </Card>
        <Card className="dashboard-recent">
          <CardHeader title="Últimas movimentações" action={<Link to="/movimentacoes">Ver todas</Link>} />
          {recent.length ? (
            <div className="recent-list">
              {recent.map((item) => (
                <div className="recent-item" key={item.id}>
                  <span className={'recent-icon ' + item.type}>
                    {item.type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </span>
                  <span className="recent-description">
                    <strong>{item.description}</strong>
                    <small>{new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}</small>
                  </span>
                  <strong className={'recent-value ' + item.type}>
                    {item.type === 'expense' ? '−' : item.type === 'income' ? '+' : ''}
                    {toCurrency(item.amount)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-inline-empty">Ainda não há movimentações cadastradas.</p>
          )}
        </Card>
        <Card className="document-summary">
          <CardHeader title="Central de documentos" description="Leitura de PDF, imagens e prints" action={<Link to="/documentos">Abrir</Link>} />
          <div className="doc-summary-body">
            <FileScan size={36} />
            <strong>{documents.length} documento(s)</strong>
            <span>{pendingDocuments} aguardando revisão</span>
            <Link to="/documentos">Revisar documentos <ArrowRight size={15} /></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
