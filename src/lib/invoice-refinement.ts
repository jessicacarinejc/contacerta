import type { ExtractedDocumentData, ExtractedDocumentItem } from '../types/finance';

const moneyPattern = /(?:R\s*\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})(-)?/gi;
const installmentPattern = /\b(?:parc(?:ela)?\s*)?(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})\b/i;
const datePattern = /\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/;

const paymentOrCreditPattern =
  /(?:pagamentos?\b|pagamentos?\s*\/\s*cr[eé]ditos?|cr[eé]ditos?\b|pgto\.?\s+cash|estorno\b|reembolso\b|devolu[cç][aã]o\b|ajuste\s+a\s+cr[eé]dito|saldo\s+fatura\s+anterior|saldo\s+anterior)/i;

const informationalPattern =
  /(?:resumo\s+da\s+fatura|subtotal\b|^total\b|^valor$|valor\s+da\s+fatura|compras\s+nacionais|compras\s+internacionais|fatura\s+atual|vencimento|linha\s+digit[aá]vel|c[oó]digo\s+de\s+barras|limite\s+(?:único|unico|total|dispon[ií]vel)|saldo\s+parcelado|total\s+parcelado|p[aá]gina\s+\d+|data\s+descri[cç][aã]o\s+pa[ií]s\s+valor)/i;

function normalizeLine(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function currencyToNumber(value: string) {
  return Number(value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
}

export function normalizeInvoiceDescription(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(installmentPattern, ' ')
    .replace(/\b(?:santo\s+antonio|salvador|curitiba|sapeacu|amparo)\b/g, ' ')
    .replace(/\bbr\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferYear(text: string, dueDate?: string) {
  if (dueDate && /^\d{4}-/.test(dueDate)) return Number(dueDate.slice(0, 4));
  const match = text.match(/\b(20\d{2}|19\d{2})\b/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

function parseDate(line: string, year: number) {
  const match = line.match(datePattern);
  if (!match) return undefined;
  const resolvedYear = match[3]
    ? match[3].length === 2
      ? 2000 + Number(match[3])
      : Number(match[3])
    : year;
  return `${resolvedYear}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
}

function isNegativeAmount(line: string, match: RegExpMatchArray) {
  return match[1]?.startsWith('-') || match[2] === '-' || /R\s*\$\s*-/.test(line);
}

function cleanDescription(line: string, amountText = '') {
  return line
    .replace(amountText, ' ')
    .replace(/R\s*\$/gi, ' ')
    .replace(datePattern, ' ')
    .replace(installmentPattern, ' ')
    .replace(/\b(?:final|cart[aã]o\.?\s*n\.?)\s*\d{4}\b/gi, ' ')
    .replace(/\b(?:br|us)\b/gi, ' ')
    .replace(/[|•›>]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, '')
    .trim();
}

function validDescription(value: string) {
  if (value.length < 2 || value.length > 150) return false;
  if (!/[a-zà-ÿ]/i.test(value)) return false;
  if (paymentOrCreditPattern.test(value) || informationalPattern.test(value)) return false;
  if (/^(?:compras\s+diversas|hospitais|parcelamentos?\s+pr[oó]xima\s+fatura)$/i.test(value)) {
    return false;
  }
  return true;
}

function parseItem(line: string, year: number, pendingDescription = '') {
  const matches = [...line.matchAll(moneyPattern)];
  moneyPattern.lastIndex = 0;
  if (!matches.length) return undefined;

  const chosen = matches[matches.length - 1];
  if (isNegativeAmount(line, chosen)) return undefined;
  if (paymentOrCreditPattern.test(line) || informationalPattern.test(line)) return undefined;

  const amount = currencyToNumber(chosen[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;

  const directDescription = cleanDescription(line, chosen[0]);
  const description = validDescription(directDescription)
    ? directDescription
    : cleanDescription(pendingDescription);
  if (!validDescription(description)) return undefined;

  const installmentMatch = `${pendingDescription} ${line}`.match(installmentPattern);
  return {
    description,
    amount,
    date: parseDate(`${pendingDescription} ${line}`, year),
    installment: installmentMatch
      ? { current: Number(installmentMatch[1]), total: Number(installmentMatch[2]) }
      : undefined,
    sourceLine: pendingDescription ? `${pendingDescription} | ${line}` : line,
  } satisfies ExtractedDocumentItem;
}

function safeBaseItems(items: ExtractedDocumentItem[] | undefined) {
  return (items || []).filter((item) => {
    const text = `${item.description} ${item.sourceLine || ''}`;
    if (paymentOrCreditPattern.test(text) || informationalPattern.test(item.description)) return false;
    if (/R\s*\$\s*[\d.]+,\d{2}-/.test(text)) return false;
    return item.amount > 0 && validDescription(item.description);
  });
}

function deduplicate(items: ExtractedDocumentItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [
      item.date || '',
      normalizeInvoiceDescription(item.description),
      item.amount.toFixed(2),
      item.installment?.current || '',
      item.installment?.total || '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function merge(primary: ExtractedDocumentItem[], fallback: ExtractedDocumentItem[]) {
  const output = [...primary];
  for (const item of fallback) {
    const normalized = normalizeInvoiceDescription(item.description);
    const duplicate = output.some((existing) => {
      const sameDescription = normalizeInvoiceDescription(existing.description) === normalized;
      const sameAmount = Math.abs(existing.amount - item.amount) < 0.01;
      const sameInstallment =
        !existing.installment ||
        !item.installment ||
        (existing.installment.current === item.installment.current &&
          existing.installment.total === item.installment.total);
      return sameDescription && sameAmount && sameInstallment;
    });
    if (!duplicate) output.push(item);
  }
  return deduplicate(output);
}

function parseSections(text: string, dueDate?: string) {
  const year = inferYear(text, dueDate);
  const lines = text.split(/\n+/).map(normalizeLine).filter(Boolean);
  const current: ExtractedDocumentItem[] = [];
  const future: ExtractedDocumentItem[] = [];
  let section: 'unknown' | 'payments' | 'current' | 'future' | 'summary' = 'unknown';
  let pendingDescription = '';

  for (const line of lines) {
    if (/parcelamentos?\s+pr[oó]xima\s+fatura/i.test(line)) {
      section = 'future';
      pendingDescription = '';
      continue;
    }
    if (/^(?:pagamentos?|pagamentos?\s*\/\s*cr[eé]ditos?)$/i.test(line)) {
      section = 'payments';
      pendingDescription = '';
      continue;
    }
    if (/lan[cç]amentos\s+nesta\s+fatura|^compras\s+diversas$|^compras\s*\/\s*pgto\s+contas\s+parc$/i.test(line)) {
      section = 'current';
      pendingDescription = '';
      continue;
    }
    if (/^resumo\s+da\s+fatura$/i.test(line) || /^total\s+parcelado/i.test(line)) {
      section = 'summary';
      pendingDescription = '';
      continue;
    }

    if (section === 'payments' || section === 'summary') continue;
    if (paymentOrCreditPattern.test(line) || informationalPattern.test(line)) {
      pendingDescription = '';
      continue;
    }

    const item = parseItem(line, year, pendingDescription);
    if (item) {
      if (section === 'future') future.push(item);
      else current.push(item);
      pendingDescription = '';
      continue;
    }

    if (validDescription(line) && !datePattern.test(line)) pendingDescription = line;
  }

  return { current: deduplicate(current), future: deduplicate(future) };
}

export function refineInvoiceExtraction(
  text: string,
  _fileName: string,
  base: ExtractedDocumentData,
): ExtractedDocumentData {
  if (base.documentType !== 'invoice' && !/fatura|cart[aã]o|lan[cç]amentos\s+nesta\s+fatura/i.test(text)) {
    return base;
  }

  const parsed = parseSections(text, base.dueDate);
  const futureSourceLines = new Set(parsed.future.map((item) => item.sourceLine));
  const fallback = safeBaseItems(base.items).filter((item) => !futureSourceLines.has(item.sourceLine));
  const items = merge(parsed.current, fallback);
  const itemsTotal = items.length ? items.reduce((sum, item) => sum + item.amount, 0) : undefined;

  return {
    ...base,
    documentType: 'invoice',
    value: itemsTotal,
    items: items.length ? items : undefined,
    itemsTotal,
    futureItems: parsed.future.length ? parsed.future : undefined,
    confidence: Math.min(0.99, Math.max(base.confidence, items.length >= 2 ? 0.84 : base.confidence)),
  };
}
