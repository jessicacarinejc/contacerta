import type { ExtractedDocumentItem } from '../types/finance';
import { parseInstallment, stripInstallment } from './installment-parser';

const monthMap: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  março: 3,
  marco: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
};

const moneyPattern = /(?:R\s*\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/gi;
const namedDatePattern = /\b(\d{1,2})(?:\s+de)?\s+(jan(?:eiro)?|fev(?:ereiro)?|mar(?:ço|co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\b/i;
const numericDateOnlyPattern = /^\s*(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\s*$/;
const timeOnlyPattern = /^\s*([01]?\d|2[0-3]):([0-5]\d)\s*$/;
const cardFinalPattern = /\bfinal\s+(\d{4})\b/i;

function normalizeLine(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function currencyToNumber(value: string) {
  return Number(value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
}

function inferReferenceYear(text: string, fileName: string, dueDate?: string) {
  if (dueDate && /^\d{4}-/.test(dueDate)) return Number(dueDate.slice(0, 4));

  const fromFileName = fileName.match(/\b(20\d{2}|19\d{2})\b/);
  if (fromFileName) return Number(fromFileName[1]);

  const fromText = text.match(/\b(20\d{2}|19\d{2})\b/);
  if (fromText) return Number(fromText[1]);

  return new Date().getFullYear();
}

function namedDate(line: string, fallbackYear: number) {
  const match = line.match(namedDatePattern);
  if (!match) return undefined;
  const month = monthMap[match[2].toLowerCase()];
  if (!month) return undefined;
  return `${fallbackYear}-${String(month).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
}

function numericDate(line: string, fallbackYear: number) {
  const match = line.match(numericDateOnlyPattern);
  if (!match) return undefined;
  const year = match[3]
    ? match[3].length === 2
      ? 2000 + Number(match[3])
      : Number(match[3])
    : fallbackYear;
  return `${year}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
}

function inlineDate(line: string, fallbackYear: number) {
  const full = line.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (full) {
    const year = full[3].length === 2 ? 2000 + Number(full[3]) : Number(full[3]);
    return `${year}-${String(Number(full[2])).padStart(2, '0')}-${String(Number(full[1])).padStart(2, '0')}`;
  }

  const short = line.match(/\b(\d{1,2})[./-](\d{1,2})\b/);
  if (short) {
    return `${fallbackYear}-${String(Number(short[2])).padStart(2, '0')}-${String(Number(short[1])).padStart(2, '0')}`;
  }

  return namedDate(line, fallbackYear);
}

function isSummaryOrNavigationLine(line: string) {
  const lower = line.toLowerCase();
  if (!lower) return true;
  if (/^(ago|set|out|nov|dez|jan|fev|mar|abr|mai|jun|jul)(\s+(ago|set|out|nov|dez|jan|fev|mar|abr|mai|jun|jul)){1,}$/.test(lower)) return true;
  if (/^(faturas?|cart[aã]o\b|voltar\b|dashboard\b|documentos\b|movimenta[cç][oõ]es\b|metas\b|perfil\b)/i.test(line)) return true;
  if (/^(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)$/i.test(line)) return true;
  return /(?:total\s+da\s+fatura|valor\s+da\s+fatura|fatura\s+atual|pagamento\s+(?:mínimo|minimo|total)|limite\s+(?:total|disponível|disponivel)|saldo\s+(?:disponível|disponivel|anterior)|melhor\s+dia|vencimento|linha\s+digitável|linha\s+digitavel|código\s+de\s+barras|codigo\s+de\s+barras|parcelamento\s+da\s+fatura|resumo\s+da\s+fatura|encargos\s+de\s+financiamento|taxa\s+de\s+juros|crédito\s+disponível|credito\s+disponivel|fechamento\s+da\s+fatura|melhor\s+dia\s+de\s+compra)/i.test(lower);
}

function isDescriptionCandidate(line: string) {
  if (line.length < 2 || line.length > 120) return false;
  if (isSummaryOrNavigationLine(line)) return false;
  if (cardFinalPattern.test(line)) return false;
  if (timeOnlyPattern.test(line)) return false;
  if (parseInstallment(line)) return false;
  if (numericDateOnlyPattern.test(line) || namedDatePattern.test(line)) return false;
  if (!/[a-zà-ÿ]/i.test(line)) return false;
  return true;
}

function cleanDescription(line: string, amountText?: string) {
  let value = line;
  if (amountText) value = value.replace(amountText, ' ');
  return stripInstallment(value)
    .replace(/R\s*\$/gi, ' ')
    .replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, ' ')
    .replace(namedDatePattern, ' ')
    .replace(cardFinalPattern, ' ')
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, ' ')
    .replace(/[|•›>]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, '')
    .trim();
}

function appendSource(item: ExtractedDocumentItem, line: string) {
  const normalized = normalizeLine(line);
  if (!normalized) return;
  item.sourceLine = item.sourceLine ? `${item.sourceLine} | ${normalized}` : normalized;
}

function deduplicate(items: ExtractedDocumentItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [
      item.date || '',
      item.time || '',
      item.cardLastDigits || '',
      item.description.toLowerCase(),
      item.amount.toFixed(2),
      item.installment?.current || '',
      item.installment?.total || '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseImageTransactionList(
  text: string,
  fileName: string,
  dueDate?: string,
): ExtractedDocumentItem[] {
  const fallbackYear = inferReferenceYear(text, fileName, dueDate);
  const lines = text.split(/\n+/).map(normalizeLine).filter(Boolean);
  const items: ExtractedDocumentItem[] = [];

  let currentDate: string | undefined;
  let pendingDescription = '';
  let afterItem = false;

  for (const line of lines) {
    const last = items[items.length - 1];
    const named = namedDate(line, fallbackYear);
    if (named && !moneyPattern.test(line)) {
      currentDate = named;
      pendingDescription = '';
      afterItem = false;
      moneyPattern.lastIndex = 0;
      continue;
    }
    moneyPattern.lastIndex = 0;

    const numeric = numericDate(line, fallbackYear);
    if (numeric) {
      if (afterItem && last && !last.date) {
        last.date = numeric;
        appendSource(last, line);
      } else {
        currentDate = numeric;
      }
      pendingDescription = '';
      continue;
    }

    const time = line.match(timeOnlyPattern);
    if (time && last && afterItem) {
      last.time = `${time[1].padStart(2, '0')}:${time[2]}`;
      appendSource(last, line);
      continue;
    }

    const cardFinal = line.match(cardFinalPattern);
    if (cardFinal && last && afterItem) {
      last.cardLastDigits = cardFinal[1];
      appendSource(last, line);
      continue;
    }

    const installment = parseInstallment(line);
    if (installment && last && afterItem) {
      last.installment = installment;
      appendSource(last, line);
      continue;
    }

    if (isSummaryOrNavigationLine(line)) {
      pendingDescription = '';
      continue;
    }

    const amountMatches = [...line.matchAll(moneyPattern)];
    moneyPattern.lastIndex = 0;
    if (amountMatches.length) {
      const chosen = amountMatches[amountMatches.length - 1];
      const amount = Math.abs(currencyToNumber(chosen[1]));
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const directDescription = cleanDescription(line, chosen[0]);
      const description = isDescriptionCandidate(directDescription)
        ? directDescription
        : pendingDescription;
      if (!description || !isDescriptionCandidate(description)) {
        pendingDescription = '';
        continue;
      }

      const directDate = inlineDate(line, fallbackYear);
      const directInstallment = parseInstallment(line);
      const directFinal = line.match(cardFinalPattern);
      const directTime = line.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);

      items.push({
        description,
        amount,
        date: directDate || currentDate,
        time: directTime ? `${directTime[1].padStart(2, '0')}:${directTime[2]}` : undefined,
        cardLastDigits: directFinal?.[1],
        installment: directInstallment,
        sourceLine: line,
      });

      pendingDescription = '';
      afterItem = true;
      continue;
    }

    if (isDescriptionCandidate(line)) {
      pendingDescription = line;
      afterItem = false;
    }
  }

  return deduplicate(items);
}

export function looksLikeImageTransactionList(text: string, items: ExtractedDocumentItem[]) {
  if (items.length < 2) return false;
  const lower = text.toLowerCase();
  const contextSignals = [
    /faturas?/,
    /cart[aã]o/,
    /final\s+\d{4}/,
    /parcelas?\s+de\s+compras/,
    /compras\s+anteriores/,
    /extrato/,
    /movimenta[cç][oõ]es/,
    /transa[cç][oõ]es/,
  ].filter((pattern) => pattern.test(lower)).length;
  const monetaryValues = [...text.matchAll(/(?:R\s*\$\s*)?\d+(?:\.\d{3})*,\d{2}/g)].length;
  return contextSignals >= 1 && monetaryValues >= 2;
}
