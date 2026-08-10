import { Download, FileText, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { BalanceChart, CategoryChart, IncomeExpenseChart } from '../components/charts/FinanceCharts';
import { Button, Card, CardHeader } from '../components/ui';
import { toCurrency } from '../lib/currency';
import { categoryTotals, monthTransactions, totals } from '../lib/finance';
import { isAndroid } from '../lib/platform';
import {
  collectThirdParties,
  filterThirdPartyTransactions,
  normalizeThirdPartyName,
  thirdPartyStatusLabel,
} from '../lib/third-party-report';
import { useFinanceStore } from '../store/useFinanceStore';

async function deliverPdf(pdf: jsPDF, fileName: string, title: string) {
  if (!isAndroid()) {
    pdf.save(fileName);
    return 'downloaded' as const;
  }

  const blob = pdf.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });
  const shareNavigator = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };

  if (
    shareNavigator.share &&
    (!shareNavigator.canShare || shareNavigator.canShare({ files: [file] }))
  ) {
    try {
      await shareNavigator.share({
        title,
        text: 'Relatório gerado pelo Conta Certa.',
        files: [file],
      });
      return 'shared' as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled' as const;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded' as const;
}

export function ReportsPage() {
  const { transactions, categories } = useFinanceStore();
  const current = monthTransactions(transactions.filter((item) => !item.futureInstallment));
  const summary = totals(current);
  const data = categoryTotals(current, categories);
  const thirdParties = useMemo(() => collectThirdParties(transactions), [transactions]);
  const [selectedThirdParty, setSelectedThirdParty] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [generatingThirdPartyReport, setGeneratingThirdPartyReport] = useState(false);
  const thirdPartyTransactions = useMemo(
    () => filterThirdPartyTransactions(transactions, selectedThirdParty),
    [transactions, selectedThirdParty],
  );
  const thirdPartyTotal = thirdPartyTransactions.reduce((sum, item) => sum + item.amount, 0);
  const thirdPartyPaid = thirdPartyTransactions
    .filter((item) => item.status === 'paid' && !item.futureInstallment)
    .reduce((sum, item) => sum + item.amount, 0);
  const thirdPartyPending = thirdPartyTransactions
    .filter((item) => item.status !== 'paid' || item.futureInstallment)
    .reduce((sum, item) => sum + item.amount, 0);

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
    void deliverPdf(pdf, 'conta-certa-relatorio.pdf', 'Relatório Financeiro - Conta Certa');
  }

  async function exportThirdPartyPdf() {
    if (thirdPartyTransactions.length === 0) {
      setReportMessage('Nenhum lançamento de terceiro foi encontrado para gerar o relatório.');
      return;
    }

    setGeneratingThirdPartyReport(true);
    setReportMessage('');

    try {
      const pdf = new jsPDF();
      const selectedName = normalizeThirdPartyName(selectedThirdParty);
      const title = selectedName
        ? `Despesas de terceiro - ${selectedName}`
        : 'Despesas feitas para terceiros';

      pdf.setFontSize(18);
      pdf.text(title, 15, 18);
      pdf.setFontSize(9);
      pdf.text(`Lançamentos: ${thirdPartyTransactions.length}`, 15, 28);
      pdf.text(`Total geral: ${toCurrency(thirdPartyTotal)}`, 15, 34);
      pdf.text(`Realizado: ${toCurrency(thirdPartyPaid)}`, 15, 40);
      pdf.text(`Pendente/futuro: ${toCurrency(thirdPartyPending)}`, 15, 46);

      let y = 58;
      for (const item of thirdPartyTransactions) {
        if (y > 270) {
          pdf.addPage();
          y = 18;
        }

        const date = new Date(`${item.dueDate || item.date}T12:00:00`).toLocaleDateString('pt-BR');
        const installment = item.installment
          ? `Parcela ${item.installment.current}/${item.installment.total}`
          : 'Sem parcela';
        const status = thirdPartyStatusLabel(item);
        const line = `${date} | ${normalizeThirdPartyName(item.thirdParty)} | ${installment} | ${status} | ${toCurrency(item.amount)}`;
        pdf.setFontSize(9);
        pdf.text(line, 15, y);
        y += 5;
        pdf.setFontSize(8);
        const descriptionLines = pdf.splitTextToSize(item.description, 178) as string[];
        pdf.text(descriptionLines, 18, y);
        y += descriptionLines.length * 4 + 3;
      }

      const safeName = selectedName
        ? selectedName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase()
        : 'todos';
      const result = await deliverPdf(
        pdf,
        `conta-certa-terceiros-${safeName}.pdf`,
        title,
      );

      if (result === 'shared') {
        setReportMessage('Relatório gerado. Escolha onde salvar ou compartilhar o PDF.');
      } else if (result === 'downloaded') {
        setReportMessage('Relatório gerado com sucesso.');
      }
    } catch (error) {
      setReportMessage(
        error instanceof Error
          ? `Não foi possível gerar o relatório: ${error.message}`
          : 'Não foi possível gerar o relatório de terceiros.',
      );
    } finally {
      setGeneratingThirdPartyReport(false);
    }
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
          <select
            value={selectedThirdParty}
            onChange={(event) => {
              setSelectedThirdParty(event.target.value);
              setReportMessage('');
            }}
          >
            <option value="">Todos os terceiros</option>
            {thirdParties.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <Button
            onClick={() => void exportThirdPartyPdf()}
            disabled={thirdPartyTransactions.length === 0 || generatingThirdPartyReport}
          >
            <Download size={17} />
            {generatingThirdPartyReport ? 'Gerando...' : 'Gerar relatório por terceiro'}
          </Button>
        </div>

        {reportMessage && <div className="processing-message">{reportMessage}</div>}

        <div className="summary-strip">
          <Card><small>Lançamentos</small><strong>{thirdPartyTransactions.length}</strong></Card>
          <Card><small>Realizado</small><strong>{toCurrency(thirdPartyPaid)}</strong></Card>
          <Card><small>Pendente/futuro</small><strong>{toCurrency(thirdPartyPending)}</strong></Card>
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
                  <th>Situação</th>
                  <th className="right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {thirdPartyTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(`${item.dueDate || item.date}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                    <td><strong>{normalizeThirdPartyName(item.thirdParty)}</strong></td>
                    <td>{item.description}</td>
                    <td>{item.installment ? `${item.installment.current}/${item.installment.total}` : '—'}</td>
                    <td>{thirdPartyStatusLabel(item)}</td>
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
