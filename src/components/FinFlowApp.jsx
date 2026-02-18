'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DEFAULT_EXPENSE_CATS, DEFAULT_INCOME_CATS, MONTHS, MONTHS_FULL, formatBRL, genId, getCategoryByDesc, getCatBudget, getCatBudgetRange } from '@/lib/constants';
import { loadData, saveData } from '@/lib/storage';
import { computeForecast } from '@/lib/forecast';
import { generatePredictions, getMonthlyBudgetTarget } from '@/lib/predictions';
import { parseImportFile, detectDuplicates } from '@/lib/importParser';
import IconPicker from './IconPicker';
import { renderIcon, GlassIcon, NAV_ICON_MAP, GLASS_ICONS } from './GlassIcons';
// Helper: icon text for <option> tags where SVG cant render
const iconText = (icon) => { if (!icon) return ''; if (typeof icon === 'string' && icon.length > 2) return GLASS_ICONS[icon]?.l ? `◆` : '◆'; return icon; };

const today = new Date();
const cm = today.getMonth(), cy = today.getFullYear();
const getLocalDateStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const todayStr = getLocalDateStr();

function generateSampleData() {
  const tx = [];
  const types = [
    { desc: 'Supermercado Pão de Açúcar', cat: 'alimentacao', min: 150, max: 600 },
    { desc: 'iFood', cat: 'alimentacao', min: 25, max: 80 },
    { desc: 'Uber', cat: 'transporte', min: 15, max: 45 },
    { desc: 'Combustível Shell', cat: 'transporte', min: 180, max: 350 },
    { desc: 'Aluguel', cat: 'moradia', min: 2800, max: 2800 },
    { desc: 'Condomínio', cat: 'moradia', min: 450, max: 450 },
    { desc: 'Plano Unimed', cat: 'saude', min: 380, max: 380 },
    { desc: 'Netflix', cat: 'lazer', min: 55, max: 55 },
    { desc: 'CEMIG Energia', cat: 'servicos', min: 180, max: 350 },
  ];
  for (let m = 0; m < 6; m++) {
    const month = cm - 5 + m, yr = month < 0 ? cy - 1 : cy, mo = ((month % 12) + 12) % 12;
    for (let i = 0; i < 10 + Math.floor(Math.random() * 6); i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const day = 1 + Math.floor(Math.random() * 27);
      tx.push({ id: genId(), date: `${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`, description: t.desc, category: t.cat, amount: -(t.min + Math.random() * (t.max - t.min)), type: 'expense', accountId: 'acc1' });
    }
    tx.push({ id: genId(), date: `${yr}-${String(mo+1).padStart(2,'0')}-05`, description: 'Salário DSA', category: 'salario', amount: 12000, type: 'income', accountId: 'acc1' });
  }
  return tx.sort((a, b) => b.date.localeCompare(a.date));
}

function BgMesh() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a0015 0%, #0d0030 25%, #050520 50%, #001a1a 75%, #000d1a 100%)' }} />
      <div className="orb orb1" /><div className="orb orb2" /><div className="orb orb3" /><div className="orb orb4" /><div className="orb orb5" />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.02, backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
    </div>
  );
}

function GlassRing({ value, max, size = 60, color = '#B24DFF' }) {
  const pct = Math.min((value / (max || 1)) * 100, 100);
  const r = (size - 10) / 2, circ = 2 * Math.PI * r, offset = circ - (pct / 100) * circ;
  const c = value > max ? '#FF6B9D' : color;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 6px ${c}44)` }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={5} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }} />
    </svg>
  );
}

/* ─── EDIT MODAL ─── */
function EditModal({ title, children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
      <div className="glass" style={{ position: 'relative', width: '90%', maxWidth: 500, maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ═══════ MAIN APP ═══════ */
export default function FinFlowApp() {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('dashboard');
  const [notification, setNotification] = useState(null);

  // Core data
  const [transactions, setTransactions] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [expenseCats, setExpenseCats] = useState(DEFAULT_EXPENSE_CATS);
  const [incomeCats, setIncomeCats] = useState(DEFAULT_INCOME_CATS);

  // Patrimônio
  const [assets, setAssets] = useState([]);
  const [investments, setInvestments] = useState([]);

  // UI state
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasSampleData, setHasSampleData] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showAddTx, setShowAddTx] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [chartHover, setChartHover] = useState(null);
  const [categoryDetail, setCategoryDetail] = useState(null); // { catId, type }
  const [quickCatTxId, setQuickCatTxId] = useState(null); // for quick icon-click category change
  const [forecastMonths, setForecastMonths] = useState(6);
  const [viewPeriod, setViewPeriod] = useState('monthly'); // monthly | quarterly | semiannual | annual
  const [viewMonth, setViewMonth] = useState(cm + 1); // 1-12
  const [viewYear, setViewYear] = useState(cy);
  const [viewQuarter, setViewQuarter] = useState(Math.ceil((cm + 1) / 3)); // 1-4
  const [budgetTab, setBudgetTab] = useState('expense'); // expense | income
  const [importStaging, setImportStaging] = useState([]);
  const [importHistory, setImportHistory] = useState([]);
  const [importAccountId, setImportAccountId] = useState('');
  const [importCardId, setImportCardId] = useState('');
  const [editingImportId, setEditingImportId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importDragActive, setImportDragActive] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [patrimonioTab, setPatrimonioTab] = useState('summary');
  const [settingsTab, setSettingsTab] = useState('accounts');
  const [newTx, setNewTx] = useState({ description: '', amount: '', category: 'alimentacao', type: 'expense', date: todayStr, accountId: '', cardId: '', fromAccountId: '', toAccountId: '' });

  const fileRef = useRef(null);
  const galleryRef = useRef(null);
  const importRef = useRef(null);
  const backupRef = useRef(null);

  const notify = (msg, type = 'success') => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3500); };

  // ─── LOAD ───
  useEffect(() => {
    const d = loadData();
    if (d?.transactions?.length) {
      setTransactions(d.transactions);
      if (d.bankAccounts) setBankAccounts(d.bankAccounts);
      if (d.creditCards) setCreditCards(d.creditCards);
      if (d.expenseCats) setExpenseCats(d.expenseCats);
      if (d.incomeCats) setIncomeCats(d.incomeCats);
      if (d.assets) setAssets(d.assets);
      if (d.investments) setInvestments(d.investments);
      if (d.importHistory) setImportHistory(d.importHistory);
      setHasSampleData(!!d.isSampleData);
    } else {
      setBankAccounts([{ id: 'acc1', name: 'Nubank', icon: 'card', balance: 4523.87, initialBalance: 4523.87, color: '#B24DFF' }, { id: 'acc2', name: 'Banco do Brasil', icon: 'bank', balance: 12350, initialBalance: 12350, color: '#FFD740' }]);
      setTransactions(generateSampleData());
      setHasSampleData(true);
    }
    try { const k = localStorage.getItem('finflow-api-key'); if (k) setApiKey(k); } catch {}
    setLoading(false);
  }, []);

  // ─── SAVE ───
  useEffect(() => {
    if (!loading) saveData({ transactions, bankAccounts, creditCards, expenseCats, incomeCats, assets, investments, importHistory, isSampleData: hasSampleData });
  }, [transactions, bankAccounts, creditCards, expenseCats, incomeCats, assets, investments, importHistory, hasSampleData, loading]);

  // ─── COMPUTED ───
  const bankTotal = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);
  const cardDebt = creditCards.reduce((s, c) => s + (c.used || 0), 0);
  const assetTotal = assets.reduce((s, a) => s + (a.value || 0), 0);
  const investTotal = investments.reduce((s, i) => s + ((i.history?.length ? i.history[i.history.length - 1].value : 0) || 0), 0);
  const totalPatrimonio = bankTotal + assetTotal + investTotal - cardDebt;

  const accounts4forecast = [{ balance: bankTotal }];
  const fd = useMemo(() => computeForecast(transactions, accounts4forecast), [transactions, bankTotal]);
  const predictions = useMemo(() => generatePredictions(transactions, expenseCats, incomeCats, viewYear, viewMonth), [transactions, expenseCats, incomeCats, viewYear, viewMonth]);

  // ─── PERIOD HELPERS ───
  const getViewMonths = () => {
    switch (viewPeriod) {
      case 'monthly': return [{ month: viewMonth, year: viewYear }];
      case 'quarterly': {
        const start = (viewQuarter - 1) * 3 + 1;
        return [1,2,3].map(i => ({ month: start + i - 1, year: viewYear }));
      }
      case 'semiannual': {
        const start = viewMonth <= 6 ? 1 : 7;
        return [0,1,2,3,4,5].map(i => ({ month: start + i, year: viewYear }));
      }
      case 'annual': return [1,2,3,4,5,6,7,8,9,10,11,12].map(m => ({ month: m, year: viewYear }));
      default: return [{ month: viewMonth, year: viewYear }];
    }
  };
  const periodMonths = getViewMonths();

  const filterByPeriod = (txs) => {
    return txs.filter(tx => {
      const d = new Date(tx.date);
      const txMonth = d.getMonth() + 1;
      const txYear = d.getFullYear();
      return periodMonths.some(pm => pm.month === txMonth && pm.year === txYear);
    });
  };

  const periodLabel = () => {
    switch (viewPeriod) {
      case 'monthly': return `${MONTHS_FULL[viewMonth - 1]} ${viewYear}`;
      case 'quarterly': return `${viewQuarter}º Trimestre ${viewYear}`;
      case 'semiannual': return `${viewMonth <= 6 ? '1º' : '2º'} Semestre ${viewYear}`;
      case 'annual': return `Ano ${viewYear}`;
      default: return '';
    }
  };

  const periodPrev = () => {
    switch (viewPeriod) {
      case 'monthly': { const m = viewMonth - 1; if (m < 1) { setViewMonth(12); setViewYear(viewYear - 1); } else setViewMonth(m); break; }
      case 'quarterly': { const q = viewQuarter - 1; if (q < 1) { setViewQuarter(4); setViewYear(viewYear - 1); } else setViewQuarter(q); break; }
      case 'semiannual': { if (viewMonth <= 6) { setViewMonth(7); setViewYear(viewYear - 1); } else setViewMonth(1); break; }
      case 'annual': setViewYear(viewYear - 1); break;
    }
  };

  const periodNext = () => {
    switch (viewPeriod) {
      case 'monthly': { const m = viewMonth + 1; if (m > 12) { setViewMonth(1); setViewYear(viewYear + 1); } else setViewMonth(m); break; }
      case 'quarterly': { const q = viewQuarter + 1; if (q > 4) { setViewQuarter(1); setViewYear(viewYear + 1); } else setViewQuarter(q); break; }
      case 'semiannual': { if (viewMonth >= 7) { setViewMonth(1); setViewYear(viewYear + 1); } else setViewMonth(7); break; }
      case 'annual': setViewYear(viewYear + 1); break;
    }
  };

  // ─── PERIOD-FILTERED DATA ───
  const periodTx = filterByPeriod(transactions);
  const periodIncome = periodTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const periodExpense = periodTx.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);

  const catExpenses = {};
  periodTx.filter(t => t.type === 'expense').forEach(t => { if (!catExpenses[t.category]) catExpenses[t.category] = 0; catExpenses[t.category] += Math.abs(t.amount); });

  const catIncomes = {};
  periodTx.filter(t => t.type === 'income').forEach(t => { if (!catIncomes[t.category]) catIncomes[t.category] = 0; catIncomes[t.category] += t.amount; });

  const getCat = (id) => expenseCats.find(c => c.id === id) || incomeCats.find(c => c.id === id) || { name: id, icon: 'box', color: '#B388FF' };

  // ─── TRANSACTION ACTIONS ───
  const addTransaction = useCallback((tx) => {
    const amt = tx.type === 'expense' ? -Math.abs(tx.amount) : tx.type === 'card_payment' ? -Math.abs(tx.amount) : tx.type === 'transfer' ? -Math.abs(tx.amount) : Math.abs(tx.amount);
    const t = { ...tx, id: tx.id || genId(), amount: amt };
    setTransactions(prev => [t, ...prev].sort((a, b) => b.date.localeCompare(a.date)));

    // Update balances
    if (tx.type === 'transfer' && tx.fromAccountId && tx.toAccountId) {
      const absAmt = Math.abs(tx.amount);
      setBankAccounts(prev => prev.map(a => {
        if (a.id === tx.fromAccountId) return { ...a, balance: a.balance - absAmt };
        if (a.id === tx.toAccountId) return { ...a, balance: a.balance + absAmt };
        return a;
      }));
    } else if (tx.type === 'income' && tx.accountId) {
      setBankAccounts(prev => prev.map(a => a.id === tx.accountId ? { ...a, balance: a.balance + Math.abs(tx.amount) } : a));
    } else if (tx.type === 'expense' && tx.cardId) {
      setCreditCards(prev => prev.map(c => c.id === tx.cardId ? { ...c, used: (c.used || 0) + Math.abs(tx.amount) } : c));
    } else if (tx.type === 'expense' && tx.accountId) {
      setBankAccounts(prev => prev.map(a => a.id === tx.accountId ? { ...a, balance: a.balance - Math.abs(tx.amount) } : a));
    } else if (tx.type === 'card_payment' && tx.cardId && tx.accountId) {
      setCreditCards(prev => prev.map(c => c.id === tx.cardId ? { ...c, used: Math.max(0, (c.used || 0) - Math.abs(tx.amount)) } : c));
      setBankAccounts(prev => prev.map(a => a.id === tx.accountId ? { ...a, balance: a.balance - Math.abs(tx.amount) } : a));
    }
  }, []);

  const updateTransaction = useCallback((id, updates) => {
    setTransactions(prev => prev.map(tx => {
      if (tx.id !== id) return tx;
      const updated = { ...tx, ...updates };
      // Recalculate amount sign based on type
      if (updates.amount !== undefined || updates.type !== undefined) {
        const absAmt = Math.abs(updates.amount !== undefined ? parseFloat(updates.amount) || 0 : tx.amount);
        updated.amount = (updated.type === 'expense' || updated.type === 'transfer' || updated.type === 'card_payment') ? -absAmt : absAmt;
      }
      return updated;
    }).sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  const deleteTransaction = useCallback((id) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
    setEditingTxId(null);
    notify('Lançamento excluído!');
  }, []);
  const parseAmountInput = (str) => {
    if (!str) return 0;
    const s = str.toString().trim().replace(/R\$\s*/gi, '').replace(/\s/g, '');
    // If has comma as decimal separator (Brazilian): 1.234,56 or 123,45
    if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    return parseFloat(s) || 0;
  };

  const handleAddManual = () => {
    if (!newTx.description || !newTx.amount) return;
    const parsed = parseAmountInput(newTx.amount);
    if (parsed === 0) { notify('Valor inválido', 'error'); return; }
    if (newTx.type === 'transfer') {
      if (!newTx.fromAccountId || !newTx.toAccountId) { notify('Selecione conta de origem e destino', 'error'); return; }
      if (newTx.fromAccountId === newTx.toAccountId) { notify('Contas devem ser diferentes', 'error'); return; }
      const fromAcc = bankAccounts.find(a => a.id === newTx.fromAccountId);
      const toAcc = bankAccounts.find(a => a.id === newTx.toAccountId);
      addTransaction({ ...newTx, amount: parsed, description: newTx.description || `Transferência ${fromAcc?.name || ''} → ${toAcc?.name || ''}` });
    } else {
      addTransaction({ ...newTx, amount: parsed });
    }
    notify('"' + newTx.description + '" lançado!');
    setNewTx({ description: '', amount: '', category: 'alimentacao', type: 'expense', date: getLocalDateStr(), accountId: '', cardId: '', fromAccountId: '', toAccountId: '' });
    setShowAddTx(false);
  };

  // ─── SCANNER ───
  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!apiKey) { notify('Configure sua API Key em Config.', 'error'); setPage('settings'); return; }
    setScanning(true); setScanResult(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const b64 = reader.result.split(',')[1];
        const resp = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: b64, apiKey }) });
        const data = await resp.json();
        if (!resp.ok) { notify(data.error || 'Erro', 'error'); setScanning(false); return; }
        setScanResult(data.data); notify('Recibo escaneado!');
      } catch { notify('Falha na leitura.', 'error'); }
      setScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const confirmScan = () => { if (scanResult) { const extra = {}; if (scanResult.cardId) extra.cardId = scanResult.cardId; else if (scanResult.accountId) extra.accountId = scanResult.accountId; addTransaction({ description: scanResult.description, amount: scanResult.amount, category: scanResult.category, type: scanResult.type || 'expense', date: scanResult.date || todayStr, ...extra }); setScanResult(null); notify('Lançado!'); } };

  // ─── IMPORT ───
  const handleImportFile = async (file) => { if (!file) return; setImporting(true); try { const parsed = await parseImportFile(file); const checked = detectDuplicates(parsed, transactions); const dupeCount = checked.filter(t => t.isDuplicate).length; setImportStaging(prev => [...prev, ...checked]); notify(`${parsed.length} transações importadas!${dupeCount > 0 ? ` ${dupeCount} possíveis duplicatas.` : ''}`); } catch (err) { notify(err.message, 'error'); } setImporting(false); };
  const handleImportDrop = (e) => { e.preventDefault(); setImportDragActive(false); handleImportFile(e.dataTransfer?.files?.[0]); };
  const updateStagingItem = (id, updates) => setImportStaging(prev => prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx));
  const approveAll = () => setImportStaging(prev => prev.map(tx => tx.importStatus === 'pending' ? { ...tx, importStatus: 'approved' } : tx));
  const rejectAll = () => setImportStaging(prev => prev.map(tx => tx.importStatus === 'pending' ? { ...tx, importStatus: 'rejected' } : tx));
  const confirmImport = () => {
    const approved = importStaging.filter(tx => tx.importStatus === 'approved');
    if (!approved.length) { notify('Nenhuma aprovada.', 'error'); return; }
    approved.forEach(tx => {
      const extra = {};
      // If user selected a card, link expenses to that card
      if (importCardId && tx.type === 'expense') {
        extra.cardId = importCardId;
      } else if (importAccountId && tx.type !== 'card_payment') {
        extra.accountId = importAccountId;
      }
      addTransaction({ description: tx.description, amount: tx.amount, category: tx.category, type: tx.type === 'card_payment' ? 'expense' : tx.type, date: tx.date, ...extra });
    });
    setImportHistory(prev => [{ id: genId(), date: new Date().toISOString(), fileName: approved[0]?.importSource || 'Import', total: importStaging.length, approved: approved.length, rejected: importStaging.filter(tx => tx.importStatus === 'rejected').length }, ...prev]);
    setImportStaging([]); setImportAccountId(''); setImportCardId(''); setEditingImportId(null); notify(`${approved.length} confirmadas!`);
  };

  // ─── SETTINGS ACTIONS ───
  const saveApiKeyFn = (k) => { setApiKey(k); try { localStorage.setItem('finflow-api-key', k); } catch {} notify('API Key salva!'); };
  const clearAllData = () => { setTransactions([]); setImportHistory([]); setImportStaging([]); setBankAccounts([]); setCreditCards([]); setAssets([]); setInvestments([]); setExpenseCats(DEFAULT_EXPENSE_CATS); setIncomeCats(DEFAULT_INCOME_CATS); setHasSampleData(false); notify('Dados limpos!'); };
  const exportBackup = () => { const d = { transactions, bankAccounts, creditCards, expenseCats, incomeCats, assets, investments, importHistory }; const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `finflow-backup-${todayStr}.json`; a.click(); URL.revokeObjectURL(url); notify('Backup exportado!'); };
  const importBackupFn = (file) => { const reader = new FileReader(); reader.onload = (e) => { try { const d = JSON.parse(e.target.result); if (d.transactions) { setTransactions(d.transactions); if (d.bankAccounts) setBankAccounts(d.bankAccounts); if (d.creditCards) setCreditCards(d.creditCards); if (d.expenseCats) setExpenseCats(d.expenseCats); if (d.incomeCats) setIncomeCats(d.incomeCats); if (d.assets) setAssets(d.assets); if (d.investments) setInvestments(d.investments); setHasSampleData(false); notify('Backup restaurado!'); } } catch { notify('Arquivo inválido.', 'error'); } }; reader.readAsText(file); };

  const pendingCount = importStaging.filter(t => t.importStatus === 'pending').length;
  const approvedCount = importStaging.filter(t => t.importStatus === 'approved').length;

  if (loading) return (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><BgMesh /><div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}><div className="loader" /><p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 20 }}>Carregando FinFlow...</p></div></div>);

  const navItems = [
    { id: 'dashboard', icon: 'nav_grid', label: 'Dashboard' },
    { id: 'transactions', icon: 'nav_list', label: 'Lançamentos' },
    { id: 'scan', icon: 'nav_scan', label: 'Escanear' },
    { id: 'import', icon: 'nav_down', label: 'Importar' },
    { id: 'budget', icon: 'nav_pie', label: 'Orçamento' },
    { id: 'patrimonio', icon: 'nav_diamond', label: 'Patrimônio' },
    { id: 'forecast', icon: 'nav_trend', label: 'Forecast' },
    { id: 'settings', icon: 'nav_gear', label: 'Config.' },
  ];

  return (
    <div className="app-layout">
      <BgMesh />
      {notification && (<div style={{ position: 'fixed', top: 24, right: 24, zIndex: 100, animation: 'notifSlide 0.4s cubic-bezier(0.16,1,0.3,1)' }}><div className="glass" style={{ padding: '14px 24px', borderColor: notification.type === 'error' ? 'rgba(255,107,157,0.3)' : 'rgba(105,240,174,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>{notification.type === 'error' ? <GlassIcon icon="zap" size={16} color="#FF6B9D" /> : <GlassIcon icon="check" size={16} color="#69F0AE" />}<span style={{ fontSize: 13, fontWeight: 500 }}>{notification.msg}</span></div></div>)}
      {showIconPicker && <IconPicker value={showIconPicker.value} onChange={showIconPicker.onChange} onClose={() => setShowIconPicker(null)} />}

      {/* SIDEBAR */}
      <nav className="sidebar">
        <div className="sidebar-logo" style={{ padding: '0 24px', marginBottom: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#B24DFF,#00E5FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, boxShadow: '0 0 20px rgba(178,77,255,0.4)' }}>F</div>
          <div><div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>FinFlow</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase' }}>v2.3</div></div>
        </div>
        <div className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 12px', flex: 1 }}>
          {navItems.map(n => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
              <span style={{ width: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GlassIcon icon={n.icon} size={18} color={page === n.id ? '#B24DFF' : 'rgba(255,255,255,0.5)'} glow={page === n.id ? 'rgba(178,77,255,0.5)' : undefined} /></span>
              <span>{n.label}</span>
              {n.id === 'import' && importStaging.length > 0 && <span style={{ marginLeft: 'auto', background: 'rgba(255,215,64,0.2)', color: '#FFD740', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{importStaging.length}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-footer" style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>FinFlow v2.3 — 2026<br />Powered by EOS Finance</div>
        </div>
      </nav>

      {/* MAIN */}
      <main className="main-content">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} style={{ display: 'none' }} />
        <input ref={importRef} type="file" accept=".csv,.ofx,.qfx,.tsv,.txt,.xlsx,.xls" onChange={(e) => { handleImportFile(e.target.files?.[0]); e.target.value = ''; }} style={{ display: 'none' }} />
        <input ref={backupRef} type="file" accept=".json" onChange={(e) => { if (e.target.files?.[0]) importBackupFn(e.target.files[0]); e.target.value = ''; }} style={{ display: 'none' }} />


        {/* ══════ DASHBOARD ══════ */}
        {page === 'dashboard' && (() => {
          const budgetExpTotal = expenseCats.reduce((s, c) => s + getCatBudgetRange(c, periodMonths), 0);
          const budgetIncTotal = incomeCats.reduce((s, c) => s + getCatBudgetRange(c, periodMonths), 0);
          return (
          <div className="stagger">
            {hasSampleData && (
              <div className="glass" style={{ marginBottom: 20, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14, borderColor: 'rgba(255,215,64,0.3)', background: 'rgba(255,215,64,0.05)' }}>
                <span style={{ fontSize: 20 }}></span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#FFD740' }}>Dados de exemplo</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Limpe para começar com seus dados reais.</div></div>
                <button className="btn-danger" onClick={clearAllData}>Limpar</button>
              </div>
            )}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h1 className="page-title gradient-text" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>Dashboard</h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-primary" onClick={() => { setShowAddTx(true); setPage('transactions'); }}>+ Lançamento</button>
                <button className="btn-secondary" onClick={() => setPage('scan')} style={{ padding: '10px 18px', fontSize: 13 }}>Escanear</button>
              </div>
            </div>
            {/* ── Period Selector ── */}
            <div className="glass" style={{ padding: '12px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{id:'monthly',l:'Mensal'},{id:'quarterly',l:'Trimestral'},{id:'semiannual',l:'Semestral'},{id:'annual',l:'Anual'}].map(p=>(
                  <button key={p.id} className={`chip ${viewPeriod===p.id?'active':''}`} onClick={()=>setViewPeriod(p.id)} style={{ fontSize: 11, padding: '5px 12px' }}>{p.l}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={periodPrev} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, padding: '2px 6px' }}>‹</button>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', minWidth: 160, textAlign: 'center' }}>{periodLabel()}</span>
                <button onClick={periodNext} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, padding: '2px 6px' }}>›</button>
              </div>
            </div>
            {/* ══ POSIÇÃO ATUAL ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 24 }}>
              <div className="glass hoverable" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#B24DFF,transparent)', opacity: 0.6 }} />
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Patrimônio Total</div>
                <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: '#B24DFF', textShadow: '0 0 30px #B24DFF33' }}>{formatBRL(totalPatrimonio)}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Bancos: {formatBRL(bankTotal)} · Investimentos: {formatBRL(investTotal)}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
                {bankAccounts.map(a => (
                  <div key={a.id} className="glass" style={{ minWidth: 150, padding: '12px 16px', flex: '0 0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>{renderIcon(a.icon, 16)}<span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{a.name}</span></div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: a.balance >= 0 ? '#69F0AE' : '#FF6B9D' }}>{formatBRL(a.balance)}</div>
                  </div>
                ))}
                {creditCards.map(c => (
                  <div key={c.id} className="glass" style={{ minWidth: 150, padding: '12px 16px', flex: '0 0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>{renderIcon(c.icon, 16)}<span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{c.name}</span></div>
                    <div className="mono" style={{ fontSize: 12, color: '#FF6B9D' }}>Fatura: {formatBRL(c.used || 0)}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>Limite: {formatBRL(c.limit)}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* ══ RESULTADO DO PERÍODO ══ */}
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: `Receita · ${periodLabel()}`, value: formatBRL(periodIncome), color: '#69F0AE', sub: budgetIncTotal > 0 ? `Meta: ${formatBRL(budgetIncTotal)} (${periodIncome > 0 ? ((periodIncome / budgetIncTotal) * 100).toFixed(0) : 0}%)` : 'Sem meta' },
                { label: `Despesa · ${periodLabel()}`, value: formatBRL(periodExpense), color: '#FF6B9D', sub: budgetExpTotal > 0 ? `Orçamento: ${formatBRL(budgetExpTotal)} (${budgetExpTotal > 0 ? ((periodExpense / budgetExpTotal) * 100).toFixed(0) : 0}%)` : 'Sem orçamento' },
                { label: 'Resultado', value: formatBRL(periodIncome - periodExpense), color: periodIncome - periodExpense >= 0 ? '#69F0AE' : '#FF6B9D', sub: periodIncome > 0 ? `Economia: ${((1 - periodExpense / periodIncome) * 100).toFixed(1)}%` : '—' },
                { label: 'Meta de Economia', value: budgetIncTotal > 0 && budgetExpTotal > 0 ? formatBRL(budgetIncTotal - budgetExpTotal) : '—', color: '#64B5F6', sub: budgetIncTotal > 0 && budgetExpTotal > 0 ? ((periodIncome - periodExpense) >= (budgetIncTotal - budgetExpTotal) ? 'Meta atingida' : `Faltam ${formatBRL((budgetIncTotal - budgetExpTotal) - (periodIncome - periodExpense))}`) : 'Configure orçamentos' },
              ].map((k, i) => (
                <div key={i} className="glass hoverable" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${k.color},transparent)`, opacity: 0.6 }} />
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{k.label}</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: k.color, textShadow: `0 0 30px ${k.color}33` }}>{k.value}</div>
                  {k.sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>{k.sub}</div>}
                </div>
              ))}
            </div>
            {/* ══ EVOLUÇÃO MENSAL ══ */}
            <div className="glass" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 20 }}>{renderIcon('chart_up', 16)} Evolução Mensal</h3>
              {(() => {
                const rawData = fd.monthlyData.slice(-8);
                if (rawData.length < 2) return <p style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 20 }}>Dados insuficientes</p>;
                const incomeData = rawData.map(([, d]) => d.income);
                const expenseData = rawData.map(([, d]) => d.expense);
                const resultData = rawData.map(([, d]) => d.income - d.expense);
                const labels = rawData.map(([k]) => { const [y, m] = k.split('-'); return `${MONTHS[parseInt(m)-1]}'${y.slice(2)}`; });
                // Budget targets per month
                const budgetTargets = rawData.map(([k]) => {
                  const mo = parseInt(k.split('-')[1], 10);
                  const expB = expenseCats.reduce((s, c) => s + getCatBudget(c, mo), 0);
                  const incB = incomeCats.reduce((s, c) => s + getCatBudget(c, mo), 0);
                  return incB - expB; // savings target
                });
                const allVals = [...incomeData, ...expenseData, ...resultData.map(Math.abs), ...budgetTargets.map(Math.abs)];
                const maxVal = Math.max(...allVals, 1) * 1.2;
                const minVal = Math.min(0, ...resultData, ...budgetTargets) * 1.1;
                const range = maxVal - minVal;
                const W = 520, H = 200, padL = 50, padR = 20, padT = 15, padB = 5;
                const chartW = W - padL - padR, chartH = H - padT - padB;
                const n = rawData.length;
                const toY = (v) => padT + chartH - ((v - minVal) / range) * chartH;
                const toX = (i) => padL + (i / (n - 1)) * chartW;
                const zeroY = toY(0);

                const smoothPath = (data) => {
                  const pts = data.map((v, i) => ({ x: toX(i), y: toY(v) }));
                  if (pts.length < 2) return '';
                  let d = `M ${pts[0].x} ${pts[0].y}`;
                  for (let i = 0; i < pts.length - 1; i++) {
                    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
                    const t = 0.35;
                    d += ` C ${p1.x + (p2.x - p0.x) * t} ${p1.y + (p2.y - p0.y) * t}, ${p2.x - (p3.x - p1.x) * t} ${p2.y - (p3.y - p1.y) * t}, ${p2.x} ${p2.y}`;
                  }
                  return d;
                };

                const hIdx = chartHover;

                return (
                  <div style={{ position: 'relative' }}>
                    <svg viewBox={`0 0 ${W} ${H + 35}`} width="100%" style={{ overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#69F0AE" stopOpacity="0.2" /><stop offset="100%" stopColor="#69F0AE" stopOpacity="0.01" /></linearGradient>
                        <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF6B9D" stopOpacity="0.2" /><stop offset="100%" stopColor="#FF6B9D" stopOpacity="0.01" /></linearGradient>
                        <linearGradient id="gRes" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#64B5F6" /><stop offset="100%" stopColor="#64B5F6" /></linearGradient>
                      </defs>
                      {/* Grid */}
                      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                        const val = minVal + range * p;
                        const y = toY(val);
                        return (<g key={i}><line x1={padL} x2={W - padR} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" /><text x={padL - 6} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="inherit">{val >= 1000 ? `${(val/1000).toFixed(0)}k` : val.toFixed(0)}</text></g>);
                      })}
                      {/* Zero line */}
                      {minVal < 0 && <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />}
                      {/* Area fills */}
                      <path d={`${smoothPath(incomeData)} L ${toX(n-1)} ${zeroY} L ${toX(0)} ${zeroY} Z`} fill="url(#gInc)" />
                      <path d={`${smoothPath(expenseData)} L ${toX(n-1)} ${zeroY} L ${toX(0)} ${zeroY} Z`} fill="url(#gExp)" />
                      {/* Lines */}
                      <path d={smoothPath(incomeData)} fill="none" stroke="#69F0AE" strokeWidth="2" strokeLinecap="round" />
                      <path d={smoothPath(expenseData)} fill="none" stroke="#FF6B9D" strokeWidth="2" strokeLinecap="round" />
                      {/* Result line - smooth curve */}
                      <path d={smoothPath(resultData)} fill="none" stroke="url(#gRes)" strokeWidth="2.5" strokeLinecap="round" />
                      {/* Budget target dashed */}
                      <path d={smoothPath(budgetTargets)} fill="none" stroke="rgba(100,181,246,0.3)" strokeWidth="1.5" strokeDasharray="6 4" />
                      {/* Dots on result line */}
                      {resultData.map((v, i) => {
                        const metTarget = budgetTargets[i] > 0 ? v >= budgetTargets[i] : v >= 0;
                        return <circle key={`rd${i}`} cx={toX(i)} cy={toY(v)} r={hIdx === i ? 5 : 3.5} fill={metTarget ? '#64B5F6' : '#FF9800'} stroke="#0F1117" strokeWidth="1.5" style={{ cursor: 'pointer' }} />;
                      })}
                      {/* Hover zones */}
                      {rawData.map((_, i) => (
                        <rect key={`hz${i}`} x={toX(i) - chartW / n / 2} y={padT} width={chartW / n} height={chartH} fill="transparent" onMouseEnter={() => setChartHover(i)} onMouseLeave={() => setChartHover(null)} style={{ cursor: 'pointer' }} />
                      ))}
                      {/* Hover vertical line */}
                      {hIdx !== null && hIdx >= 0 && hIdx < n && (
                        <line x1={toX(hIdx)} x2={toX(hIdx)} y1={padT} y2={padT + chartH} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                      )}
                      {/* Month labels */}
                      {labels.map((l, i) => {
                        const metTarget = budgetTargets[i] > 0 ? resultData[i] >= budgetTargets[i] : resultData[i] >= 0;
                        return <text key={i} x={toX(i)} y={H + 18} textAnchor="middle" fill={metTarget ? '#64B5F6' : '#FF9800'} fontSize="10" fontWeight={hIdx === i ? '700' : '400'} fontFamily="inherit">{l}</text>;
                      })}
                    </svg>
                    {/* Hover tooltip */}
                    {hIdx !== null && hIdx >= 0 && hIdx < n && (
                      <div style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(15,17,23,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', fontSize: 12, minWidth: 170, zIndex: 5 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6, color: 'rgba(255,255,255,0.9)' }}>{labels[hIdx]}</div>
                        <div style={{ color: '#69F0AE', marginBottom: 3 }}>Receita: {formatBRL(incomeData[hIdx])}</div>
                        <div style={{ color: '#FF6B9D', marginBottom: 3 }}>Despesa: {formatBRL(expenseData[hIdx])}</div>
                        <div style={{ color: resultData[hIdx] >= 0 ? '#69F0AE' : '#FF6B9D', fontWeight: 600, marginBottom: 3 }}>Resultado: {formatBRL(resultData[hIdx])}</div>
                        {budgetTargets[hIdx] !== 0 && <div style={{ color: '#64B5F6', fontSize: 11 }}>Meta: {formatBRL(budgetTargets[hIdx])}</div>}
                        {budgetTargets[hIdx] > 0 && <div style={{ fontSize: 11, marginTop: 3, color: resultData[hIdx] >= budgetTargets[hIdx] ? '#69F0AE' : '#FF9800' }}>{resultData[hIdx] >= budgetTargets[hIdx] ? 'Meta atingida' : 'Abaixo da meta'}</div>}
                      </div>
                    )}
                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                      {[{c:'#69F0AE',l:'Receita'},{c:'#FF6B9D',l:'Despesa'},{c:'#64B5F6',l:'Resultado (meta)',s:'solid'},{c:'#FF9800',l:'Resultado (abaixo)',s:'solid'},{c:'rgba(100,181,246,0.5)',l:'Meta economia',s:'dashed'}].map((x,i)=>(
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 14, height: 2, background: x.c, borderBottom: x.s === 'dashed' ? '2px dashed' : 'none', borderColor: x.c }} />
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{x.l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            {/* ══ DESPESAS vs ORÇAMENTO + PREVISÃO IA ══ */}
            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div className="glass">
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>{renderIcon('chart_bar', 16, '#FF6B9D')} Despesas vs Orçamento</h3>
                {expenseCats.filter(c => catExpenses[c.id] || getCatBudgetRange(c, periodMonths) > 0).sort((a, b) => (catExpenses[b.id] || 0) - (catExpenses[a.id] || 0)).slice(0, 6).map(cat => {
                  const spent = catExpenses[cat.id] || 0;
                  const budget = getCatBudgetRange(cat, periodMonths);
                  const pred = predictions.expenses[cat.id];
                  const predicted = pred?.smartPredicted || 0;
                  const pct = budget > 0 ? (spent / budget) * 100 : (spent > 0 ? 100 : 0);
                  const predPct = budget > 0 ? Math.min((predicted / budget) * 100, 120) : 0;
                  const over = budget > 0 && spent > budget;
                  const isOpen = categoryDetail?.catId === cat.id && categoryDetail?.type === 'expense';
                  const catTxs = isOpen ? periodTx.filter(t => t.category === cat.id && t.type === 'expense') : [];
                  return (<div key={cat.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center', cursor: 'pointer' }} onClick={() => setCategoryDetail(isOpen ? null : { catId: cat.id, type: 'expense' })}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{renderIcon(cat.icon, 16)} {cat.name} <span style={{ fontSize: 10, opacity: 0.4 }}>{isOpen ? '▾' : '▸'}</span></span>
                      <div style={{ textAlign: 'right' }}>
                        <span className="mono" style={{ fontSize: 12 }}><span style={{ color: over ? '#FF6B9D' : 'rgba(255,255,255,0.6)' }}>{formatBRL(spent)}</span>{budget > 0 && <span style={{ color: 'rgba(255,255,255,0.25)' }}> / {formatBRL(budget)}</span>}</span>
                      </div>
                    </div>
                    <div style={{ position: 'relative', height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 6, overflow: 'visible' }}>
                      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: over ? 'linear-gradient(90deg,#FF6B9D88,#FF6B9D)' : 'linear-gradient(90deg,#B24DFF88,#B24DFF)', borderRadius: 6, transition: 'width 1s', position: 'relative', zIndex: 2 }} />
                      {predicted > 0 && budget > 0 && <div title={`Previsão IA: ${formatBRL(predicted)}`} style={{ position: 'absolute', left: `${Math.min(predPct, 100)}%`, top: -2, width: 3, height: 12, background: '#FFD740', borderRadius: 2, zIndex: 3, opacity: 0.8 }} />}
                      {budget > 0 && <div style={{ position: 'absolute', left: '100%', top: -3, bottom: -3, width: 1, borderRight: '2px dashed rgba(255,255,255,0.15)', zIndex: 1 }} />}
                    </div>
                    {pred && pred.pattern !== 'INSUFFICIENT' && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{pred.details?.description || pred.pattern}</span>
                        <span style={{ color: pred.willMeetBudget === false ? '#FF9800' : pred.willMeetBudget === true ? '#69F0AE' : 'rgba(255,255,255,0.2)' }}>
                          {pred.willMeetBudget === false ? `Prev: ${formatBRL(predicted)}` : pred.willMeetBudget === true ? 'Dentro do orçamento' : ''}
                        </span>
                      </div>
                    )}
                    {/* Category detail panel */}
                    {isOpen && (
                      <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(178,77,255,0.04)', border: '1px solid rgba(178,77,255,0.12)', borderRadius: 12, animation: 'fadeIn 0.2s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{catTxs.length} lançamentos no período</span>
                          {pred && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Padrão: {pred.pattern} · Confiança: {Math.round((pred.confidence || 0) * 100)}%</span>}
                        </div>
                        {catTxs.slice(0, 8).map(tx => (
                          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 12 }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: 8 }}>{tx.description}</span>
                            <span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 12, flexShrink: 0 }}>{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                            <span className="mono" style={{ color: '#FF6B9D', flexShrink: 0 }}>{formatBRL(tx.amount)}</span>
                          </div>
                        ))}
                        {catTxs.length > 8 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 6, textAlign: 'center' }}>+{catTxs.length - 8} lançamentos</div>}
                        {pred?.monthEnd && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 8, padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>Gasto até agora: {formatBRL(pred.monthEnd.spentSoFar)} · Previsão final: {formatBRL(predicted)} {budget > 0 ? `· ${((spent / budget) * 100).toFixed(0)}% do orçamento` : ''}</div>}
                      </div>
                    )}
                  </div>);
                })}
                {expenseCats.filter(c => catExpenses[c.id] || getCatBudgetRange(c, periodMonths) > 0).length === 0 && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>Sem dados no período</p>}
              </div>
              <div className="glass">
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>{renderIcon('trending', 16, '#69F0AE')} Receitas vs Previsão</h3>
                {incomeCats.filter(c => catIncomes[c.id] || getCatBudgetRange(c, periodMonths) > 0).map(cat => {
                  const received = catIncomes[cat.id] || 0;
                  const budget = getCatBudgetRange(cat, periodMonths);
                  const pred = predictions.incomes[cat.id];
                  const predicted = pred?.smartPredicted || 0;
                  const pct = budget > 0 ? Math.min((received / budget) * 100, 100) : (received > 0 ? 100 : 0);
                  const predPct = budget > 0 ? Math.min((predicted / budget) * 100, 120) : 0;
                  const isOpen = categoryDetail?.catId === cat.id && categoryDetail?.type === 'income';
                  const catTxs = isOpen ? periodTx.filter(t => t.category === cat.id && t.type === 'income') : [];
                  return (<div key={cat.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, cursor: 'pointer' }} onClick={() => setCategoryDetail(isOpen ? null : { catId: cat.id, type: 'income' })}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{renderIcon(cat.icon, 16)} {cat.name} <span style={{ fontSize: 10, opacity: 0.4 }}>{isOpen ? '▾' : '▸'}</span></span>
                      <span className="mono" style={{ fontSize: 12 }}><span style={{ color: '#69F0AE' }}>{formatBRL(received)}</span>{budget > 0 && <span style={{ color: 'rgba(255,255,255,0.25)' }}> / {formatBRL(budget)}</span>}</span>
                    </div>
                    <div style={{ position: 'relative', height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 6, overflow: 'visible' }}>
                      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: 'linear-gradient(90deg,#69F0AE88,#69F0AE)', borderRadius: 6, transition: 'width 1s', position: 'relative', zIndex: 2 }} />
                      {predicted > 0 && budget > 0 && <div title={`Previsão IA: ${formatBRL(predicted)}`} style={{ position: 'absolute', left: `${Math.min(predPct, 100)}%`, top: -2, width: 3, height: 12, background: '#FFD740', borderRadius: 2, zIndex: 3, opacity: 0.8 }} />}
                      {budget > 0 && <div style={{ position: 'absolute', left: '100%', top: -3, bottom: -3, width: 1, borderRight: '2px dashed rgba(255,255,255,0.15)', zIndex: 1 }} />}
                    </div>
                    {pred && pred.pattern !== 'INSUFFICIENT' && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>
                        <span>{pred.details?.description || pred.pattern}</span>
                      </div>
                    )}
                    {isOpen && (
                      <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(105,240,174,0.04)', border: '1px solid rgba(105,240,174,0.12)', borderRadius: 12, animation: 'fadeIn 0.2s ease' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{catTxs.length} lançamentos no período</div>
                        {catTxs.slice(0, 8).map(tx => (
                          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 12 }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: 8 }}>{tx.description}</span>
                            <span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 12, flexShrink: 0 }}>{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                            <span className="mono" style={{ color: '#69F0AE', flexShrink: 0 }}>{formatBRL(tx.amount)}</span>
                          </div>
                        ))}
                        {catTxs.length > 8 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 6, textAlign: 'center' }}>+{catTxs.length - 8} lançamentos</div>}
                      </div>
                    )}
                  </div>);
                })}
                {incomeCats.filter(c => catIncomes[c.id] || getCatBudgetRange(c, periodMonths) > 0).length === 0 && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>Sem dados no período</p>}
              </div>
            </div>
            {/* ══ LANÇAMENTOS RECENTES ══ */}
            <div className="glass">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Lançamentos do Período</h3>
                <button className="chip" onClick={() => setPage('transactions')}>Ver todos →</button>
              </div>
              {periodTx.slice(0, 7).map(tx => { const cat = getCat(tx.category); return (
                <div key={tx.id} className="tx-row">
                  <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(178,77,255,0.08)', border: '1px solid rgba(178,77,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{tx.type === 'income' ? renderIcon('money', 18, '#69F0AE') : tx.type === 'transfer' ? renderIcon('transfer', 18, '#B24DFF') : renderIcon(cat?.icon || 'box', 18)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.description}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')} · {cat?.name || tx.category}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: tx.type === 'transfer' ? '#B24DFF' : tx.amount >= 0 ? '#69F0AE' : '#FF6B9D' }}>{tx.amount >= 0 ? '+' : ''}{formatBRL(tx.amount)}</div>
                </div>
              ); })}
              {periodTx.length === 0 && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', padding: 20 }}>Nenhum lançamento no período</p>}
            </div>
          </div>
          );
        })()}

        {/* ══════ TRANSACTIONS ══════ */}
        {page === 'transactions' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div><h1 className="page-title gradient-text" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>Lançamentos</h1></div>
              <button className="btn-primary" onClick={() => setShowAddTx(!showAddTx)}>{showAddTx ? 'Fechar' : '+ Novo'}</button>
            </div>
            {showAddTx && (
              <div className="glass" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Novo Lançamento</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                  {[{v:'expense',l:'Despesa'},{v:'income',l:'Receita'},{v:'transfer',l:'Transferência'},{v:'card_payment',l:'Pagar Fatura'}].map(t=>(
                    <button key={t.v} onClick={()=>setNewTx({...newTx, type: t.v})} style={{ padding: '10px 10px', borderRadius: 12, border: newTx.type===t.v ? '1px solid #B24DFF':'1px solid rgba(255,255,255,0.08)', background: newTx.type===t.v ? 'rgba(178,77,255,0.12)':'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.8)', cursor:'pointer', fontSize:12, fontWeight: newTx.type===t.v ? 600:400 }}>{t.l}</button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <input className="glass-input" placeholder={newTx.type === 'transfer' ? 'Motivo da transferência' : 'Descrição'} value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} />
                  <input className="glass-input" inputMode="decimal" placeholder="Valor (ex: 1.234,56)" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} />
                  <input className="glass-input" type="date" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: newTx.type === 'transfer' ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {newTx.type === 'transfer' ? (
                    <>
                      <select className="glass-input" value={newTx.fromAccountId} onChange={e => setNewTx({...newTx, fromAccountId: e.target.value})}>
                        <option value="">Conta de origem...</option>
                        {bankAccounts.map(a => (<option key={a.id} value={a.id}>{iconText(a.icon)} {a.name} ({formatBRL(a.balance)})</option>))}
                      </select>
                      <select className="glass-input" value={newTx.toAccountId} onChange={e => setNewTx({...newTx, toAccountId: e.target.value})}>
                        <option value="">Conta de destino...</option>
                        {bankAccounts.filter(a => a.id !== newTx.fromAccountId).map(a => (<option key={a.id} value={a.id}>{iconText(a.icon)} {a.name} ({formatBRL(a.balance)})</option>))}
                      </select>
                    </>
                  ) : (
                    <>
                      {newTx.type !== 'card_payment' && (
                        <select className="glass-input" value={newTx.category} onChange={e => setNewTx({...newTx, category: e.target.value})}>
                          {newTx.type === 'income' ? incomeCats.map(c => (<option key={c.id} value={c.id}>{iconText(c.icon)} {c.name}</option>)) : expenseCats.map(c => (<option key={c.id} value={c.id}>{iconText(c.icon)} {c.name}</option>))}
                        </select>
                      )}
                      {(newTx.type === 'income' || newTx.type === 'card_payment' || (newTx.type === 'expense' && !newTx.cardId)) && (
                        <select className="glass-input" value={newTx.accountId} onChange={e => setNewTx({...newTx, accountId: e.target.value})}>
                          <option value="">Conta bancária...</option>
                          {bankAccounts.map(a => (<option key={a.id} value={a.id}>{iconText(a.icon)} {a.name}</option>))}
                        </select>
                      )}
                      {(newTx.type === 'expense' || newTx.type === 'card_payment') && creditCards.length > 0 && (
                        <select className="glass-input" value={newTx.cardId} onChange={e => setNewTx({...newTx, cardId: e.target.value, accountId: newTx.type === 'expense' ? '' : newTx.accountId})}>
                          <option value="">{newTx.type === 'card_payment' ? 'Qual cartão?' : 'No cartão? (opcional)'}</option>
                          {creditCards.map(c => (<option key={c.id} value={c.id}>{iconText(c.icon)} {c.name} (fatura: {formatBRL(c.used||0)})</option>))}
                        </select>
                      )}
                    </>
                  )}
                </div>
                <button className="btn-primary" onClick={handleAddManual}>Lançar</button>
              </div>
            )}
            {transactions.map(tx => { const cat = getCat(tx.category); const isEditing = editingTxId === tx.id; const isQuickCat = quickCatTxId === tx.id; const sameCats = tx.type === 'income' ? incomeCats : expenseCats; return (
              <div key={tx.id} style={{ position: 'relative' }}>
                <div className="tx-row" style={{ cursor: 'pointer' }} onClick={() => { setQuickCatTxId(null); setEditingTxId(isEditing ? null : tx.id); }}>
                  <div onClick={e => { e.stopPropagation(); setEditingTxId(null); setQuickCatTxId(isQuickCat ? null : tx.id); }} style={{ width: 40, height: 40, borderRadius: 14, background: isQuickCat ? 'rgba(178,77,255,0.25)' : isEditing ? 'rgba(178,77,255,0.15)' : 'rgba(178,77,255,0.08)', border: `1px solid ${isQuickCat ? 'rgba(178,77,255,0.6)' : isEditing ? 'rgba(178,77,255,0.4)' : 'rgba(178,77,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', cursor: 'pointer' }} title="Alterar categoria">{tx.type === 'income' ? renderIcon('money', 18, '#69F0AE') : tx.type === 'card_payment' ? renderIcon('card', 18, '#64B5F6') : tx.type === 'transfer' ? renderIcon('transfer', 18, '#B24DFF') : renderIcon(cat?.icon || 'box', 18)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.description}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')} · {cat?.name || tx.category}{tx.accountId ? ` · ${bankAccounts.find(a=>a.id===tx.accountId)?.name||''}` : ''}{tx.cardId ? ` · ${creditCards.find(c=>c.id===tx.cardId)?.name||''}` : ''}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: tx.type === 'transfer' ? '#B24DFF' : tx.amount >= 0 ? '#69F0AE' : '#FF6B9D' }}>{tx.amount >= 0 ? '+' : ''}{formatBRL(tx.amount)}</div>
                  <div style={{ opacity: 0.3, marginLeft: 8 }}>{isEditing ? '▾' : <GlassIcon icon="pencil" size={13} color="rgba(255,255,255,0.5)" />}</div>
                </div>
                {/* Quick category picker popup */}
                {isQuickCat && (
                  <div style={{ position: 'absolute', left: 0, top: 50, zIndex: 20, background: 'rgba(15,17,23,0.97)', border: '1px solid rgba(178,77,255,0.3)', borderRadius: 14, padding: 8, display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', animation: 'fadeIn 0.15s ease' }}>
                    {sameCats.map(c => (
                      <button key={c.id} onClick={() => { updateTransaction(tx.id, { category: c.id }); setQuickCatTxId(null); notify(`Categoria: ${c.name}`); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 10, border: tx.category === c.id ? '1px solid rgba(178,77,255,0.5)' : '1px solid rgba(255,255,255,0.06)', background: tx.category === c.id ? 'rgba(178,77,255,0.15)' : 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 12 }}>
                        {renderIcon(c.icon, 16)} <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {isEditing && (
                  <div style={{ background: 'rgba(178,77,255,0.04)', border: '1px solid rgba(178,77,255,0.12)', borderRadius: '0 0 16px 16px', marginTop: -8, padding: '16px 16px 12px', animation: 'fadeIn 0.2s ease' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 3 }}>Descrição</label>
                        <input className="glass-input" value={tx.description} onChange={e => updateTransaction(tx.id, { description: e.target.value })} style={{ fontSize: 13 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 3 }}>Valor (R$)</label>
                        <input className="glass-input" inputMode="decimal" value={Math.abs(tx.amount).toFixed(2)} onChange={e => { const v = parseAmountInput(e.target.value); if (v >= 0) updateTransaction(tx.id, { amount: v }); }} style={{ fontSize: 13 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 3 }}>Data</label>
                        <input className="glass-input" type="date" value={tx.date} onChange={e => updateTransaction(tx.id, { date: e.target.value })} style={{ fontSize: 13 }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 3 }}>Tipo</label>
                        <select className="glass-input" value={tx.type} onChange={e => updateTransaction(tx.id, { type: e.target.value })} style={{ fontSize: 12 }}>
                          <option value="expense">Despesa</option><option value="income">Receita</option><option value="transfer">Transferência</option><option value="card_payment">Pagar Fatura</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 3 }}>Categoria</label>
                        <select className="glass-input" value={tx.category} onChange={e => updateTransaction(tx.id, { category: e.target.value })} style={{ fontSize: 12 }}>
                          <optgroup label="Despesas">{expenseCats.map(c => <option key={c.id} value={c.id}>{iconText(c.icon)} {c.name}</option>)}</optgroup>
                          <optgroup label="Receitas">{incomeCats.map(c => <option key={c.id} value={c.id}>{iconText(c.icon)} {c.name}</option>)}</optgroup>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 3 }}>Conta / Cartão</label>
                        <select className="glass-input" value={tx.cardId || tx.accountId || ''} onChange={e => {
                          const val = e.target.value;
                          const isCard = creditCards.some(c => c.id === val);
                          updateTransaction(tx.id, isCard ? { cardId: val, accountId: '' } : { accountId: val, cardId: '' });
                        }} style={{ fontSize: 12 }}>
                          <option value="">Nenhum</option>
                          {bankAccounts.length > 0 && <optgroup label="Contas">{bankAccounts.map(a => <option key={a.id} value={a.id}>{iconText(a.icon)} {a.name}</option>)}</optgroup>}
                          {creditCards.length > 0 && <optgroup label="Cartões">{creditCards.map(c => <option key={c.id} value={c.id}>{iconText(c.icon)} {c.name}</option>)}</optgroup>}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button onClick={() => { if (confirm('Excluir este lançamento?')) deleteTransaction(tx.id); }} style={{ background: 'none', border: '1px solid rgba(255,77,77,0.25)', color: '#FF6B9D', padding: '6px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12 }}>Excluir</button>
                      <button onClick={() => { setEditingTxId(null); notify('Salvo!'); }} className="btn-primary" style={{ padding: '6px 20px', fontSize: 12 }}>Fechar</button>
                    </div>
                  </div>
                )}
              </div>
            ); })}
            {transactions.length === 0 && <div className="glass" style={{ textAlign: 'center', padding: 40 }}><div style={{ opacity: 0.3, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{renderIcon('nav_list', 40, 'rgba(255,255,255,0.3)')}</div><p style={{ color: 'rgba(255,255,255,0.35)' }}>Nenhum lançamento ainda</p></div>}
          </div>
        )}

        {/* ══════ IMPORT ══════ */}
        {page === 'import' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{ marginBottom: 28 }}><h1 className="page-title gradient-text" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>Importar Extrato</h1></div>
            <div className={`glass dropzone ${importDragActive ? 'drag-active' : ''}`} style={{ textAlign: 'center', padding: '48px 32px', marginBottom: 24, cursor: 'pointer' }} onClick={() => importRef.current?.click()} onDragOver={e => { e.preventDefault(); setImportDragActive(true); }} onDragLeave={() => setImportDragActive(false)} onDrop={handleImportDrop}>
              {importing ? (<><div className="loader" /><p style={{ marginTop: 16, color: 'rgba(255,255,255,0.5)' }}>Processando...</p></>) : (<><div style={{ opacity: 0.3, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{renderIcon('nav_down', 48, 'rgba(255,255,255,0.3)')}</div><p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Arraste seu extrato aqui</p><p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Suporta CSV, XLSX (Excel/Santander), OFX/QFX</p></>)}
            </div>
            {importStaging.length > 0 && (
              <>
              {/* Source Selection */}
              <div className="glass" style={{ marginBottom: 16, padding: '16px 20px' }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'rgba(255,255,255,0.7)' }}>{renderIcon('bank', 16)} De onde veio este extrato?</h4>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {creditCards.length > 0 && (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Cartão de Crédito</label>
                      <select className="glass-input" value={importCardId} onChange={e => { setImportCardId(e.target.value); if (e.target.value) setImportAccountId(''); }}>
                        <option value="">Nenhum (não é fatura)</option>
                        {creditCards.map(c => <option key={c.id} value={c.id}>{iconText(c.icon)} {c.name}</option>)}
                      </select>
                    </div>
                  )}
                  {bankAccounts.length > 0 && (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Conta Bancária</label>
                      <select className="glass-input" value={importAccountId} onChange={e => { setImportAccountId(e.target.value); if (e.target.value) setImportCardId(''); }}>
                        <option value="">Nenhuma</option>
                        {bankAccounts.map(a => <option key={a.id} value={a.id}>{iconText(a.icon)} {a.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                {importStaging[0]?.cardLabel && !importCardId && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#FFD740', padding: '6px 10px', background: 'rgba(255,215,64,0.06)', borderRadius: 8 }}>
                    Fatura de cartão detectada ({importStaging[0].cardLabel}). Selecione o cartão acima para vincular.
                  </div>
                )}
              </div>
              {/* Staging Table */}
              <div className="glass" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>Revisão ({importStaging.length} transações)</h3>
                    {importStaging.filter(t => t.isDuplicate).length > 0 && (
                      <div style={{ fontSize: 12, color: '#FFD740', marginTop: 4 }}>{importStaging.filter(t => t.isDuplicate).length} possíveis duplicatas encontradas</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary" onClick={approveAll}>Aprovar {pendingCount}</button>
                    <button className="btn-secondary" onClick={rejectAll}>Rejeitar</button>
                    <button className="btn-primary" onClick={confirmImport} disabled={approvedCount === 0}>Importar {approvedCount}</button>
                  </div>
                </div>
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                  {importStaging.map(tx => {
                    const cat = getCat(tx.category);
                    const isEditing = editingImportId === tx.id;
                    return (
                    <div key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: tx.isDuplicate ? 'rgba(255,215,64,0.03)' : 'transparent' }}>
                      <div className="import-row" style={{ display: 'grid', gridTemplateColumns: '70px 24px 2fr 1fr 1.2fr 100px', gap: 8, padding: '10px 0', alignItems: 'center' }}>
                        <span className={`badge badge-${tx.importStatus}`} style={{ fontSize: 11 }}>{tx.importStatus === 'approved' ? 'OK' : tx.importStatus === 'rejected' ? 'Não' : '...'}</span>
                        <span title={tx.isDuplicate ? `Possível duplicata: ${tx.duplicateOf}` : ''} style={{ cursor: tx.isDuplicate ? 'help' : 'default', textAlign: 'center' }}>{tx.isDuplicate ? <GlassIcon icon="zap" size={14} color="#FFD740" /> : ''}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.description}</div>
                          <div style={{ fontSize: 11, color: tx.isDuplicate ? '#FFD740' : 'rgba(255,255,255,0.3)' }}>
                            {new Date(tx.date+'T12:00:00').toLocaleDateString('pt-BR')}
                            {tx.cardLabel ? ` · ${tx.cardLabel}` : ''}
                            {tx.isDuplicate ? ` · ${tx.duplicateOf}` : ''}
                          </div>
                        </div>
                        <span className="mono" style={{ fontSize: 13, color: tx.amount >= 0 ? '#69F0AE' : '#FF6B9D', fontWeight: 600 }}>{formatBRL(tx.amount)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <select className="glass-input" style={{ padding: '5px 6px', fontSize: 11, flex: 1 }} value={tx.category} onChange={e => updateStagingItem(tx.id, { category: e.target.value })}>
                            <option value="" disabled>Categoria...</option>
                            <optgroup label="Despesas">{expenseCats.map(c => <option key={c.id} value={c.id}>{iconText(c.icon)} {c.name}</option>)}</optgroup>
                            <optgroup label="Receitas">{incomeCats.map(c => <option key={c.id} value={c.id}>{iconText(c.icon)} {c.name}</option>)}</optgroup>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: 3 }}>
                          <button title="Editar" onClick={() => setEditingImportId(isEditing ? null : tx.id)} style={{ padding: '5px 8px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: isEditing ? 'rgba(178,77,255,0.15)' : 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>⌂</button>
                          <button className="btn-success" onClick={() => updateStagingItem(tx.id, { importStatus: 'approved' })} style={{ padding: '5px 8px', fontSize: 12 }}>OK</button>
                          <button className="btn-danger" onClick={() => updateStagingItem(tx.id, { importStatus: 'rejected' })} style={{ padding: '5px 8px', fontSize: 12 }}>×</button>
                        </div>
                      </div>
                      {isEditing && (
                        <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 10, background: 'rgba(178,77,255,0.02)', borderRadius: 8, marginBottom: 4 }}>
                          <div>
                            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 3 }}>Data</label>
                            <input className="glass-input" type="date" style={{ padding: '6px 8px', fontSize: 12 }} value={tx.date} onChange={e => updateStagingItem(tx.id, { date: e.target.value })} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 3 }}>Descrição</label>
                            <input className="glass-input" style={{ padding: '6px 8px', fontSize: 12 }} value={tx.description} onChange={e => updateStagingItem(tx.id, { description: e.target.value })} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 3 }}>Valor (R$)</label>
                            <input className="glass-input" type="number" step="0.01" style={{ padding: '6px 8px', fontSize: 12 }} value={tx.amount} onChange={e => updateStagingItem(tx.id, { amount: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 3 }}>Tipo</label>
                            <select className="glass-input" style={{ padding: '6px 8px', fontSize: 12 }} value={tx.type} onChange={e => updateStagingItem(tx.id, { type: e.target.value })}>
                              <option value="expense">Despesa</option>
                              <option value="income">Receita</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
              </>
            )}
            {importHistory.length > 0 && (
              <div className="glass"><h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Histórico de Importações</h3>
                {importHistory.map(h => (<div key={h.id} className="tx-row"><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{h.fileName}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{new Date(h.date).toLocaleDateString('pt-BR')}</div></div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{h.approved}/{h.total} aprovadas</div></div>))}
              </div>
            )}
          </div>
        )}

        {/* ══════ SCAN ══════ */}
        {page === 'scan' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{ marginBottom: 28 }}><h1 className="page-title gradient-text" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>Escanear Recibo</h1></div>
            <div className="glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340 }}>
              {!apiKey ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 56, opacity: 0.3, marginBottom: 16 }}></div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>API Key necessária</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>Configure em Configurações</p>
                  <button className="btn-primary" onClick={() => setPage('settings')}>Configurar</button>
                </div>
              ) : scanning ? (
                <div style={{ textAlign: 'center' }}>
                  <div className="loader" />
                  <p style={{ marginTop: 20, fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{renderIcon('sparkle', 16)} Analisando recibo com IA...</p>
                  <p style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Extraindo dados automaticamente</p>
                </div>
              ) : scanResult ? (
                <div style={{ width: '100%' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, textAlign: 'center' }}>{renderIcon('check', 16, '#69F0AE')} Resultado — Edite se necessário</h3>
                  <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                    <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Descrição</label><input className="glass-input" value={scanResult.description} onChange={e => setScanResult(p => ({ ...p, description: e.target.value }))} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Valor (R$)</label><input className="glass-input" type="number" step="0.01" value={scanResult.amount} onChange={e => setScanResult(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} /></div>
                      <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Data</label><input className="glass-input" type="date" value={scanResult.date} onChange={e => setScanResult(p => ({ ...p, date: e.target.value }))} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Tipo</label><select className="glass-input" value={scanResult.type || 'expense'} onChange={e => setScanResult(p => ({ ...p, type: e.target.value }))}><option value="expense">Despesa</option><option value="income">Receita</option></select></div>
                      <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Categoria</label>
                        <select className="glass-input" value={scanResult.category} onChange={e => setScanResult(p => ({ ...p, category: e.target.value }))}>
                          <optgroup label="Despesas">{expenseCats.map(c => <option key={c.id} value={c.id}>{iconText(c.icon)} {c.name}</option>)}</optgroup>
                          <optgroup label="Receitas">{incomeCats.map(c => <option key={c.id} value={c.id}>{iconText(c.icon)} {c.name}</option>)}</optgroup>
                        </select>
                      </div>
                    </div>
                    <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>{renderIcon('bank', 14)} Pago com</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <select className="glass-input" value={scanResult.cardId || ''} onChange={e => setScanResult(p => ({ ...p, cardId: e.target.value, accountId: e.target.value ? '' : p.accountId }))}>
                          <option value="">Cartão: nenhum</option>
                          {creditCards.map(c => <option key={c.id} value={c.id}>{iconText(c.icon)} {c.name}</option>)}
                        </select>
                        <select className="glass-input" value={scanResult.accountId || ''} onChange={e => setScanResult(p => ({ ...p, accountId: e.target.value, cardId: e.target.value ? '' : p.cardId }))}>
                          <option value="">Conta: nenhuma</option>
                          {bankAccounts.map(a => <option key={a.id} value={a.id}>{iconText(a.icon)} {a.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn-primary" onClick={confirmScan} style={{ flex: 1 }}>Confirmar</button>
                    <button className="btn-secondary" onClick={() => setScanResult(null)} style={{ flex: 1 }}>↻ Nova foto</button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ opacity: 0.3, marginBottom: 16, display: 'flex', justifyContent: 'center' }}>{renderIcon('camera', 56, 'rgba(255,255,255,0.3)')}</div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Escanear Recibo</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>Cupons fiscais, recibos, notas</p>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button className="btn-primary" onClick={() => fileRef.current?.click()} style={{ padding: '12px 24px', fontSize: 14 }}>Tirar Foto</button>
                    <input ref={galleryRef} type="file" accept="image/*" onChange={handlePhotoCapture} style={{ display: 'none' }} />
                    <button className="btn-secondary" onClick={() => galleryRef.current?.click()} style={{ padding: '12px 24px', fontSize: 14 }}>Selecionar Imagem</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ BUDGET ══════ */}
        {page === 'budget' && (() => {
          const budgetExpTotal = expenseCats.reduce((s, c) => s + getCatBudgetRange(c, periodMonths), 0);
          const budgetIncTotal = incomeCats.reduce((s, c) => s + getCatBudgetRange(c, periodMonths), 0);
          return (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h1 className="page-title gradient-text" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>Orçamento</h1>
            </div>
            {/* Period Selector */}
            <div className="glass" style={{ padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{id:'monthly',l:'Mensal'},{id:'quarterly',l:'Trimestral'},{id:'semiannual',l:'Semestral'},{id:'annual',l:'Anual'}].map(p=>(
                  <button key={p.id} className={`chip ${viewPeriod===p.id?'active':''}`} onClick={()=>setViewPeriod(p.id)} style={{ fontSize: 11, padding: '5px 12px' }}>{p.l}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={periodPrev} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, padding: '2px 6px' }}>‹</button>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', minWidth: 160, textAlign: 'center' }}>{periodLabel()}</span>
                <button onClick={periodNext} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, padding: '2px 6px' }}>›</button>
              </div>
            </div>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
              {[
                { l: 'Orçamento Despesas', v: budgetExpTotal, c: '#FF6B9D', i: 'chart_bar' },
                { l: 'Realizado Despesas', v: periodExpense, c: periodExpense > budgetExpTotal && budgetExpTotal > 0 ? '#FF6B9D' : '#B24DFF', i: 'money' },
                { l: 'Previsão Receitas', v: budgetIncTotal, c: '#69F0AE', i: 'trending' },
                { l: 'Realizado Receitas', v: periodIncome, c: '#69F0AE', i: 'coins' },
              ].map((k, i) => (
                <div key={i} className="glass" style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{renderIcon(k.i, 20)}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{k.l}</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: k.c }}>{formatBRL(k.v)}</div>
                </div>
              ))}
            </div>
            {/* Expense / Income tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button className={`chip ${budgetTab==='expense'?'active':''}`} onClick={()=>setBudgetTab('expense')}>{renderIcon('chart_bar', 14, '#FF6B9D')} Despesas</button>
              <button className={`chip ${budgetTab==='income'?'active':''}`} onClick={()=>setBudgetTab('income')}>{renderIcon('trending', 14, '#69F0AE')} Receitas</button>
            </div>

            {budgetTab === 'expense' && (
              <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
                {expenseCats.map(cat => {
                  const spent = catExpenses[cat.id] || 0;
                  const budget = getCatBudgetRange(cat, periodMonths);
                  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : (spent > 0 ? 100 : 0);
                  const over = budget > 0 && spent > budget;
                  return (
                    <div key={cat.id} className="glass hoverable" style={{ textAlign: 'center', padding: 24, borderColor: over ? 'rgba(255,107,157,0.25)' : undefined, background: over ? 'rgba(255,107,157,0.03)' : undefined }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, position: 'relative' }}>
                        <GlassRing value={spent} max={budget || spent || 1} size={80} color={over ? '#FF6B9D' : '#B24DFF'} />
                        <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>{renderIcon(cat.icon, 22)}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>{cat.name}</div>
                      <div style={{ fontSize: 10, color: cat.budgetType === 'annual' ? '#FFD740' : 'rgba(255,255,255,0.25)', marginBottom: 6 }}>{cat.budgetType === 'annual' ? 'Orçamento anual' : 'Orçamento mensal'}</div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: over ? '#FF6B9D' : '#69F0AE' }}>{formatBRL(spent)}</div>
                      {budget > 0 ? (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>de {formatBRL(budget)} ({pct.toFixed(0)}%)</div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>sem orçamento definido</div>
                      )}
                      {over && <div style={{ fontSize: 11, color: '#FF6B9D', marginTop: 6, fontWeight: 600 }}>Estourou {formatBRL(spent - budget)}</div>}
                      {/* Monthly breakdown for annual budget in annual/quarterly view */}
                      {cat.budgetType === 'annual' && viewPeriod !== 'monthly' && periodMonths.length > 1 && budget > 0 && (
                        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 10 }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {periodMonths.map(pm => {
                              const mb = getCatBudget(cat, pm.month);
                              return <span key={pm.month} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: mb > 0 ? 'rgba(178,77,255,0.1)' : 'rgba(255,255,255,0.02)', color: mb > 0 ? '#B24DFF' : 'rgba(255,255,255,0.15)' }}>{MONTHS[pm.month - 1]}: {mb > 0 ? formatBRL(mb) : '—'}</span>;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {budgetTab === 'income' && (
              <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
                {incomeCats.map(cat => {
                  const received = catIncomes[cat.id] || 0;
                  const budget = getCatBudgetRange(cat, periodMonths);
                  const pct = budget > 0 ? Math.min((received / budget) * 100, 100) : (received > 0 ? 100 : 0);
                  const under = budget > 0 && received < budget * 0.8;
                  return (
                    <div key={cat.id} className="glass hoverable" style={{ textAlign: 'center', padding: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, position: 'relative' }}>
                        <GlassRing value={received} max={budget || received || 1} size={80} color="#69F0AE" />
                        <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>{renderIcon(cat.icon, 22)}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>{cat.name}</div>
                      <div style={{ fontSize: 10, color: cat.budgetType === 'annual' ? '#FFD740' : 'rgba(255,255,255,0.25)', marginBottom: 6 }}>{cat.budgetType === 'annual' ? 'Previsão anual' : 'Previsão mensal'}</div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: '#69F0AE' }}>{formatBRL(received)}</div>
                      {budget > 0 ? (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>de {formatBRL(budget)} ({pct.toFixed(0)}%)</div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>sem previsão definida</div>
                      )}
                      {under && budget > 0 && <div style={{ fontSize: 11, color: '#FFD740', marginTop: 6 }}>Faltam {formatBRL(budget - received)}</div>}
                      {cat.budgetType === 'annual' && viewPeriod !== 'monthly' && periodMonths.length > 1 && budget > 0 && (
                        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 10 }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {periodMonths.map(pm => {
                              const mb = getCatBudget(cat, pm.month);
                              return <span key={pm.month} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: mb > 0 ? 'rgba(105,240,174,0.1)' : 'rgba(255,255,255,0.02)', color: mb > 0 ? '#69F0AE' : 'rgba(255,255,255,0.15)' }}>{MONTHS[pm.month - 1]}: {mb > 0 ? formatBRL(mb) : '—'}</span>;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          );
        })()}

        {/* ══════ FORECAST ══════ */}
        {page === 'forecast' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div><h1 className="page-title gradient-text" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>Forecast</h1></div>
              <div style={{ display: 'flex', gap: 8 }}>{[3,6,12].map(m => (<button key={m} className={`chip ${forecastMonths===m?'active':''}`} onClick={()=>setForecastMonths(m)}>{m} meses</button>))}</div>
            </div>
            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                { l: 'Receita Média', v: formatBRL(fd.avgIncome), c: '#69F0AE', i: 'trending' },
                { l: 'Despesa Média', v: formatBRL(fd.avgExpense), c: '#FF6B9D', i: 'chart_bar' },
                { l: 'Tendência', v: fd.trend > 0 ? 'Subindo' : 'Estável', c: fd.trend > 0 ? '#FFD740' : '#69F0AE', i: 'chart_up' },
                { l: 'Taxa Economia', v: fd.avgIncome > 0 ? `${((1 - fd.avgExpense / fd.avgIncome) * 100).toFixed(1)}%` : '—', c: '#B24DFF', i: 'target' },
              ].map((k, i) => (
                <div key={i} className="glass" style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{renderIcon(k.i, 20)}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{k.l}</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: k.c }}>{k.v}</div>
                </div>
              ))}
            </div>
            <div className="glass" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 20 }}>Projeção de Patrimônio</h3>
              <div style={{ position: 'relative', height: 220 }}>
                {(() => {
                  const data = fd.forecast.slice(0, forecastMonths), maxB = Math.max(...data.map(d => d.balance)), minB = Math.min(...data.map(d => d.balance), 0), range = maxB - minB || 1;
                  const W = 400, H = 100, padL = 5, padR = 5;
                  const toX = (i) => padL + (i / (data.length - 1)) * (W - padL - padR);
                  const toY = (v) => 5 + (1 - (v - minB) / range) * (H - 10);
                  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.balance) }));
                  // Smooth curve
                  let pathD = `M ${pts[0].x} ${pts[0].y}`;
                  for (let i = 0; i < pts.length - 1; i++) {
                    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
                    const t = 0.35;
                    pathD += ` C ${p1.x + (p2.x - p0.x) * t} ${p1.y + (p2.y - p0.y) * t}, ${p2.x - (p3.x - p1.x) * t} ${p2.y - (p3.y - p1.y) * t}, ${p2.x} ${p2.y}`;
                  }
                  const areaD = `${pathD} L ${pts[pts.length-1].x} ${H} L ${pts[0].x} ${H} Z`;
                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                      <defs>
                        <linearGradient id="fg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B24DFF" stopOpacity="0.25" /><stop offset="100%" stopColor="#00E5FF" stopOpacity="0.02" /></linearGradient>
                        <linearGradient id="lg2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#B24DFF" /><stop offset="100%" stopColor="#00E5FF" /></linearGradient>
                      </defs>
                      <path d={areaD} fill="url(#fg2)" />
                      <path d={pathD} fill="none" stroke="url(#lg2)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      {pts.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r="2" fill="#0F1117" stroke="#00E5FF" strokeWidth="1" style={{ filter: 'drop-shadow(0 0 3px rgba(0,229,255,0.5))' }} />
                      ))}
                    </svg>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>{fd.forecast.slice(0, forecastMonths).map((d, i) => (<span key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{d.shortMonth}</span>))}</div>
            </div>
            <div className="glass">
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Detalhamento</h3>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '0 0 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', minWidth: 500 }}>
                  {['Mês','Receita','Despesa','Saldo','Patrimônio'].map(h => (<span key={h} style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</span>))}
                </div>
                {fd.forecast.slice(0, forecastMonths).map((f, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', minWidth: 500 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{f.month}</span>
                    <span className="mono" style={{ fontSize: 13, color: '#69F0AE' }}>{formatBRL(f.income)}</span>
                    <span className="mono" style={{ fontSize: 13, color: '#FF6B9D' }}>{formatBRL(f.expense)}</span>
                    <span className="mono" style={{ fontSize: 13, color: f.net >= 0 ? '#69F0AE' : '#FF6B9D' }}>{formatBRL(f.net)}</span>
                    <span className="mono" style={{ fontSize: 13, color: '#B24DFF', fontWeight: 600 }}>{formatBRL(f.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════ PATRIMÔNIO ══════ */}
        {page === 'patrimonio' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div><h1 className="page-title gradient-text" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>Patrimônio</h1></div>
            </div>

            {/* Total */}
            <div className="glass" style={{ textAlign: 'center', padding: 32, marginBottom: 24, borderColor: 'rgba(178,77,255,0.2)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Patrimônio Total</div>
              <div className="mono" style={{ fontSize: 42, fontWeight: 700, color: '#B24DFF', textShadow: '0 0 40px rgba(178,77,255,0.3)' }}>{formatBRL(totalPatrimonio)}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
                {[
                  { l: 'Contas', v: bankTotal, c: '#69F0AE', i: 'bank' },
                  { l: 'Investimentos', v: investTotal, c: '#00E5FF', i: 'trending' },
                  { l: 'Bens', v: assetTotal, c: '#FFD740', i: 'house' },
                  { l: 'Cartões', v: -cardDebt, c: '#FF6B9D', i: 'card' },
                ].filter(x => x.v !== 0 || x.l === 'Contas').map((s, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{renderIcon(s.i, 20)}</div>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: s.c }}>{formatBRL(s.v)}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {[{id:'summary',l:'Resumo'},{id:'assets',l:'Bens'},{id:'investments',l:'Investimentos'}].map(t=>(
                <button key={t.id} className={`chip ${patrimonioTab===t.id?'active':''}`} onClick={()=>setPatrimonioTab(t.id)}>{t.l}</button>
              ))}
            </div>

            {/* SUMMARY TAB */}
            {patrimonioTab === 'summary' && (
              <div>
                {/* Pie-like breakdown */}
                <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="glass">
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Composição</h3>
                    {[
                      { l: 'Contas Bancárias', v: bankTotal, c: '#69F0AE' },
                      { l: 'Investimentos', v: investTotal, c: '#00E5FF' },
                      { l: 'Bens', v: assetTotal, c: '#FFD740' },
                      { l: 'Dívida Cartões', v: -cardDebt, c: '#FF6B9D' },
                    ].map((item, i) => {
                      const total = bankTotal + investTotal + assetTotal;
                      const pct = total > 0 ? (Math.abs(item.v) / total * 100) : 0;
                      return (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{item.l}</span>
                            <span className="mono" style={{ fontSize: 13, color: item.c, fontWeight: 600 }}>{formatBRL(item.v)}</span>
                          </div>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: item.c, borderRadius: 6, transition: 'width 1s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="glass">
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Investimentos por Instituição</h3>
                    {investments.length === 0 ? <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Nenhum investimento cadastrado</p> : null}
                    {investments.map(inv => {
                      const currentVal = inv.history?.length ? inv.history[inv.history.length - 1].value : 0;
                      const totalContrib = inv.history?.reduce((s, h) => s + (h.contribution || 0), 0) || 0;
                      const returns = currentVal - totalContrib;
                      return (
                        <div key={inv.id} style={{ marginBottom: 14, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><span style={{ marginRight: 8, display: 'inline-flex' }}>{renderIcon(inv.icon, 16)}</span><span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{inv.institution}</span><span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>{inv.category}</span></div>
                            <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#00E5FF' }}>{formatBRL(currentVal)}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Aportado: {formatBRL(totalContrib)}</span>
                            <span style={{ fontSize: 11, color: returns >= 0 ? '#69F0AE' : '#FF6B9D' }}>Rent.: {formatBRL(returns)} ({totalContrib > 0 ? ((returns / totalContrib) * 100).toFixed(1) : 0}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ASSETS TAB */}
            {patrimonioTab === 'assets' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <button className="btn-primary" onClick={() => setEditModal({ type: 'asset', data: { id: '', name: '', icon: 'house', value: '', category: '', acquiredDate: todayStr, notes: '' } })}>+ Novo Bem</button>
                </div>
                {assets.length === 0 && <div className="glass" style={{ textAlign: 'center', padding: 40 }}><div style={{ opacity: 0.3, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{renderIcon('box', 48, 'rgba(255,255,255,0.3)')}</div><p style={{ color: 'rgba(255,255,255,0.35)' }}>Nenhum bem cadastrado</p><p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>Adicione imóveis, veículos e outros bens</p></div>}
                <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
                  {assets.map(a => (
                    <div key={a.id} className="glass hoverable" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setEditModal({ type: 'asset', data: a })}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        {renderIcon(a.icon, 32)}
                        <div><div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{a.name}</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{a.category}</div></div>
                      </div>
                      <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: '#FFD740', marginBottom: 8 }}>{formatBRL(a.value)}</div>
                      {a.acquiredDate && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Aquisição: {new Date(a.acquiredDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>}
                      {a.notes && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8, fontStyle: 'italic' }}>{a.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* INVESTMENTS TAB */}
            {patrimonioTab === 'investments' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <button className="btn-primary" onClick={() => setEditModal({ type: 'investment', data: { id: '', institution: '', icon: 'bank', category: '', history: [] } })}>+ Novo Investimento</button>
                </div>
                {investments.length === 0 && <div className="glass" style={{ textAlign: 'center', padding: 40 }}><div style={{ opacity: 0.3, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{renderIcon('box', 48, 'rgba(255,255,255,0.3)')}</div><p style={{ color: 'rgba(255,255,255,0.35)' }}>Nenhum investimento cadastrado</p></div>}
                {investments.map(inv => {
                  const currentVal = inv.history?.length ? inv.history[inv.history.length - 1].value : 0;
                  const totalContrib = inv.history?.reduce((s, h) => s + (h.contribution || 0), 0) || 0;
                  const returns = currentVal - totalContrib;
                  const lastMonth = inv.history?.length >= 2 ? inv.history[inv.history.length - 1].value - inv.history[inv.history.length - 2].value : 0;
                  return (
                    <div key={inv.id} className="glass" style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {renderIcon(inv.icon, 28)}
                          <div><div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{inv.institution}</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{inv.category}</div></div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: '#00E5FF' }}>{formatBRL(currentVal)}</div>
                          <div style={{ fontSize: 11, color: returns >= 0 ? '#69F0AE' : '#FF6B9D' }}>{returns >= 0 ? '↑' : '↓'} {formatBRL(Math.abs(returns))} ({totalContrib > 0 ? ((returns / totalContrib) * 100).toFixed(1) : 0}%)</div>
                        </div>
                      </div>
                      {/* Monthly summary */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                        {[
                          { l: 'Total Aportado', v: totalContrib, c: 'rgba(255,255,255,0.6)' },
                          { l: 'Rentabilidade', v: returns, c: returns >= 0 ? '#69F0AE' : '#FF6B9D' },
                          { l: 'Variação Mês', v: lastMonth, c: lastMonth >= 0 ? '#69F0AE' : '#FF6B9D' },
                        ].map((s, i) => (
                          <div key={i} style={{ textAlign: 'center', padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{s.l}</div>
                            <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: s.c }}>{formatBRL(s.v)}</div>
                          </div>
                        ))}
                      </div>
                      {/* History table */}
                      {inv.history?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Histórico de Posições</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span>Mês</span><span>Posição</span><span>Aporte</span><span>Variação</span>
                          </div>
                          {inv.history.slice(-6).map((h, i, arr) => {
                            const prev = i > 0 ? arr[i - 1].value : (inv.history.indexOf(h) > 0 ? inv.history[inv.history.indexOf(h) - 1].value : h.contribution);
                            const diff = h.value - prev;
                            return (
                              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: 12 }}>
                                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{h.month}</span>
                                <span className="mono" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{formatBRL(h.value)}</span>
                                <span className="mono" style={{ color: '#69F0AE' }}>{h.contribution > 0 ? `+${formatBRL(h.contribution)}` : '—'}</span>
                                <span className="mono" style={{ color: diff >= 0 ? '#69F0AE' : '#FF6B9D' }}>{diff >= 0 ? '+' : ''}{formatBRL(diff)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button className="btn-secondary" onClick={() => setEditModal({ type: 'update_position', data: inv })} style={{ fontSize: 12 }}>{renderIcon('chart_up', 12)} Atualizar Posição</button>
                        <button className="btn-secondary" onClick={() => setEditModal({ type: 'investment', data: inv })} style={{ fontSize: 12 }}>Editar</button>
                        <button className="btn-danger" onClick={() => { setInvestments(prev => prev.filter(x => x.id !== inv.id)); notify('Investimento removido'); }} style={{ fontSize: 12, marginLeft: 'auto' }}>Remover</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════ SETTINGS ══════ */}
        {page === 'settings' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{ marginBottom: 28 }}>
              <h1 className="page-title gradient-text" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>Configurações</h1>
            </div>
            {/* Settings Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {[{id:'accounts',l:'Contas'},{id:'cards',l:'Cartões'},{id:'categories',l:'Categorias'},{id:'apikey',l:'API Key'},{id:'data',l:'Dados'},{id:'reconcile',l:'Reconciliar'}].map(t=>(
                <button key={t.id} className={`chip ${settingsTab===t.id?'active':''}`} onClick={()=>setSettingsTab(t.id)}>{t.l}</button>
              ))}
            </div>

            {/* ACCOUNTS */}
            {settingsTab === 'accounts' && (
              <div className="glass">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>{renderIcon('bank', 16)} Contas Bancárias</h3>
                  <button className="btn-primary" onClick={() => setEditModal({ type: 'bank', data: { id: '', name: '', icon: 'bank', balance: '', initialBalance: '', color: '#69F0AE' } })}>+ Nova Conta</button>
                </div>
                {bankAccounts.length === 0 && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: 20 }}>Nenhuma conta cadastrada</p>}
                {bankAccounts.map(acc => (
                  <div key={acc.id} className="tx-row" style={{ cursor: 'pointer' }} onClick={() => setEditModal({ type: 'bank', data: acc })}>
                    {renderIcon(acc.icon, 24)}
                    <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{acc.name}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Saldo inicial: {formatBRL(acc.initialBalance)}</div></div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: acc.balance >= 0 ? '#69F0AE' : '#FF6B9D' }}>{formatBRL(acc.balance)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* CARDS */}
            {settingsTab === 'cards' && (
              <div className="glass">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>{renderIcon('card', 16)} Cartões de Crédito</h3>
                  <button className="btn-primary" onClick={() => setEditModal({ type: 'card', data: { id: '', name: '', icon: 'card', limit: '', used: 0, brand: '', color: '#FF6B9D' } })}>+ Novo Cartão</button>
                </div>
                {creditCards.length === 0 && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: 20 }}>Nenhum cartão cadastrado</p>}
                {creditCards.map(card => (
                  <div key={card.id} className="tx-row" style={{ cursor: 'pointer' }} onClick={() => setEditModal({ type: 'card', data: card })}>
                    {renderIcon(card.icon, 24)}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{card.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{card.brand || ''} · Limite: {formatBRL(card.limit)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#FF6B9D' }}>Fatura: {formatBRL(card.used || 0)}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Disponível: {formatBRL((card.limit || 0) - (card.used || 0))}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CATEGORIES */}
            {settingsTab === 'categories' && (
              <div>
                {/* Expense Cats */}
                <div className="glass" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{renderIcon('chart_bar', 16)} Categorias de Despesa</h3>
                    <button className="btn-primary" onClick={() => setEditModal({ type: 'expense_cat', data: { id: '', name: '', icon: 'box', budgetType: 'monthly', monthlyBudget: '', annualBudget: {} } })}>+ Nova</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
                    {expenseCats.map(cat => (
                      <div key={cat.id} className="glass hoverable" style={{ padding: '12px 16px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }} onClick={() => setEditModal({ type: 'expense_cat', data: cat })}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {renderIcon(cat.icon, 20)}
                          <div><div style={{ fontSize: 13, fontWeight: 600 }}>{cat.name}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{cat.budgetType === 'annual' ? 'Anual variável' : `${formatBRL(cat.monthlyBudget)}/mês`}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Income Cats */}
                <div className="glass">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{renderIcon('trending', 16)} Categorias de Receita</h3>
                    <button className="btn-primary" onClick={() => setEditModal({ type: 'income_cat', data: { id: '', name: '', icon: 'coins', budgetType: 'monthly', monthlyBudget: '', annualBudget: {} } })}>+ Nova</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
                    {incomeCats.map(cat => (
                      <div key={cat.id} className="glass hoverable" style={{ padding: '12px 16px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }} onClick={() => setEditModal({ type: 'income_cat', data: cat })}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {renderIcon(cat.icon, 20)}
                          <div><div style={{ fontSize: 13, fontWeight: 600 }}>{cat.name}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{cat.budgetType === 'annual' ? 'Anual variável' : (cat.monthlyBudget ? `${formatBRL(cat.monthlyBudget)}/mês` : 'Sem previsão')}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* API KEY */}
            {settingsTab === 'apikey' && (
              <div className="glass" style={{ borderColor: apiKey ? 'rgba(105,240,174,0.15)' : 'rgba(255,215,64,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{ }}>{renderIcon('transfer', 24, 'rgba(178,77,255,0.5)')}</span>
                  <div><h3 style={{ fontSize: 16, fontWeight: 600 }}>API Key — Claude (Anthropic)</h3><p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Necessária para o scanner de recibos</p></div>
                  {apiKey ? <span className="badge badge-approved" style={{ marginLeft: 'auto' }}>OK</span> : <span className="badge badge-pending" style={{ marginLeft: 'auto' }}>{'...'}</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input className="glass-input" type={showApiKey?'text':'password'} placeholder="sk-ant-api03-..." value={apiKey} onChange={e=>setApiKey(e.target.value)} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }} />
                    <button onClick={()=>setShowApiKey(!showApiKey)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center' }}>{showApiKey ? <GlassIcon icon="shield" size={16} color="rgba(255,255,255,0.35)" /> : <GlassIcon icon="target" size={16} color="rgba(255,255,255,0.35)" />}</button>
                  </div>
                  <button className="btn-primary" onClick={()=>saveApiKeyFn(apiKey)}>Salvar</button>
                </div>
                <div style={{ marginTop: 14, padding: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}><strong style={{ color: 'rgba(255,255,255,0.5)' }}>Como obter:</strong> console.anthropic.com → API Keys → Create Key<br /><strong style={{ color: 'rgba(255,255,255,0.5)' }}>Custo:</strong> ~R$ 0,02 por foto escaneada<br />A chave fica salva apenas no seu navegador</p>
                </div>
              </div>
            )}

            {/* DATA */}
            {settingsTab === 'data' && (
              <div className="glass">
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>{renderIcon('archive', 16)} Gerenciar Dados</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[{ l: 'Transações', v: transactions.length, c: '#00E5FF' },{ l: 'Contas', v: bankAccounts.length, c: '#FFD740' },{ l: 'Cartões', v: creditCards.length, c: '#FF6B9D' },{ l: 'Bens', v: assets.length, c: '#69F0AE' }].map((s,i)=>(
                    <div key={i} style={{ textAlign: 'center', padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.04)' }}><div className="mono" style={{ fontSize: 24, fontWeight: 700, color: s.c }}>{s.v}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{s.l}</div></div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button className="btn-secondary" onClick={exportBackup} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}><span style={{ }}>{renderIcon('nav_down', 18, 'rgba(255,255,255,0.5)')}</span><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 600, fontSize: 13 }}>Exportar Backup</div><div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>Arquivo .json</div></div></button>
                  <button className="btn-secondary" onClick={()=>backupRef.current?.click()} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}><span>{renderIcon('archive', 18, 'rgba(255,255,255,0.5)')}</span><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 600, fontSize: 13 }}>Restaurar Backup</div><div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>Carregar .json</div></div></button>
                  <button onClick={clearAllData} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', gridColumn: 'span 2', background: 'rgba(255,107,157,0.08)', border: '1px solid rgba(255,107,157,0.2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#FF6B9D' }}><span style={{ }}>{renderIcon('archive', 18, '#FF6B9D')}</span><div style={{ fontWeight: 600, fontSize: 13 }}>Limpar Todos os Dados</div></button>
                </div>
              </div>
            )}

            {/* RECONCILE */}
            {settingsTab === 'reconcile' && (
              <div className="glass">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{ }}>{renderIcon('transfer', 24, 'rgba(178,77,255,0.5)')}</span>
                  <div><h3 style={{ fontSize: 16, fontWeight: 600 }}>Reconciliar Saldos</h3><p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Ficou tempo sem contabilizar? Atualize os saldos reais aqui.</p></div>
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20, lineHeight: 1.7 }}>Edite os saldos atuais das suas contas e o valor usado dos cartões. Isso ajusta tudo de uma vez sem precisar lançar transações retroativas.</p>
                {bankAccounts.length > 0 && <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>{renderIcon('bank', 14)} Contas Bancárias</div>}
                {bankAccounts.map(acc => (
                  <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    {renderIcon(acc.icon, 20)}
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{acc.name}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginRight: 8 }}>Atual: {formatBRL(acc.balance)}</span>
                    <input className="glass-input" type="number" placeholder="Novo saldo" style={{ width: 160 }} onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setBankAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, balance: v } : a)); notify(`${acc.name} atualizado!`); } }} />
                  </div>
                ))}
                {creditCards.length > 0 && <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 12, marginTop: 20 }}>{renderIcon('card', 14)} Cartões de Crédito</div>}
                {creditCards.map(card => (
                  <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    {renderIcon(card.icon, 20)}
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{card.name}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginRight: 8 }}>Fatura: {formatBRL(card.used || 0)}</span>
                    <input className="glass-input" type="number" placeholder="Valor fatura atual" style={{ width: 160 }} onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setCreditCards(prev => prev.map(c => c.id === card.id ? { ...c, used: v } : c)); notify(`${card.name} atualizado!`); } }} />
                  </div>
                ))}
                {bankAccounts.length === 0 && creditCards.length === 0 && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: 20 }}>Cadastre contas e cartões primeiro</p>}
              </div>
            )}
          </div>
        )}

        {/* ══════ MODALS ══════ */}
        {editModal?.type === 'bank' && (() => {
          const [d, setD] = [editModal.data, (fn) => setEditModal(prev => ({ ...prev, data: typeof fn === 'function' ? fn(prev.data) : fn }))];
          const isNew = !d.id;
          const save = () => {
            const item = { ...d, id: d.id || genId(), balance: parseFloat(d.balance) || 0, initialBalance: parseFloat(d.initialBalance) || parseFloat(d.balance) || 0 };
            if (!item.name) { notify('Nome obrigatório', 'error'); return; }
            if (isNew) setBankAccounts(prev => [...prev, item]);
            else setBankAccounts(prev => prev.map(a => a.id === item.id ? item : a));
            setEditModal(null); notify(isNew ? 'Conta criada!' : 'Conta atualizada!');
          };
          const remove = () => { setBankAccounts(prev => prev.filter(a => a.id !== d.id)); setEditModal(null); notify('Conta removida'); };
          return (
            <EditModal title={isNew ? 'Nova Conta Bancária' : 'Editar Conta'} onClose={() => setEditModal(null)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => setShowIconPicker({ value: d.icon, onChange: (v) => setD(p => ({ ...p, icon: v })) })} style={{ width: 56, height: 56, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.icon}</button>
                <input className="glass-input" placeholder="Nome da conta (ex: Nubank)" value={d.name} onChange={e => setD(p => ({ ...p, name: e.target.value }))} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Saldo Inicial</label><input className="glass-input" type="number" placeholder="0.00" value={d.initialBalance} onChange={e => setD(p => ({ ...p, initialBalance: e.target.value, balance: isNew ? e.target.value : p.balance }))} /></div>
                <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Saldo Atual</label><input className="glass-input" type="number" placeholder="0.00" value={d.balance} onChange={e => setD(p => ({ ...p, balance: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-primary" onClick={save} style={{ flex: 1 }}>Salvar</button>
                {!isNew && <button className="btn-danger" onClick={remove}>Remover</button>}
              </div>
            </EditModal>
          );
        })()}

        {editModal?.type === 'card' && (() => {
          const [d, setD] = [editModal.data, (fn) => setEditModal(prev => ({ ...prev, data: typeof fn === 'function' ? fn(prev.data) : fn }))];
          const isNew = !d.id;
          const save = () => {
            const item = { ...d, id: d.id || genId(), limit: parseFloat(d.limit) || 0, used: parseFloat(d.used) || 0 };
            if (!item.name) { notify('Nome obrigatório', 'error'); return; }
            if (isNew) setCreditCards(prev => [...prev, item]);
            else setCreditCards(prev => prev.map(c => c.id === item.id ? item : c));
            setEditModal(null); notify(isNew ? 'Cartão criado!' : 'Cartão atualizado!');
          };
          const remove = () => { setCreditCards(prev => prev.filter(c => c.id !== d.id)); setEditModal(null); notify('Cartão removido'); };
          return (
            <EditModal title={isNew ? 'Novo Cartão de Crédito' : 'Editar Cartão'} onClose={() => setEditModal(null)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => setShowIconPicker({ value: d.icon, onChange: (v) => setD(p => ({ ...p, icon: v })) })} style={{ width: 56, height: 56, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.icon}</button>
                <input className="glass-input" placeholder="Nome (ex: Amex Gold)" value={d.name} onChange={e => setD(p => ({ ...p, name: e.target.value }))} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Bandeira</label><input className="glass-input" placeholder="Visa, Master, Amex..." value={d.brand || ''} onChange={e => setD(p => ({ ...p, brand: e.target.value }))} /></div>
                <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Limite</label><input className="glass-input" type="number" placeholder="10000" value={d.limit} onChange={e => setD(p => ({ ...p, limit: e.target.value }))} /></div>
              </div>
              <div style={{ marginBottom: 16 }}><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Fatura Atual (valor usado)</label><input className="glass-input" type="number" placeholder="0" value={d.used || ''} onChange={e => setD(p => ({ ...p, used: e.target.value }))} /></div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-primary" onClick={save} style={{ flex: 1 }}>Salvar</button>
                {!isNew && <button className="btn-danger" onClick={remove}>Remover</button>}
              </div>
            </EditModal>
          );
        })()}

        {editModal?.type === 'expense_cat' && (() => {
          const [d, setD] = [editModal.data, (fn) => setEditModal(prev => ({ ...prev, data: typeof fn === 'function' ? fn(prev.data) : fn }))];
          const isNew = !d.id;
          const bType = d.budgetType || 'monthly';
          const save = () => {
            const item = { ...d, id: d.id || d.name.toLowerCase().replace(/[^a-z0-9]/g, '_'), monthlyBudget: parseFloat(d.monthlyBudget) || 0, budgetType: bType, annualBudget: d.annualBudget || {} };
            if (!item.name) { notify('Nome obrigatório', 'error'); return; }
            if (isNew) setExpenseCats(prev => [...prev, item]);
            else setExpenseCats(prev => prev.map(c => c.id === item.id ? item : c));
            setEditModal(null); notify('Categoria salva!');
          };
          const remove = () => { setExpenseCats(prev => prev.filter(c => c.id !== d.id)); setEditModal(null); notify('Categoria removida'); };
          return (
            <EditModal title={isNew ? 'Nova Categoria de Despesa' : 'Editar Categoria'} onClose={() => setEditModal(null)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => setShowIconPicker({ value: d.icon, onChange: (v) => setD(p => ({ ...p, icon: v })) })} style={{ width: 56, height: 56, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.icon}</button>
                <input className="glass-input" placeholder="Nome da categoria" value={d.name} onChange={e => setD(p => ({ ...p, name: e.target.value }))} style={{ flex: 1 }} />
              </div>
              {/* Budget type selector */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 8 }}>Tipo de Orçamento</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => setD(p => ({ ...p, budgetType: 'monthly' }))} style={{ padding: '12px 14px', borderRadius: 12, border: bType === 'monthly' ? '1px solid #B24DFF' : '1px solid rgba(255,255,255,0.08)', background: bType === 'monthly' ? 'rgba(178,77,255,0.12)' : 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{renderIcon('clock', 14)} Mensal Fixo</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Mesmo valor todo mês</div>
                  </button>
                  <button onClick={() => setD(p => ({ ...p, budgetType: 'annual' }))} style={{ padding: '12px 14px', borderRadius: 12, border: bType === 'annual' ? '1px solid #FFD740' : '1px solid rgba(255,255,255,0.08)', background: bType === 'annual' ? 'rgba(255,215,64,0.08)' : 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{renderIcon('flag', 14)} Anual Variável</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Personalizar por mês</div>
                  </button>
                </div>
              </div>
              {bType === 'monthly' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Orçamento Mensal (R$)</label>
                  <input className="glass-input" type="number" placeholder="1000" value={d.monthlyBudget || ''} onChange={e => setD(p => ({ ...p, monthlyBudget: e.target.value }))} />
                </div>
              )}
              {bType === 'annual' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 8 }}>Orçamento por Mês (R$)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    {MONTHS_FULL.map((m, i) => (
                      <div key={i}>
                        <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 2 }}>{MONTHS[i]}</label>
                        <input className="glass-input" type="number" placeholder="0" style={{ padding: '8px 10px', fontSize: 12 }} value={(d.annualBudget || {})[i + 1] || ''} onChange={e => setD(p => ({ ...p, annualBudget: { ...(p.annualBudget || {}), [i + 1]: parseFloat(e.target.value) || 0 } }))} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Total anual: <span className="mono" style={{ color: '#B24DFF' }}>{formatBRL(Object.values(d.annualBudget || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0))}</span></div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-primary" onClick={save} style={{ flex: 1 }}>Salvar</button>
                {!isNew && <button className="btn-danger" onClick={remove}>Remover</button>}
              </div>
            </EditModal>
          );
        })()}

        {editModal?.type === 'income_cat' && (() => {
          const [d, setD] = [editModal.data, (fn) => setEditModal(prev => ({ ...prev, data: typeof fn === 'function' ? fn(prev.data) : fn }))];
          const isNew = !d.id;
          const bType = d.budgetType || 'monthly';
          const save = () => {
            const item = { ...d, id: d.id || d.name.toLowerCase().replace(/[^a-z0-9]/g, '_'), monthlyBudget: parseFloat(d.monthlyBudget) || 0, budgetType: bType, annualBudget: d.annualBudget || {} };
            if (!item.name) { notify('Nome obrigatório', 'error'); return; }
            if (isNew) setIncomeCats(prev => [...prev, item]);
            else setIncomeCats(prev => prev.map(c => c.id === item.id ? item : c));
            setEditModal(null); notify('Categoria salva!');
          };
          const remove = () => { setIncomeCats(prev => prev.filter(c => c.id !== d.id)); setEditModal(null); notify('Categoria removida'); };
          return (
            <EditModal title={isNew ? 'Nova Categoria de Receita' : 'Editar Categoria'} onClose={() => setEditModal(null)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => setShowIconPicker({ value: d.icon, onChange: (v) => setD(p => ({ ...p, icon: v })) })} style={{ width: 56, height: 56, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.icon}</button>
                <input className="glass-input" placeholder="Nome da categoria" value={d.name} onChange={e => setD(p => ({ ...p, name: e.target.value }))} style={{ flex: 1 }} />
              </div>
              {/* Budget type selector */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 8 }}>Tipo de Previsão</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => setD(p => ({ ...p, budgetType: 'monthly' }))} style={{ padding: '12px 14px', borderRadius: 12, border: bType === 'monthly' ? '1px solid #69F0AE' : '1px solid rgba(255,255,255,0.08)', background: bType === 'monthly' ? 'rgba(105,240,174,0.08)' : 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{renderIcon('clock', 14)} Mensal Fixo</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Mesmo valor todo mês</div>
                  </button>
                  <button onClick={() => setD(p => ({ ...p, budgetType: 'annual' }))} style={{ padding: '12px 14px', borderRadius: 12, border: bType === 'annual' ? '1px solid #FFD740' : '1px solid rgba(255,255,255,0.08)', background: bType === 'annual' ? 'rgba(255,215,64,0.08)' : 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{renderIcon('flag', 14)} Anual Variável</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Personalizar por mês</div>
                  </button>
                </div>
              </div>
              {bType === 'monthly' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Previsão Mensal (R$)</label>
                  <input className="glass-input" type="number" placeholder="12000" value={d.monthlyBudget || ''} onChange={e => setD(p => ({ ...p, monthlyBudget: e.target.value }))} />
                </div>
              )}
              {bType === 'annual' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 8 }}>Previsão por Mês (R$)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    {MONTHS_FULL.map((m, i) => (
                      <div key={i}>
                        <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 2 }}>{MONTHS[i]}</label>
                        <input className="glass-input" type="number" placeholder="0" style={{ padding: '8px 10px', fontSize: 12 }} value={(d.annualBudget || {})[i + 1] || ''} onChange={e => setD(p => ({ ...p, annualBudget: { ...(p.annualBudget || {}), [i + 1]: parseFloat(e.target.value) || 0 } }))} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Total anual: <span className="mono" style={{ color: '#69F0AE' }}>{formatBRL(Object.values(d.annualBudget || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0))}</span></div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-primary" onClick={save} style={{ flex: 1 }}>Salvar</button>
                {!isNew && <button className="btn-danger" onClick={remove}>Remover</button>}
              </div>
            </EditModal>
          );
        })()}

        {editModal?.type === 'asset' && (() => {
          const [d, setD] = [editModal.data, (fn) => setEditModal(prev => ({ ...prev, data: typeof fn === 'function' ? fn(prev.data) : fn }))];
          const isNew = !d.id;
          const save = () => {
            const item = { ...d, id: d.id || genId(), value: parseFloat(d.value) || 0 };
            if (!item.name) { notify('Nome obrigatório', 'error'); return; }
            if (isNew) setAssets(prev => [...prev, item]);
            else setAssets(prev => prev.map(a => a.id === item.id ? item : a));
            setEditModal(null); notify(isNew ? 'Bem cadastrado!' : 'Bem atualizado!');
          };
          const remove = () => { setAssets(prev => prev.filter(a => a.id !== d.id)); setEditModal(null); notify('Bem removido'); };
          return (
            <EditModal title={isNew ? 'Novo Bem' : 'Editar Bem'} onClose={() => setEditModal(null)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => setShowIconPicker({ value: d.icon, onChange: (v) => setD(p => ({ ...p, icon: v })) })} style={{ width: 56, height: 56, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.icon}</button>
                <input className="glass-input" placeholder="Nome (ex: Apartamento 302)" value={d.name} onChange={e => setD(p => ({ ...p, name: e.target.value }))} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Categoria</label><input className="glass-input" placeholder="Imóvel, Veículo, etc." value={d.category || ''} onChange={e => setD(p => ({ ...p, category: e.target.value }))} /></div>
                <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Valor Atual (R$)</label><input className="glass-input" type="number" placeholder="500000" value={d.value} onChange={e => setD(p => ({ ...p, value: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Data Aquisição</label><input className="glass-input" type="date" value={d.acquiredDate || ''} onChange={e => setD(p => ({ ...p, acquiredDate: e.target.value }))} /></div>
                <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Observações</label><input className="glass-input" placeholder="Notas..." value={d.notes || ''} onChange={e => setD(p => ({ ...p, notes: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-primary" onClick={save} style={{ flex: 1 }}>Salvar</button>
                {!isNew && <button className="btn-danger" onClick={remove}>Remover</button>}
              </div>
            </EditModal>
          );
        })()}

        {editModal?.type === 'investment' && (() => {
          const [d, setD] = [editModal.data, (fn) => setEditModal(prev => ({ ...prev, data: typeof fn === 'function' ? fn(prev.data) : fn }))];
          const isNew = !d.id;
          const save = () => {
            const item = { ...d, id: d.id || genId() };
            if (!item.institution) { notify('Instituição obrigatória', 'error'); return; }
            if (isNew) setInvestments(prev => [...prev, item]);
            else setInvestments(prev => prev.map(x => x.id === item.id ? item : x));
            setEditModal(null); notify(isNew ? 'Investimento criado!' : 'Investimento atualizado!');
          };
          return (
            <EditModal title={isNew ? 'Novo Investimento' : 'Editar Investimento'} onClose={() => setEditModal(null)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => setShowIconPicker({ value: d.icon, onChange: (v) => setD(p => ({ ...p, icon: v })) })} style={{ width: 56, height: 56, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.icon}</button>
                <input className="glass-input" placeholder="Instituição (ex: XP, BTG, Rico)" value={d.institution || ''} onChange={e => setD(p => ({ ...p, institution: e.target.value }))} style={{ flex: 1 }} />
              </div>
              <div style={{ marginBottom: 16 }}><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Categoria (ex: Renda Fixa, Ações, FII)</label><input className="glass-input" placeholder="Você define..." value={d.category || ''} onChange={e => setD(p => ({ ...p, category: e.target.value }))} /></div>
              <button className="btn-primary" onClick={save} style={{ width: '100%' }}>Salvar</button>
            </EditModal>
          );
        })()}

        {editModal?.type === 'update_position' && (() => {
          const inv = editModal.data;
          const [month, setMonth] = [editModal.month || `${MONTHS[cm]}/${cy}`, (v) => setEditModal(prev => ({ ...prev, month: v }))];
          const [value, setValue] = [editModal.value || '', (v) => setEditModal(prev => ({ ...prev, value: v }))];
          const [contribution, setContribution] = [editModal.contribution || '', (v) => setEditModal(prev => ({ ...prev, contribution: v }))];
          const save = () => {
            const val = parseFloat(value);
            if (isNaN(val)) { notify('Valor obrigatório', 'error'); return; }
            const entry = { month, value: val, contribution: parseFloat(contribution) || 0, date: today.toISOString() };
            setInvestments(prev => prev.map(x => x.id === inv.id ? { ...x, history: [...(x.history || []), entry] } : x));
            setEditModal(null); notify('Posição atualizada!');
          };
          return (
            <EditModal title={`Atualizar Posição — ${inv.institution}`} onClose={() => setEditModal(null)}>
              <div style={{ marginBottom: 16 }}><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Mês/Ano</label><input className="glass-input" placeholder="Fev/2026" value={month} onChange={e => setMonth(e.target.value)} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Posição Consolidada (R$)</label><input className="glass-input" type="number" placeholder="Valor total atual" value={value} onChange={e => setValue(e.target.value)} /></div>
                <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Aporte do Mês (R$)</label><input className="glass-input" type="number" placeholder="Quanto aportou (0 se nada)" value={contribution} onChange={e => setContribution(e.target.value)} /></div>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 16, lineHeight: 1.6 }}>A rentabilidade é calculada automaticamente: Posição atual - Posição anterior - Aporte = Rendimento</p>
              <button className="btn-primary" onClick={save} style={{ width: '100%' }}>Registrar Posição</button>
            </EditModal>
          );
        })()}

      </main>
      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        {navItems.slice(0, 6).map(n => (
          <button key={n.id} className={`mobile-nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
            <GlassIcon icon={n.icon} size={18} color={page === n.id ? '#B24DFF' : 'rgba(255,255,255,0.5)'} />
            <span style={{ fontSize: 9 }}>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
