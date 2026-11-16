import React, { useState } from 'react';

const PALETTE = [
  { bar: 'linear-gradient(90deg, #38bdf8, #6366f1)', dot: '#38bdf8' },
  { bar: 'linear-gradient(90deg, #818cf8, #a855f7)', dot: '#818cf8' },
  { bar: 'linear-gradient(90deg, #ec4899, #f43f5e)', dot: '#ec4899' },
  { bar: 'linear-gradient(90deg, #f59e0b, #ea580c)', dot: '#f59e0b' },
  { bar: 'linear-gradient(90deg, #10b981, #059669)', dot: '#10b981' },
  { bar: 'linear-gradient(90deg, #06b6d4, #0284c7)', dot: '#06b6d4' },
  { bar: 'linear-gradient(90deg, #8b5cf6, #d946ef)', dot: '#8b5cf6' },
  { bar: 'linear-gradient(90deg, #14b8a6, #0d9488)', dot: '#14b8a6' },
];

export default function CategoryBarChart({ data }) {
  const [hovered, setHovered] = useState(null);

  const entries = Object.entries(data || {})
    .map(([category, amount]) => ({
      category,
      amount: Number(amount) || 0,
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  if (entries.length === 0) {
    return (
      <div className="chart-empty">
        <div className="chart-empty-icon">📊</div>
        <p>No category expenses recorded yet</p>
      </div>
    );
  }

  const total = entries.reduce((acc, curr) => acc + curr.amount, 0);
  const maxAmount = Math.max(...entries.map((e) => e.amount), 1);

  return (
    <div className="category-chart-container">
      <div className="category-chart-list">
        {entries.map((item, index) => {
          const color = PALETTE[index % PALETTE.length];
          const pctOfTotal = total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0';
          const widthPct = Math.max(((item.amount / maxAmount) * 100), 2);
          const isHovered = hovered === item.category;

          return (
            <div
              key={item.category}
              className={`category-bar-row ${isHovered ? 'active' : ''}`}
              onMouseEnter={() => setHovered(item.category)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="category-info-header">
                <span className="category-name-wrap">
                  <span
                    className="category-color-dot"
                    style={{ background: color.dot }}
                  />
                  <strong className="category-title">{item.category}</strong>
                </span>
                <span className="category-amount-wrap">
                  <span className="category-amount">${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="category-percent-chip">{pctOfTotal}%</span>
                </span>
              </div>
              <div className="category-bar-track">
                <div
                  className="category-bar-fill"
                  style={{
                    width: `${widthPct}%`,
                    background: color.bar,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
