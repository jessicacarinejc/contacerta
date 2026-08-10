import { describe, expect, it } from 'vitest';
import { parseImageTransactionList } from './image-transaction-parser';

describe('parcelas importadas de imagens', () => {
  it('reconhece PARC na mesma linha da despesa', () => {
    const text = `
Fatura cartão
30/06/2026 L.R. MODA LTD PARC 02/05 R$ 57,59
01/05/2026 EBN TEMU PARC. 04 / 04 R$ 46,51
`;
    const items = parseImageTransactionList(text, 'fatura-2026.jpg');

    expect(items).toHaveLength(2);
    expect(items[0].installment).toEqual({ current: 2, total: 5 });
    expect(items[1].installment).toEqual({ current: 4, total: 4 });
  });

  it('reconhece PARCELA em linha separada sem confundir a data', () => {
    const text = `
Parcelas de compras anteriores
L.r Moda Ltda R$ 57,59
30/06/2026
Parcela 2 de 5
`;
    const [item] = parseImageTransactionList(text, 'fatura.jpg');

    expect(item.date).toBe('2026-06-30');
    expect(item.installment).toEqual({ current: 2, total: 5 });
  });
});
