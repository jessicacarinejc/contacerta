import { Download, FileText, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import {
  BalanceChart,
  CategoryChart,
  IncomeExpenseChart,
} from '../components/charts/FinanceCharts';
import { Button, Card, CardHeader } from '../components/ui';
import { toCurrency } from '../lib/currency';
import { categoryTotals, monthTransactions, totals } from '../lib/finance';
import { exportPdfNative } from '../lib/native-file-export';
import { buildPixPayload, sanitizePixKey } from '../lib/pix';
import {
  addBrandedFooters,
  addBrandedHeader,
  addSummaryBox,
  createReportId,
} from '../lib/report-branding';
import {
  collectThirdParties,
  filterThirdPartyTransactions,
  normalizeThirdPartyName,
  thirdPartyStatusLabel,
} from '../lib/third-party-report';
import { useFinanceStore } from '../store/useFinanceStore';

async function deliverPdf(pdf: jsPDF, fileName: string, title: string) {
  const buffer = pdf.output('arraybuffer');
  const deliveredNatively = await exportPdfNative(buffer, fileName, title);

  if (deliveredNatively) return 'native' as const;

  pdf.save(fileName);
  return 'downloaded' as const;
}

function formattedPixKey(key: string, type?: string) {
  if (type === 'cpf' && /^\d{11}$/.test(key)) {
    return key.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (type === 'cnpj' && /^\d{14}$/.test(key)) {
    return key.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return key;
}

function pdfImageFormat(dataUrl: string) {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
    return 'JPEG';
  }
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
}

export function ReportsPage() {
  const { transactions, categories, settings } = useFinanceStore();
  const current = monthTransactions(transactions.filter((item) => !item.futureInstallment));
  const summary = totals(current);
  const data = categoryTotals(current, categories);
  const thirdParties = useMemo(() => collectThirdParties(transactions), [transactions]);
  const [selectedThirdParty, setSelectedThirdParty] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [generatingThirdPartyReport, setGeneratingThirdPartyReport] = useState(false);
  const [includePix, setIncludePix] = useState(settings.showPixInThirdPartyReports ?? true);
  const [includeQrCode, setIncludeQrCode] = useState(settings.includePixQrCode ?? true);
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
  const pixConfigured = Boolean(
    settings.pixKey?.trim() || settings.pixPayload?.trim() || settings.pixQrCodeImage?.trim(),
  );

  async function exportPdf() {
    const pdf = new jsPDF();
    const reportId = createReportId('CC-FIN');
    let y = await addBrandedHeader(
      pdf,
      'Relatório Financeiro',
      `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    );

    addSummaryBox(pdf, 15, y, 55, 'Receitas', toCurrency(summary.income));
    addSummaryBox(pdf, 77.5, y, 55, 'Despesas', toCurrency(summary.expense));
    addSummaryBox(pdf, 140, y, 55, 'Resultado', toCurrency(summary.result));
    y += 30;

    pdf.setTextColor('#092144');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('Principais categorias', 15, y);
    y += 8;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    data.slice(0, 10).forEach((item) => {
      pdf.text(item.name, 18, y);
      pdf.text(toCurrency(item.value), 195, y, { align: 'right' });
      y += 7;
    });

    addBrandedFooters(pdf, reportId);

    try {
      await deliverPdf(pdf, 'conta-certa-relatorio.pdf', 'Relatório Financeiro - Conta Certa');
    } catch (error) {
      setReportMessage(
        error instanceof Error
          ? `Não foi possível salvar ou compartilhar o relatório: ${error.message}`
          : 'Não foi possível salvar ou compartilhar o relatório.',
      );
    }
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
      const reportId = createReportId('CC-TER');
      let y = await addBrandedHeader(
        pdf,
        title,
        `Demonstrativo gerado em ${new Date().toLocaleString('pt-BR')} · ${thirdPartyTransactions.length} lançamento(s)`,
      );

      addSummaryBox(pdf, 15, y, 40, 'Lançamentos', String(thirdPartyTransactions.length));
      addSummaryBox(pdf, 61.5, y, 40, 'Realizado', toCurrency(thirdPartyPaid));
      addSummaryBox(pdf, 108, y, 40, 'Pendente/futuro', toCurrency(thirdPartyPending));
      addSummaryBox(pdf, 154.5, y, 40, 'Total', toCurrency(thirdPartyTotal));
      y += 28;

      pdf.setTextColor('#092144');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('Detalhamento das despesas', 15, y);
      y += 7;

      for (const item of thirdPartyTransactions) {
        if (y > 260) {
          pdf.addPage();
          y = await addBrandedHeader(pdf, title, 'Continuação do detalhamento');
        }

        const date = new Date(`${item.dueDate || item.date}T12:00:00`).toLocaleDateString('pt-BR');
        const installment = item.installment
          ? `Parcela ${item.installment.current}/${item.installment.total}`
          : 'Sem parcela';
        const status = thirdPartyStatusLabel(item);

        pdf.setFillColor('#F7F9FC');
        pdf.setDrawColor('#E4E9F0');
        pdf.roundedRect(15, y - 3, 180, 16, 1.5, 1.5, 'FD');
        pdf.setTextColor('#092144');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.text(`${date} · ${installment} · ${status}`, 19, y + 2);
        pdf.text(toCurrency(item.amount), 191, y + 2, { align: 'right' });
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor('#475467');
        const descriptionLines = pdf.splitTextToSize(item.description, 145) as string[];
        pdf.text(descriptionLines.slice(0, 2), 19, y + 8);
        y += 20;
      }

      if (includePix && pixConfigured) {
        if (y > 200) {
          pdf.addPage();
          y = await addBrandedHeader(pdf, title, 'Dados para pagamento');
        }

        const normalizedKey = settings.pixKey
          ? sanitizePixKey(settings.pixKey, settings.pixKeyType)
          : '';
        const generatedPayload = normalizedKey
          ? buildPixPayload({
              key: normalizedKey,
              merchantName: settings.pixHolderName || settings.userName,
              merchantCity: settings.pixCity || 'Salvador',
              amount: thirdPartyTotal,
              description: selectedName ? `Reembolso ${selectedName}` : 'Reembolso Conta Certa',
              transactionId: reportId.replace(/[^A-Za-z0-9]/g, '').slice(-25),
            })
          : '';
        const payload = settings.pixPayload?.trim() || generatedPayload;
        const uploadedQr = settings.pixQrCodeImage?.trim();
        const qrDataUrl = includeQrCode
          ? uploadedQr ||
            (payload
              ? await QRCode.toDataURL(payload, {
                  errorCorrectionLevel: 'M',
                  margin: 1,
                  width: 360,
                })
              : undefined)
          : undefined;

        const boxHeight = qrDataUrl ? 84 : payload ? 68 : 54;
        pdf.setFillColor('#F3FAF5');
        pdf.setDrawColor('#279B48');
        pdf.roundedRect(15, y, 180, boxHeight, 2, 2, 'FD');
        pdf.setTextColor('#092144');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('Pagamento via PIX', 20, y + 10);
        pdf.setFontSize(9);
        pdf.text(`Valor do relatório: ${toCurrency(thirdPartyTotal)}`, 20, y + 19);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Titular: ${settings.pixHolderName || settings.userName}`, 20, y + 27);

        let detailY = y + 35;
        if (normalizedKey) {
          pdf.text(
            `Chave PIX (${(settings.pixKeyType || 'chave').toUpperCase()}): ${formattedPixKey(normalizedKey, settings.pixKeyType)}`,
            20,
            detailY,
          );
          detailY += 8;
        }
        if (settings.pixInstitution) {
          pdf.text(`Instituição: ${settings.pixInstitution}`, 20, detailY);
          detailY += 8;
        }

        if (qrDataUrl) {
          pdf.addImage(qrDataUrl, pdfImageFormat(qrDataUrl), 148, y + 8, 40, 40);
        }

        if (payload) {
          pdf.setFontSize(7.2);
          pdf.setTextColor('#475467');
          const copyPasteY = Math.max(detailY + 2, y + 50);
          pdf.text('PIX Copia e Cola:', 20, copyPasteY);
          const payloadLines = pdf.splitTextToSize(payload, qrDataUrl ? 120 : 165) as string[];
          pdf.text(payloadLines.slice(0, qrDataUrl ? 5 : 7), 20, copyPasteY + 5);
        } else if (qrDataUrl) {
          pdf.setFontSize(7.5);
          pdf.setTextColor('#475467');
          pdf.text('Escaneie o QR Code para realizar o pagamento.', 20, detailY + 4);
        }

        y += boxHeight + 6;
      }

      addBrandedFooters(pdf, reportId);

      const safeName = selectedName
        ? selectedName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase()
        : 'todos';
      const result = await deliverPdf(pdf, `conta-certa-terceiros-${safeName}.pdf`, title);

      if (result === 'native') {
        setReportMessage('Relatório pronto. Escolha onde salvar ou compartilhar o PDF.');
      } else {
        setReportMessage('Relatório PDF salvo com sucesso.');
      }
    } catch (error) {
      setReportMessage(
        error instanceof Error
          ? `Não foi possível salvar ou compartilhar o relatório: ${error.message}`
          : 'Não foi possível salvar ou compartilhar o relatório de terceiros.',
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
            <Button onClick={() => void exportPdf()}>
              <Download size={17} /> Exportar PDF
            </Button>
          </>
        }
      />

      <div className="summary-strip">
        <Card>
          <small>Receitas</small>
          <strong>{toCurrency(summary.income)}</strong>
        </Card>
        <Card>
          <small>Despesas</small>
          <strong>{toCurrency(summary.expense)}</strong>
        </Card>
        <Card>
          <small>Resultado</small>
          <strong>{toCurrency(summary.result)}</strong>
        </Card>
      </div>

      <div className="report-grid">
        <Card className="span-2">
          <CardHeader title="Desempenho financeiro" />
          <IncomeExpenseChart />
        </Card>
        <Card>
          <CardHeader title="Categorias" />
          <CategoryChart data={data} />
        </Card>
        <Card className="span-2">
          <CardHeader title="Evolução do saldo" />
          <BalanceChart />
        </Card>
        <Card>
          <div className="feature-callout vertical">
            <FileText />
            <h3>Relatório auditável</h3>
            <p>
              Os filtros e exportações preservam competência, caixa, conta, categoria e situação.
            </p>
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
            {thirdParties.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={includePix}
              onChange={(event) => setIncludePix(event.target.checked)}
              disabled={!pixConfigured}
            />
            Incluir PIX
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={includeQrCode}
              onChange={(event) => setIncludeQrCode(event.target.checked)}
              disabled={!pixConfigured || !includePix}
            />
            QR Code
          </label>
          <Button
            onClick={() => void exportThirdPartyPdf()}
            disabled={thirdPartyTransactions.length === 0 || generatingThirdPartyReport}
          >
            <Download size={17} />
            {generatingThirdPartyReport ? 'Gerando...' : 'Gerar relatório por terceiro'}
          </Button>
        </div>

        {!pixConfigured && (
          <div className="processing-message">
            Cadastre sua chave, PIX Copia e Cola ou QR Code em Perfil para incluí-lo nos relatórios.
          </div>
        )}

        {reportMessage && <div className="processing-message">{reportMessage}</div>}

        <div className="summary-strip">
          <Card>
            <small>Lançamentos</small>
            <strong>{thirdPartyTransactions.length}</strong>
          </Card>
          <Card>
            <small>Realizado</small>
            <strong>{toCurrency(thirdPartyPaid)}</strong>
          </Card>
          <Card>
            <small>Pendente/futuro</small>
            <strong>{toCurrency(thirdPartyPending)}</strong>
          </Card>
          <Card>
            <small>Total</small>
            <strong>{toCurrency(thirdPartyTotal)}</strong>
          </Card>
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
                    <td>
                      {new Date(`${item.dueDate || item.date}T12:00:00`).toLocaleDateString(
                        'pt-BR',
                      )}
                    </td>
                    <td>
                      <strong>{normalizeThirdPartyName(item.thirdParty)}</strong>
                    </td>
                    <td>{item.description}</td>
                    <td>
                      {item.installment
                        ? `${item.installment.current}/${item.installment.total}`
                        : '—'}
                    </td>
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
