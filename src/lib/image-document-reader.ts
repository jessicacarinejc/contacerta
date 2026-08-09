import { createWorker, PSM } from 'tesseract.js';
import { hashFile, parseFinancialDocument, type DocumentReadResult } from './document-reader';
import { looksLikeImageTransactionList, parseImageTransactionList } from './image-transaction-parser';
import type { ExtractedDocumentItem } from '../types/finance';

interface OcrBbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface OcrWordLike {
  text?: string;
  confidence?: number;
  bbox?: OcrBbox;
}

interface OcrLineLike {
  words?: OcrWordLike[];
}

interface OcrParagraphLike {
  lines?: OcrLineLike[];
}

interface OcrBlockLike {
  paragraphs?: OcrParagraphLike[];
}

interface PositionedWord {
  text: string;
  confidence: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  centerY: number;
  height: number;
}

const normalizeText = (text: string) =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'erro desconhecido';
}

async function decodeImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Alguns WebViews Android expõem createImageBitmap, mas falham com arquivos do seletor nativo.
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
  const maxDimension = Number(import.meta.env.VITE_OCR_MAX_IMAGE_DIMENSION || 3000);
  const longestSide = Math.max(image.width, image.height);
  const scale = Math.min(maxDimension / Math.max(longestSide, 1), 1.8);

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Não foi possível preparar a imagem para OCR.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  if ('close' in image && typeof image.close === 'function') image.close();
  return canvas;
}

function flattenWords(blocks: unknown): PositionedWord[] {
  if (!Array.isArray(blocks)) return [];
  const words: PositionedWord[] = [];

  for (const block of blocks as OcrBlockLike[]) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        for (const word of line.words || []) {
          const text = word.text?.trim();
          const bbox = word.bbox;
          if (!text || !bbox) continue;
          const height = Math.max(1, bbox.y1 - bbox.y0);
          words.push({
            text,
            confidence: Number(word.confidence || 0),
            x0: bbox.x0,
            x1: bbox.x1,
            y0: bbox.y0,
            y1: bbox.y1,
            centerY: (bbox.y0 + bbox.y1) / 2,
            height,
          });
        }
      }
    }
  }

  return words;
}

function median(values: number[]) {
  if (!values.length) return 12;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function visualRowsFromWords(words: PositionedWord[]) {
  if (!words.length) return '';
  const reliable = words.filter((word) => word.confidence >= 20);
  const source = reliable.length >= Math.max(4, words.length * 0.45) ? reliable : words;
  const typicalHeight = median(source.map((word) => word.height));
  const tolerance = Math.max(6, typicalHeight * 0.62);

  const rows: Array<{ centerY: number; words: PositionedWord[] }> = [];
  for (const word of [...source].sort((a, b) => a.centerY - b.centerY || a.x0 - b.x0)) {
    let best: { centerY: number; words: PositionedWord[] } | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const row of rows) {
      const distance = Math.abs(row.centerY - word.centerY);
      if (distance <= tolerance && distance < bestDistance) {
        best = row;
        bestDistance = distance;
      }
    }

    if (!best) {
      rows.push({ centerY: word.centerY, words: [word] });
      continue;
    }

    best.words.push(word);
    best.centerY = best.words.reduce((sum, item) => sum + item.centerY, 0) / best.words.length;
  }

  return normalizeText(
    rows
      .sort((a, b) => a.centerY - b.centerY)
      .map((row) =>
        row.words
          .sort((a, b) => a.x0 - b.x0)
          .map((word) => word.text)
          .join(' '),
      )
      .join('\n'),
  );
}

async function createImageOcrWorker(
  language: string,
  onProgress?: (progress: number, message: string) => void,
) {
  const worker = await createWorker(language, 1, {
    workerBlobURL: true,
    logger: (event) => {
      if (event.status === 'loading tesseract core') onProgress?.(10, 'Carregando mecanismo de OCR');
      else if (event.status === 'loading language traineddata') onProgress?.(13, 'Carregando idioma do OCR');
      else if (event.status === 'initializing api') onProgress?.(17, 'Inicializando OCR estruturado');
      else if (event.status === 'recognizing text')
        onProgress?.(Math.round(event.progress * 68) + 22, 'Reconhecendo linhas e valores');
    },
  });

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });
  return worker;
}

async function recognizeStructured(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: number, message: string) => void,
) {
  const configuredLanguage = import.meta.env.VITE_OCR_LANG || 'por';
  let worker: Awaited<ReturnType<typeof createWorker>>;

  try {
    worker = await createImageOcrWorker(configuredLanguage, onProgress);
  } catch (primaryError) {
    if (configuredLanguage === 'eng') {
      throw new Error(
        `Não foi possível iniciar o OCR da imagem. Verifique a conexão com a internet e tente novamente. Detalhe: ${errorMessage(primaryError)}`,
      );
    }
    onProgress?.(14, 'Tentando modo de compatibilidade do OCR');
    try {
      worker = await createImageOcrWorker('eng', onProgress);
    } catch (fallbackError) {
      throw new Error(
        `Não foi possível iniciar o OCR da imagem no aparelho. Detalhe: ${errorMessage(fallbackError)}`,
      );
    }
  }

  try {
    const recognition = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const data = recognition.data as typeof recognition.data & { blocks?: unknown };
    const visualText = visualRowsFromWords(flattenWords(data.blocks));
    const plainText = normalizeText(data.text || '');
    return visualText.length >= 20 ? visualText : plainText;
  } catch (error) {
    throw new Error(`Falha durante a leitura estruturada da imagem: ${errorMessage(error)}`);
  } finally {
    await worker.terminate();
  }
}

function invoiceSummaryTotal(text: string) {
  const patterns = [
    /(?:valor\s+total\s+da\s+fatura|total\s+da\s+fatura|valor\s+da\s+fatura|fatura\s+atual|pagamento\s+total|total\s+a\s+pagar)\s*[:-]?\s*R?\s*\$?\s*([\d.]+,\d{2})/i,
    /(?:total|saldo)\s+(?:desta\s+fatura|da\s+fatura)\s*[:-]?\s*R?\s*\$?\s*([\d.]+,\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = Number(match[1].replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function richerItems(baseItems: ExtractedDocumentItem[] | undefined, imageItems: ExtractedDocumentItem[]) {
  if (!baseItems?.length) return imageItems;
  if (!imageItems.length) return baseItems;
  return imageItems.length >= baseItems.length ? imageItems : baseItems;
}

export async function readFinancialImage(
  file: File,
  onProgress?: (progress: number, message: string) => void,
): Promise<DocumentReadResult> {
  onProgress?.(2, 'Calculando assinatura digital');
  const hash = await hashFile(file);
  onProgress?.(6, 'Preparando imagem para leitura estruturada');
  const canvas = await imageToCanvas(file);
  const text = await recognizeStructured(canvas, onProgress);

  if (!text.trim()) throw new Error('A imagem não contém texto legível para análise.');

  onProgress?.(93, 'Separando movimentações da imagem');
  const base = parseFinancialDocument(text, file.name);
  const imageItems = parseImageTransactionList(text, file.name, base.dueDate);
  const items = richerItems(base.items, imageItems);
  const isTransactionList = looksLikeImageTransactionList(text, items);

  if (!isTransactionList) {
    onProgress?.(100, 'Leitura concluída');
    return { hash, text, extracted: base };
  }

  const itemsTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const actualInvoiceTotal = invoiceSummaryTotal(text);
  const extracted = {
    ...base,
    documentType: 'invoice' as const,
    value: actualInvoiceTotal,
    items,
    itemsTotal,
    confidence: Math.min(0.97, Math.max(base.confidence, 0.68 + Math.min(items.length, 8) * 0.035)),
  };

  onProgress?.(100, `${items.length} movimentação(ões) identificada(s)`);
  return { hash, text, extracted };
}
