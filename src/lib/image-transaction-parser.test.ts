import { describe, expect, it } from 'vitest';
import { looksLikeImageTransactionList, parseImageTransactionList } from './image-transaction-parser';

describe('parseImageTransactionList', () => {
  it('separa individualmente as movimentações de um print de fatura de cartão', () => {
    const text = `
Faturas
Cartao Ame Gold Mastercard
AGO SET OUT
Mercadao R$ 17,89
Final 0652
10:02
03 de agosto, segunda
Mp *verduraodomil R$ 22,80
Final 0652
14:57
31 de julho, sexta
Mercadao R$ 10,60
Final 0652
13:27
Willopetshop R$ 94,00
Final 0652
11:12
Mp *joadsonsantos R$ 20,00
Final 0652
11:03
`;

    const items = parseImageTransactionList(text, 'Screenshot_2026-08-09-18-02-06.jpg');

    expect(items).toHaveLength(5);
    expect(items.map((item) => [item.description, item.amount])).toEqual([
      ['Mercadao', 17.89],
      ['Mp *verduraodomil', 22.8],
      ['Mercadao', 10.6],
      ['Willopetshop', 94],
      ['Mp *joadsonsantos', 20],
    ]);
    expect(items[0]).toMatchObject({ time: '10:02', cardLastDigits: '0652' });
    expect(items[0].date).toBeUndefined();
    expect(items[1]).toMatchObject({ date: '2026-08-03', time: '14:57', cardLastDigits: '0652' });
    expect(items[2]).toMatchObject({ date: '2026-07-31', time: '13:27', cardLastDigits: '0652' });
    expect(items[3]).toMatchObject({ date: '2026-07-31', time: '11:12', cardLastDigits: '0652' });
    expect(items[4]).toMatchObject({ date: '2026-07-31', time: '11:03', cardLastDigits: '0652' });
    expect(looksLikeImageTransactionList(text, items)).toBe(true);
  });

  it('associa data e parcela quando os metadados aparecem nas linhas seguintes', () => {
    const text = `
Parcelas de compras anteriores
L.r Moda Ltda R$ 57,59
Final 3499
30/06/2026
Parcela 2 de 5
Pode antecipar
Jim.com 50502579 Edson Ra R$ 147,61
Final 3499
05/06/2026
Parcela 3 de 4
Pode antecipar
Ebn*temu Com R$ 46,51
Final 3499
01/05/2026
Parcela 4 de 4
`;

    const items = parseImageTransactionList(text, 'fatura.jpg');

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      description: 'L.r Moda Ltda',
      amount: 57.59,
      date: '2026-06-30',
      cardLastDigits: '3499',
      installment: { current: 2, total: 5 },
    });
    expect(items[1]).toMatchObject({
      description: 'Jim.com 50502579 Edson Ra',
      amount: 147.61,
      date: '2026-06-05',
      installment: { current: 3, total: 4 },
    });
    expect(items[2]).toMatchObject({
      description: 'Ebn*temu Com',
      amount: 46.51,
      date: '2026-05-01',
      installment: { current: 4, total: 4 },
    });
  });

  it('não trata um recibo simples com um único valor como lista de movimentações', () => {
    const text = `Comprovante de pagamento\nPadaria Central\nR$ 35,90`;
    const items = parseImageTransactionList(text, 'comprovante.jpg');
    expect(looksLikeImageTransactionList(text, items)).toBe(false);
  });
});
