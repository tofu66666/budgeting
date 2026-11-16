import React, { useState } from 'react';

export default function ReceiptResultView({ result }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!result) return null;

  const lineItems = Array.isArray(result.line_items) ? result.line_items : [];

  return (
    <div className="receipt-result-card">
      <div className="receipt-result-header">
        <div className="receipt-total-badge">
          <span className="badge-label">Receipt Total</span>
          <strong className="badge-value">
            ${Number(result.monthly_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </div>
        {result.imported_rows > 0 && (
          <span className="receipt-imported-pill">
            ✓ {result.imported_rows} item{result.imported_rows !== 1 ? 's' : ''} imported
          </span>
        )}
      </div>

      {result.notes && (
        <div className="receipt-notes-box">
          <span className="receipt-notes-title">AI Summary:</span> {result.notes}
        </div>
      )}

      {lineItems.length > 0 && (
        <div className="receipt-items-list">
          <div className="receipt-items-heading">Extracted Items ({lineItems.length})</div>
          <div className="receipt-items-table">
            {lineItems.map((item, idx) => {
              const amount = Number(item.amount || 0);
              const isDiscount = amount < 0;
              return (
                <div key={idx} className="receipt-item-row">
                  <div className="receipt-item-info">
                    <span className="receipt-item-desc">{item.description || 'Receipt Item'}</span>
                    <span className="receipt-item-cat">{item.category || 'General'}</span>
                  </div>
                  <div className={`receipt-item-price ${isDiscount ? 'discount' : ''}`}>
                    {isDiscount ? '-' : ''}${Math.abs(amount).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="receipt-raw-toggle">
        <button
          type="button"
          className="ghost text-btn"
          onClick={() => setShowRaw(!showRaw)}
        >
          {showRaw ? 'Hide raw JSON ▲' : 'View raw JSON ▼'}
        </button>
        {showRaw && (
          <pre className="receipt-raw-pre">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
