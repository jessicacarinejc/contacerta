import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';
import type { ExtractedDocumentData } from '../types/finance';

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
  text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

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

async function extractPdfText(file: File, password?: string) {
  const pdf = await openPdf(file, password);
  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages, Number(import.meta.env.VITE_PDF_TEXT_MAX_PAGES || 80));

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }

  return normalizeText(pages.join('\n'));
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
      // Alguns WebViews Android anunciam createImageBitmap, mas não conseguem
      // decodificar arquivos vindos do seletor nativo. O fallback usa uma URL blob.
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
      if (event.status === 'loading tesseract core') {
        onProgress?.(8, 'Carregando mecanismo de OCR');
      } else if (event.status === 'loading language traineddata') {
        onProgress?.(10, 'Carregando idioma do OCR');
      } else if (event.status === 'initializing api') {
        onProgress?.(13, 'Inicializando OCR');
      } else if (event.status === 'recognizing text') {
        onProgress?.(Math.round(event.progress * 78) + 16, 'Reconhecendo o conteúdo');
      }
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

function parseValue(text: string) {
  const patterns = [
    /(?:valor\s+total\s+da\s+fatura|total\s+da\s+fatura|valor\s+da\s+fatura|fatura\s+atual|pagamento\s+total|total\s+a\s+pagar|valor\s+a\s+pagar|valor\s+(?:total|do\s+documento|cobrado))\s*[:-]?\s*R?\$?\s*([\d.]+,\d{2})/gi,
    /(?:total|saldo)\s+(?:desta\s+fatura|da\s+fatura)\s*[:-]?\s*R?\$?\s*([\d.]+,\d{2})/gi,
    /R\$\s*([\d.]+,\d{2})/g,
  ];

  for (const pattern of patterns) {
    const values = [...text.matchAll(pattern)]
      .map((match) => Number(match[1].replace(/\./g, '').replace(',', '.')))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (values.length) return pattern === patterns[2] ? Math.max(...values) : values[0];
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

function detectDocumentType(text: string): ExtractedDocumentData['documentType'] {
  const lower = text.toLowerCase();
  if (/linha digitável|linha digitavel|código de barras|codigo de barras|boleto/.test(lower)) {
    return 'boleto';
  }
  if (/extrato|saldo anterior|saldo disponível|saldo disponivel|<ofx>|<stmtrs>/.test(lower)) {
    return 'statement';
  }
  if (
    /fatura|cartão de crédito|cartao de credito|pagamento mínimo|parcelas? de compras|parcela \d+ de \d+/i.test(
      lower,
    )
  ) {
    return 'invoice';
  }
  if (/cupom fiscal|comprovante|recibo|nota fiscal/.test(lower)) return 'receipt';
  return 'other';
}

export function parseFinancialDocument(text: string, fileName: string): ExtractedDocumentData {
  const value = parseValue(text);
  const dueDate = parseDate(text);
  const beneficiary = parseBeneficiary(text);
  const barcode = parseBarcode(text);
  const criticalFields = [value, dueDate, beneficiary].filter(Boolean).length;

  return {
    documentType: detectDocumentType(text),
    value,
    dueDate,
    beneficiary,
    barcode,
    description: beneficiary || fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
    confidence: Math.min(
      0.99,
      0.48 + criticalFields * 0.13 + (barcode ? 0.08 : 0) + (text.length > 250 ? 0.08 : 0),
    ),
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
    onProgress?.(20, 'Lendo planilha financeira');
    text = await extractSpreadsheetText(file);
  } else if (isTextFinancialFile(file)) {
    onProgress?.(20, 'Lendo arquivo financeiro');
    text = await extractTextFinancialFile(file);
  } else {
    throw new Error(
      'Formato não suportado. Envie PDF, JPG, JPEG, PNG, WebP, BMP, TXT, CSV, OFX, QFX, OFC, XML, JSON, XLS ou XLSX.',
    );
  }

  if (!text.trim()) throw new Error('Nenhum texto foi identificado no documento.');
  onProgress?.(96, 'Interpretando dados financeiros');
  const extracted = parseFinancialDocument(text, file.name);
  onProgress?.(100, 'Documento pronto para revisão');
  return { hash, text, extracted };
}
