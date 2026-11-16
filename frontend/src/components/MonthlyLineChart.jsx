import React, { useState } from 'react';

function formatChartLabel(key, unit = 'month') {
  if (!key) return '';
  const parts = key.split('-');

  // Full date: YYYY-MM-DD
  if (parts.length === 3) {
    const d = new Date(`${key}T00:00:00`);
    if (!isNaN(d.getTime())) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${dayNames[d.getDay()]} ${d.getDate()}`;
    }
  }

  // Month: YYYY-MM
  if (parts.length === 2) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const yearShort = parts[0].slice(-2);
    const name = monthNames[monthIdx] || parts[1];
    return `${name} '${yearShort}`;
  }

  return key;
}

function formatTooltipTitle(key) {
  if (!key) return '';
  const parts = key.split('-');

  // Full date
  if (parts.length === 3) {
    const d = new Date(`${key}T00:00:00`);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  // Month
  if (parts.length === 2) {
    const d = new Date(`${key}-01T00:00:00`);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
  }

  return key;
}

export default function MonthlyLineChart({ data, unit = 'month', emptyMessage = 'No spend recorded for this period' }) {
  const [activePoint, setActivePoint] = useState(null);

  const sortedEntries = Object.entries(data || {})
    .filter(([key]) => Boolean(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => ({
      key,
      label: formatChartLabel(key, unit),
      tooltipTitle: formatTooltipTitle(key),
      amount: Number(amount) || 0,
    }));

  if (sortedEntries.length === 0) {
    return (
      <div className="chart-empty">
        <div className="chart-empty-icon">📈</div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const svgWidth = 560;
  const svgHeight = 220;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const maxValRaw = Math.max(...sortedEntries.map((e) => e.amount), 50);
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValRaw)));
  const maxVal = Math.ceil(maxValRaw / magnitude) * magnitude || 100;

  const points = sortedEntries.map((entry, i) => {
    const x = sortedEntries.length === 1
      ? padLeft + chartW / 2
      : padLeft + (i / (sortedEntries.length - 1)) * chartW;
    const yRatio = Math.min(Math.max(entry.amount / maxVal, 0), 1);
    const y = padTop + chartH - yRatio * chartH;
    return { ...entry, x, y };
  });

  // Generate smooth cubic Bezier path
  let pathD = '';
  if (points.length === 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
  } else {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
  }

  const zeroY = padTop + chartH;
  const areaD = points.length > 1
    ? `${pathD} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`
    : '';

  const gridLevels = [
    { value: maxVal, y: padTop },
    { value: maxVal / 2, y: padTop + chartH / 2 },
    { value: 0, y: zeroY },
  ];

  return (
    <div className="line-chart-wrapper">
      {activePoint && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(activePoint.x / svgWidth) * 100}%`,
            top: `${(activePoint.y / svgHeight) * 100}%`,
          }}
        >
          <div className="tooltip-month">{activePoint.tooltipTitle || activePoint.label}</div>
          <div className="tooltip-value">
            ${activePoint.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="monthly-svg-chart"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>

          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#6366f1" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#38bdf8" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Grid lines & Y labels */}
        {gridLevels.map((g, idx) => (
          <g key={idx} className="chart-grid-group">
            <line
              x1={padLeft}
              y1={g.y}
              x2={svgWidth - padRight}
              y2={g.y}
              className="chart-grid-line"
            />
            <text
              x={padLeft - 10}
              y={g.y + 4}
              className="chart-y-label"
              textAnchor="end"
            >
              ${g.value >= 1000 ? `${(g.value / 1000).toFixed(1)}k` : Math.round(g.value)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        {areaD && <path d={areaD} fill="url(#areaGrad)" />}

        {/* Main curve */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />

        {/* Data points & X labels */}
        {points.map((pt) => {
          const isActive = activePoint?.key === pt.key;
          return (
            <g
              key={pt.key}
              className="chart-point-group"
              onMouseEnter={() => setActivePoint(pt)}
              onMouseLeave={() => setActivePoint(null)}
            >
              <circle cx={pt.x} cy={pt.y} r="16" fill="transparent" style={{ cursor: 'pointer' }} />

              {isActive && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="10"
                  fill="#38bdf8"
                  opacity="0.3"
                  className="point-pulse"
                />
              )}

              <circle
                cx={pt.x}
                cy={pt.y}
                r={isActive ? 6 : 4.5}
                fill="#0f172a"
                stroke={isActive ? '#38bdf8' : '#60a5fa'}
                strokeWidth={isActive ? '3' : '2.5'}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
              />

              <text
                x={pt.x}
                y={zeroY + 22}
                className={`chart-x-label ${isActive ? 'active' : ''}`}
                textAnchor="middle"
              >
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
