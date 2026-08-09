import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
import type { ExtractedDocumentData } from '../types/finance';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface DocumentReadResult {
  hash: string;
  text: string;
  extracted: ExtractedDocumentData;
}

const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

function lowerFileName(file: File) {
  return file.name.toLowerCase().split('?')[0];
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || lowerFileName(file).endsWith('.pdf');
}

function isImageFile(file: File) {
  const name = lowerFileName(file);
  return file.type.startsWith('image/') || imageExtensions.some((extension) => name.endsWith(extension));
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'erro desconhecido';
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

async function extractPdfText(file: File) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages, Number(import.meta.env.VITE_OCR_MAX_PAGES || 3));

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }

  return normalizeText(pages.join('\n'));
}

async function renderPdfPages(file: File) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const maxPages = Math.min(pdf.numPages, Number(import.meta.env.VITE_OCR_MAX_PAGES || 3));
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.7 });
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
  const maxDimension = Number(import.meta.env.VITE_OCR_MAX_IMAGE_DIMENSION || 2400);
  const longestSide = Math.max(image.width, image.height);
  const scale = Math.min(maxDimension / Math.max(longestSide, 1), 1.6);

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Não foi possível preparar a imagem.');

  // Fundo branco evita artefatos de OCR em PNG/WebP com transparência.
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

    // Em alguns aparelhos o pacote de idioma português pode falhar na primeira
    // inicialização. O modelo inglês ainda reconhece textos latinos e números,
    // permitindo que o usuário prossiga com a conferência manual.
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
    /(?:valor\s+(?:total|do\s+documento|a\s+pagar)|total\s+a\s+pagar|valor\s+cobrado)\s*[:-]?\s*R?\$?\s*([\d.]+,\d{2})/gi,
    /R\$\s*([\d.]+,\d{2})/g,
  ];

  for (const pattern of patterns) {
    const values = [...text.matchAll(pattern)]
      .map((match) => Number(match[1].replace(/\./g, '').replace(',', '.')))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (values.length) return Math.max(...values);
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
  if (/extrato|saldo anterior|saldo disponível|saldo disponivel/.test(lower)) return 'statement';
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
): Promise<DocumentReadResult> {
  onProgress?.(2, 'Calculando assinatura digital');
  const hash = await hashFile(file);
  let text = '';

  if (isPdfFile(file)) {
    onProgress?.(6, 'Verificando texto selecionável');
    text = await extractPdfText(file);
    if (text.replace(/\s/g, '').length < 80) {
      onProgress?.(8, 'PDF digitalizado detectado');
      text = await runOcr(await renderPdfPages(file), onProgress);
    }
  } else if (isImageFile(file)) {
    onProgress?.(6, 'Preparando imagem');
    text = await runOcr([await imageToCanvas(file)], onProgress);
  } else {
    throw new Error('Formato não suportado. Envie PDF, JPG, JPEG, PNG ou WebP.');
  }

  if (!text.trim()) throw new Error('Nenhum texto foi identificado. Tente uma imagem mais nítida.');
  onProgress?.(96, 'Interpretando dados financeiros');
  const extracted = parseFinancialDocument(text, file.name);
  onProgress?.(100, 'Documento pronto para revisão');
  return { hash, text, extracted };
}
