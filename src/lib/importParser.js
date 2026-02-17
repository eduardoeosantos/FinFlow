import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { genId, getCategoryByDesc } from './constants';

/* ═══════════════════════════════════════════
   DUPLICATE DETECTION
   ═══════════════════════════════════════════ */

/**
 * Generate a fingerprint for a transaction to detect duplicates.
 * Uses date + normalized description + amount for matching.
 */
function txFingerprint(date, description, amount) {
  const d = (date || '').trim();
  const desc = (description || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const amt = Math.abs(parseFloat(amount) || 0).toFixed(2);
  return `${d}|${desc}|${amt}`;
}

/**
 * Check imported transactions against existing ones for duplicates.
 * Returns transactions with `isDuplicate` and `duplicateOf` flags.
 */
export function detectDuplicates(importedTxs, existingTxs) {
  // Build fingerprint set from existing transactions
  const existingPrints = new Set();
  const existingMap = {};

  for (const tx of existingTxs) {
    const fp = txFingerprint(tx.date, tx.description, tx.amount);
    existingPrints.add(fp);
    existingMap[fp] = tx;
  }

  // Also check within the imported batch itself
  const batchPrints = new Set();

  return importedTxs.map(tx => {
    const fp = txFingerprint(tx.date, tx.description, tx.amount);

    // Check against existing transactions
    if (existingPrints.has(fp)) {
      return {
        ...tx,
        isDuplicate: true,
        duplicateOf: existingMap[fp]?.description || 'Transação existente',
        importStatus: 'pending',
      };
    }

    // Check against other items in same import batch
    if (batchPrints.has(fp)) {
      return {
        ...tx,
        isDuplicate: true,
        duplicateOf: 'Duplicada no próprio arquivo',
        importStatus: 'pending',
      };
    }

    batchPrints.add(fp);
    return { ...tx, isDuplicate: false };
  });
}

/* ═══════════════════════════════════════════
   XLSX PARSER
   ═══════════════════════════════════════════ */

/**
 * Parse an Excel (.xlsx, .xls) bank statement file.
 * Reads the first sheet, tries to detect header row and columns.
 */
export function parseXLSX(buffer, fileName = '') {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Planilha vazia.');

  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON with header detection
  // First try with headers from row 1
  let rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  // If first attempt has very few or no usable columns, try raw approach
  if (!rows.length) {
    throw new Error('Planilha vazia ou sem dados reconhecíveis.');
  }

  // Check if headers look valid (have date/amount-like columns)
  const firstRowKeys = Object.keys(rows[0]).map(h => h.toLowerCase().trim());
  const hasDateCol = firstRowKeys.some(k => k.includes('data') || k.includes('date') || k.includes('dt'));
  const hasAmountCol = firstRowKeys.some(k => k.includes('valor') || k.includes('amount') || k.includes('credito') || k.includes('debito') || k.includes('value'));

  // If headers don't look right, maybe the actual headers are in a later row
  if (!hasDateCol && !hasAmountCol) {
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    // Search first 10 rows for a header row
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(10, rawRows.length); i++) {
      const rowStr = rawRows[i].map(c => String(c).toLowerCase()).join(' ');
      if ((rowStr.includes('data') || rowStr.includes('date')) && (rowStr.includes('valor') || rowStr.includes('amount') || rowStr.includes('descri') || rowStr.includes('histor'))) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx >= 0) {
      const headers = rawRows[headerRowIdx].map(h => String(h).trim());
      rows = rawRows.slice(headerRowIdx + 1)
        .filter(r => r.some(cell => cell !== ''))
        .map(r => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = r[i] !== undefined ? r[i] : ''; });
          return obj;
        });
    }
  }

  const transactions = [];
  const headers = Object.keys(rows[0] || {}).map(h => h.toLowerCase().trim());

  for (const row of rows) {
    const normalized = {};
    Object.entries(row).forEach(([k, v]) => {
      const key = k.toLowerCase().trim();
      // Handle Excel Date objects
      if (v instanceof Date) {
        normalized[key] = v.toISOString().split('T')[0];
      } else {
        normalized[key] = String(v || '').trim();
      }
    });

    const tx = detectAndExtract(normalized, headers, fileName);
    if (tx && tx.amount !== 0) {
      transactions.push({
        id: genId(),
        ...tx,
        importStatus: 'pending',
        importSource: fileName,
        importedAt: new Date().toISOString(),
      });
    }
  }

  if (transactions.length === 0) {
    throw new Error('Nenhuma transação encontrada na planilha. Verifique se há colunas de data e valor.');
  }

  return transactions;
}

/* ═══════════════════════════════════════════
   CSV PARSER
   ═══════════════════════════════════════════ */

export function parseCSV(text, fileName = '') {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      encoding: 'UTF-8',
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          reject(new Error('Arquivo CSV vazio ou sem dados'));
          return;
        }

        const headers = Object.keys(results.data[0]).map(h => h.toLowerCase().trim());
        const transactions = [];

        for (const row of results.data) {
          const normalized = {};
          Object.entries(row).forEach(([k, v]) => {
            normalized[k.toLowerCase().trim()] = (v || '').trim();
          });

          const tx = detectAndExtract(normalized, headers, fileName);
          if (tx && tx.amount !== 0) {
            transactions.push({
              id: genId(),
              ...tx,
              importStatus: 'pending',
              importSource: fileName,
              importedAt: new Date().toISOString(),
            });
          }
        }

        if (transactions.length === 0) {
          reject(new Error('Nenhuma transação encontrada. Verifique o formato do CSV.'));
          return;
        }

        resolve(transactions);
      },
      error: (err) => reject(new Error(`Erro ao processar CSV: ${err.message}`)),
    });
  });
}

/* ═══════════════════════════════════════════
   OFX PARSER
   ═══════════════════════════════════════════ */

export function parseOFX(text) {
  const transactions = [];
  const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = txRegex.exec(text)) !== null) {
    const block = match[1];
    const getTag = (tag) => {
      const r = new RegExp(`<${tag}>(.+?)(?:<|\\n|\\r)`, 'i');
      const m = block.match(r);
      return m ? m[1].trim() : '';
    };

    const dateStr = getTag('DTPOSTED');
    const amount = parseFloat(getTag('TRNAMT').replace(',', '.')) || 0;
    const name = getTag('NAME') || getTag('MEMO') || 'Transação importada';
    const memo = getTag('MEMO');

    let date = '';
    if (dateStr.length >= 8) {
      date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }

    const description = memo && memo !== name ? `${name} - ${memo}` : name;
    const category = getCategoryByDesc(description);

    transactions.push({
      id: genId(),
      date,
      description,
      amount,
      type: amount >= 0 ? 'income' : 'expense',
      category,
      importStatus: 'pending',
      importSource: 'OFX',
      importedAt: new Date().toISOString(),
    });
  }

  if (transactions.length === 0) {
    throw new Error('Nenhuma transação encontrada no arquivo OFX.');
  }

  return transactions;
}

/* ═══════════════════════════════════════════
   COLUMN DETECTION (shared by CSV & XLSX)
   ═══════════════════════════════════════════ */

function detectAndExtract(row, headers, fileName) {
  let date = '', description = '', amount = 0, type = 'expense';

  // ── Date detection ──
  const dateKeys = ['data', 'date', 'dt', 'data lançamento', 'data lancamento', 'data transação', 'data da compra', 'data compra'];
  for (const k of dateKeys) {
    if (row[k]) { date = normalizeDate(row[k]); break; }
  }
  if (!date) {
    for (const h of headers) {
      if (h.includes('data') || h.includes('date')) { date = normalizeDate(row[h]); break; }
    }
  }

  // ── Description detection ──
  const descKeys = ['title', 'titulo', 'título', 'descricao', 'descrição', 'description', 'historico', 'histórico', 'lançamento', 'lancamento', 'memo', 'name', 'estabelecimento'];
  for (const k of descKeys) {
    if (row[k]) { description = row[k]; break; }
  }
  if (!description) {
    for (const h of headers) {
      if (h.includes('descri') || h.includes('histor') || h.includes('title') || h.includes('lanc') || h.includes('memo')) {
        description = row[h]; break;
      }
    }
  }

  // ── Amount detection ──
  const creditKeys = ['credito', 'crédito', 'credit', 'valor credito', 'entrada'];
  const debitKeys = ['debito', 'débito', 'debit', 'valor debito', 'saída', 'saida'];
  let foundAmount = false;

  for (const k of creditKeys) {
    if (row[k] && row[k] !== '0' && row[k] !== '0,00' && row[k] !== '') {
      amount = parseAmount(row[k]);
      type = 'income';
      foundAmount = true;
      break;
    }
  }
  if (!foundAmount) {
    for (const k of debitKeys) {
      if (row[k] && row[k] !== '0' && row[k] !== '0,00' && row[k] !== '') {
        amount = -Math.abs(parseAmount(row[k]));
        type = 'expense';
        foundAmount = true;
        break;
      }
    }
  }
  if (!foundAmount) {
    const amountKeys = ['amount', 'valor', 'value', 'quantia', 'total'];
    for (const k of amountKeys) {
      if (row[k]) {
        amount = parseAmount(row[k]);
        type = amount >= 0 ? 'income' : 'expense';
        foundAmount = true;
        break;
      }
    }
  }
  if (!foundAmount) {
    for (const h of headers) {
      if (h.includes('valor') || h.includes('amount') || h.includes('value')) {
        amount = parseAmount(row[h]);
        type = amount >= 0 ? 'income' : 'expense';
        break;
      }
    }
  }

  if (!date || !description) return null;

  const category = getCategoryByDesc(description);
  return { date, description, amount, type, category };
}

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

function normalizeDate(str) {
  if (!str) return '';
  // Already ISO from Excel Date object
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  str = str.trim().replace(/\//g, '-');

  // DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;

  // YYYY-MM-DD (with possible time)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;

  // DD-MM-YY
  const shortMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (shortMatch) {
    const yr = parseInt(shortMatch[3]) > 50 ? `19${shortMatch[3]}` : `20${shortMatch[3]}`;
    return `${yr}-${shortMatch[2].padStart(2, '0')}-${shortMatch[1].padStart(2, '0')}`;
  }

  return str;
}

function parseAmount(str) {
  if (!str) return 0;
  str = str.toString().trim().replace(/R\$\s*/gi, '').replace(/\s/g, '');
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const val = parseFloat(str);
  return isNaN(val) ? 0 : val;
}

/* ═══════════════════════════════════════════
   MAIN ENTRY POINT
   ═══════════════════════════════════════════ */

export async function parseImportFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.ofx') || name.endsWith('.qfx')) {
    const text = await file.text();
    return parseOFX(text);
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    return parseXLSX(buffer, file.name);
  }

  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    const text = await file.text();
    return parseCSV(text, file.name);
  }

  throw new Error('Formato não suportado. Use CSV, XLSX, OFX ou QFX.');
}
