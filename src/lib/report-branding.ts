import type { jsPDF } from 'jspdf';

const BRAND_BLUE = '#092144';
const BRAND_GREEN = '#279B48';
const TEXT_MUTED = '#667085';

let iconDataUrlPromise: Promise<string | undefined> | undefined;

async function loadBrandIcon() {
  iconDataUrlPromise ??= fetch('/app-icon.png')
    .then((response) => {
      if (!response.ok) throw new Error('Logo não disponível');
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => undefined);
  return iconDataUrlPromise;
}

export function createReportId(prefix = 'CC-RPT') {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

export async function addBrandedHeader(pdf: jsPDF, title: string, subtitle?: string) {
  pdf.setFillColor(BRAND_BLUE);
  pdf.rect(0, 0, 210, 27, 'F');
  pdf.setFillColor(BRAND_GREEN);
  pdf.rect(0, 27, 210, 1.4, 'F');

  const icon = await loadBrandIcon();
  if (icon) {
    try {
      pdf.addImage(icon, 'PNG', 12, 6, 15, 15);
    } catch {
      // O texto da marca mantém o cabeçalho válido mesmo sem a imagem.
    }
  }

  pdf.setTextColor('#FFFFFF');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text('Conta Certa', 31, 13);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.text('Gestão Financeira Inteligente', 31, 19);

  pdf.setTextColor(BRAND_BLUE);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(title, 15, 40);

  if (subtitle) {
    pdf.setTextColor(TEXT_MUTED);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    const lines = pdf.splitTextToSize(subtitle, 180) as string[];
    pdf.text(lines, 15, 46);
    return 46 + lines.length * 4 + 3;
  }

  return 47;
}

export function addSummaryBox(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
) {
  pdf.setDrawColor('#DDE3EA');
  pdf.setFillColor('#F7F9FC');
  pdf.roundedRect(x, y, width, 19, 2, 2, 'FD');
  pdf.setTextColor(TEXT_MUTED);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text(label.toUpperCase(), x + 4, y + 6);
  pdf.setTextColor(BRAND_BLUE);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.text(value, x + 4, y + 14);
}

export function addBrandedFooters(pdf: jsPDF, reportId: string) {
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor('#DDE3EA');
    pdf.line(15, 283, 195, 283);
    pdf.setTextColor(TEXT_MUTED);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text(`Conta Certa · Gestão Financeira Inteligente · ${reportId}`, 15, 289);
    pdf.text(`Página ${page} de ${pageCount}`, 195, 289, { align: 'right' });
  }
}
