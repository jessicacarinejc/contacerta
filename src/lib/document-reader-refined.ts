import {
  PdfPasswordError,
  readFinancialDocument,
  type DocumentReadResult,
} from './document-reader';
import { readFinancialImage } from './image-document-reader';
import { refineInvoiceExtraction } from './invoice-refinement';
import type { ExtractedDocumentItem } from '../types/finance';

function isSafeExpenseItem(item: ExtractedDocumentItem) {
  const text = `${item.description} ${item.sourceLine || ''}`.toLowerCase();
  if (!item.description.trim() || item.amount <= 0) return false;
  if (/^(?:total|subtotal|valor|saldo|pagamento|pagamentos|cr[eé]dito|cr[eé]ditos)$/i.test(item.description.trim())) {
    return false;
  }
  if (
    /(?:saldo\s+fatura\s+anterior|pagamentos?\s*\/\s*cr[eé]ditos?|pgto\.?\s+cash|pagamento\s+recebido|estorno|reembolso|devolu[cç][aã]o|limite\s+(?:único|unico|total|dispon[ií]vel)|total\s+parcelado|resumo\s+da\s+fatura)/i.test(
      text,
    )
  ) {
    return false;
  }
  if (/r\s*\$\s*[\d.]+,\d{2}-/.test(text)) return false;
  return true;
}

export function finalizeFinancialResult(
  result: DocumentReadResult,
  fileName: string,
): DocumentReadResult {
  const refined = refineInvoiceExtraction(result.text, fileName, result.extracted);

  if (refined.documentType !== 'invoice') {
    return { ...result, extracted: refined };
  }

  const expenses = (refined.items || []).filter(isSafeExpenseItem);
  const futureItems = (refined.futureItems || []).filter(isSafeExpenseItem);

  // Em fatura, o total usado pelo Conta Certa é calculado exclusivamente a partir
  // das despesas individuais reconhecidas. Assim saldo anterior, pagamentos/créditos,
  // limite do cartão e linhas de total informativas nunca alteram o valor da fatura.
  const expenseTotal = expenses.length
    ? expenses.reduce((sum, item) => sum + item.amount, 0)
    : undefined;

  return {
    ...result,
    extracted: {
      ...refined,
      value: expenseTotal,
      items: expenses.length ? expenses : undefined,
      itemsTotal: expenseTotal,
      futureItems: futureItems.length ? futureItems : undefined,
    },
  };
}

export async function readFinancialDocumentRefined(
  file: File,
  onProgress?: (progress: number, message: string) => void,
  password?: string,
) {
  return finalizeFinancialResult(await readFinancialDocument(file, onProgress, password), file.name);
}

export async function readFinancialImageRefined(
  file: File,
  onProgress?: (progress: number, message: string) => void,
) {
  return finalizeFinancialResult(await readFinancialImage(file, onProgress), file.name);
}

export { PdfPasswordError };
