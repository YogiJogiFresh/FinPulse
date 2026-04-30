/**
 * CSV Parser for bank credit card statements.
 * Supports: Capital One, Chase, Citi, Synchrony
 * Auto-detects bank from CSV headers.
 */

export interface ParsedTransaction {
  date: string;        // YYYY-MM-DD
  postDate: string;    // YYYY-MM-DD or ''
  description: string;
  amount: number;      // positive = charge/debit, negative = payment/credit
}

export type BankType = 'capital_one' | 'chase' | 'citi' | 'synchrony' | 'unknown';

export interface ParseResult {
  bank: BankType;
  transactions: ParsedTransaction[];
  errors: string[];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.trim().replace(/"/g, '');

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // MM/DD/YYYY
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM-DD-YYYY
  const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, m, d, y] = dashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // YYYY/MM/DD
  const ymdSlash = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlash) {
    const [, y, m, d] = ymdSlash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return cleaned;
}

function detectBank(headers: string[]): BankType {
  const normalized = headers.map(h => h.toLowerCase().replace(/[^a-z]/g, ''));

  // Capital One: "Transaction Date","Posted Date","Card No.","Description","Category","Debit","Credit"
  if (normalized.includes('debit') && normalized.includes('credit') && normalized.includes('cardno')) {
    return 'capital_one';
  }
  // Capital One alternate: "Transaction Date","Posted Date","Description","Debit","Credit"
  if (normalized.includes('debit') && normalized.includes('credit') && normalized.includes('posteddate')) {
    return 'capital_one';
  }

  // Chase: "Transaction Date","Post Date","Description","Category","Type","Amount","Memo"
  if (normalized.includes('type') && normalized.includes('memo') && normalized.includes('postdate')) {
    return 'chase';
  }
  // Chase simpler: "Transaction Date","Post Date","Description","Category","Type","Amount"
  if (normalized.includes('transactiondate') && normalized.includes('postdate') && normalized.includes('amount') && normalized.includes('type')) {
    return 'chase';
  }

  // Citi: "Status","Date","Description","Debit","Credit"
  if (normalized.includes('status') && normalized.includes('debit') && normalized.includes('credit')) {
    return 'citi';
  }

  // Synchrony: "Date","Description","Amount"  (very simple)
  if (normalized.length <= 4 && normalized.includes('date') && normalized.includes('description') && normalized.includes('amount')) {
    return 'synchrony';
  }

  // Fallback detection
  if (normalized.includes('debit') && normalized.includes('credit')) {
    return 'capital_one'; // Best guess for debit/credit format
  }

  if (normalized.includes('amount') && (normalized.includes('transactiondate') || normalized.includes('date'))) {
    return 'chase'; // Best guess for signed amount format
  }

  return 'unknown';
}

function findColumn(headers: string[], ...candidates: string[]): number {
  const normalized = headers.map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate.toLowerCase().replace(/[^a-z]/g, ''));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseCapitalOne(headers: string[], rows: string[][]): { transactions: ParsedTransaction[]; errors: string[] } {
  const dateIdx = findColumn(headers, 'Transaction Date', 'TransactionDate');
  const postIdx = findColumn(headers, 'Posted Date', 'PostedDate');
  const descIdx = findColumn(headers, 'Description');
  const debitIdx = findColumn(headers, 'Debit');
  const creditIdx = findColumn(headers, 'Credit');

  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const date = normalizeDate(row[dateIdx >= 0 ? dateIdx : 0]);
    const postDate = postIdx >= 0 ? normalizeDate(row[postIdx]) : '';
    const desc = row[descIdx >= 0 ? descIdx : 2] || '';
    const debit = parseFloat(row[debitIdx >= 0 ? debitIdx : row.length - 2]) || 0;
    const credit = parseFloat(row[creditIdx >= 0 ? creditIdx : row.length - 1]) || 0;

    if (!date || !desc) {
      errors.push(`Row ${i + 2}: Missing date or description`);
      continue;
    }

    // Debit = positive charge, Credit = negative (payment)
    const amount = debit > 0 ? debit : (credit > 0 ? -credit : 0);
    if (amount === 0 && debit === 0 && credit === 0) {
      errors.push(`Row ${i + 2}: Zero amount skipped`);
      continue;
    }

    transactions.push({ date, postDate, description: desc, amount });
  }

  return { transactions, errors };
}

function parseChase(headers: string[], rows: string[][]): { transactions: ParsedTransaction[]; errors: string[] } {
  const dateIdx = findColumn(headers, 'Transaction Date', 'TransactionDate');
  const postIdx = findColumn(headers, 'Post Date', 'PostDate');
  const descIdx = findColumn(headers, 'Description');
  const amtIdx = findColumn(headers, 'Amount');

  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const date = normalizeDate(row[dateIdx >= 0 ? dateIdx : 0]);
    const postDate = postIdx >= 0 ? normalizeDate(row[postIdx]) : '';
    const desc = row[descIdx >= 0 ? descIdx : 2] || '';
    const rawAmount = parseFloat(row[amtIdx >= 0 ? amtIdx : row.length - 1]);

    if (!date || !desc) {
      errors.push(`Row ${i + 2}: Missing date or description`);
      continue;
    }

    if (isNaN(rawAmount)) {
      errors.push(`Row ${i + 2}: Invalid amount`);
      continue;
    }

    // Chase: negative = charge, positive = payment. We invert: positive = charge
    const amount = -rawAmount;

    transactions.push({ date, postDate, description: desc, amount });
  }

  return { transactions, errors };
}

function parseCiti(headers: string[], rows: string[][]): { transactions: ParsedTransaction[]; errors: string[] } {
  const dateIdx = findColumn(headers, 'Date');
  const descIdx = findColumn(headers, 'Description');
  const debitIdx = findColumn(headers, 'Debit');
  const creditIdx = findColumn(headers, 'Credit');

  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const date = normalizeDate(row[dateIdx >= 0 ? dateIdx : 0]);
    const desc = row[descIdx >= 0 ? descIdx : 1] || '';
    const debit = parseFloat(row[debitIdx >= 0 ? debitIdx : 2]) || 0;
    const credit = parseFloat(row[creditIdx >= 0 ? creditIdx : 3]) || 0;

    if (!date || !desc) {
      errors.push(`Row ${i + 2}: Missing date or description`);
      continue;
    }

    const amount = debit > 0 ? debit : (credit > 0 ? -credit : 0);
    if (amount === 0 && debit === 0 && credit === 0) continue;

    transactions.push({ date, postDate: '', description: desc, amount });
  }

  return { transactions, errors };
}

function parseSynchrony(headers: string[], rows: string[][]): { transactions: ParsedTransaction[]; errors: string[] } {
  const dateIdx = findColumn(headers, 'Date');
  const descIdx = findColumn(headers, 'Description');
  const amtIdx = findColumn(headers, 'Amount');

  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const date = normalizeDate(row[dateIdx >= 0 ? dateIdx : 0]);
    const desc = row[descIdx >= 0 ? descIdx : 1] || '';
    const rawAmount = parseFloat(row[amtIdx >= 0 ? amtIdx : row.length - 1]);

    if (!date || !desc) {
      errors.push(`Row ${i + 2}: Missing date or description`);
      continue;
    }

    if (isNaN(rawAmount)) {
      errors.push(`Row ${i + 2}: Invalid amount`);
      continue;
    }

    // Synchrony: positive = charge typically
    transactions.push({ date, postDate: '', description: desc, amount: rawAmount });
  }

  return { transactions, errors };
}

export function parseCSV(csvContent: string): ParseResult {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);

  if (lines.length < 2) {
    return { bank: 'unknown', transactions: [], errors: ['File is empty or has no data rows'] };
  }

  const headers = parseCSVLine(lines[0]);
  const bank = detectBank(headers);

  const rows = lines.slice(1).map(line => parseCSVLine(line));

  if (bank === 'unknown') {
    // Try generic parse: look for date-like and number-like columns
    return {
      bank: 'unknown',
      transactions: [],
      errors: ['Could not detect bank format. Supported: Capital One, Chase, Citi, Synchrony']
    };
  }

  let result: { transactions: ParsedTransaction[]; errors: string[] };

  switch (bank) {
    case 'capital_one':
      result = parseCapitalOne(headers, rows);
      break;
    case 'chase':
      result = parseChase(headers, rows);
      break;
    case 'citi':
      result = parseCiti(headers, rows);
      break;
    case 'synchrony':
      result = parseSynchrony(headers, rows);
      break;
    default:
      result = { transactions: [], errors: ['Unsupported bank format'] };
  }

  return { bank, ...result };
}
