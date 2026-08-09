import type { ExtractedDocumentData, ExtractedDocumentItem } from '../types/finance';

const moneyPattern = /(?:R\s*\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})(-)?/gi;
const installmentPattern = /\b(?:parc(?:ela)?\s*)?(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})\b/i;
const datePattern = /\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/;

const ignoredLinePattern =
  /(?:pagamentos?\b|pagamentos?\s*\/\s*cr[eé]ditos?|cr[eé]ditos?\b|pgto\.?\b|cash\s+ag\.?\b|estorno\b|reembolso\b|devolu[cç][aã]o\b|ajuste\s+a\s+cr[eé]dito|saldo\s+fatura\s+anterior|saldo\s+anterior|limite\s+(?:único|unico|total|dispon[ií]vel)|saldo\s+parcelado|tarifas?,\s*encargos?\s+e\s+multas?|total\s+parcelado\s+para\s+pr[oó]xima\s+fatura)/i;

const summaryLinePattern =
  /(?:resumo\s+da\s+fatura|subtotal\b|total\s+da\s+fatura|valor\s+da\s+fatura|compras\s+nacionais|compras\s+internacionais|fatura\s+atual|vencimento|linha\s+digit[aá]vel|c[oó]digo\s+de\s+barras|p[aá]gina\s+\d+|jessica\s+c\s+j\s+neri\s*\(cart[aã]o|data\s+descri[cç][aã]o\s+pa[ií]s\s+valor)/i;

function normalizeLine(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function moneyToNumber(value: string) {
  return Number(value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
}

function normalizeDescription(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

function parseDate(line: string, fallbackYear: number) {
  const match = line.match(datePattern);
  if (!match) return undefined;
  const year = match[3]
    ? match[3].length === 2
      ? 2000 + Number(match[3])
      : Number(match[3])
    : fallbackYear;
  return `${year}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
}

function isNegativeMoney(line: string, match: RegExpMatchArray) {
  const captured = match[1] || '';
  const trailing = match[2] || '';
  return captured.startsWith('-') || trailing === '-' || /R\s*\$\s*-/.test(line);
}

function cleanDescription(line: string, amountText: string) {
  return line
    .replace(amountText, ' ')
    .replace(/R\s*\$/gi, ' ')
    .replace(datePattern, ' ')
    .replace(installmentPattern, ' ')
    .replace(/\b(?:final|cart[aã]o\.?\s*n\.?)\s*\d{4}\b/gi, ' ')
    .replace(/\b(?:br|us)\b/gi, ' ')
    .replace(/\b(?:\d{1,3})\b(?=\s*$)/g, ' ')
    .replace(/[|•›>]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, '')
    .trim();
}

function likelyExpenseDescription(value: string) {
  if (value.length < 2 || value.length > 140) return false;
  if (!/[a-zà-ÿ]/i.test(value)) return false;
  if (ignoredLinePattern.test(value) || summaryLinePattern.test(value)) return false;
  if (/^(pagamentos?|compras\s+diversas|hospitais|parcelamentos?\s+pr[oó]xima\s+fatura)$/i.test(value)) {
    return false;
  }
  return true;
}

function parseItemLine(line: string, fallbackYear: number): ExtractedDocumentItem | undefined {
  const matches = [...line.matchAll(moneyPattern)];
  moneyPattern.lastIndex = 0;
  if (!matches.length) return undefined;

  const chosen = matches[matches.length - 1];
  if (isNegativeMoney(line, chosen)) return undefined;
  if (ignoredLinePattern.test(line)) return undefined;

  const amount = moneyToNumber(chosen[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;

  const description = cleanDescription(line, chosen[0]);
  if (!likelyExpenseDescription(description)) return undefined;

  const installmentMatch = line.match(installmentPattern);
  const installment = installmentMatch
    ? { current: Number(installmentMatch[1]), total: Number(installmentMatch[2]) }
    : undefined;

  return {
    description,
    amount,
    date: parseDate(line, fallbackYear),
    installment,
    sourceLine: line,
  };
}

function deduplicate(items: ExtractedDocumentItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [
      item.date || '',
      normalizeDescription(item.description),
      item.amount.toFixed(2),
      item.installment?.current || '',
      item.installment?.total || '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectInvoiceTotal(text: string) {
  const lines = text.split(/\n+/).map(normalizeLine).filter(Boolean);

  const patterns = [
    /^(?:valor|valor\s+da\s+fatura|total\s+da\s+fatura|fatura\s+atual)\s*[:\-]?\s*R\s*\$\s*([\d.]+,\d{2})\s*$/i,
    /^total\s*[:\-]?\s*R\s*\$\s*([\d.]+,\d{2})\s*$/i,
    /^compras\s+nacionais\s*[:\-]?\s*R\s*\$\s*([\d.]+,\d{2})\s*$/i,
  ];

  for (const pattern of patterns) {
    for (const line of lines) {
      if (/saldo|limite|parcelado|pagamento|cr[eé]dito|subtotal/i.test(line)) continue;
      const match = line.match(pattern);
      if (!match?.[1]) continue;
      const value = moneyToNumber(match[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  const compact = text.replace(/[ \t]+/g, ' ');
  const inline = compact.match(
    /(?:valor\s+da\s+fatura|total\s+da\s+fatura|fatura\s+atual)\s*[:\-]?\s*R\s*\$\s*([\d.]+,\d{2})/i,
  );
  if (inline?.[1]) {
    const value = moneyToNumber(inline[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return undefined;
}

function filterBaseExpenses(items: ExtractedDocumentItem[] | undefined) {
  return (items || []).filter((item) => {
    const source = `${item.description} ${item.sourceLine || ''}`;
    if (ignoredLinePattern.test(source)) return false;
    if (/R\s*\$\s*[\d.]+,\d{2}-/.test(source)) return false;
    return item.amount > 0 && likelyExpenseDescription(item.description);
  });
}

function classifySections(text: string, dueDate?: string) {
  const fallbackYear = inferYear(text, dueDate);
  const lines = text.split(/\n+/).map(normalizeLine).filter(Boolean);
  const currentItems: ExtractedDocumentItem[] = [];
  const futureItems: ExtractedDocumentItem[] = [];

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
    if (/^resumo\s+da\s+fatura$/i.test(line)) {
      section = 'summary';
      pendingDescription = '';
      continue;
    }
    if (/^total\s+parcelado\s+para\s+pr[oó]xima\s+fatura/i.test(line)) {
      section = 'summary';
      pendingDescription = '';
      continue;
    }

    if (section === 'payments' || section === 'summary') continue;
    if (ignoredLinePattern.test(line)) {
      pendingDescription = '';
      continue;
    }

    let item = parseItemLine(line, fallbackYear);
    if (!item && pendingDescription) {
      const moneyMatches = [...line.matchAll(moneyPattern)];
      moneyPattern.lastIndex = 0;
      if (moneyMatches.length) {
        const chosen = moneyMatches[moneyMatches.length - 1];
        if (!isNegativeMoney(line, chosen)) {
          const amount = moneyToNumber(chosen[1]);
          if (Number.isFinite(amount) && amount > 0) {
            const installmentMatch = `${pendingDescription} ${line}`.match(installmentPattern);
            item = {
              description: cleanDescription(pendingDescription, ''),
              amount,
              date: parseDate(`${pendingDescription} ${line}`, fallbackYear),
              installment: installmentMatch
                ? { current: Number(installmentMatch[1]), total: Number(installmentMatch[2]) }
                : undefined,
              sourceLine: `${pendingDescription} | ${line}`,
            };
          }
        }
      }
    }

    if (item) {
      if (section === 'future') futureItems.push(item);
      else currentItems.push(item);
      pendingDescription = '';
      continue;
    }

    if (
      !summaryLinePattern.test(line) &&
      !ignoredLinePattern.test(line) &&
      likelyExpenseDescription(line) &&
      !/^\d{1,2}[./-]\d{1,2}/.test(line)
    ) {
      pendingDescription = line;
    }
  }

  return {
    currentItems: deduplicate(currentItems),
    futureItems: deduplicate(futureItems),
  };
}

function mergeItems(primary: ExtractedDocumentItem[], fallback: ExtractedDocumentItem[]) {
  if (!primary.length) return deduplicate(fallback);
  const merged = [...primary];
  for (const item of fallback) {
    const normalized = normalizeDescription(item.description);
    const duplicate = merged.some((existing) => {
      const sameInstallment =
        !item.installment ||
        !existing.installment ||
        (item.installment.current === existing.installment.current &&
          item.installment.total === existing.installment.total);
      return (
        normalizeDescription(existing.description) === normalized &&
        Math.abs(existing.amount - item.amount) < 0.01 &&
        sameInstallment
      );
    });
    if (!duplicate) merged.push(item);
  }
  return deduplicate(merged);
}

export function refineInvoiceExtraction(
  text: string,
  _fileName: string,
  base: ExtractedDocumentData,
): ExtractedDocumentData {
  if (base.documentType !== 'invoice' && !/fatura|cart[aã]o|lan[cç]amentos\s+nesta\s+fatura/i.test(text)) {
    return base;
  }

  const parsed = classifySections(text, base.dueDate);
  const baseExpenses = filterBaseExpenses(base.items);
  const items = mergeItems(parsed.currentItems, baseExpenses).filter(
    (item) => !parsed.futureItems.some((future) => future.sourceLine === item.sourceLine),
  );
  const itemsTotal = items.length ? items.reduce((sum, item) => sum + item.amount, 0) : undefined;
  const invoiceTotal = detectInvoiceTotal(text) || base.value || itemsTotal;

  return {
    ...base,
    documentType: 'invoice',
    value: invoiceTotal,
    items: items.length ? items : undefined,
    itemsTotal,
    futureItems: parsed.futureItems.length ? parsed.futureItems : undefined,
    confidence: Math.min(0.99, Math.max(base.confidence, items.length >= 2 ? 0.82 : base.confidence)),
  };
}

export function normalizeInvoiceDescription(value: string) {
  return normalizeDescription(value);
}
