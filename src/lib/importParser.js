import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { genId, getCategoryByDesc } from './constants';

/* ═══════════════════════════════════════════
   DUPLICATE DETECTION
   ═══════════════════════════════════════════ */

function txFingerprint(date, description, amount) {
  const d = (date || '').trim();
  const desc = (description || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const amt = Math.abs(parseFloat(amount) || 0).toFixed(2);
  return `${d}|${desc}|${amt}`;
}

export function detectDuplicates(importedTxs, existingTxs) {
  const existingPrints = new Set();
  const existingMap = {};
  for (const tx of existingTxs) {
    const fp = txFingerprint(tx.date, tx.description, tx.amount);
    existingPrints.add(fp);
    existingMap[fp] = tx;
  }
  const batchPrints = new Set();
  return importedTxs.map(tx => {
    const fp = txFingerprint(tx.date, tx.description, tx.amount);
    if (existingPrints.has(fp)) {
      return { ...tx, isDuplicate: true, duplicateOf: existingMap[fp]?.description || 'Transação existente', importStatus: 'pending' };
    }
    if (batchPrints.has(fp)) {
      return { ...tx, isDuplicate: true, duplicateOf: 'Duplicada no próprio arquivo', importStatus: 'pending' };
    }
    batchPrints.add(fp);
    return { ...tx, isDuplicate: false };
  });
}

/* ═══════════════════════════════════════════
   SANTANDER FATURA PARSER (XLSX)
   ═══════════════════════════════════════════
   Structure:
   Row 1: "Lançamentos"
   Row 2: "Cartão" | "Final XXXX"
   Row 3: "Titular" | "NAME"
   Row 4: "Data" | "Descrição" | "Valor (US$)" | "Valor (R$)"
   Rows 5+: date | description | usd | brl
   ...
   Subtotal row: "01/01/0001" | "Subtotal" | ... | ...
   Then another card section may follow...
   Finally: "Resumo de despesas" section
   ═══════════════════════════════════════════ */

function isSantanderFormat(rows) {
  if (!rows || rows.length < 5) return false;
  const r1 = String(rows[0]?.[0] || '').toLowerCase();
  const r4a = String(rows[3]?.[0] || '').toLowerCase();
  const r4b = String(rows[3]?.[1] || '').toLowerCase();
  return (r1.includes('lançamento') || r1.includes('lancamento')) &&
         (r4a.includes('data') && r4b.includes('descri'));
}

function parseSantanderXLSX(rawRows, fileName) {
  const transactions = [];
  let currentCard = '';
  let inDataSection = false;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const colA = row[0];
    const colB = row[1];
    const colC = row[2];
    const colD = row[3];

    // Detect card header: "Cartão" or "Cartão on-line" in col A
    const colAStr = String(colA || '').toLowerCase();
    if (colAStr.includes('cartão') || colAStr.includes('cartao')) {
      currentCard = String(colB || '').trim(); // "Final 5757"
      inDataSection = false;
      continue;
    }

    // Detect column headers row: "Data" | "Descrição"
    if (colAStr === 'data' && String(colB || '').toLowerCase().includes('descri')) {
      inDataSection = true;
      continue;
    }

    // Skip titular rows
    if (colAStr === 'titular') continue;

    // Stop at "Resumo de despesas" section
    if (String(colB || '').toLowerCase().includes('resumo de despesas')) break;

    // Skip subtotal rows
    if (String(colB || '').toLowerCase() === 'subtotal') {
      inDataSection = false;
      continue;
    }
    if (String(colA || '') === '01/01/0001') continue;

    // Skip empty rows
    if (!colA && !colB) continue;

    // Only process if we're in a data section
    if (!inDataSection) continue;

    // Parse date
    let date = '';
    if (colA instanceof Date) {
      date = colA.toISOString().split('T')[0];
    } else if (typeof colA === 'string') {
      date = normalizeDate(colA);
    }
    if (!date) continue;

    // Parse description
    const description = String(colB || '').trim();
    if (!description) continue;

    // Parse amount (column D = R$)
    const amount = parseFloat(colD) || 0;
    if (amount === 0) continue;

    // Parse USD amount (column C)
    const amountUSD = parseFloat(colC) || 0;

    // Determine type
    // "Pagamento De Fatura" is negative = a payment, we'll mark it as card_payment type
    const descLower = description.toLowerCase();
    const isPayment = descLower.includes('pagamento') && descLower.includes('fatura');
    const type = isPayment ? 'card_payment' : (amount < 0 ? 'income' : 'expense');

    const category = isPayment ? 'pagamento_fatura' : getCategoryByDesc(description);

    transactions.push({
      id: genId(),
      date,
      description: amountUSD > 0 ? `${description} (US$ ${amountUSD.toFixed(2)})` : description,
      amount: type === 'expense' ? -Math.abs(amount) : amount,
      type,
      category,
      cardLabel: currentCard || '',
      importStatus: 'pending',
      importSource: fileName || 'Santander XLSX',
      importedAt: new Date().toISOString(),
    });
  }

  if (transactions.length === 0) {
    throw new Error('Nenhuma transação encontrada na fatura do Santander.');
  }

  return transactions;
}

/* ═══════════════════════════════════════════
   GENERIC XLSX PARSER
   ═══════════════════════════════════════════ */

function parseGenericXLSX(rawRows, fileName) {
  // Try to find header row
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const rowStr = rawRows[i].map(c => String(c || '').toLowerCase()).join(' ');
    if ((rowStr.includes('data') || rowStr.includes('date')) &&
        (rowStr.includes('valor') || rowStr.includes('amount') || rowStr.includes('descri') || rowStr.includes('histor'))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx < 0) {
    // Fallback: assume row 0 is header
    headerRowIdx = 0;
  }

  const headers = rawRows[headerRowIdx].map(h => String(h || '').toLowerCase().trim());
  const transactions = [];

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every(c => c === null || c === undefined || c === '')) continue;

    const normalized = {};
    headers.forEach((h, idx) => {
      const val = row[idx];
      if (val instanceof Date) {
        normalized[h] = val.toISOString().split('T')[0];
      } else {
        normalized[h] = String(val || '').trim();
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
   XLSX ENTRY POINT
   ═══════════════════════════════════════════ */

export function parseXLSX(buffer, fileName = '') {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Planilha vazia.');

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (!rawRows || rawRows.length < 2) throw new Error('Planilha vazia ou sem dados.');

  // Detect format
  if (isSantanderFormat(rawRows)) {
    return parseSantanderXLSX(rawRows, fileName);
  }

  return parseGenericXLSX(rawRows, fileName);
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
            transactions.push({ id: genId(), ...tx, importStatus: 'pending', importSource: fileName, importedAt: new Date().toISOString() });
          }
        }
        if (transactions.length === 0) { reject(new Error('Nenhuma transação encontrada.')); return; }
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
    const getTag = (tag) => { const r = new RegExp(`<${tag}>(.+?)(?:<|\\n|\\r)`, 'i'); const m = block.match(r); return m ? m[1].trim() : ''; };
    const dateStr = getTag('DTPOSTED');
    const amount = parseFloat(getTag('TRNAMT').replace(',', '.')) || 0;
    const name = getTag('NAME') || getTag('MEMO') || 'Transação importada';
    const memo = getTag('MEMO');
    let date = '';
    if (dateStr.length >= 8) { date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`; }
    const description = memo && memo !== name ? `${name} - ${memo}` : name;
    const category = getCategoryByDesc(description);
    transactions.push({ id: genId(), date, description, amount, type: amount >= 0 ? 'income' : 'expense', category, importStatus: 'pending', importSource: 'OFX', importedAt: new Date().toISOString() });
  }
  if (transactions.length === 0) throw new Error('Nenhuma transação encontrada no arquivo OFX.');
  return transactions;
}

/* ═══════════════════════════════════════════
   COLUMN DETECTION (generic CSV & XLSX)
   ═══════════════════════════════════════════ */

function detectAndExtract(row, headers, fileName) {
  let date = '', description = '', amount = 0, type = 'expense';

  const dateKeys = ['data', 'date', 'dt', 'data lançamento', 'data lancamento', 'data transação', 'data da compra', 'data compra'];
  for (const k of dateKeys) { if (row[k]) { date = normalizeDate(row[k]); break; } }
  if (!date) { for (const h of headers) { if (h.includes('data') || h.includes('date')) { date = normalizeDate(row[h]); break; } } }

  const descKeys = ['title', 'titulo', 'título', 'descricao', 'descrição', 'description', 'historico', 'histórico', 'lançamento', 'lancamento', 'memo', 'name', 'estabelecimento'];
  for (const k of descKeys) { if (row[k]) { description = row[k]; break; } }
  if (!description) { for (const h of headers) { if (h.includes('descri') || h.includes('histor') || h.includes('title') || h.includes('lanc') || h.includes('memo')) { description = row[h]; break; } } }

  const creditKeys = ['credito', 'crédito', 'credit', 'valor credito', 'entrada'];
  const debitKeys = ['debito', 'débito', 'debit', 'valor debito', 'saída', 'saida'];
  let foundAmount = false;
  for (const k of creditKeys) { if (row[k] && row[k] !== '0' && row[k] !== '0,00' && row[k] !== '') { amount = parseAmount(row[k]); type = 'income'; foundAmount = true; break; } }
  if (!foundAmount) { for (const k of debitKeys) { if (row[k] && row[k] !== '0' && row[k] !== '0,00' && row[k] !== '') { amount = -Math.abs(parseAmount(row[k])); type = 'expense'; foundAmount = true; break; } } }
  if (!foundAmount) {
    const amountKeys = ['amount', 'valor', 'value', 'quantia', 'total', 'valor (r$)', 'valor(r$)'];
    for (const k of amountKeys) { if (row[k]) { amount = parseAmount(row[k]); type = amount >= 0 ? 'income' : 'expense'; foundAmount = true; break; } }
  }
  if (!foundAmount) { for (const h of headers) { if (h.includes('valor') || h.includes('amount') || h.includes('value')) { amount = parseAmount(row[h]); type = amount >= 0 ? 'income' : 'expense'; break; } } }

  if (!date || !description) return null;
  const category = getCategoryByDesc(description);
  return { date, description, amount, type, category };
}

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

function normalizeDate(str) {
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  str = str.trim().replace(/\//g, '-');
  const brMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  const shortMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (shortMatch) { const yr = parseInt(shortMatch[3]) > 50 ? `19${shortMatch[3]}` : `20${shortMatch[3]}`; return `${yr}-${shortMatch[2].padStart(2, '0')}-${shortMatch[1].padStart(2, '0')}`; }
  return str;
}

function parseAmount(str) {
  if (!str) return 0;
  str = str.toString().trim().replace(/R\$\s*/gi, '').replace(/\s/g, '');
  if (str.includes(',')) { str = str.replace(/\./g, '').replace(',', '.'); }
  const val = parseFloat(str);
  return isNaN(val) ? 0 : val;
}

/* ═══════════════════════════════════════════
   MAIN ENTRY POINT
   ═══════════════════════════════════════════ */

export async function parseImportFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.ofx') || name.endsWith('.qfx')) { const text = await file.text(); return parseOFX(text); }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) { const buffer = await file.arrayBuffer(); return parseXLSX(buffer, file.name); }
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) { const text = await file.text(); return parseCSV(text, file.name); }
  throw new Error('Formato não suportado. Use CSV, XLSX, OFX ou QFX.');
}
