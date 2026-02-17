'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CATEGORIES, MONTHS, formatBRL, genId, defaultAccounts } from '@/lib/constants';
import { loadData, saveData } from '@/lib/storage';
import { computeForecast } from '@/lib/forecast';
import { parseImportFile } from '@/lib/importParser';

const today = new Date();
const currentMonth = today.getMonth();
const currentYear = today.getFullYear();

/* ─── Sample data generator ─── */
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
    { desc: 'Tesouro Direto', cat: 'investimentos', min: 500, max: 2000 },
  ];
  for (let m = 0; m < 6; m++) {
    const month = currentMonth - 5 + m;
    const yr = month < 0 ? currentYear - 1 : currentYear;
    const mo = ((month % 12) + 12) % 12;
    for (let i = 0; i < 10 + Math.floor(Math.random() * 6); i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const day = 1 + Math.floor(Math.random() * 27);
      tx.push({ id: genId(), date: `${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`, description: t.desc, category: t.cat, amount: -(t.min + Math.random() * (t.max - t.min)), type: 'expense' });
    }
    tx.push({ id: genId(), date: `${yr}-${String(mo+1).padStart(2,'0')}-05`, description: 'Salário DSA', category: 'renda', amount: 12000, type: 'income' });
  }
  return tx.sort((a, b) => b.date.localeCompare(a.date));
}

/* ─── Background Mesh ─── */
function BackgroundMesh() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a0015 0%, #0d0030 25%, #050520 50%, #001a1a 75%, #000d1a 100%)' }} />
      <div className="orb orb1" /><div className="orb orb2" /><div className="orb orb3" /><div className="orb orb4" /><div className="orb orb5" />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.02, backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
    </div>
  );
}

/* ─── Glass Ring ─── */
function GlassRing({ value, max, size = 60, color = '#B24DFF' }) {
  const pct = Math.min((value / max) * 100, 100);
  const r = (size - 10) / 2, circ = 2 * Math.PI * r, offset = circ - (pct / 100) * circ;
  const c = value > max ? '#FF6B9D' : color;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 6px ${c}44)` }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={5} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */
export default function FinFlowApp() {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState(defaultAccounts);
  const [budgets, setBudgets] = useState(() => {
    const b = {}; CATEGORIES.forEach(c => { b[c.id] = c.budget; }); return b;
  });
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showAddTx, setShowAddTx] = useState(false);
  const [newTx, setNewTx] = useState({ description: '', amount: '', category: 'alimentacao', type: 'expense', date: today.toISOString().split('T')[0] });
  const [notification, setNotification] = useState(null);
  const [forecastMonths, setForecastMonths] = useState(6);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasSampleData, setHasSampleData] = useState(false);

  // Import state
  const [importStaging, setImportStaging] = useState([]);
  const [importHistory, setImportHistory] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importDragActive, setImportDragActive] = useState(false);

  const fileRef = useRef(null);
  const importRef = useRef(null);
  const backupRef = useRef(null);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Load data
  useEffect(() => {
    const data = loadData();
    if (data?.transactions?.length) {
      setTransactions(data.transactions);
      if (data.accounts) setAccounts(data.accounts);
      if (data.budgets) setBudgets(data.budgets);
      if (data.importHistory) setImportHistory(data.importHistory);
      setHasSampleData(!!data.isSampleData);
    } else {
      setTransactions(generateSampleData());
      setHasSampleData(true);
    }
    // Load API key separately (not in main data)
    try { const k = localStorage.getItem('finflow-api-key'); if (k) setApiKey(k); } catch {}
    setLoading(false);
  }, []);

  // Save data
  useEffect(() => {
    if (!loading) saveData({ transactions, accounts, budgets, importHistory, isSampleData: hasSampleData });
  }, [transactions, accounts, budgets, importHistory, hasSampleData, loading]);

  // Add transaction
  const addTransaction = useCallback((tx) => {
    const t = { ...tx, id: tx.id || genId(), amount: tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount) };
    setTransactions(prev => [t, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  // Receipt scanner
  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!apiKey) { notify('Configure sua API Key em Configurações primeiro!', 'error'); setPage('settings'); return; }
    setScanning(true); setScanResult(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const b64 = reader.result.split(',')[1];
        const resp = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: b64, apiKey }),
        });
        const data = await resp.json();
        if (!resp.ok) { notify(data.error || 'Erro ao escanear.', 'error'); setScanning(false); return; }
        setScanResult(data.data);
        notify('Recibo escaneado!');
      } catch { notify('Falha na leitura. Tente novamente.', 'error'); }
      setScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const confirmScan = () => {
    if (scanResult) {
      addTransaction({ description: scanResult.description, amount: scanResult.amount, category: scanResult.category, type: 'expense', date: scanResult.date || today.toISOString().split('T')[0] });
      setScanResult(null);
      notify('"' + scanResult.description + '" lançado!');
    }
  };

  const handleAddManual = () => {
    if (!newTx.description || !newTx.amount) return;
    addTransaction({ ...newTx, amount: parseFloat(newTx.amount) });
    notify('"' + newTx.description + '" lançado!');
    setNewTx({ description: '', amount: '', category: 'alimentacao', type: 'expense', date: today.toISOString().split('T')[0] });
    setShowAddTx(false);
  };

  /* ── Import Functions ── */
  const handleImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const parsed = await parseImportFile(file);
      setImportStaging(prev => [...prev, ...parsed]);
      notify(`${parsed.length} transações importadas de "${file.name}"!`);
    } catch (err) {
      notify(err.message, 'error');
    }
    setImporting(false);
  };

  const handleImportDrop = (e) => {
    e.preventDefault(); setImportDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImportFile(file);
  };

  const updateStagingItem = (id, updates) => {
    setImportStaging(prev => prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx));
  };

  const approveAll = () => {
    setImportStaging(prev => prev.map(tx => tx.importStatus === 'pending' ? { ...tx, importStatus: 'approved' } : tx));
  };

  const rejectAll = () => {
    setImportStaging(prev => prev.map(tx => tx.importStatus === 'pending' ? { ...tx, importStatus: 'rejected' } : tx));
  };

  const confirmImport = () => {
    const approved = importStaging.filter(tx => tx.importStatus === 'approved');
    if (approved.length === 0) { notify('Nenhuma transação aprovada.', 'error'); return; }

    approved.forEach(tx => {
      addTransaction({ description: tx.description, amount: tx.amount, category: tx.category, type: tx.type, date: tx.date });
    });

    const historyEntry = {
      id: genId(),
      date: new Date().toISOString(),
      fileName: approved[0]?.importSource || 'Importação',
      total: importStaging.length,
      approved: approved.length,
      rejected: importStaging.filter(tx => tx.importStatus === 'rejected').length,
    };

    setImportHistory(prev => [historyEntry, ...prev]);
    setImportStaging([]);
    notify(`${approved.length} transações confirmadas!`);
  };

  const clearStaging = () => { setImportStaging([]); };

  /* ── Settings Functions ── */
  const saveApiKey = (key) => {
    setApiKey(key);
    try { localStorage.setItem('finflow-api-key', key); } catch {}
    notify('API Key salva!');
  };

  const clearAllData = () => {
    setTransactions([]);
    setImportHistory([]);
    setImportStaging([]);
    setAccounts(defaultAccounts);
    const b = {}; CATEGORIES.forEach(c => { b[c.id] = c.budget; }); setBudgets(b);
    setHasSampleData(false);
    notify('Todos os dados foram limpos!');
  };

  const clearAndLoadSample = () => {
    setTransactions(generateSampleData());
    setHasSampleData(true);
    notify('Dados de exemplo carregados!');
  };

  const exportBackup = () => {
    const data = { transactions, accounts, budgets, importHistory, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `finflow-backup-${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
    notify('Backup exportado!');
  };

  const importBackupFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.transactions) {
          setTransactions(data.transactions);
          if (data.accounts) setAccounts(data.accounts);
          if (data.budgets) setBudgets(data.budgets);
          if (data.importHistory) setImportHistory(data.importHistory);
          setHasSampleData(false);
          notify(`Backup restaurado! ${data.transactions.length} transações carregadas.`);
        } else { notify('Arquivo inválido.', 'error'); }
      } catch { notify('Erro ao ler o backup.', 'error'); }
    };
    reader.readAsText(file);
  };

  /* ── Computed values ── */
  const fd = useMemo(() => computeForecast(transactions, accounts), [transactions, accounts]);
  const thisMonthTx = transactions.filter(tx => { const d = new Date(tx.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
  const thisMonthIncome = thisMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const thisMonthExpense = thisMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const catExpenses = {};
  thisMonthTx.filter(t => t.type === 'expense').forEach(t => { if (!catExpenses[t.category]) catExpenses[t.category] = 0; catExpenses[t.category] += Math.abs(t.amount); });

  const pendingCount = importStaging.filter(t => t.importStatus === 'pending').length;
  const approvedCount = importStaging.filter(t => t.importStatus === 'approved').length;
  const rejectedCount = importStaging.filter(t => t.importStatus === 'rejected').length;

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <BackgroundMesh /><div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}><div className="loader" /><p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 20, letterSpacing: 1 }}>Carregando FinFlow...</p></div>
    </div>
  );

  const navItems = [
    { id: 'dashboard', icon: '⬡', label: 'Dashboard' },
    { id: 'transactions', icon: '⇄', label: 'Lançamentos' },
    { id: 'import', icon: '⤓', label: 'Importar' },
    { id: 'scan', icon: '◎', label: 'Escanear' },
    { id: 'budget', icon: '◉', label: 'Orçamento' },
    { id: 'forecast', icon: '◐', label: 'Forecast' },
    { id: 'accounts', icon: '◧', label: 'Contas' },
    { id: 'settings', icon: '⚙', label: 'Config.' },
  ];

  return (
    <div className="app-layout">
      <BackgroundMesh />

      {/* Notification */}
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 100, animation: 'notifSlide 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="glass" style={{ padding: '14px 24px', borderColor: notification.type === 'error' ? 'rgba(255,107,157,0.3)' : 'rgba(105,240,174,0.3)', boxShadow: notification.type === 'error' ? '0 0 30px rgba(255,107,157,0.15)' : '0 0 30px rgba(105,240,174,0.15)' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{notification.type === 'error' ? '⚠️' : '✅'} {notification.msg}</span>
          </div>
        </div>
      )}

      {/* ─── SIDEBAR ─── */}
      <nav className="sidebar">
        <div className="sidebar-logo" style={{ padding: '0 24px', marginBottom: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#B24DFF,#00E5FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, boxShadow: '0 0 20px rgba(178,77,255,0.4)' }}>F</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>FinFlow</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: -1 }}>Liquid Glass</div>
          </div>
        </div>
        <div className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 12px', flex: 1 }}>
          {navItems.map(n => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
              <span style={{ fontSize: 17, width: 26, textAlign: 'center', opacity: page === n.id ? 1 : 0.6 }}>{n.icon}</span>
              <span>{n.label}</span>
              {n.id === 'import' && importStaging.length > 0 && (
                <span style={{ marginLeft: 'auto', background: 'rgba(255,215,64,0.2)', color: '#FFD740', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{importStaging.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="sidebar-footer" style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6, letterSpacing: 0.5 }}>FinFlow v2.0 — 2026<br />Powered by Claude AI</div>
        </div>
      </nav>

      {/* ─── MAIN CONTENT ─── */}
      <main className="main-content">
        {/* Hidden file inputs */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} style={{ display: 'none' }} />
        <input ref={importRef} type="file" accept=".csv,.ofx,.qfx,.tsv,.txt" onChange={(e) => { handleImportFile(e.target.files?.[0]); e.target.value = ''; }} style={{ display: 'none' }} />
        <input ref={backupRef} type="file" accept=".json" onChange={(e) => { if (e.target.files?.[0]) importBackupFile(e.target.files[0]); e.target.value = ''; }} style={{ display: 'none' }} />

        {/* ══════ DASHBOARD ══════ */}
        {page === 'dashboard' && (
          <div className="stagger">
            {hasSampleData && (
              <div className="glass" style={{ marginBottom: 20, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14, borderColor: 'rgba(255,215,64,0.3)', background: 'rgba(255,215,64,0.05)' }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#FFD740' }}>Dados de exemplo carregados</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Estes são dados fictícios para demonstração. Limpe para começar com seus dados reais.</div>
                </div>
                <button className="btn-danger" onClick={() => { clearAllData(); }} style={{ whiteSpace: 'nowrap' }}>🗑 Limpar dados</button>
              </div>
            )}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div>
                <h1 className="page-title gradient-text" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>Dashboard</h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <button className="btn-primary" onClick={() => { setShowAddTx(true); setPage('transactions'); }}>+ Novo Lançamento</button>
            </div>

            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Patrimônio Total', value: formatBRL(totalBalance), color: '#B24DFF', sub: `${accounts.length} contas` },
                { label: 'Receita do Mês', value: formatBRL(thisMonthIncome), color: '#69F0AE', sub: `${((thisMonthIncome / (fd.avgIncome || 1) - 1) * 100).toFixed(1)}% vs média` },
                { label: 'Despesa do Mês', value: formatBRL(thisMonthExpense), color: '#FF6B9D', sub: `${((thisMonthExpense / (fd.avgExpense || 1)) * 100).toFixed(0)}% do orçamento` },
                { label: 'Saldo do Mês', value: formatBRL(thisMonthIncome - thisMonthExpense), color: thisMonthIncome - thisMonthExpense >= 0 ? '#69F0AE' : '#FF6B9D', sub: `Economia: ${thisMonthIncome > 0 ? ((1 - thisMonthExpense / thisMonthIncome) * 100).toFixed(1) : 0}%` },
              ].map((k, i) => (
                <div key={i} className="glass hoverable" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${k.color},transparent)`, opacity: 0.6 }} />
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>{k.label}</div>
                  <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: k.color, textShadow: `0 0 30px ${k.color}33` }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div className="glass">
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 20 }}>Evolução Mensal</h3>
                <div style={{ display: 'flex', gap: 20 }}>
                  {[{ label: 'Receitas', data: fd.monthlyData.slice(-6).map(([, d]) => d.income), max: fd.avgIncome * 1.4, color: '#69F0AE' },
                    { label: 'Despesas', data: fd.monthlyData.slice(-6).map(([, d]) => d.expense), max: fd.avgExpense * 1.4, color: '#FF6B9D' }].map((s, si) => (
                    <div key={si} style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>{s.label}</div>
                      <div style={{ display: 'flex', alignItems: 'end', gap: 4, height: 90 }}>
                        {s.data.map((v, i) => (
                          <div key={i} style={{ flex: 1, background: `linear-gradient(180deg,${s.color}${i === s.data.length - 1 ? '' : '66'},${s.color}11)`, height: `${Math.max(8, (v / (s.max || 1)) * 100)}%`, borderRadius: 6, transition: 'height 0.8s cubic-bezier(0.16,1,0.3,1)', boxShadow: i === s.data.length - 1 ? `0 0 12px ${s.color}44` : 'none' }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass">
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>Gastos por Categoria</h3>
                {CATEGORIES.filter(c => catExpenses[c.id]).sort((a, b) => (catExpenses[b.id] || 0) - (catExpenses[a.id] || 0)).slice(0, 5).map(cat => {
                  const spent = catExpenses[cat.id] || 0, budget = budgets[cat.id] || cat.budget, pct = Math.min((spent / budget) * 100, 100);
                  return (
                    <div key={cat.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{cat.icon} {cat.name}</span>
                        <span className="mono" style={{ fontSize: 12, color: spent > budget ? '#FF6B9D' : 'rgba(255,255,255,0.5)' }}>{formatBRL(spent)}<span style={{ opacity: 0.4 }}> / {formatBRL(budget)}</span></span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: spent > budget ? 'linear-gradient(90deg,#FF6B9D,#FF2D7B)' : `linear-gradient(90deg,${cat.color}88,${cat.color})`, borderRadius: 6, transition: 'width 1s cubic-bezier(0.16,1,0.3,1)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Últimos Lançamentos</h3>
                <button className="chip" onClick={() => setPage('transactions')}>Ver todos →</button>
              </div>
              {transactions.slice(0, 7).map(tx => { const cat = CATEGORIES.find(c => c.id === tx.category); return (
                <div key={tx.id} className="tx-row">
                  <div style={{ width: 40, height: 40, borderRadius: 14, background: `linear-gradient(135deg,${cat?.color || '#69F0AE'}22,${cat?.color || '#69F0AE'}08)`, border: `1px solid ${cat?.color || '#69F0AE'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{tx.type === 'income' ? '💰' : cat?.icon || '📦'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.description}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')} · {tx.type === 'income' ? 'Renda' : cat?.name}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: tx.amount >= 0 ? '#69F0AE' : '#FF6B9D' }}>{tx.amount >= 0 ? '+' : ''}{formatBRL(tx.amount)}</div>
                </div>
              ); })}
            </div>
          </div>
        )}

        {/* ══════ TRANSACTIONS ══════ */}
        {page === 'transactions' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h1 className="page-title" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, background: 'linear-gradient(135deg,#fff 30%,#00E5FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lançamentos</h1>
              <button className="btn-primary" onClick={() => setShowAddTx(!showAddTx)}>{showAddTx ? '✕ Cancelar' : '+ Novo'}</button>
            </div>
            {showAddTx && (
              <div className="glass" style={{ marginBottom: 20, borderColor: 'rgba(178,77,255,0.2)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>Novo Lançamento</h3>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <input className="glass-input" placeholder="Descrição" value={newTx.description} onChange={e => setNewTx({ ...newTx, description: e.target.value })} />
                  <input className="glass-input" placeholder="Valor (R$)" type="number" step="0.01" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} />
                  <input className="glass-input" type="date" value={newTx.date} onChange={e => setNewTx({ ...newTx, date: e.target.value })} />
                  <select className="glass-input" value={newTx.category} onChange={e => setNewTx({ ...newTx, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                  <select className="glass-input" value={newTx.type} onChange={e => setNewTx({ ...newTx, type: e.target.value })}>
                    <option value="expense">Despesa</option><option value="income">Receita</option>
                  </select>
                  <button className="btn-primary" onClick={handleAddManual}>Lançar ✓</button>
                </div>
              </div>
            )}
            <div className="glass">
              {transactions.slice(0, 50).map(tx => { const cat = CATEGORIES.find(c => c.id === tx.category); return (
                <div key={tx.id} className="tx-row">
                  <div style={{ width: 40, height: 40, borderRadius: 14, background: `linear-gradient(135deg,${cat?.color || '#69F0AE'}22,${cat?.color || '#69F0AE'}08)`, border: `1px solid ${cat?.color || '#69F0AE'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{tx.type === 'income' ? '💰' : cat?.icon || '📦'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.description}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')} · {tx.type === 'income' ? 'Renda' : cat?.name}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: tx.amount >= 0 ? '#69F0AE' : '#FF6B9D' }}>{tx.amount >= 0 ? '+' : ''}{formatBRL(tx.amount)}</div>
                </div>
              ); })}
            </div>
          </div>
        )}

        {/* ══════ IMPORT ══════ */}
        {page === 'import' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div>
                <h1 className="page-title" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, background: 'linear-gradient(135deg,#fff 30%,#FFD740)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Importar Dados</h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Importe extratos CSV ou OFX do seu banco</p>
              </div>
              {importStaging.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-pending">⏳ {pendingCount} pendentes</span>
                  <span className="badge badge-approved">✓ {approvedCount} aprovados</span>
                  <span className="badge badge-rejected">✕ {rejectedCount} rejeitados</span>
                </div>
              )}
            </div>

            {/* Dropzone */}
            {importStaging.length === 0 && (
              <div className={`dropzone ${importDragActive ? 'active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setImportDragActive(true); }}
                onDragLeave={() => setImportDragActive(false)}
                onDrop={handleImportDrop}
                onClick={() => importRef.current?.click()}>
                {importing ? (
                  <div><div className="loader" /><p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16 }}>Processando arquivo...</p></div>
                ) : (
                  <>
                    <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.6 }}>⤓</div>
                    <p style={{ fontSize: 17, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>Arraste o arquivo aqui ou clique para selecionar</p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 24, lineHeight: 1.6 }}>Aceita CSV, OFX e QFX — extratos do Nubank, BB, Itaú, Bradesco, etc.</p>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {['CSV', 'OFX', 'QFX'].map(f => (
                        <span key={f} style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>.{f.toLowerCase()}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Staging Area */}
            {importStaging.length > 0 && (
              <>
                {/* Action bar */}
                <div className="glass" style={{ marginBottom: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button className="btn-primary" onClick={() => importRef.current?.click()} style={{ fontSize: 12, padding: '8px 16px' }}>+ Importar mais</button>
                  <div style={{ flex: 1 }} />
                  <button className="btn-success" onClick={approveAll}>✓ Aprovar Todos ({pendingCount})</button>
                  <button className="btn-danger" onClick={rejectAll}>✕ Rejeitar Todos</button>
                  <button className="btn-secondary" onClick={clearStaging} style={{ fontSize: 12, padding: '8px 16px' }}>🗑 Limpar</button>
                  <button className="btn-primary" onClick={confirmImport} disabled={approvedCount === 0} style={{ boxShadow: approvedCount > 0 ? '0 4px 20px rgba(105,240,174,0.3)' : 'none', background: approvedCount > 0 ? 'linear-gradient(135deg,#69F0AE,#38A169)' : undefined }}>
                    Confirmar {approvedCount} lançamento{approvedCount !== 1 ? 's' : ''} →
                  </button>
                </div>

                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 120px 140px 140px', gap: 12, padding: '0 16px 8px', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }} className="import-header">
                  <span>Status</span><span>Transação</span><span style={{ textAlign: 'right' }}>Valor</span><span>Categoria</span><span>Ações</span>
                </div>

                {/* Transaction rows */}
                <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                  {importStaging.map((tx) => {
                    const cat = CATEGORIES.find(c => c.id === tx.category);
                    return (
                      <div key={tx.id} className={`import-row ${tx.importStatus}`}>
                        {/* Status icon */}
                        <div style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                          background: tx.importStatus === 'approved' ? 'rgba(105,240,174,0.15)' : tx.importStatus === 'rejected' ? 'rgba(255,107,157,0.15)' : 'rgba(255,215,64,0.1)',
                          border: `1px solid ${tx.importStatus === 'approved' ? 'rgba(105,240,174,0.3)' : tx.importStatus === 'rejected' ? 'rgba(255,107,157,0.3)' : 'rgba(255,215,64,0.2)'}` }}>
                          {tx.importStatus === 'approved' ? '✓' : tx.importStatus === 'rejected' ? '✕' : '⏳'}
                        </div>

                        {/* Description & Date */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.description}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')} · {tx.importSource}</div>
                        </div>

                        {/* Amount */}
                        <div className="mono" style={{ fontSize: 14, fontWeight: 600, textAlign: 'right', color: tx.amount >= 0 ? '#69F0AE' : '#FF6B9D' }}>
                          {tx.amount >= 0 ? '+' : ''}{formatBRL(tx.amount)}
                        </div>

                        {/* Category selector */}
                        <select className="glass-input" value={tx.category} onChange={(e) => updateStagingItem(tx.id, { category: e.target.value })}
                          style={{ fontSize: 11, padding: '6px 8px' }}>
                          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                        </select>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          {tx.importStatus !== 'approved' && (
                            <button className="btn-success" onClick={() => updateStagingItem(tx.id, { importStatus: 'approved' })} style={{ padding: '6px 10px', fontSize: 11 }}>✓</button>
                          )}
                          {tx.importStatus !== 'rejected' && (
                            <button className="btn-danger" onClick={() => updateStagingItem(tx.id, { importStatus: 'rejected' })} style={{ padding: '6px 10px', fontSize: 11 }}>✕</button>
                          )}
                          {tx.importStatus !== 'pending' && (
                            <button className="chip" onClick={() => updateStagingItem(tx.id, { importStatus: 'pending' })} style={{ padding: '6px 10px', fontSize: 11 }}>↺</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* How it works + Import History */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }} className="charts-grid">
              <div className="glass">
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 20 }}>Como exportar do seu banco</h3>
                {[
                  { bank: '💜 Nubank', steps: 'App → Conta → Extrato → ⋮ → Exportar → CSV' },
                  { bank: '🟡 Banco do Brasil', steps: 'App/Site → Conta Corrente → Extrato → Salvar → OFX ou CSV' },
                  { bank: '🔶 Itaú', steps: 'Site → Extrato → Exportar → OFX' },
                  { bank: '🔴 Bradesco', steps: 'Site → Extrato → Salvar como → OFX' },
                  { bank: '🔴 Santander', steps: 'Site → Conta → Extrato → Exportar → OFX/CSV' },
                ].map((b, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>{b.bank}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{b.steps}</div>
                  </div>
                ))}
              </div>

              <div className="glass">
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>Histórico de Importações</h3>
                {importHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 40, opacity: 0.15, marginBottom: 8 }}>📋</div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>Nenhuma importação realizada</p>
                  </div>
                ) : (
                  importHistory.slice(0, 8).map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(105,240,174,0.1)', border: '1px solid rgba(105,240,174,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>✓</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.fileName}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{new Date(h.date).toLocaleDateString('pt-BR')} · {h.approved} de {h.total} aprovados</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════ SCAN ══════ */}
        {page === 'scan' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{ marginBottom: 28 }}>
              <h1 className="page-title" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, background: 'linear-gradient(135deg,#fff 30%,#FF6B9D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Escanear Recibo</h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Fotografe e a IA lança automaticamente</p>
            </div>
            <div className="scan-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340 }}>
                {!apiKey ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 56, opacity: 0.3, marginBottom: 16 }}>🔑</div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>API Key necessária</p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 24, lineHeight: 1.6, maxWidth: 280 }}>Configure sua chave da Anthropic para usar o scanner de recibos</p>
                    <button className="btn-primary" onClick={() => setPage('settings')}>⚙ Ir para Configurações</button>
                  </div>
                ) : scanning ? (
                  <div style={{ textAlign: 'center' }}><div className="loader" /><p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 20, fontSize: 14 }}>Analisando com IA...</p></div>
                ) : (
                  <>
                    <div style={{ fontSize: 72, marginBottom: 20, animation: 'pulse 2.5s ease infinite' }}>◎</div>
                    <p style={{ fontSize: 17, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 6 }}>Capturar Recibo</p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 28, textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>Fotografe um cupom fiscal, nota ou recibo</p>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button className="btn-primary" onClick={() => fileRef.current?.click()}>📸 Tirar Foto</button>
                      <button className="btn-secondary" onClick={() => { fileRef.current.removeAttribute('capture'); fileRef.current?.click(); }}>📁 Galeria</button>
                    </div>
                  </>
                )}
              </div>
              <div className="glass">
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Resultado</h3>
                {scanResult ? (
                  <div style={{ marginTop: 20 }}>
                    <div className="glass" style={{ background: 'rgba(105,240,174,0.06)', borderColor: 'rgba(105,240,174,0.2)', marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: '#69F0AE', fontWeight: 600, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>✅ Recibo Identificado</div>
                      {[
                        { l: 'Estabelecimento', v: scanResult.description },
                        { l: 'Valor', v: formatBRL(scanResult.amount), style: { color: '#FF6B9D', fontSize: 22, fontFamily: "'JetBrains Mono',monospace" } },
                        { l: 'Categoria', v: `${CATEGORIES.find(c => c.id === scanResult.category)?.icon || ''} ${CATEGORIES.find(c => c.id === scanResult.category)?.name || scanResult.category}` },
                        { l: 'Data', v: new Date(scanResult.date + 'T12:00:00').toLocaleDateString('pt-BR') },
                      ].map((f, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{f.l}</span>
                          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: 600, ...(f.style || {}) }}>{f.v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button className="btn-primary" style={{ flex: 1 }} onClick={confirmScan}>✓ Lançar</button>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setScanResult(null)}>✕ Descartar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
                    <div style={{ fontSize: 56, opacity: 0.15, marginBottom: 12 }}>🧾</div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>Nenhum recibo escaneado</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════ BUDGET ══════ */}
        {page === 'budget' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{ marginBottom: 28 }}>
              <h1 className="page-title" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, background: 'linear-gradient(135deg,#fff 30%,#E040FB)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Orçamento</h1>
            </div>
            <div className="budget-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {CATEGORIES.map(cat => {
                const spent = catExpenses[cat.id] || 0, budget = budgets[cat.id] || cat.budget, pct = budget > 0 ? (spent / budget) * 100 : 0, remaining = budget - spent;
                return (
                  <div key={cat.id} className="glass hoverable" style={{ position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${cat.color},transparent)`, opacity: spent > budget ? 0.9 : 0.4 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                      <div style={{ position: 'relative' }}><GlassRing value={spent} max={budget} size={60} color={cat.color} /><div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{cat.icon}</div></div>
                      <div><div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{cat.name}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{pct.toFixed(0)}%</div></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Gasto</span><span className="mono" style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{formatBRL(spent)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Restante</span><span className="mono" style={{ fontSize: 13, color: remaining >= 0 ? '#69F0AE' : '#FF6B9D' }}>{formatBRL(remaining)}</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Limite:</span><input className="glass-input" type="number" value={budgets[cat.id] || cat.budget} onChange={e => setBudgets(p => ({ ...p, [cat.id]: parseFloat(e.target.value) || 0 }))} style={{ flex: 1, fontSize: 12, padding: '6px 10px' }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════ FORECAST ══════ */}
        {page === 'forecast' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div>
                <h1 className="page-title" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, background: 'linear-gradient(135deg,#fff 30%,#00E5FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Forecast</h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Projeção baseada nos últimos 6 meses</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>{[3, 6, 12].map(m => (<button key={m} className={`chip ${forecastMonths === m ? 'active' : ''}`} onClick={() => setForecastMonths(m)}>{m} meses</button>))}</div>
            </div>
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { l: 'Receita Projetada', v: formatBRL(fd.avgIncome), c: '#69F0AE', s: 'por mês' },
                { l: 'Despesa Projetada', v: formatBRL(fd.avgExpense), c: '#FF6B9D', s: 'por mês' },
                { l: `Economia (${forecastMonths}m)`, v: formatBRL(fd.forecast.slice(0, forecastMonths).reduce((s, f) => s + f.savings, 0)), c: '#B24DFF', s: 'acumulado' },
                { l: `Patrimônio ${forecastMonths}m`, v: formatBRL(fd.forecast[forecastMonths - 1]?.balance || 0), c: '#FFD740', s: 'projetado' },
              ].map((k, i) => (
                <div key={i} className="glass hoverable" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{k.l}</div>
                  <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: k.c, textShadow: `0 0 30px ${k.c}33` }}>{k.v}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>{k.s}</div>
                </div>
              ))}
            </div>
            <div className="glass" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 20 }}>Projeção de Patrimônio</h3>
              <div style={{ position: 'relative', height: 220 }}>
                {(() => {
                  const data = fd.forecast.slice(0, forecastMonths), maxB = Math.max(...data.map(d => d.balance)), minB = Math.min(...data.map(d => d.balance), 0), range = maxB - minB || 1;
                  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 100},${100 - ((d.balance - minB) / range) * 100}`).join(' ');
                  return (
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                      <defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B24DFF" stopOpacity="0.25" /><stop offset="100%" stopColor="#00E5FF" stopOpacity="0.01" /></linearGradient><linearGradient id="lg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#B24DFF" /><stop offset="100%" stopColor="#00E5FF" /></linearGradient></defs>
                      <polygon points={pts + ' 100,100 0,100'} fill="url(#fg)" />
                      <polyline points={pts} fill="none" stroke="url(#lg)" strokeWidth="0.7" strokeLinecap="round" />
                      {data.map((d, i) => { const x = (i / (data.length - 1)) * 100, y = 100 - ((d.balance - minB) / range) * 100; return <circle key={i} cx={x} cy={y} r="1.3" fill="#00E5FF" style={{ filter: 'drop-shadow(0 0 4px #00E5FF)' }} />; })}
                    </svg>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>{fd.forecast.slice(0, forecastMonths).map((d, i) => (<span key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{d.shortMonth}</span>))}</div>
            </div>
            <div className="glass forecast-table">
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>Detalhamento</h3>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '0 0 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', minWidth: 500 }}>
                  {['Mês', 'Receita', 'Despesa', 'Saldo', 'Patrimônio'].map(h => (<span key={h} style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</span>))}
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
            <div className="glass" style={{ marginTop: 24, borderColor: 'rgba(178,77,255,0.15)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 20 }}>📊 Insights</h3>
              <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { t: 'Tendência', d: fd.trend > 0 ? `⚠️ Gastos aumentando ~${formatBRL(Math.abs(fd.trend))}/mês` : '✅ Gastos estáveis ou em queda' },
                  { t: 'Economia', d: fd.avgIncome > 0 ? `Taxa: ${((1 - fd.avgExpense / fd.avgIncome) * 100).toFixed(1)}% ${(1 - fd.avgExpense / fd.avgIncome) >= 0.2 ? '🎯 Acima de 20%!' : '💡 Meta: 20%'}` : 'Sem dados' },
                  { t: 'Emergência', d: `Meta 6m: ${formatBRL(fd.avgExpense * 6)} ${totalBalance >= fd.avgExpense * 6 ? '✅ Completa!' : '— faltam ' + formatBRL(fd.avgExpense * 6 - totalBalance)}` },
                  { t: 'Projeção 12m', d: `Patrimônio: ${formatBRL(fd.forecast[11]?.balance || 0)} (${(fd.forecast[11]?.balance || 0) > totalBalance ? '+' : ''}${formatBRL((fd.forecast[11]?.balance || 0) - totalBalance)})` },
                ].map((ins, i) => (
                  <div key={i} className="glass" style={{ background: 'rgba(255,255,255,0.02)', padding: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>{ins.t}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>{ins.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════ ACCOUNTS ══════ */}
        {page === 'accounts' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div>
                <h1 className="page-title" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, background: 'linear-gradient(135deg,#fff 30%,#FFD740)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Contas</h1>
              </div>
            </div>
            <div className="accounts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
              {accounts.map(acc => (
                <div key={acc.id} className="glass hoverable" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${acc.color},transparent)`, opacity: 0.7 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 24 }}>{acc.icon}</span>
                      <div><div style={{ fontSize: 16, fontWeight: 700 }}>{acc.name}</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{acc.type}</div></div>
                    </div>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: acc.connected ? '#69F0AE' : '#FF6B9D', boxShadow: acc.connected ? '0 0 10px rgba(105,240,174,0.5)' : 'none', animation: acc.connected ? 'glowPulse 3s ease infinite' : 'none' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Saldo</div>
                  <div className="mono" style={{ fontSize: 30, fontWeight: 700, textShadow: `0 0 30px ${acc.color}22` }}>{formatBRL(acc.balance)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ SETTINGS ══════ */}
        {page === 'settings' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{ marginBottom: 28 }}>
              <h1 className="page-title" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, background: 'linear-gradient(135deg,#fff 30%,#B24DFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Configurações</h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Gerencie sua API key, dados e backup</p>
            </div>

            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
              {/* API Key */}
              <div className="glass" style={{ borderColor: apiKey ? 'rgba(105,240,174,0.15)' : 'rgba(255,215,64,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{ fontSize: 24 }}>🔑</span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>API Key — Claude (Anthropic)</h3>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Necessária para o scanner de recibos funcionar</p>
                  </div>
                  {apiKey && <span className="badge badge-approved" style={{ marginLeft: 'auto' }}>✓ Configurada</span>}
                  {!apiKey && <span className="badge badge-pending" style={{ marginLeft: 'auto' }}>⏳ Pendente</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      className="glass-input"
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="sk-ant-api03-..."
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      style={{ paddingRight: 44, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 16, padding: 4 }}
                    >
                      {showApiKey ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <button className="btn-primary" onClick={() => saveApiKey(apiKey)} style={{ whiteSpace: 'nowrap' }}>Salvar</button>
                </div>
                <div style={{ marginTop: 14, padding: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
                    📌 <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Como obter:</strong> Acesse{' '}
                    <span style={{ color: '#00E5FF' }}>console.anthropic.com</span> → API Keys → Create Key<br />
                    💰 <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Custo:</strong> ~R$ 0,02 por foto escaneada (Claude Sonnet)<br />
                    🔒 <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Segurança:</strong> A chave fica salva apenas no seu navegador
                  </p>
                </div>
              </div>

              {/* Data Management */}
              <div className="glass">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{ fontSize: 24 }}>💾</span>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Gerenciar Dados</h3>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
                    {[
                      { l: 'Transações', v: transactions.length, c: '#00E5FF' },
                      { l: 'Contas', v: accounts.length, c: '#FFD740' },
                      { l: 'Importações', v: importHistory.length, c: '#69F0AE' },
                      { l: 'Tipo', v: hasSampleData ? 'Exemplo' : 'Real', c: hasSampleData ? '#FF6B9D' : '#69F0AE' },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: 'center', padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: s.c }}>{s.v}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button className="btn-secondary" onClick={exportBackup} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                      <span style={{ fontSize: 18 }}>📤</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>Exportar Backup</div>
                        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>Salvar arquivo .json</div>
                      </div>
                    </button>
                    <button className="btn-secondary" onClick={() => backupRef.current?.click()} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                      <span style={{ fontSize: 18 }}>📥</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>Restaurar Backup</div>
                        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>Carregar arquivo .json</div>
                      </div>
                    </button>
                    <button className="btn-secondary" onClick={clearAndLoadSample} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                      <span style={{ fontSize: 18 }}>🎲</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>Carregar Dados Exemplo</div>
                        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>Dados fictícios para teste</div>
                      </div>
                    </button>
                    <button onClick={clearAllData} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', background: 'rgba(255,107,157,0.08)', border: '1px solid rgba(255,107,157,0.2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#FF6B9D', transition: 'all 0.3s ease' }}>
                      <span style={{ fontSize: 18 }}>🗑</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>Limpar Tudo</div>
                        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>Zerar e começar do zero</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* About */}
              <div className="glass" style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#B24DFF,#00E5FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, boxShadow: '0 0 30px rgba(178,77,255,0.4)' }}>F</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>FinFlow</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4, letterSpacing: 2, textTransform: 'uppercase' }}>Liquid Glass Edition</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 12 }}>Versão 2.0 — Fevereiro 2026</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>Powered by Claude AI (Anthropic)</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
