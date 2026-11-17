import { useEffect, useMemo, useState } from 'react';
import CategoryBarChart from './components/CategoryBarChart';
import MonthlyLineChart from './components/MonthlyLineChart';
import ReceiptResultView from './components/ReceiptResultView';
import { compressImageForUpload } from './utils/imageCompressor';
import { getTranslator, getCategoryOptions, CATEGORY_VALUES_EN } from './i18n';

const apiUrl = (path) => `/api${path}`;

const safeDate = (val) => {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : new Date(val);
  const str = String(val).trim();
  const d = str.length === 10 ? new Date(`${str}T00:00:00`) : new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
};

const startOfWeek = (value) => {
  const date = safeDate(value);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (value, days) => {
  const date = safeDate(value);
  date.setDate(date.getDate() + days);
  return date;
};

const formatDateInput = (value) => safeDate(value).toISOString().slice(0, 10);

const DEFAULT_RECEIPT_PROMPT = `Analyze this receipt with high precision.
Extract:
1. "merchant": Store/vendor name
2. "date": Transaction date in YYYY-MM-DD format (null if missing)
3. "grand_total": Total charge paid (float)
4. "line_items": Every item with item name, quantity, unit_price, total_price, and category (Groceries, Dining Out, Alcohol & Drinks, Housing, Utilities, Transportation, Shopping, Entertainment, Healthcare, Personal Care, Furniture, Luxury, Discounts & Adjustments, Other)
5. Record coupons or refunds with negative total_price under "Discounts & Adjustments".
Return strictly valid JSON.`;

function CollapsibleSection({ title, icon, defaultOpen = false, children, badge, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapsible-section ${className}`}>
      <button type="button" className="collapsible-header" onClick={() => setOpen(!open)}>
        <div className="collapsible-title-group">
          {icon && <span className="collapsible-icon">{icon}</span>}
          <span className="collapsible-title">{title}</span>
          {badge && <span className="collapsible-badge">{badge}</span>}
        </div>
        <span className={`collapsible-arrow ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('budget-token') || '');
  const [login, setLogin] = useState({ username: '', password: '' });
  const [dashboard, setDashboard] = useState(null);
  const [spendRows, setSpendRows] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [chartTimeframe, setChartTimeframe] = useState('week');
  const [anchorDate, setAnchorDate] = useState(formatDateInput(new Date()));
  const [filterTransactionsByChart, setFilterTransactionsByChart] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState({ has_gemini_api_key: false, gemini_api_key_masked: '' });
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('budget_gemini_api_key') || '');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [showApiKeyText, setShowApiKeyText] = useState(false);
  const [lang, setLang] = useState(localStorage.getItem('budget-lang') || 'en');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: 'Groceries',
    merchant: '',
    notes: '',
    source: 'manual',
  });
  const [recurringForm, setRecurringForm] = useState({
    name: '',
    category: 'Utilities',
    amount: '',
    frequency: 'monthly',
    next_due_date: new Date().toISOString().slice(0, 10),
    is_active: true,
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptMonth, setReceiptMonth] = useState('');
  const [receiptPrompt, setReceiptPrompt] = useState(DEFAULT_RECEIPT_PROMPT);
  const [analyzingReceipt, setAnalyzingReceipt] = useState(false);
  const [receiptResult, setReceiptResult] = useState(null);
  const [editingSpendId, setEditingSpendId] = useState(null);
  const [editingRecurringId, setEditingRecurringId] = useState(null);

  const t = useMemo(() => getTranslator(lang), [lang]);
  const categoryOptions = useMemo(() => getCategoryOptions(lang), [lang]);

  const switchLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('budget-lang', newLang);
  };

  const resetSpendForm = () => {
    setForm({
      date: new Date().toISOString().slice(0, 10),
      amount: '',
      category: 'Groceries',
      merchant: '',
      notes: '',
      source: 'manual',
    });
    setEditingSpendId(null);
  };

  const resetRecurringForm = () => {
    setRecurringForm({
      name: '',
      category: 'Utilities',
      amount: '',
      frequency: 'monthly',
      next_due_date: new Date().toISOString().slice(0, 10),
      is_active: true,
      notes: '',
    });
    setEditingRecurringId(null);
  };

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const loadDashboard = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/dashboard'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error('Unable to load dashboard');
      const data = await res.json();
      setDashboard(data);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    if (!token) return;
    try {
      const [spendRes, recurringRes] = await Promise.all([
        fetch(apiUrl('/spend'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/recurring'), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (spendRes.status === 401 || recurringRes.status === 401) { logout(); return; }
      if (spendRes.ok) setSpendRows(await spendRes.json());
      if (recurringRes.ok) setRecurring(await recurringRes.json());
    } catch (err) {
      setStatus(err.message);
    }
  };

  const loadSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/settings'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeyStatus(data);
      }
    } catch {}
  };

  const saveApiKey = async (e) => {
    if (e) e.preventDefault();
    setSavingApiKey(true);
    try {
      const cleanKey = apiKeyInput.trim();
      if (!cleanKey) throw new Error(t('enterValidKey'));
      const res = await fetch(apiUrl('/settings'), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ gemini_api_key: cleanKey }),
      });
      if (!res.ok) throw new Error(t('failedSaveKey'));
      const data = await res.json();
      setApiKeyStatus({
        has_gemini_api_key: data.has_gemini_api_key,
        gemini_api_key_masked: data.gemini_api_key_masked,
      });
      localStorage.setItem('budget_gemini_api_key', cleanKey);
      setStatus(t('keySaved'));
      setApiKeyModalOpen(false);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setSavingApiKey(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadDashboard();
      loadAll();
      loadSettings();
    }
  }, [token]);

  const loginUser = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(login),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Login failed');
      }
      const data = await res.json();
      setToken(data.access_token);
      localStorage.setItem('budget-token', data.access_token);
      setStatus(t('loggedIn'));
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addSpend = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, amount: Number(form.amount) };
      const method = editingSpendId ? 'PUT' : 'POST';
      const url = editingSpendId ? apiUrl(`/spend/${editingSpendId}`) : apiUrl('/spend');
      const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(payload) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || (editingSpendId ? t('updateSpend') : t('saveSpend')));
      }
      resetSpendForm();
      await loadDashboard();
      await loadAll();
      setStatus(editingSpendId ? t('spendUpdated') : t('spendAdded'));
    } catch (err) {
      setStatus(err.message);
    }
  };

  const deleteSpend = async (id) => {
    try {
      const res = await fetch(apiUrl(`/spend/${id}`), { method: 'DELETE', headers: authHeaders });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Unable to delete spend');
      }
      if (editingSpendId === id) resetSpendForm();
      await loadDashboard();
      await loadAll();
      setStatus(t('spendDeleted'));
    } catch (err) {
      setStatus(err.message);
    }
  };

  const editSpend = (item) => {
    setEditingSpendId(item.id);
    setForm({
      date: item.date || new Date().toISOString().slice(0, 10),
      amount: String(item.amount),
      category: item.category || 'Groceries',
      merchant: item.merchant || '',
      notes: item.notes || '',
      source: item.source || 'manual',
    });
  };

  const saveRecurring = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...recurringForm, amount: Number(recurringForm.amount) };
      const method = editingRecurringId ? 'PUT' : 'POST';
      const url = editingRecurringId ? apiUrl(`/recurring/${editingRecurringId}`) : apiUrl('/recurring');
      const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(payload) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || (editingRecurringId ? t('recurringUpdated') : t('recurringCreated')));
      }
      resetRecurringForm();
      await loadAll();
      setStatus(editingRecurringId ? t('recurringUpdated') : t('recurringCreated'));
    } catch (err) {
      setStatus(err.message);
    }
  };

  const deleteRecurring = async (id) => {
    try {
      const res = await fetch(apiUrl(`/recurring/${id}`), { method: 'DELETE', headers: authHeaders });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Unable to delete recurring expense');
      }
      if (editingRecurringId === id) resetRecurringForm();
      await loadAll();
      setStatus(t('recurringDeleted'));
    } catch (err) {
      setStatus(err.message);
    }
  };

  const editRecurring = (item) => {
    setEditingRecurringId(item.id);
    setRecurringForm({
      name: item.name || '',
      category: item.category || 'Utilities',
      amount: String(item.amount),
      frequency: item.frequency || 'monthly',
      next_due_date: item.next_due_date || new Date().toISOString().slice(0, 10),
      is_active: item.is_active ?? true,
      notes: item.notes || '',
    });
  };

  const analyzeReceipt = async () => {
    if (!receiptFile) { setStatus(t('chooseImage')); return; }
    setAnalyzingReceipt(true);
    setStatus(t('optimizing'));
    try {
      const fileToUpload = await compressImageForUpload(receiptFile);
      const customKey = apiKeyInput.trim() || localStorage.getItem('budget_gemini_api_key') || '';
      const formData = new FormData();
      if (receiptMonth) formData.append('month', receiptMonth);
      if (receiptPrompt) formData.append('system_prompt', receiptPrompt);
      if (customKey) formData.append('api_key', customKey);
      formData.append('file', fileToUpload);
      setStatus(t('processingGemini'));
      const headers = { Authorization: `Bearer ${token}` };
      if (customKey) headers['X-Gemini-API-Key'] = customKey;
      const res = await fetch(apiUrl('/receipt/analyze'), { method: 'POST', headers, body: formData });
      const text = await res.text();
      if (res.status === 413 || text.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
        throw new Error(t('imageTooLarge'));
      }
      if (!res.ok) {
        let errorDetail = text;
        try { const parsed = JSON.parse(text); errorDetail = parsed.detail || text; } catch {}
        if (errorDetail.includes('Gemini API key is missing')) { setApiKeyModalOpen(true); }
        throw new Error(errorDetail || 'Unable to analyze receipt');
      }
      const data = JSON.parse(text);
      setReceiptResult(data);
      setStatus(data.imported_rows ? t('receiptImported', { count: data.imported_rows }) : t('receiptAnalyzed'));
      await loadDashboard();
      await loadAll();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setAnalyzingReceipt(false);
    }
  };

  const handlePrevPeriod = () => {
    const cur = safeDate(anchorDate);
    if (chartTimeframe === 'day') cur.setDate(cur.getDate() - 1);
    else if (chartTimeframe === 'week') cur.setDate(cur.getDate() - 7);
    else if (chartTimeframe === 'month') cur.setMonth(cur.getMonth() - 1);
    setAnchorDate(formatDateInput(cur));
  };

  const handleNextPeriod = () => {
    const cur = safeDate(anchorDate);
    if (chartTimeframe === 'day') cur.setDate(cur.getDate() + 1);
    else if (chartTimeframe === 'week') cur.setDate(cur.getDate() + 7);
    else if (chartTimeframe === 'month') cur.setMonth(cur.getMonth() + 1);
    setAnchorDate(formatDateInput(cur));
  };

  const handleToday = () => { setAnchorDate(formatDateInput(new Date())); };

  const chartData = useMemo(() => {
    const anchor = safeDate(anchorDate);
    let rangeStart = null, rangeEnd = null, periodLabel = '', trendUnit = 'day';
    const trendMap = {};

    if (chartTimeframe === 'day') {
      trendUnit = 'day';
      rangeStart = formatDateInput(anchor);
      rangeEnd = rangeStart;
      periodLabel = anchor.toLocaleDateString(lang === 'zh' ? 'zh-CN' : undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      for (let i = 6; i >= 0; i--) { const d = addDays(anchor, -i); trendMap[formatDateInput(d)] = 0; }
    } else if (chartTimeframe === 'week') {
      trendUnit = 'day';
      const wStart = startOfWeek(anchorDate);
      const wEnd = addDays(wStart, 6);
      rangeStart = formatDateInput(wStart);
      rangeEnd = formatDateInput(wEnd);
      const locale = lang === 'zh' ? 'zh-CN' : undefined;
      periodLabel = `${wStart.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${wEnd.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      for (let i = 0; i < 7; i++) { const d = addDays(wStart, i); trendMap[formatDateInput(d)] = 0; }
    } else if (chartTimeframe === 'month') {
      trendUnit = 'month';
      const y = anchor.getFullYear(), m = anchor.getMonth();
      const mStart = new Date(y, m, 1), mEnd = new Date(y, m + 1, 0);
      rangeStart = formatDateInput(mStart);
      rangeEnd = formatDateInput(mEnd);
      periodLabel = anchor.toLocaleDateString(lang === 'zh' ? 'zh-CN' : undefined, { month: 'long', year: 'numeric' });
      for (let i = 5; i >= 0; i--) { const d = new Date(y, m - i, 1); trendMap[d.toISOString().slice(0, 7)] = 0; }
    } else {
      trendUnit = 'month';
      periodLabel = t('allTime');
    }

    const categoryTotals = {};
    let periodTotal = 0;
    for (const row of spendRows) {
      const rowDate = row.date || '', amount = Number(row.amount) || 0, cat = row.category || 'Other', rowMonth = rowDate.slice(0, 7);
      const inRange = chartTimeframe === 'all' || (rangeStart && rangeEnd && rowDate >= rangeStart && rowDate <= rangeEnd);
      if (inRange) { categoryTotals[cat] = (categoryTotals[cat] || 0) + amount; periodTotal += amount; }
      if (chartTimeframe === 'day' || chartTimeframe === 'week') { if (rowDate in trendMap) trendMap[rowDate] = (trendMap[rowDate] || 0) + amount; }
      else if (chartTimeframe === 'month') { if (rowMonth in trendMap) trendMap[rowMonth] = (trendMap[rowMonth] || 0) + amount; }
      else if (chartTimeframe === 'all') { if (rowMonth) trendMap[rowMonth] = (trendMap[rowMonth] || 0) + amount; }
    }
    if (chartTimeframe === 'all' && dashboard?.by_month) {
      for (const [mKey, amt] of Object.entries(dashboard.by_month)) {
        trendMap[mKey] = Math.max(trendMap[mKey] || 0, Number(amt) || 0);
      }
    }
    return { categoryTotals, trendMap, periodLabel, periodTotal, trendUnit, rangeStart, rangeEnd };
  }, [spendRows, dashboard, chartTimeframe, anchorDate, lang]);

  const filteredSpendRows = useMemo(() => {
    let rows = spendRows;
    if (filterTransactionsByChart && chartTimeframe !== 'all' && chartData.rangeStart && chartData.rangeEnd) {
      rows = rows.filter((item) => item.date >= chartData.rangeStart && item.date <= chartData.rangeEnd);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter((item) =>
        (item.merchant || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [spendRows, filterTransactionsByChart, chartTimeframe, chartData, searchQuery]);

  const filteredSpendTotal = filteredSpendRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  // Translate a category value from DB (English) to current language for display
  const displayCategory = (catEnglish) => {
    const opt = categoryOptions.find(o => o.value === catEnglish);
    return opt ? opt.label : catEnglish;
  };

  const logout = () => {
    localStorage.removeItem('budget-token');
    setToken('');
    setDashboard(null);
    setSpendRows([]);
    setRecurring([]);
  };

  if (!token) {
    return (
      <div className="page auth-page">
        <form className="panel login-panel" onSubmit={(e) => { e.preventDefault(); loginUser(); }}>
          <div className="login-header">
            <div className="login-logo">💰</div>
            <h1>{t('loginTitle')}</h1>
            <p className="login-subtitle">{t('loginSubtitle')}</p>
          </div>
          <div className="login-inputs">
            <label className="input-group">
              <span className="input-label">{t('username')}</span>
              <input placeholder={t('accountName')} value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} required />
            </label>
            <label className="input-group">
              <span className="input-label">{t('password')}</span>
              <input type="password" placeholder={t('accessKey')} value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required />
            </label>
          </div>
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? t('signingIn') : t('signIn')}
          </button>
          <div className="lang-switcher-login">
            <select value={lang} onChange={(e) => switchLang(e.target.value)} className="lang-select">
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>
          {status && <div className="message">{status}</div>}
        </form>
      </div>
    );
  }

  const categoryMap = dashboard?.by_category || {};

  return (
    <div className="page app-shell">
      <header className="topbar">
        <div className="brand-group">
          <span className="brand-icon">💰</span>
          <div>
            <h1>{t('appTitle')}</h1>
            <span className="brand-tagline">{t('appTagline')}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <select value={lang} onChange={(e) => switchLang(e.target.value)} className="lang-select" title={t('language')}>
            <option value="en">EN</option>
            <option value="zh">中文</option>
          </select>
          <button
            type="button"
            className={`api-key-btn ${apiKeyStatus.has_gemini_api_key ? 'configured' : 'missing'}`}
            onClick={() => setApiKeyModalOpen(true)}
            title={t('geminiApiKey')}
          >
            <span className="api-key-dot" />
            <span>🔑 {apiKeyStatus.has_gemini_api_key ? (apiKeyStatus.gemini_api_key_masked || 'Active') : t('addApiKey')}</span>
          </button>
          <button className="ghost logout-btn" onClick={logout}>
            <span>{t('signOut')}</span>
          </button>
        </div>
      </header>

      {status && <div className="message">{status}</div>}

      {/* Collapsible: Add Spend Row */}
      <section className="collapsible-wrapper">
        <CollapsibleSection
          title={editingSpendId ? t('editSpendRow') : t('addSpendRow')}
          icon="➕"
          defaultOpen={!!editingSpendId}
        >
          <form className="collapsible-form" onSubmit={addSpend}>
            <div className="form-grid">
              <label className="input-group">
                <span className="input-label">{t('date')}</span>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </label>
              <label className="input-group">
                <span className="input-label">{t('amount')}</span>
                <input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </label>
              <label className="input-group">
                <span className="input-label">{t('category')}</span>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                  {categoryOptions.map(opt => (
                    <option key={opt.key} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="input-group">
                <span className="input-label">{t('merchant')}</span>
                <input placeholder={t('merchantPlaceholder')} value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
              </label>
              <label className="input-group span-2">
                <span className="input-label">{t('notes')}</span>
                <input placeholder={t('optionalMemo')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>
            <div className="form-actions-row">
              <button type="submit" className="primary-btn">{editingSpendId ? t('updateSpend') : t('saveSpend')}</button>
              {editingSpendId && <button type="button" className="ghost" onClick={resetSpendForm}>{t('cancel')}</button>}
            </div>
          </form>
        </CollapsibleSection>
      </section>

      {/* Collapsible: Receipt AI */}
      <section className="collapsible-wrapper">
        <CollapsibleSection
          title={t('receiptAI')}
          icon="✨"
          className="ai-collapsible"
        >
          <div className="collapsible-form">
            {!apiKeyStatus.has_gemini_api_key && (
              <div className="api-key-status-banner missing" style={{ cursor: 'pointer' }} onClick={() => setApiKeyModalOpen(true)}>
                <span>{t('apiKeyNotSet')}</span>
                <strong style={{ textDecoration: 'underline' }}>{t('configure')}</strong>
              </div>
            )}
            <div className="form-grid">
              <label className="input-group">
                <span className="input-label">{t('dateOverride')}</span>
                <input type="month" value={receiptMonth} onChange={(e) => setReceiptMonth(e.target.value)} placeholder={t('autoDetect')} />
                <span className="input-hint">{t('dateHint')}</span>
              </label>
              <label className="input-group file-upload-group">
                <span className="input-label">{t('receiptImage')}</span>
                <input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files?.[0])} />
              </label>
            </div>
            <label className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span className="input-label">{t('extractionPrompt')}</span>
                <button type="button" onClick={() => setReceiptPrompt(DEFAULT_RECEIPT_PROMPT)}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer', padding: '2px 6px' }}>
                  {t('resetPrompt')}
                </button>
              </div>
              <textarea value={receiptPrompt} rows="3" onChange={(e) => setReceiptPrompt(e.target.value)} />
            </label>
            <div className="receipt-actions">
              <button onClick={analyzeReceipt} disabled={analyzingReceipt} className="ai-btn">
                {analyzingReceipt ? t('scanning') : t('analyzeReceipt')}
              </button>
              {analyzingReceipt && <div className="message ai-status">{t('processingAI')}</div>}
            </div>
            {receiptResult && <ReceiptResultView result={receiptResult} />}
          </div>
        </CollapsibleSection>
      </section>

      {/* Stats Cards */}
      <section className="grid stats-grid">
        <div className="card highlight">
          <div className="card-top">
            <span>{t('totalSpend')}</span>
            <span className="card-icon">💳</span>
          </div>
          <strong>${Number(dashboard?.total_spend || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <span className="card-footnote">{t('acrossAll')}</span>
        </div>
        <div className="card">
          <div className="card-top">
            <span>{t('recurringObligations')}</span>
            <span className="card-icon">🔄</span>
          </div>
          <strong>${Number(dashboard?.recurring_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <span className="card-footnote">{t('activeSubscriptions', { count: recurring.filter(r => r.is_active).length })}</span>
        </div>
        <div className="card">
          <div className="card-top">
            <span>{t('activeCategories')}</span>
            <span className="card-icon">🏷️</span>
          </div>
          <strong>{Object.keys(categoryMap).length}</strong>
          <span className="card-footnote">{t('trackedGroups')}</span>
        </div>
      </section>

      {/* Timeframe & Chart Granularity */}
      <section className="panel timeframe-control-panel">
        <div className="timeframe-bar">
          <div className="timeframe-segment">
            <span className="timeframe-label">{t('filterView')}</span>
            <div className="timeframe-buttons">
              {['day', 'week', 'month', 'all'].map(tf => (
                <button key={tf} type="button"
                  className={`ghost pill-btn ${chartTimeframe === tf ? 'active' : ''}`}
                  onClick={() => setChartTimeframe(tf)}>
                  {t(tf === 'all' ? 'allTime' : tf)}
                </button>
              ))}
            </div>
          </div>
          <div className="timeframe-nav">
            {chartTimeframe !== 'all' ? (
              <>
                <button type="button" className="ghost nav-arrow-btn" onClick={handlePrevPeriod} title={t('previousPeriod')}>◀</button>
                <div className="timeframe-period-badge">
                  <span className="period-icon">📅</span>
                  <strong>{chartData.periodLabel}</strong>
                </div>
                <button type="button" className="ghost nav-arrow-btn" onClick={handleNextPeriod} title={t('nextPeriod')}>▶</button>
                <button type="button" className="ghost today-pill-btn" onClick={handleToday}>{t('today')}</button>
                <input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} className="date-direct-picker" title={t('jumpToDate')} />
              </>
            ) : (
              <div className="timeframe-period-badge">
                <span className="period-icon">🌐</span>
                <strong>{t('allRecorded')}</strong>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="grid two-col charts-section">
        <div className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>{t('spendByCategory')}</h2>
              <span className="panel-subtitle">
                {chartTimeframe === 'all' ? t('allTimeCategoryDist') : t('expensesFor', { period: chartData.periodLabel })}
              </span>
            </div>
            <span className="chart-badge">
              ${chartData.periodTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <CategoryBarChart data={chartData.categoryTotals} />
        </div>
        <div className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>
                {chartTimeframe === 'day' ? t('dailyTrajectory')
                  : chartTimeframe === 'week' ? t('weeklyDailyTrend')
                  : chartTimeframe === 'month' ? t('monthlyTrend')
                  : t('historicalTrend')}
              </h2>
              <span className="panel-subtitle">
                {chartTimeframe === 'day' ? t('dayByDay', { date: anchorDate })
                  : chartTimeframe === 'week' ? t('dailySpendingAcross', { period: chartData.periodLabel })
                  : chartTimeframe === 'month' ? t('recentMonthly')
                  : t('macroTimeline')}
              </span>
            </div>
            <span className="chart-badge">{chartData.trendUnit === 'day' ? t('daily') : t('monthly')}</span>
          </div>
          <MonthlyLineChart data={chartData.trendMap} unit={chartData.trendUnit} emptyMessage={`No spending recorded for this ${chartTimeframe}`} />
        </div>
      </section>

      {/* Transactions Explorer */}
      <section className="panel filter-panel">
        <div className="filter-controls-header">
          <div className="filter-title-wrap">
            <h2>{t('transactionsExplorer')}</h2>
            <span className="panel-subtitle">
              {filterTransactionsByChart && chartTimeframe !== 'all'
                ? t('filteredToActive', { timeframe: t(chartTimeframe), period: chartData.periodLabel })
                : t('allTransactions')}
            </span>
          </div>
          <div className="filter-inputs-row">
            <div className="search-input-wrap">
              <input type="text" placeholder={t('searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
            </div>
            <div className="filter-quick-buttons">
              <button type="button" className={`ghost pill-btn ${filterTransactionsByChart ? 'active' : ''}`} onClick={() => setFilterTransactionsByChart(!filterTransactionsByChart)}>
                {filterTransactionsByChart ? t('filteredTo', { timeframe: t(chartTimeframe === 'all' ? 'allTime' : chartTimeframe) }) : t('showingAllTime')}
              </button>
            </div>
          </div>
        </div>
        <div className="week-summary-card">
          <span className="summary-pill">{filteredSpendRows.length} {filteredSpendRows.length === 1 ? t('transaction') : t('transactions')}</span>
          <span className="summary-amount">${filteredSpendTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </section>

      {/* Transactions & Recurring Lists */}
      <section className="grid two-col">
        <div className="panel data-panel">
          <div className="panel-header">
            <h2>{t('transactionsTitle')}</h2>
            <span className="record-count">{filteredSpendRows.length} {t('entries')}</span>
          </div>
          {filteredSpendRows.length === 0 ? (
            <div className="empty-data-state"><span>🧾</span><p>{t('noSpend')}</p></div>
          ) : (
            <ul className="rows-list slim-list">
              {filteredSpendRows.map((item) => (
                <li key={item.id} className="transaction-row">
                  <div className="transaction-main">
                    <div className="transaction-line1">
                      <strong className="merchant-name">{item.merchant || t('unknownMerchant')}</strong>
                      <span className="category-pill">{displayCategory(item.category)}</span>
                      {item.source === 'receipt_ai' && <span className="ai-pill" title="Imported by Gemini AI">{t('ai')}</span>}
                    </div>
                    <div className="transaction-line2">
                      <span className="transaction-date">{item.date}</span>
                      {item.notes && <span className="transaction-memo">• {item.notes}</span>}
                    </div>
                  </div>
                  <div className="transaction-right">
                    <strong className="transaction-amount">
                      ${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    <div className="actions">
                      <button className="ghost sm-btn" onClick={() => editSpend(item)}>{t('edit')}</button>
                      <button className="ghost sm-btn danger-hover" onClick={() => deleteSpend(item.id)}>{t('delete')}</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel data-panel">
          <div className="panel-header">
            <h2>{t('recurringExpenses')}</h2>
            <span className="record-count">{t('subscriptionsCount', { count: recurring.length })}</span>
          </div>
          {recurring.length === 0 ? (
            <div className="empty-data-state"><span>🔄</span><p>{t('noRecurring')}</p></div>
          ) : (
            <ul className="rows-list">
              {recurring.map((item) => (
                <li key={item.id} className="recurring-row">
                  <div className="recurring-main">
                    <div className="recurring-line1">
                      <strong className="recurring-name">{item.name}</strong>
                      <span className="frequency-badge">{item.frequency === 'monthly' ? t('freqMonthly') : item.frequency === 'weekly' ? t('freqWeekly') : item.frequency === 'quarterly' ? t('freqQuarterly') : t('freqYearly')}</span>
                    </div>
                    <div className="recurring-line2">
                      <span className="recurring-cat">{displayCategory(item.category)}</span>
                      <span className="recurring-due">{t('due', { date: item.next_due_date })}</span>
                    </div>
                  </div>
                  <div className="recurring-right">
                    <strong className="recurring-amount">
                      ${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    <div className="actions">
                      <button className="ghost sm-btn" onClick={() => editRecurring(item)}>{t('edit')}</button>
                      <button className="ghost sm-btn danger-hover" onClick={() => deleteRecurring(item.id)}>{t('delete')}</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Collapsible: Recurring Expenses Form — at the very bottom */}
      <section className="collapsible-wrapper bottom-section">
        <CollapsibleSection
          title={editingRecurringId ? t('editRecurring') : t('addRecurring')}
          icon="🔄"
          defaultOpen={!!editingRecurringId}
        >
          <form className="collapsible-form" onSubmit={saveRecurring}>
            <div className="form-grid">
              <label className="input-group">
                <span className="input-label">{t('name')}</span>
                <input placeholder={t('namePlaceholder')} value={recurringForm.name} onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })} required />
              </label>
              <label className="input-group">
                <span className="input-label">{t('category')}</span>
                <select value={recurringForm.category} onChange={(e) => setRecurringForm({ ...recurringForm, category: e.target.value })} required>
                  {categoryOptions.map(opt => (
                    <option key={opt.key} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="input-group">
                <span className="input-label">{t('amount')}</span>
                <input type="number" step="0.01" placeholder="0.00" value={recurringForm.amount} onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })} required />
              </label>
              <label className="input-group">
                <span className="input-label">{t('frequency')}</span>
                <select value={recurringForm.frequency} onChange={(e) => setRecurringForm({ ...recurringForm, frequency: e.target.value })}>
                  <option value="monthly">{t('freqMonthly')}</option>
                  <option value="weekly">{t('freqWeekly')}</option>
                  <option value="quarterly">{t('freqQuarterly')}</option>
                  <option value="yearly">{t('freqYearly')}</option>
                </select>
              </label>
              <label className="input-group">
                <span className="input-label">{t('nextDueDate')}</span>
                <input type="date" value={recurringForm.next_due_date} onChange={(e) => setRecurringForm({ ...recurringForm, next_due_date: e.target.value })} required />
              </label>
              <label className="input-group">
                <span className="input-label">{t('notes')}</span>
                <textarea placeholder={t('notesDetails')} value={recurringForm.notes} onChange={(e) => setRecurringForm({ ...recurringForm, notes: e.target.value })} rows="2" />
              </label>
            </div>
            <div className="form-actions-row">
              <button type="submit" className="primary-btn">{editingRecurringId ? t('updateRecurringBtn') : t('saveRecurring')}</button>
              {editingRecurringId && <button type="button" className="ghost" onClick={resetRecurringForm}>{t('cancel')}</button>}
            </div>
          </form>
        </CollapsibleSection>
      </section>

      {/* API Key Modal */}
      {apiKeyModalOpen && (
        <div className="modal-backdrop" onClick={() => setApiKeyModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('geminiApiKey')}</h3>
              <button type="button" className="modal-close" onClick={() => setApiKeyModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className={`api-key-status-banner ${apiKeyStatus.has_gemini_api_key ? 'configured' : 'missing'}`}>
                <span>{apiKeyStatus.has_gemini_api_key ? '✓' : '⚠️'}</span>
                <span>
                  {apiKeyStatus.has_gemini_api_key
                    ? t('configuredKey', { key: apiKeyStatus.gemini_api_key_masked || 'Active' })
                    : t('noApiKey')}
                </span>
              </div>
              <p>{t('geminiDesc')}</p>
              <form onSubmit={saveApiKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <label className="input-group">
                  <span className="input-label">{t('geminiKeyLabel')}</span>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input type={showApiKeyText ? 'text' : 'password'} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="AIzaSy..." required style={{ width: '100%', paddingRight: '4rem' }} />
                    <button type="button" onClick={() => setShowApiKeyText(!showApiKeyText)}
                      style={{ position: 'absolute', right: '8px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 6px' }}>
                      {showApiKeyText ? t('hide') : t('show')}
                    </button>
                  </div>
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="api-key-link">{t('getKey')}</a>
                  <div className="modal-actions">
                    <button type="button" className="ghost" onClick={() => setApiKeyModalOpen(false)}>{t('cancel')}</button>
                    <button type="submit" className="primary-btn" disabled={savingApiKey}>{savingApiKey ? t('saving') : t('saveKey')}</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
