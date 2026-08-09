import type { ExtractedDocumentItem } from '../types/finance';
import { normalizeInvoiceDescription } from './invoice-refinement';

export interface FutureInstallmentDraft {
  description: string;
  amount: number;
  installment: { current: number; total: number };
  dueDate: string;
}

function addMonths(dateIso: string, months: number) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

function findExplicitFuture(
  current: ExtractedDocumentItem,
  installmentNumber: number,
  futureItems: ExtractedDocumentItem[],
) {
  const currentDescription = normalizeInvoiceDescription(current.description);
  return futureItems.find((candidate) => {
    if (!candidate.installment || candidate.installment.current !== installmentNumber) return false;
    if (candidate.installment.total !== current.installment?.total) return false;
    return normalizeInvoiceDescription(candidate.description) === currentDescription;
  });
}

export function buildFutureInstallments(
  current: ExtractedDocumentItem,
  invoiceDueDate: string | undefined,
  explicitFutureItems: ExtractedDocumentItem[] = [],
): FutureInstallmentDraft[] {
  const installment = current.installment;
  if (!installment || installment.current >= installment.total) return [];

  const baseDueDate = invoiceDueDate || new Date().toISOString().slice(0, 10);
  const drafts: FutureInstallmentDraft[] = [];
  let lastKnownAmount = current.amount;

  for (let number = installment.current + 1; number <= installment.total; number += 1) {
    const explicit = findExplicitFuture(current, number, explicitFutureItems);
    if (explicit?.amount && explicit.amount > 0) lastKnownAmount = explicit.amount;

    drafts.push({
      description: current.description,
      amount: lastKnownAmount,
      installment: { current: number, total: installment.total },
      dueDate: addMonths(baseDueDate, number - installment.current),
    });
  }

  return drafts;
}
