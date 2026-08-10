export interface ParsedInstallment {
  current: number;
  total: number;
}

// Exige uma palavra explícita de parcela para nunca confundir datas como 30/06 com 30 de 6.
// Aceita formatos comuns de PDF/OCR: PARC 01/05, PARC. 01 / 05, PARCELA 1 DE 4,
// PARCELA: 2/5 e variações de espaçamento.
export const installmentTextPattern =
  /\bparc(?:\.|ela)?\s*[:#-]?\s*(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})\b/i;

export function parseInstallment(value: string): ParsedInstallment | undefined {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
  const match = normalized.match(installmentTextPattern);
  if (!match) return undefined;

  const current = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isInteger(current) || !Number.isInteger(total)) return undefined;
  if (current < 1 || total < 1 || current > total || total > 99) return undefined;
  return { current, total };
}

export function hasInstallment(value: string) {
  return Boolean(parseInstallment(value));
}

export function stripInstallment(value: string) {
  return value.replace(installmentTextPattern, ' ');
}

export function validInstallment(
  installment?: { current: number; total: number },
): installment is ParsedInstallment {
  return Boolean(
    installment &&
      Number.isInteger(installment.current) &&
      Number.isInteger(installment.total) &&
      installment.current >= 1 &&
      installment.total >= 1 &&
      installment.current <= installment.total &&
      installment.total <= 99,
  );
}
