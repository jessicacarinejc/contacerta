import { describe, expect, it } from 'vitest';
import type { ExtractedDocumentData } from '../types/finance';
import { refineInvoiceExtraction } from './invoice-refinement';

describe('mesclagem de parcelas da fatura', () => {
  it('preserva a parcela correta quando uma das leituras perde o metadado', () => {
    const text = `
Fatura cartão
Lançamentos nesta fatura
30/06 L.R. MODA LTD PARC 01/05 SANTO ANTONI BR R$ 57,63
`;
    const base: ExtractedDocumentData = {
      documentType: 'invoice',
      dueDate: '2026-08-06',
      confidence: 0.7,
      items: [
        {
          description: 'L.R. MODA LTD SANTO ANTONI',
          amount: 57.63,
          date: '2026-06-30',
          sourceLine: '30/06 L.R. MODA LTD PARC 01/05 SANTO ANTONI BR R$ 57,63',
        },
      ],
    };

    const result = refineInvoiceExtraction(text, 'fatura.pdf', base);
    expect(result.items).toHaveLength(1);
    expect(result.items?.[0].installment).toEqual({ current: 1, total: 5 });
  });

  it('descarta parcela inválida confundida por outra leitura', () => {
    const text = `
Fatura cartão
Lançamentos nesta fatura
30/06 L.R. MODA LTD PARC 02/05 SANTO ANTONI BR R$ 57,59
`;
    const base: ExtractedDocumentData = {
      documentType: 'invoice',
      dueDate: '2026-09-06',
      confidence: 0.7,
      items: [
        {
          description: 'L.R. MODA LTD SANTO ANTONI',
          amount: 57.59,
          date: '2026-06-30',
          installment: { current: 30, total: 6 },
          sourceLine: '30/06 L.R. MODA LTD PARC 02/05 SANTO ANTONI BR R$ 57,59',
        },
      ],
    };

    const result = refineInvoiceExtraction(text, 'fatura.pdf', base);
    expect(result.items?.[0].installment).toEqual({ current: 2, total: 5 });
  });
});
