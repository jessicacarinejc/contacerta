import {
  PdfPasswordError,
  readFinancialDocument,
  type DocumentReadResult,
} from './document-reader';
import { readFinancialImage } from './image-document-reader';
import { refineInvoiceExtraction } from './invoice-refinement';

function finalize(result: DocumentReadResult, fileName: string): DocumentReadResult {
  const refined = refineInvoiceExtraction(result.text, fileName, result.extracted);

  if (refined.documentType !== 'invoice') {
    return { ...result, extracted: refined };
  }

  // Em fatura, o valor confiável para lançamento é a soma das despesas individuais
  // reconhecidas. Pagamentos, créditos, limites, saldos anteriores e totais parcelados
  // nunca entram nessa soma.
  const expenseTotal = refined.items?.length
    ? refined.items.reduce((sum, item) => sum + item.amount, 0)
    : undefined;

  return {
    ...result,
    extracted: {
      ...refined,
      value: expenseTotal,
      itemsTotal: expenseTotal,
    },
  };
}

export async function readFinancialDocumentRefined(
  file: File,
  onProgress?: (progress: number, message: string) => void,
  password?: string,
) {
  return finalize(await readFinancialDocument(file, onProgress, password), file.name);
}

export async function readFinancialImageRefined(
  file: File,
  onProgress?: (progress: number, message: string) => void,
) {
  return finalize(await readFinancialImage(file, onProgress), file.name);
}

export { PdfPasswordError };
