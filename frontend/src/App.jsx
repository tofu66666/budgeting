import { useEffect, useMemo, useState } from 'react';

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
  const [weekFilter, setWeekFilter] = useState(formatDateInput(new Date()));
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
  const [receiptMonth, setReceiptMonth] = useState(new Date().toISOString().slice(0, 7));
  const [receiptPrompt, setReceiptPrompt] = useState('Extract all receipt items, categorize them into budget categories and return concise JSON only. Use exactly these keys: total_spend, categories, line_items, notes. Do not include category_totals, summary, markdown, commentary, or any extra sections. Include each line item individually, including discounts, price overrides, refunds, and adjustments. Keep negative amounts for discounts/refunds. Output valid JSON only, no code fences, and no explanation.');
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
      if (!res.ok) throw new Error('Login failed');
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
      if (!res.ok) throw new Error(editingSpendId ? 'Unable to update spend' : 'Unable to save spend');
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
      if (!res.ok) throw new Error('Unable to delete spend');
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
      if (!res.ok) throw new Error(editingRecurringId ? 'Unable to update recurring expense' : 'Unable to save recurring expense');
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
      if (!res.ok) throw new Error('Unable to delete recurring expense');
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
    const formData = new FormData();
    formData.append('month', receiptMonth);
    formData.append('system_prompt', receiptPrompt);
    formData.append('file', receiptFile);

    try {
      const res = await fetch(apiUrl('/receipt/analyze'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Unable to analyze receipt');
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

  // All hooks must be called before any early return (React rules of hooks)
  const filteredSpendRows = useMemo(() => {
    if (!weekFilter) return spendRows;
    const weekStart = startOfWeek(weekFilter);
    const weekEnd = addDays(weekStart, 6);

    return spendRows.filter((item) => {
      const itemDate = new Date(`${item.date}T00:00:00`);
      return itemDate >= weekStart && itemDate <= weekEnd;
    });
  }, [spendRows, weekFilter]);

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
          <h1>Budget Dashboard</h1>
          <div>
            <input
              placeholder="Account"
              value={login.username}
              onChange={(e) => setLogin({ ...login, username: e.target.value })}
            />
            <input
              type="password"
              placeholder="Access key"
              value={login.password}
              onChange={(e) => setLogin({ ...login, password: e.target.value })}
            />
          </div>
          <button type="submit">Login</button>
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
        <h1>Budget Dashboard</h1>
        <button className="ghost" onClick={logout}>Logout</button>
      </header>

      {status && <div className="message">{status}</div>}

      <section className="grid stats-grid">
        <div className="card highlight">
          <span>Total spend</span>
          <strong>${dashboard?.total_spend?.toFixed(2) || '0.00'}</strong>
        </div>
        <div className="card">
          <span>Recurring</span>
          <strong>${dashboard?.recurring_total?.toFixed(2) || '0.00'}</strong>
        </div>
        <div className="card">
          <span>Categories</span>
          <strong>{Object.keys(categoryMap).length}</strong>
        </div>
      </section>

      <section className="grid two-col">
        <div className="panel">
          <h2>Spend by category</h2>
          <ul className="rows-list">
            {Object.entries(categoryMap).map(([key, value]) => (
              <li key={key}><span>{key}</span><strong>${Number(value).toFixed(2)}</strong></li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h2>Spend by month</h2>
          <ul className="rows-list">
            {Object.entries(byMonth).map(([key, value]) => (
              <li key={key}><span>{key}</span><strong>${Number(value).toFixed(2)}</strong></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel">
        <h2>Week filter</h2>
        <input type="date" value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} />
        <div className="week-summary">
          <strong>{filteredSpendRows.length} entries</strong>
          <strong>${filteredSpendTotal.toFixed(2)}</strong>
        </div>
      </section>

      <section className="grid three-col">
        <form className="panel" onSubmit={addSpend}>
          <h2>Add spend row</h2>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input placeholder="Merchant" value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit">{editingSpendId ? 'Update spend' : 'Save spend'}</button>
          {editingSpendId && <button type="button" className="ghost" onClick={resetSpendForm}>Cancel</button>}
        </form>

        <form className="panel" onSubmit={saveRecurring}>
          <h2>{editingRecurringId ? 'Edit recurring expense' : 'Recurring expenses'}</h2>
          <input placeholder="Name" value={recurringForm.name} onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })} />
          <input placeholder="Category" value={recurringForm.category} onChange={(e) => setRecurringForm({ ...recurringForm, category: e.target.value })} />
          <input type="number" step="0.01" placeholder="Amount" value={recurringForm.amount} onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })} />
          <select value={recurringForm.frequency} onChange={(e) => setRecurringForm({ ...recurringForm, frequency: e.target.value })}>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <input type="date" value={recurringForm.next_due_date} onChange={(e) => setRecurringForm({ ...recurringForm, next_due_date: e.target.value })} />
          <textarea placeholder="Notes" value={recurringForm.notes} onChange={(e) => setRecurringForm({ ...recurringForm, notes: e.target.value })} />
          <button type="submit">{editingRecurringId ? 'Update recurring' : 'Save recurring'}</button>
          {editingRecurringId && <button type="button" className="ghost" onClick={resetRecurringForm}>Cancel</button>}
        </form>

        <div className="panel">
          <h2>Gemini receipt AI</h2>
          <input type="month" value={receiptMonth} onChange={(e) => setReceiptMonth(e.target.value)} />
          <input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files?.[0])} />
          <textarea value={receiptPrompt} rows="4" onChange={(e) => setReceiptPrompt(e.target.value)} />
          <div className="receipt-actions">
            <button onClick={analyzeReceipt} disabled={analyzingReceipt}>
              {analyzingReceipt ? 'Analyzing receipt...' : 'Analyze receipt'}
            </button>
            {analyzingReceipt && <div className="message">Processing image…</div>}
          </div>
          {receiptResult && (
            <div className="receipt-result">
              <p><strong>Total:</strong> ${Number(receiptResult.monthly_total || 0).toFixed(2)}</p>
              <pre>{JSON.stringify(receiptResult, null, 2)}</pre>
            </div>
          )}
        </div>
      </section>

      <section className="grid two-col">
        <div className="panel">
          <h2>Spend rows</h2>
          <ul className="rows-list slim-list">
            {filteredSpendRows.map((item) => (
              <li key={item.id}>
                <span>{item.category} • {item.merchant || 'Unknown merchant'}</span>
                <strong>${Number(item.amount).toFixed(2)}</strong>
                <span className="actions">
                  <button onClick={() => editSpend(item)}>Edit</button>
                  <button onClick={() => deleteSpend(item.id)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel">
        <h2>Recurring expenses</h2>
        <ul className="rows-list">
          {recurring.map((item) => (
            <li key={item.id}>
              <span>{item.name} ({item.frequency})</span>
              <strong>${Number(item.amount).toFixed(2)}</strong>
              <span className="actions">
                <button onClick={() => editRecurring(item)}>Edit</button>
                <button onClick={() => deleteRecurring(item.id)}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default App;
