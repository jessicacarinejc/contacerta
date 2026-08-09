import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';
import type { ExtractedDocumentData, ExtractedDocumentItem } from '../types/finance';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface DocumentReadResult {
  hash: string;
  text: string;
  extracted: ExtractedDocumentData;
}

export class PdfPasswordError extends Error {
  readonly reason: 'required' | 'incorrect';

  constructor(reason: 'required' | 'incorrect') {
    super(
      reason === 'incorrect'
        ? 'A senha informada para este PDF está incorreta.'
        : 'Este PDF é protegido por senha. Informe a senha usada para abrir a fatura.',
    );
    this.name = 'PdfPasswordError';
    this.reason = reason;
  }
}

const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
const textExtensions = ['.txt', '.csv', '.ofx', '.qfx', '.ofc', '.xml', '.json', '.ret', '.rem'];
const spreadsheetExtensions = ['.xls', '.xlsx'];

function lowerFileName(file: File) {
  return file.name.toLowerCase().split('?')[0];
}

function hasExtension(file: File, extensions: string[]) {
  const name = lowerFileName(file);
  return extensions.some((extension) => name.endsWith(extension));
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || lowerFileName(file).endsWith('.pdf');
}

function isImageFile(file: File) {
  return file.type.startsWith('image/') || hasExtension(file, imageExtensions);
}

function isTextFinancialFile(file: File) {
  return (
    file.type.startsWith('text/') ||
    ['application/json', 'application/xml', 'text/xml'].includes(file.type) ||
    hasExtension(file, textExtensions)
  );
}

function isSpreadsheetFile(file: File) {
  return (
    hasExtension(file, spreadsheetExtensions) ||
    file.type === 'application/vnd.ms-excel' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'erro desconhecido';
}

function pdfPasswordReason(error: unknown): 'required' | 'incorrect' | undefined {
  const code = Number((error as { code?: number })?.code);
  const message = errorMessage(error).toLowerCase();
  if (code === 2 || /incorrect password|senha incorreta/.test(message)) return 'incorrect';
  if (code === 1 || /password|senha/.test(message)) return 'required';
  return undefined;
}

export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

const normalizeText = (text: string) =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

async function openPdf(file: File, password?: string) {
  const data = new Uint8Array(await file.arrayBuffer());
  try {
    return await pdfjs.getDocument({ data, password: password || undefined }).promise;
  } catch (error) {
    const reason = pdfPasswordReason(error);
    if (reason) throw new PdfPasswordError(reason);
    throw new Error(`Não foi possível abrir o PDF: ${errorMessage(error)}`);
  }
}

function textContentToLines(items: Array<unknown>) {
  const positioned = items
    .map((raw) => {
      const item = raw as { str?: string; transform?: number[]; width?: number };
      const text = item.str?.trim();
      if (!text) return null;
      const transform = item.transform || [];
      return {
        text,
        x: Number(transform[4] || 0),
        y: Number(transform[5] || 0),
        width: Number(item.width || 0),
      };
    })
    .filter(Boolean) as Array<{ text: string; x: number; y: number; width: number }>;

  if (!positioned.length) return '';

  const rows: Array<{ y: number; items: typeof positioned }> = [];
  for (const item of positioned) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }

  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((row) =>
      row.items
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text)
        .join(' '),
    )
    .join('\n');
}

async function extractPdfText(file: File, password?: string) {
  const pdf = await openPdf(file, password);
  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages, Number(import.meta.env.VITE_PDF_TEXT_MAX_PAGES || 80));

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(textContentToLines(content.items));
  }

  return normalizeText(pages.join('\n\n'));
}

async function renderPdfPages(file: File, password?: string) {
  const pdf = await openPdf(file, password);
  const maxPages = Math.min(pdf.numPages, Number(import.meta.env.VITE_OCR_MAX_PAGES || 12));
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.55 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Não foi possível preparar a página para OCR.');
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    canvases.push(canvas);
  }

  return canvases;
}

async function decodeImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fallback para WebViews Android que não decodificam corretamente arquivos do seletor nativo.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('O Android não conseguiu abrir esta imagem.'));
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function imageToCanvas(file: File) {
  const image = await decodeImage(file);
  const canvas = document.createElement('canvas');
  const maxDimension = Number(import.meta.env.VITE_OCR_MAX_IMAGE_DIMENSION || 2800);
  const longestSide = Math.max(image.width, image.height);
  const scale = Math.min(maxDimension / Math.max(longestSide, 1), 1.6);
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Não foi possível preparar a imagem.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ('close' in image && typeof image.close === 'function') image.close();
  return canvas;
}

async function createOcrWorker(
  language: string,
  onProgress?: (progress: number, message: string) => void,
) {
  return createWorker(language, 1, {
    workerBlobURL: true,
    logger: (event) => {
      if (event.status === 'loading tesseract core') onProgress?.(8, 'Carregando mecanismo de OCR');
      else if (event.status === 'loading language traineddata') onProgress?.(10, 'Carregando idioma do OCR');
      else if (event.status === 'initializing api') onProgress?.(13, 'Inicializando OCR');
      else if (event.status === 'recognizing text')
        onProgress?.(Math.round(event.progress * 78) + 16, 'Reconhecendo o conteúdo');
    },
  });
}

async function runOcr(
  canvases: HTMLCanvasElement[],
  onProgress?: (progress: number, message: string) => void,
) {
  const configuredLanguage = import.meta.env.VITE_OCR_LANG || 'por';
  let worker: Awaited<ReturnType<typeof createWorker>>;

  onProgress?.(7, 'Iniciando OCR');
  try {
    worker = await createOcrWorker(configuredLanguage, onProgress);
  } catch (primaryError) {
    if (configuredLanguage === 'eng') {
      throw new Error(
        `Não foi possível iniciar o OCR. Verifique a conexão com a internet e tente novamente. Detalhe: ${errorMessage(primaryError)}`,
      );
    }
    onProgress?.(9, 'Tentando modo de compatibilidade do OCR');
    try {
      worker = await createOcrWorker('eng', onProgress);
    } catch (fallbackError) {
      throw new Error(
        `Não foi possível iniciar o OCR no aparelho. Verifique a conexão com a internet na primeira leitura e tente novamente. Detalhe: ${errorMessage(fallbackError)}`,
      );
    }
  }

  try {
    const chunks: string[] = [];
    for (let index = 0; index < canvases.length; index += 1) {
      onProgress?.(
        16 + Math.round((index / Math.max(canvases.length, 1)) * 76),
        canvases.length > 1 ? `Lendo página ${index + 1}` : 'Lendo imagem',
      );
      chunks.push((await worker.recognize(canvases[index])).data.text);
    }
    return normalizeText(chunks.join('\n'));
  } catch (error) {
    throw new Error(`Falha durante a leitura OCR: ${errorMessage(error)}`);
  } finally {
    await worker.terminate();
  }
}

async function extractTextFinancialFile(file: File) {
  return normalizeText(await file.text());
}

async function extractSpreadsheetText(file: File) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const chunks: string[] = [];
  const maxSheets = Math.min(workbook.SheetNames.length, 10);
  for (let index = 0; index < maxSheets; index += 1) {
    const sheetName = workbook.SheetNames[index];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    chunks.push(`Planilha: ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet)}`);
  }
  return normalizeText(chunks.join('\n\n'));
}

function parseDate(text: string) {
  const matches = [
    ...text.matchAll(
      /(?:vencimento|vence(?:rá)?|data\s+de\s+vencimento)?\s*[:-]?\s*(\d{2})[./-](\d{2})[./-](\d{4})/gi,
    ),
  ];
  const match = matches.find((item) => /venc/i.test(item[0])) ?? matches[0];
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

const currencyToNumber = (value: string) =>
  Number(value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));

function parseInvoiceTotal(text: string) {
  const patterns = [
    /(?:valor\s+total\s+da\s+fatura|total\s+da\s+fatura|valor\s+da\s+fatura|fatura\s+atual|pagamento\s+total|total\s+a\s+pagar)\s*[:-]?\s*R?\$?\s*([\d.]+,\d{2})/gi,
    /(?:total|saldo)\s+(?:desta\s+fatura|da\s+fatura)\s*[:-]?\s*R?\$?\s*([\d.]+,\d{2})/gi,
  ];
  for (const pattern of patterns) {
    const match = [...text.matchAll(pattern)][0];
    if (match?.[1]) {
      const value = currencyToNumber(match[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return undefined;
}

function parseValue(text: string) {
  const patterns = [
    /(?:total\s+a\s+pagar|valor\s+a\s+pagar|valor\s+(?:total|do\s+documento|cobrado))\s*[:-]?\s*R?\$?\s*([\d.]+,\d{2})/gi,
    /R\$\s*([\d.]+,\d{2})/g,
  ];
  for (const pattern of patterns) {
    const values = [...text.matchAll(pattern)]
      .map((match) => currencyToNumber(match[1]))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (values.length) return pattern === patterns[1] ? Math.max(...values) : values[0];
  }
  return undefined;
}

function parseBeneficiary(text: string) {
  const patterns = [
    /(?:beneficiário|beneficiario|cedente|favorecido|recebedor)\s*[:-]\s*([^\n]{3,80})/i,
    /(?:razão social|razao social)\s*[:-]\s*([^\n]{3,80})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/\s{2,}/g, ' ');
  }
  return undefined;
}

const parseBarcode = (text: string) => {
  const line = text.match(/(?:\d[ .]?){44,48}/)?.[0]?.replace(/\D/g, '');
  return line && line.length >= 44 ? line : undefined;
};

function invoiceScore(lower: string) {
  const markers = [
    /fatura/,
    /cart[aã]o\s+de\s+cr[eé]dito/,
    /compras\s+(?:do|no)\s+cart[aã]o/,
    /parcelas?\s+de\s+compras/,
    /parcela\s+\d+\s+(?:de|\/)\s*\d+/,
    /limite\s+(?:dispon[ií]vel|total)/,
    /pagamento\s+m[ií]nimo/,
    /final\s+\d{4}/,
  ];
  return markers.reduce((score, marker) => score + (marker.test(lower) ? 1 : 0), 0);
}

function detectDocumentType(text: string): ExtractedDocumentData['documentType'] {
  const lower = text.toLowerCase();
  const score = invoiceScore(lower);
  if (score >= 2 || /fatura\s+(?:mensal|do\s+cart[aã]o)/.test(lower)) return 'invoice';
  if (/extrato|saldo anterior|saldo disponível|saldo disponivel|<ofx>|<stmtrs>/.test(lower)) {
    return 'statement';
  }
  if (/linha digitável|linha digitavel|código de barras|codigo de barras|boleto/.test(lower)) {
    return 'boleto';
  }
  if (/cupom fiscal|comprovante|recibo|nota fiscal/.test(lower)) return 'receipt';
  return 'other';
}

const monthMap: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  março: 3,
  marco: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
};

function lineDate(line: string, fallbackYear: number) {
  const full = line.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (full) {
    const year = full[3].length === 2 ? 2000 + Number(full[3]) : Number(full[3]);
    return `${year}-${String(Number(full[2])).padStart(2, '0')}-${String(Number(full[1])).padStart(2, '0')}`;
  }
  const short = line.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (short) {
    return `${fallbackYear}-${String(Number(short[2])).padStart(2, '0')}-${String(Number(short[1])).padStart(2, '0')}`;
  }
  const named = line.match(
    /\b(\d{1,2})(?:\s+de)?\s+(jan(?:eiro)?|fev(?:ereiro)?|mar(?:ço|co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\b/i,
  );
  if (named) {
    const month = monthMap[named[2].toLowerCase()];
    if (month) return `${fallbackYear}-${String(month).padStart(2, '0')}-${String(Number(named[1])).padStart(2, '0')}`;
  }
  return undefined;
}

function isInvoiceSummaryLine(line: string) {
  const lower = line.toLowerCase();
  return /(?:total\s+da\s+fatura|valor\s+da\s+fatura|fatura\s+atual|pagamento\s+(?:mínimo|minimo|total)|limite\s+(?:total|disponível|disponivel)|saldo\s+(?:disponível|disponivel|anterior)|melhor\s+dia|vencimento|linha\s+digitável|linha\s+digitavel|código\s+de\s+barras|codigo\s+de\s+barras|parcelamento\s+da\s+fatura|resumo\s+da\s+fatura|encargos\s+de\s+financiamento|taxa\s+de\s+juros|crédito\s+disponível|credito\s+disponivel)/i.test(
    lower,
  );
}

function cleanInvoiceDescription(line: string, amountText: string) {
  return line
    .replace(amountText, ' ')
    .replace(/R\$/gi, ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, ' ')
    .replace(
      /\b\d{1,2}(?:\s+de)?\s+(?:jan(?:eiro)?|fev(?:ereiro)?|mar(?:ço|co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\b/gi,
      ' ',
    )
    .replace(/\bparcela\s+\d+\s+(?:de|\/)\s*\d+\b/gi, ' ')
    .replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/g, ' ')
    .replace(/\bfinal\s+\d{4}\b/gi, ' ')
    .replace(/\bpode\s+antecipar\b/gi, ' ')
    .replace(/[|•]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, '')
    .trim();
}

function parseInvoiceItems(text: string, dueDate?: string): ExtractedDocumentItem[] {
  const fallbackYear = dueDate ? Number(dueDate.slice(0, 4)) : new Date().getFullYear();
  const output: ExtractedDocumentItem[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.replace(/\s{2,}/g, ' ').trim();
    if (line.length < 5 || isInvoiceSummaryLine(line)) continue;

    const amountMatches = [
      ...line.matchAll(/(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/g),
    ];
    if (!amountMatches.length) continue;

    const chosen = amountMatches[amountMatches.length - 1];
    const amount = Math.abs(currencyToNumber(chosen[1]));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const date = lineDate(line, fallbackYear);
    const installmentMatch = line.match(/(?:parcela\s*)?(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/i);
    const installment = installmentMatch
      ? { current: Number(installmentMatch[1]), total: Number(installmentMatch[2]) }
      : undefined;

    // Uma linha de compra normalmente contém data, parcela ou marcadores de compra/estabelecimento.
    const hasTransactionSignal =
      Boolean(date || installment) ||
      /compra|estabelecimento|lançamento|lancamento|transação|transacao|saque|tarifa|juros|anuidade/i.test(
        line,
      );
    if (!hasTransactionSignal) continue;

    const amountText = chosen[0];
    const description = cleanInvoiceDescription(line, amountText);
    if (description.length < 2 || /^\d+$/.test(description)) continue;

    const fingerprint = `${date || ''}|${description.toLowerCase()}|${amount.toFixed(2)}|${installment?.current || ''}|${installment?.total || ''}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    output.push({ description, amount, date, installment, sourceLine: line });
  }

  return output;
}

export function parseFinancialDocument(text: string, fileName: string): ExtractedDocumentData {
  const documentType = detectDocumentType(text);
  const dueDate = parseDate(text);
  const beneficiary = parseBeneficiary(text);
  const barcode = parseBarcode(text);
  const items = documentType === 'invoice' ? parseInvoiceItems(text, dueDate) : [];
  const itemsTotal = items.length ? items.reduce((sum, item) => sum + item.amount, 0) : undefined;
  const value =
    documentType === 'invoice'
      ? parseInvoiceTotal(text) || itemsTotal
      : parseValue(text);
  const criticalFields = [value, dueDate, beneficiary].filter(Boolean).length;
  const itemBonus = items.length >= 2 ? 0.08 : 0;

  return {
    documentType,
    value,
    dueDate,
    beneficiary,
    barcode,
    description: beneficiary || fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
    confidence: Math.min(
      0.99,
      0.48 + criticalFields * 0.13 + (barcode ? 0.05 : 0) + (text.length > 250 ? 0.08 : 0) + itemBonus,
    ),
    items: items.length ? items : undefined,
    itemsTotal,
  };
}

export async function readFinancialDocument(
  file: File,
  onProgress?: (progress: number, message: string) => void,
  password?: string,
): Promise<DocumentReadResult> {
  onProgress?.(2, 'Calculando assinatura digital');
  const hash = await hashFile(file);
  let text = '';

  if (isPdfFile(file)) {
    onProgress?.(5, 'Abrindo PDF');
    text = await extractPdfText(file, password);
    if (text.replace(/\s/g, '').length < 80) {
      onProgress?.(8, 'PDF digitalizado detectado');
      text = await runOcr(await renderPdfPages(file, password), onProgress);
    }
  } else if (isImageFile(file)) {
    onProgress?.(6, 'Preparando imagem');
    text = await runOcr([await imageToCanvas(file)], onProgress);
  } else if (isSpreadsheetFile(file)) {
    onProgress?.(10, 'Lendo planilha');
    text = await extractSpreadsheetText(file);
  } else if (isTextFinancialFile(file)) {
    onProgress?.(10, 'Lendo arquivo financeiro');
    text = await extractTextFinancialFile(file);
  } else {
    throw new Error('Formato não suportado para leitura financeira.');
  }

  if (!text.trim()) throw new Error('O arquivo não contém texto legível para análise.');
  onProgress?.(94, 'Interpretando dados financeiros');
  const extracted = parseFinancialDocument(text, file.name);
  onProgress?.(100, 'Leitura concluída');
  return { hash, text, extracted };
}
