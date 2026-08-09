import { describe, expect, it } from 'vitest';
import { parseFinancialDocument } from './document-reader';
import { finalizeFinancialResult } from './document-reader-refined';
import { buildFutureInstallments } from './installments';

const petrobrasText = `
PETROBRAS
Olá, JESSICA, esta é a sua fatura de AGOSTO
Valor
R$ 768,80
Vencimento
06/08/2026
Limite único
R$ 21.830,00
Resumo da fatura
Saldo fatura anterior R$ 1.059,75
Pagamentos/Créditos R$ 1.059,75-
Compras nacionais R$ 768,80
Total R$ 768,80
Saldo parcelado em faturas futuras R$ 1.644,37
Lançamentos nesta fatura
JESSICA C J NERI (Cartão 3499)
Data Descrição País Valor
Pagamentos
06/07 PGTO. CASH AG. 0563 000056301 200 10 R$ 1.059,75-
Compras diversas
04/07 POSTO ZAMBAIA SAPEACU BR R$ 120,00
05/07 NiltonCorreia SANTO ANTONIO BR R$ 68,75
Compras/Pgto Contas Parc
Compras diversas
05/03 EBN * PARC 05/05 AMPARO BR R$ 26,54
27/03 EBN * PARC 04/05 CURITIBA BR R$ 19,13
01/04 IMPERADOR AUT PARC 04/04 SANTO ANTONI BR R$ 86,00
01/05 EBN*TEMU COM PARC 03/04 CURITIBA BR R$ 46,51
30/05 CEA SVS 253 E PARC 02/02 SALVADOR BR R$ 64,99
05/06 JIM.COM 50502 PARC 02/04 SANTO ANTONI BR R$ 147,61
30/06 L.R. MODA LTD PARC 01/05 SANTO ANTONI BR R$ 57,63
Hospitais
28/03 EMAGRECENTRO PARC 04/12 SANTO ANTONI BR R$ 131,64
Subtotal R$ 768,80
Total R$ 768,80
Parcelamentos Próxima Fatura
27/03 EBN * PARC 05/05 CURITIBA R$ 19,16
28/03 EMAGRECENTRO PARC 05/12 SANTO ANTONIO R$ 131,64
01/05 EBN*TEMU COM PARC 04/04 CURITIBA R$ 46,51
05/06 JIM.COM 50502 PARC 03/04 SANTO ANTONIO R$ 147,61
30/06 L.R. MODA LTD PARC 02/05 SANTO ANTONIO R$ 57,59
Total parcelado para próxima fatura R$ 402,51
`;

describe('leitura estrita de fatura', () => {
  it('considera somente despesas e ignora pagamento, limite, saldos e totais', () => {
    const base = parseFinancialDocument(petrobrasText, 'PETROBRAS.pdf');
    const result = finalizeFinancialResult(
      { hash: 'test', text: petrobrasText, extracted: base },
      'PETROBRAS.pdf',
    );

    expect(result.extracted.documentType).toBe('invoice');
    expect(result.extracted.items).toHaveLength(10);
    expect(result.extracted.itemsTotal).toBeCloseTo(768.8, 2);
    expect(result.extracted.value).toBeCloseTo(768.8, 2);
    expect(result.extracted.items?.some((item) => /pgto|cash/i.test(item.description))).toBe(false);
    expect(result.extracted.items?.some((item) => item.amount === 1059.75)).toBe(false);
    expect(result.extracted.items?.some((item) => item.amount === 21830)).toBe(false);
    expect(result.extracted.futureItems).toHaveLength(5);
  });

  it('projeta todas as parcelas restantes e usa o valor explícito da próxima parcela', () => {
    const current = {
      description: 'L.R. MODA LTD',
      amount: 57.63,
      installment: { current: 1, total: 5 },
    };
    const explicit = [
      {
        description: 'L.R. MODA LTD',
        amount: 57.59,
        installment: { current: 2, total: 5 },
      },
    ];

    const future = buildFutureInstallments(current, '2026-08-06', explicit);
    expect(future).toHaveLength(4);
    expect(future.map((item) => item.installment.current)).toEqual([2, 3, 4, 5]);
    expect(future.map((item) => item.dueDate)).toEqual([
      '2026-09-06',
      '2026-10-06',
      '2026-11-06',
      '2026-12-06',
    ]);
    expect(future.every((item) => item.amount === 57.59)).toBe(true);
  });
});
