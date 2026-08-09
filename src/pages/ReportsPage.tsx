import { Download, FileText, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { BalanceChart, CategoryChart, IncomeExpenseChart } from '../components/charts/FinanceCharts';
import { Button, Card, CardHeader } from '../components/ui';
import { categoryTotals, monthTransactions, totals } from '../lib/finance';
import { toCurrency } from '../lib/currency';
import { useFinanceStore } from '../store/useFinanceStore';

export function ReportsPage() {
  const { transactions, categories } = useFinanceStore();
  const current = monthTransactions(transactions.filter((item) => !item.futureInstallment));
  const summary = totals(current);
  const data = categoryTotals(current, categories);
  const thirdParties = useMemo(
    () =>
      Array.from(
        new Set(
          transactions
            .filter((item) => item.type === 'expense' && item.thirdParty)
            .map((item) => item.thirdParty!.trim()),
        ),
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [transactions],
  );
  const [selectedThirdParty, setSelectedThirdParty] = useState('');
  const thirdPartyTransactions = useMemo(
    () =>
      transactions
        .filter(
          (item) =>
            item.type === 'expense' &&
            item.thirdParty &&
            (!selectedThirdParty || item.thirdParty === selectedThirdParty),
        )
        .sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date)),
    [transactions, selectedThirdParty],
  );
  const thirdPartyTotal = thirdPartyTransactions.reduce((sum, item) => sum + item.amount, 0);

  function exportPdf() {
    const pdf = new jsPDF();
    pdf.setFontSize(20);
    pdf.text('Conta Certa - Relatório Financeiro', 20, 22);
    pdf.setFontSize(11);
    pdf.text(`Receitas: ${toCurrency(summary.income)}`, 20, 42);
    pdf.text(`Despesas: ${toCurrency(summary.expense)}`, 20, 50);
    pdf.text(`Resultado: ${toCurrency(summary.result)}`, 20, 58);
    pdf.text('Principais categorias:', 20, 76);
    data.slice(0, 8).forEach((item, index) =>
      pdf.text(`${item.name}: ${toCurrency(item.value)}`, 24, 86 + index * 8),
    );
    pdf.save('conta-certa-relatorio.pdf');
  }

  function exportThirdPartyPdf() {
    const pdf = new jsPDF();
    const title = selectedThirdParty
      ? `Despesas de terceiro - ${selectedThirdParty}`
      : 'Despesas de terceiros';
    pdf.setFontSize(18);
    pdf.text(title, 18, 20);
    pdf.setFontSize(10);
    pdf.text(`Total: ${toCurrency(thirdPartyTotal)}`, 18, 30);

    let y = 42;
    for (const item of thirdPartyTransactions) {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }
      const date = new Date(`${item.dueDate || item.date}T12:00:00`).toLocaleDateString('pt-BR');
      const installment = item.installment
        ? ` - parcela ${item.installment.current}/${item.installment.total}`
        : '';
      pdf.text(
        `${date} | ${item.thirdParty} | ${item.description}${installment} | ${toCurrency(item.amount)}`,
        18,
        y,
      );
      y += 7;
    }
    pdf.save(
      selectedThirdParty
        ? `conta-certa-terceiro-${selectedThirdParty.replace(/\s+/g, '-').toLowerCase()}.pdf`
        : 'conta-certa-despesas-terceiros.pdf',
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Relatórios"
        description="Análises gerenciais para compreender a evolução financeira e despesas feitas para terceiros."
        action={
          <>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={17} /> Imprimir
            </Button>
            <Button onClick={exportPdf}>
              <Download size={17} /> Exportar PDF
            </Button>
          </>
        }
      />

      <div className="summary-strip">
        <Card><small>Receitas</small><strong>{toCurrency(summary.income)}</strong></Card>
        <Card><small>Despesas</small><strong>{toCurrency(summary.expense)}</strong></Card>
        <Card><small>Resultado</small><strong>{toCurrency(summary.result)}</strong></Card>
      </div>

      <div className="report-grid">
        <Card className="span-2"><CardHeader title="Desempenho financeiro" /><IncomeExpenseChart /></Card>
        <Card><CardHeader title="Categorias" /><CategoryChart data={data} /></Card>
        <Card className="span-2"><CardHeader title="Evolução do saldo" /><BalanceChart /></Card>
        <Card>
          <div className="feature-callout vertical">
            <FileText />
            <h3>Relatório auditável</h3>
            <p>Os filtros e exportações preservam competência, caixa, conta, categoria e situação.</p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Despesas feitas para terceiros" />
        <div className="table-toolbar">
          <select value={selectedThirdParty} onChange={(event) => setSelectedThirdParty(event.target.value)}>
            <option value="">Todos os terceiros</option>
            {thirdParties.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <Button onClick={exportThirdPartyPdf} disabled={thirdPartyTransactions.length === 0}>
            <Download size={17} /> Gerar relatório por terceiro
          </Button>
        </div>

        <div className="summary-strip">
          <Card><small>Lançamentos</small><strong>{thirdPartyTransactions.length}</strong></Card>
          <Card><small>Total</small><strong>{toCurrency(thirdPartyTotal)}</strong></Card>
        </div>

        {thirdPartyTransactions.length > 0 && (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Data/Vencimento</th>
                  <th>Terceiro</th>
                  <th>Descrição</th>
                  <th>Parcela</th>
                  <th className="right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {thirdPartyTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(`${item.dueDate || item.date}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                    <td><strong>{item.thirdParty}</strong></td>
                    <td>{item.description}</td>
                    <td>{item.installment ? `${item.installment.current}/${item.installment.total}` : '—'}</td>
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
