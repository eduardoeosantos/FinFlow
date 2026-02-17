import Papa from 'papaparse';
import { genId, getCategoryByDesc } from './constants';

/**
 * Parse a CSV bank statement file.
 * Handles common Brazilian bank export formats:
 * - Nubank: date, category, title, amount
 * - Banco do Brasil: data, historico, docto, credito, debito, saldo
 * - Itaú: data, lançamento, ag/origem, valor
 * - Generic: tries to auto-detect columns
 */
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
              importStatus: 'pending', // pending | approved | rejected
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

/**
 * Parse OFX/QFX bank statement file.
 */
export function parseOFX(text) {
  const transactions = [];

  // Extract transactions from STMTTRN blocks
  const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = txRegex.exec(text)) !== null) {
    const block = match[1];

    const getTag = (tag) => {
      const r = new RegExp(`<${tag}>(.+?)(?:<|\\n|\\r)`, 'i');
      const m = block.match(r);
      return m ? m[1].trim() : '';
    };

    const trnType = getTag('TRNTYPE'); // DEBIT, CREDIT, etc.
    const dateStr = getTag('DTPOSTED'); // YYYYMMDD or YYYYMMDDHHMMSS
    const amount = parseFloat(getTag('TRNAMT').replace(',', '.')) || 0;
    const name = getTag('NAME') || getTag('MEMO') || 'Transação importada';
    const memo = getTag('MEMO');

    // Parse date
    let date = '';
    if (dateStr.length >= 8) {
      date = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
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

/**
 * Detect column mapping and extract transaction data from a CSV row.
 */
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
  // Check for separate credit/debit columns
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

/**
 * Normalize various date formats to YYYY-MM-DD
 */
function normalizeDate(str) {
  if (!str) return '';
  str = str.trim().replace(/\//g, '-');

  // DD-MM-YYYY or DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2,'0')}-${brMatch[1].padStart(2,'0')}`;
  }

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2,'0')}-${isoMatch[3].padStart(2,'0')}`;
  }

  // DD/MM/YY
  const shortMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (shortMatch) {
    const yr = parseInt(shortMatch[3]) > 50 ? `19${shortMatch[3]}` : `20${shortMatch[3]}`;
    return `${yr}-${shortMatch[2].padStart(2,'0')}-${shortMatch[1].padStart(2,'0')}`;
  }

  return str;
}

/**
 * Parse Brazilian currency amounts: "1.234,56" or "-R$ 1.234,56"
 */
function parseAmount(str) {
  if (!str) return 0;
  str = str.toString().trim()
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '');

  // Brazilian format: 1.234,56
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }

  const val = parseFloat(str);
  return isNaN(val) ? 0 : val;
}

/**
 * Detect file type and parse accordingly.
 */
export async function parseImportFile(file) {
  const text = await file.text();
  const name = file.name.toLowerCase();

  if (name.endsWith('.ofx') || name.endsWith('.qfx')) {
    return parseOFX(text);
  }

  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    return parseCSV(text, file.name);
  }

  throw new Error('Formato não suportado. Use CSV, OFX ou QFX.');
}
