import { useEffect, useMemo, useState } from 'react';
import CategoryBarChart from './components/CategoryBarChart';
import MonthlyLineChart from './components/MonthlyLineChart';
import ReceiptResultView from './components/ReceiptResultView';
import { compressImageForUpload } from './utils/imageCompressor';

const API_BASE = '';
const apiUrl = (path) => `/api${path}`;
const startOfWeek = (value) => {
  const date = new Date(value);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (value, days) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

const formatDateInput = (value) => value.toISOString().slice(0, 10);

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
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: 'Housing',
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
  const [receiptPrompt, setReceiptPrompt] = useState('Extract all receipt items with merchant, transaction date (YYYY-MM-DD), categorized line items, and grand total. If date is not visible on receipt, output null.');
  const [analyzingReceipt, setAnalyzingReceipt] = useState(false);
  const [receiptResult, setReceiptResult] = useState(null);
  const [editingSpendId, setEditingSpendId] = useState(null);
  const [editingRecurringId, setEditingRecurringId] = useState(null);

  const resetSpendForm = () => {
    setForm({
      date: new Date().toISOString().slice(0, 10),
      amount: '',
      category: 'Housing',
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
      if (res.status === 401) {
        logout();
        return;
      }
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
      if (spendRes.status === 401 || recurringRes.status === 401) {
        logout();
        return;
      }
      if (spendRes.ok) setSpendRows(await spendRes.json());
      if (recurringRes.ok) setRecurring(await recurringRes.json());
    } catch (err) {
      setStatus(err.message);
    }
  };

  useEffect(() => {
    if (token) {
      loadDashboard();
      loadAll();
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
      setStatus('Logged in successfully');
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
      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || (editingSpendId ? 'Unable to update spend' : 'Unable to save spend'));
      }
      resetSpendForm();
      await loadDashboard();
      await loadAll();
      setStatus(editingSpendId ? 'Spend updated' : 'Spend row added');
    } catch (err) {
      setStatus(err.message);
    }
  };

  const deleteSpend = async (id) => {
    try {
      const res = await fetch(apiUrl(`/spend/${id}`), {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Unable to delete spend');
      }
      if (editingSpendId === id) resetSpendForm();
      await loadDashboard();
      await loadAll();
      setStatus('Spend row deleted');
    } catch (err) {
      setStatus(err.message);
    }
  };

  const editSpend = (item) => {
    setEditingSpendId(item.id);
    setForm({
      date: item.date || new Date().toISOString().slice(0, 10),
      amount: String(item.amount),
      category: item.category || 'Housing',
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
      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || (editingRecurringId ? 'Unable to update recurring expense' : 'Unable to save recurring expense'));
      }
      resetRecurringForm();
      await loadAll();
      setStatus(editingRecurringId ? 'Recurring expense updated' : 'Recurring expense saved');
    } catch (err) {
      setStatus(err.message);
    }
  };

  const deleteRecurring = async (id) => {
    try {
      const res = await fetch(apiUrl(`/recurring/${id}`), {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Unable to delete recurring expense');
      }
      if (editingRecurringId === id) resetRecurringForm();
      await loadAll();
      setStatus('Recurring expense deleted');
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
    if (!receiptFile) {
      setStatus('Choose a receipt image first');
      return;
    }
    setAnalyzingReceipt(true);
    setStatus('Optimizing receipt image…');

    try {
      const fileToUpload = await compressImageForUpload(receiptFile);

      const formData = new FormData();
      if (receiptMonth) formData.append('month', receiptMonth);
      if (receiptPrompt) formData.append('system_prompt', receiptPrompt);
      formData.append('file', fileToUpload);

      setStatus('Processing receipt with Gemini AI…');
      const res = await fetch(apiUrl('/receipt/analyze'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const text = await res.text();
      if (res.status === 413 || text.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
        throw new Error('Image exceeds server payload limits (4.5MB). Please upload a smaller photo.');
      }
      if (!res.ok) {
        let errorDetail = text;
        try {
          const parsed = JSON.parse(text);
          errorDetail = parsed.detail || text;
        } catch {}
        throw new Error(errorDetail || 'Unable to analyze receipt');
      }
      const data = JSON.parse(text);
      setReceiptResult(data);
      setStatus(data.imported_rows ? `Receipt analyzed and ${data.imported_rows} spend rows imported` : 'Receipt analyzed successfully');
      await loadDashboard();
      await loadAll();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setAnalyzingReceipt(false);
    }
  };

  const handlePrevPeriod = () => {
    const cur = new Date(`${anchorDate}T00:00:00`);
    if (chartTimeframe === 'day') {
      cur.setDate(cur.getDate() - 1);
    } else if (chartTimeframe === 'week') {
      cur.setDate(cur.getDate() - 7);
    } else if (chartTimeframe === 'month') {
      cur.setMonth(cur.getMonth() - 1);
    }
    setAnchorDate(formatDateInput(cur));
  };

  const handleNextPeriod = () => {
    const cur = new Date(`${anchorDate}T00:00:00`);
    if (chartTimeframe === 'day') {
      cur.setDate(cur.getDate() + 1);
    } else if (chartTimeframe === 'week') {
      cur.setDate(cur.getDate() + 7);
    } else if (chartTimeframe === 'month') {
      cur.setMonth(cur.getMonth() + 1);
    }
    setAnchorDate(formatDateInput(cur));
  };

  const handleToday = () => {
    setAnchorDate(formatDateInput(new Date()));
  };

  // Compute aggregated chart data for Day, Week, Month, or All Time
  const chartData = useMemo(() => {
    const anchor = new Date(`${anchorDate}T00:00:00`);
    let rangeStart = null;
    let rangeEnd = null;
    let periodLabel = '';
    let trendUnit = 'day';
    const trendMap = {};

    if (chartTimeframe === 'day') {
      trendUnit = 'day';
      rangeStart = formatDateInput(anchor);
      rangeEnd = rangeStart;
      periodLabel = anchor.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      // Show 7 days ending on anchor date
      for (let i = 6; i >= 0; i--) {
        const d = addDays(anchor, -i);
        trendMap[formatDateInput(d)] = 0;
      }
    } else if (chartTimeframe === 'week') {
      trendUnit = 'day';
      const wStart = startOfWeek(anchorDate);
      const wEnd = addDays(wStart, 6);
      rangeStart = formatDateInput(wStart);
      rangeEnd = formatDateInput(wEnd);
      periodLabel = `${wStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${wEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

      // 7 days of this week
      for (let i = 0; i < 7; i++) {
        const d = addDays(wStart, i);
        trendMap[formatDateInput(d)] = 0;
      }
    } else if (chartTimeframe === 'month') {
      trendUnit = 'month';
      const y = anchor.getFullYear();
      const m = anchor.getMonth();
      const mStart = new Date(y, m, 1);
      const mEnd = new Date(y, m + 1, 0);
      rangeStart = formatDateInput(mStart);
      rangeEnd = formatDateInput(mEnd);
      periodLabel = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

      // Past 6 months ending in anchor month
      for (let i = 5; i >= 0; i--) {
        const d = new Date(y, m - i, 1);
        const mKey = d.toISOString().slice(0, 7);
        trendMap[mKey] = 0;
      }
    } else {
      trendUnit = 'month';
      periodLabel = 'All Time';
    }

    const categoryTotals = {};
    let periodTotal = 0;

    for (const row of spendRows) {
      const rowDate = row.date || '';
      const amount = Number(row.amount) || 0;
      const cat = row.category || 'Other';
      const rowMonth = rowDate.slice(0, 7);

      const inRange =
        chartTimeframe === 'all' ||
        (rangeStart && rangeEnd && rowDate >= rangeStart && rowDate <= rangeEnd);

      if (inRange) {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
        periodTotal += amount;
      }

      if (chartTimeframe === 'day' || chartTimeframe === 'week') {
        if (rowDate in trendMap) {
          trendMap[rowDate] = (trendMap[rowDate] || 0) + amount;
        }
      } else if (chartTimeframe === 'month') {
        if (rowMonth in trendMap) {
          trendMap[rowMonth] = (trendMap[rowMonth] || 0) + amount;
        }
      } else if (chartTimeframe === 'all') {
        if (rowMonth) {
          trendMap[rowMonth] = (trendMap[rowMonth] || 0) + amount;
        }
      }
    }

    if (chartTimeframe === 'all' && dashboard?.by_month) {
      for (const [mKey, amt] of Object.entries(dashboard.by_month)) {
        trendMap[mKey] = Math.max(trendMap[mKey] || 0, Number(amt) || 0);
      }
    }

    return {
      categoryTotals,
      trendMap,
      periodLabel,
      periodTotal,
      trendUnit,
      rangeStart,
      rangeEnd,
    };
  }, [spendRows, dashboard, chartTimeframe, anchorDate]);

  // All hooks must be called before any early return (React rules of hooks)
  const filteredSpendRows = useMemo(() => {
    let rows = spendRows;
    if (filterTransactionsByChart && chartTimeframe !== 'all' && chartData.rangeStart && chartData.rangeEnd) {
      rows = rows.filter((item) => item.date >= chartData.rangeStart && item.date <= chartData.rangeEnd);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(
        (item) =>
          (item.merchant || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q) ||
          (item.notes || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [spendRows, filterTransactionsByChart, chartTimeframe, chartData, searchQuery]);

  const filteredSpendTotal = filteredSpendRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);

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
            <h1>Budget AI Dashboard</h1>
            <p className="login-subtitle">Sign in to track spend & analyze receipts</p>
          </div>
          <div className="login-inputs">
            <label className="input-group">
              <span className="input-label">Username</span>
              <input
                placeholder="Account name"
                value={login.username}
                onChange={(e) => setLogin({ ...login, username: e.target.value })}
                required
              />
            </label>
            <label className="input-group">
              <span className="input-label">Password</span>
              <input
                type="password"
                placeholder="Access key"
                value={login.password}
                onChange={(e) => setLogin({ ...login, password: e.target.value })}
                required
              />
            </label>
          </div>
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          {status && <div className="message">{status}</div>}
        </form>
      </div>
    );
  }

  const categoryMap = dashboard?.by_category || {};
  const byMonth = dashboard?.by_month || {};
  const weekStartDate = startOfWeek(weekFilter);
  const weekEndDate = addDays(weekStartDate, 6);

  return (
    <div className="page app-shell">
      <header className="topbar">
        <div className="brand-group">
          <span className="brand-icon">💰</span>
          <div>
            <h1>Budget Dashboard</h1>
            <span className="brand-tagline">Personal spend & AI receipt intelligence</span>
          </div>
        </div>
        <button className="ghost logout-btn" onClick={logout}>
          <span>Sign out</span>
        </button>
      </header>

      {status && <div className="message">{status}</div>}

      <section className="grid stats-grid">
        <div className="card highlight">
          <div className="card-top">
            <span>Total Spend</span>
            <span className="card-icon">💳</span>
          </div>
          <strong>${Number(dashboard?.total_spend || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <span className="card-footnote">Across all recorded transactions</span>
        </div>
        <div className="card">
          <div className="card-top">
            <span>Recurring Obligations</span>
            <span className="card-icon">🔄</span>
          </div>
          <strong>${Number(dashboard?.recurring_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <span className="card-footnote">{recurring.filter(r => r.is_active).length} active subscriptions</span>
        </div>
        <div className="card">
          <div className="card-top">
            <span>Active Categories</span>
            <span className="card-icon">🏷️</span>
          </div>
          <strong>{Object.keys(categoryMap).length}</strong>
          <span className="card-footnote">Tracked expense groups</span>
        </div>
      </section>

      {/* Timeframe & Chart Granularity Bar */}
      <section className="panel timeframe-control-panel">
        <div className="timeframe-bar">
          <div className="timeframe-segment">
            <span className="timeframe-label">Filter View:</span>
            <div className="timeframe-buttons">
              <button
                type="button"
                className={`ghost pill-btn ${chartTimeframe === 'day' ? 'active' : ''}`}
                onClick={() => setChartTimeframe('day')}
              >
                Day
              </button>
              <button
                type="button"
                className={`ghost pill-btn ${chartTimeframe === 'week' ? 'active' : ''}`}
                onClick={() => setChartTimeframe('week')}
              >
                Week
              </button>
              <button
                type="button"
                className={`ghost pill-btn ${chartTimeframe === 'month' ? 'active' : ''}`}
                onClick={() => setChartTimeframe('month')}
              >
                Month
              </button>
              <button
                type="button"
                className={`ghost pill-btn ${chartTimeframe === 'all' ? 'active' : ''}`}
                onClick={() => setChartTimeframe('all')}
              >
                All Time
              </button>
            </div>
          </div>

          <div className="timeframe-nav">
            {chartTimeframe !== 'all' ? (
              <>
                <button type="button" className="ghost nav-arrow-btn" onClick={handlePrevPeriod} title="Previous period">
                  ◀
                </button>
                <div className="timeframe-period-badge">
                  <span className="period-icon">📅</span>
                  <strong>{chartData.periodLabel}</strong>
                </div>
                <button type="button" className="ghost nav-arrow-btn" onClick={handleNextPeriod} title="Next period">
                  ▶
                </button>
                <button type="button" className="ghost today-pill-btn" onClick={handleToday}>
                  Today
                </button>
                <input
                  type="date"
                  value={anchorDate}
                  onChange={(e) => setAnchorDate(e.target.value)}
                  className="date-direct-picker"
                  title="Jump to date"
                />
              </>
            ) : (
              <div className="timeframe-period-badge">
                <span className="period-icon">🌐</span>
                <strong>All Recorded Transactions</strong>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Visual Charts: Bar Chart for Categories & Line Graph for Trends */}
      <section className="grid two-col charts-section">
        <div className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>Spend by Category</h2>
              <span className="panel-subtitle">
                {chartTimeframe === 'all'
                  ? 'All-time category distribution'
                  : `Expenses for ${chartData.periodLabel}`}
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
                {chartTimeframe === 'day'
                  ? 'Daily Trajectory (7 Days)'
                  : chartTimeframe === 'week'
                  ? 'Weekly Daily Trend'
                  : chartTimeframe === 'month'
                  ? 'Monthly Trend (Past 6 Months)'
                  : 'Historical Monthly Trend'}
              </h2>
              <span className="panel-subtitle">
                {chartTimeframe === 'day'
                  ? `Day-by-day trend up to ${anchorDate}`
                  : chartTimeframe === 'week'
                  ? `Daily spending across ${chartData.periodLabel}`
                  : chartTimeframe === 'month'
                  ? 'Recent monthly timeline'
                  : 'Macro timeline across all recorded months'}
              </span>
            </div>
            <span className="chart-badge">
              {chartData.trendUnit === 'day' ? 'Daily' : 'Monthly'}
            </span>
          </div>
          <MonthlyLineChart
            data={chartData.trendMap}
            unit={chartData.trendUnit}
            emptyMessage={`No spending recorded for this ${chartTimeframe}`}
          />
        </div>
      </section>

      {/* Transactions Explorer */}
      <section className="panel filter-panel">
        <div className="filter-controls-header">
          <div className="filter-title-wrap">
            <h2>Transactions Explorer</h2>
            <span className="panel-subtitle">
              {filterTransactionsByChart && chartTimeframe !== 'all'
                ? `Filtered to active ${chartTimeframe}: ${chartData.periodLabel}`
                : 'All transactions across all time'}
            </span>
          </div>
          <div className="filter-inputs-row">
            <div className="search-input-wrap">
              <input
                type="text"
                placeholder="Search merchant, category, note…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-quick-buttons">
              <button
                type="button"
                className={`ghost pill-btn ${filterTransactionsByChart ? 'active' : ''}`}
                onClick={() => setFilterTransactionsByChart(!filterTransactionsByChart)}
                title="Toggle filtering table by chart timeframe"
              >
                {filterTransactionsByChart ? `Filtered to ${chartTimeframe}` : 'Showing All Time'}
              </button>
            </div>
          </div>
        </div>
        <div className="week-summary-card">
          <span className="summary-pill">{filteredSpendRows.length} {filteredSpendRows.length === 1 ? 'transaction' : 'transactions'}</span>
          <span className="summary-amount">${filteredSpendTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </section>

      {/* Forms & AI Section */}
      <section className="grid three-col">
        <form className="panel form-panel" onSubmit={addSpend}>
          <div className="panel-header">
            <h2>{editingSpendId ? 'Edit Spend Row' : 'Add Spend Row'}</h2>
          </div>
          <label className="input-group">
            <span className="input-label">Date</span>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </label>
          <label className="input-group">
            <span className="input-label">Amount ($)</span>
            <input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </label>
          <label className="input-group">
            <span className="input-label">Category</span>
            <input placeholder="e.g. Groceries, Housing, Dining" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
          </label>
          <label className="input-group">
            <span className="input-label">Merchant</span>
            <input placeholder="e.g. Trader Joe's, Uber" value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
          </label>
          <label className="input-group">
            <span className="input-label">Notes</span>
            <input placeholder="Optional memo" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <div className="form-actions-row">
            <button type="submit" className="primary-btn">{editingSpendId ? 'Update spend' : 'Save spend'}</button>
            {editingSpendId && <button type="button" className="ghost" onClick={resetSpendForm}>Cancel</button>}
          </div>
        </form>

        <form className="panel form-panel" onSubmit={saveRecurring}>
          <div className="panel-header">
            <h2>{editingRecurringId ? 'Edit Recurring' : 'Recurring Expenses'}</h2>
          </div>
          <label className="input-group">
            <span className="input-label">Name</span>
            <input placeholder="e.g. Netflix, Gym, Rent" value={recurringForm.name} onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })} required />
          </label>
          <label className="input-group">
            <span className="input-label">Category</span>
            <input placeholder="e.g. Utilities, Entertainment" value={recurringForm.category} onChange={(e) => setRecurringForm({ ...recurringForm, category: e.target.value })} required />
          </label>
          <label className="input-group">
            <span className="input-label">Amount ($)</span>
            <input type="number" step="0.01" placeholder="0.00" value={recurringForm.amount} onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })} required />
          </label>
          <label className="input-group">
            <span className="input-label">Frequency</span>
            <select value={recurringForm.frequency} onChange={(e) => setRecurringForm({ ...recurringForm, frequency: e.target.value })}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label className="input-group">
            <span className="input-label">Next Due Date</span>
            <input type="date" value={recurringForm.next_due_date} onChange={(e) => setRecurringForm({ ...recurringForm, next_due_date: e.target.value })} required />
          </label>
          <label className="input-group">
            <span className="input-label">Notes</span>
            <textarea placeholder="Notes / details" value={recurringForm.notes} onChange={(e) => setRecurringForm({ ...recurringForm, notes: e.target.value })} rows="2" />
          </label>
          <div className="form-actions-row">
            <button type="submit" className="primary-btn">{editingRecurringId ? 'Update recurring' : 'Save recurring'}</button>
            {editingRecurringId && <button type="button" className="ghost" onClick={resetRecurringForm}>Cancel</button>}
          </div>
        </form>

        <div className="panel form-panel ai-panel">
          <div className="panel-header">
            <div className="ai-title-wrap">
              <span className="sparkle-icon">✨</span>
              <h2>Gemini Receipt AI</h2>
            </div>
          </div>
          <label className="input-group">
            <span className="input-label">Date Override (Optional)</span>
            <input
              type="month"
              value={receiptMonth}
              onChange={(e) => setReceiptMonth(e.target.value)}
              placeholder="Auto-detect from receipt"
            />
            <span className="input-hint">Leave blank to auto-detect the date from the receipt (falls back to today if unreadable)</span>
          </label>
          <label className="input-group file-upload-group">
            <span className="input-label">Receipt Image</span>
            <input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files?.[0])} />
          </label>
          <label className="input-group">
            <span className="input-label">Extraction Prompt</span>
            <textarea value={receiptPrompt} rows="3" onChange={(e) => setReceiptPrompt(e.target.value)} />
          </label>
          <div className="receipt-actions">
            <button onClick={analyzeReceipt} disabled={analyzingReceipt} className="ai-btn">
              {analyzingReceipt ? '✨ Scanning & Analyzing…' : '✨ Analyze Receipt Image'}
            </button>
            {analyzingReceipt && <div className="message ai-status">Processing receipt with Gemini Multimodal AI…</div>}
          </div>
          {receiptResult && <ReceiptResultView result={receiptResult} />}
        </div>
      </section>

      {/* Spend Rows and Recurring Expenses Tables */}
      <section className="grid two-col">
        <div className="panel data-panel">
          <div className="panel-header">
            <h2>Transactions</h2>
            <span className="record-count">{filteredSpendRows.length} entries</span>
          </div>
          {filteredSpendRows.length === 0 ? (
            <div className="empty-data-state">
              <span>🧾</span>
              <p>No spend rows match your criteria</p>
            </div>
          ) : (
            <ul className="rows-list slim-list">
              {filteredSpendRows.map((item) => (
                <li key={item.id} className="transaction-row">
                  <div className="transaction-main">
                    <div className="transaction-line1">
                      <strong className="merchant-name">{item.merchant || 'Unknown Merchant'}</strong>
                      <span className="category-pill">{item.category}</span>
                      {item.source === 'receipt_ai' && (
                        <span className="ai-pill" title="Imported by Gemini AI">✨ AI</span>
                      )}
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
                      <button className="ghost sm-btn" onClick={() => editSpend(item)}>Edit</button>
                      <button className="ghost sm-btn danger-hover" onClick={() => deleteSpend(item.id)}>Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel data-panel">
          <div className="panel-header">
            <h2>Recurring Expenses</h2>
            <span className="record-count">{recurring.length} subscriptions</span>
          </div>
          {recurring.length === 0 ? (
            <div className="empty-data-state">
              <span>🔄</span>
              <p>No recurring expenses registered</p>
            </div>
          ) : (
            <ul className="rows-list">
              {recurring.map((item) => (
                <li key={item.id} className="recurring-row">
                  <div className="recurring-main">
                    <div className="recurring-line1">
                      <strong className="recurring-name">{item.name}</strong>
                      <span className="frequency-badge">{item.frequency}</span>
                    </div>
                    <div className="recurring-line2">
                      <span className="recurring-cat">{item.category}</span>
                      <span className="recurring-due">Due: {item.next_due_date}</span>
                    </div>
                  </div>
                  <div className="recurring-right">
                    <strong className="recurring-amount">
                      ${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    <div className="actions">
                      <button className="ghost sm-btn" onClick={() => editRecurring(item)}>Edit</button>
                      <button className="ghost sm-btn danger-hover" onClick={() => deleteRecurring(item.id)}>Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
