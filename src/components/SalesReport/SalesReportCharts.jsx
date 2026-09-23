import React, { useState } from 'react';

const PALETTE = [
  '#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6'
];

/**
 * Responsive Bar Chart (Vertical)
 */
export function SimpleBarChart({ data = [], xKey = 'label', yKey = 'value', height = 220, color = '#0284c7', yLabel = 'Qty' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  if (!data.length) {
    return <div className="chart-empty-state">No data available for this selection.</div>;
  }

  const maxVal = Math.max(...data.map((d) => d[yKey] || 0), 1);
  const chartWidth = 540;
  const chartHeight = height;
  const paddingLeft = 45;
  const paddingBottom = 35;
  const paddingTop = 20;
  const paddingRight = 15;

  const innerW = chartWidth - paddingLeft - paddingRight;
  const innerH = chartHeight - paddingTop - paddingBottom;
  const barWidth = Math.max(Math.min(innerW / data.length - 6, 36), 6);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="sales-svg-chart">
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = paddingTop + innerH * (1 - pct);
          const val = Math.round(maxVal * pct);
          return (
            <g key={i}>
              <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">{val}</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const val = item[yKey] || 0;
          const barH = (val / maxVal) * innerH;
          const x = paddingLeft + (idx * (innerW / data.length)) + ((innerW / data.length - barWidth) / 2);
          const y = paddingTop + innerH - barH;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 2)}
                rx="4"
                fill={isHovered ? '#0369a1' : (item.color || color)}
                style={{ transition: 'all 0.2s ease' }}
              />
              {/* X label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight - paddingBottom + 16}
                textAnchor="middle"
                fontSize="10"
                fill={isHovered ? '#0f172a' : '#64748b'}
                fontWeight={isHovered ? '700' : '500'}
              >
                {String(item[xKey] || '').slice(0, 7)}
              </text>
              {/* Hover Value Popover */}
              {isHovered && (
                <g>
                  <rect
                    x={Math.max(x + barWidth / 2 - 40, 10)}
                    y={Math.max(y - 28, 4)}
                    width="80"
                    height="22"
                    rx="4"
                    fill="#1e293b"
                  />
                  <text
                    x={Math.max(x + barWidth / 2, 50)}
                    y={Math.max(y - 13, 19)}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="700"
                  >
                    {val.toLocaleString()} {yLabel}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Responsive Horizontal Bar Chart (For Top Delivery Areas & Staff)
 */
export function HorizontalBarChart({ data = [], labelKey = 'label', valueKey = 'value', maxItems = 8, color = '#10b981' }) {
  const items = data.slice(0, maxItems);
  if (!items.length) {
    return <div className="chart-empty-state">No data to display.</div>;
  }

  const maxVal = Math.max(...items.map((d) => d[valueKey] || 0), 1);

  return (
    <div className="horizontal-bars-container">
      {items.map((item, idx) => {
        const val = item[valueKey] || 0;
        const pct = Math.round((val / maxVal) * 100);
        return (
          <div key={idx} className="horizontal-bar-row">
            <div className="horizontal-bar-label" title={item[labelKey]}>
              <span>{idx + 1}. {item[labelKey]}</span>
              <strong>{val.toLocaleString()}</strong>
            </div>
            <div className="horizontal-bar-track">
              <div
                className="horizontal-bar-fill"
                style={{
                  width: `${pct}%`,
                  background: PALETTE[idx % PALETTE.length],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Dual-metric comparison: refill volume and DAC percentage by period. */
export function RefillDacComparisonChart({ data = [] }) {
  if (!data.length) return <div className="chart-empty-state">No comparison data available.</div>;
  const maxRefill = Math.max(...data.map((item) => Number(item.refill) || 0), 1);

  return (
    <div className="refill-dac-chart">
      <div className="refill-dac-chart__legend">
        <span><i className="refill-dac-dot refill-dac-dot--refill" /> Total Refill</span>
        <span><i className="refill-dac-dot refill-dac-dot--dac" /> DAC %</span>
      </div>
      {data.map((item) => {
        const refill = Number(item.refill) || 0;
        const dacCount = Number(item.dacCount) || 0;
        const dac = Math.max(0, Math.min(Number(item.dac) || 0, 100));
        return (
          <div className="refill-dac-chart__row" key={item.label}>
            <strong className="refill-dac-chart__label">{item.label}</strong>
            <div className="refill-dac-chart__metrics">
              <div className="refill-dac-chart__metric">
                <span className="refill-dac-chart__value">{refill.toLocaleString()} Cyl</span>
                <div className="refill-dac-chart__track">
                  <div className="refill-dac-chart__fill refill-dac-chart__fill--refill" style={{ width: `${(refill / maxRefill) * 100}%` }} />
                </div>
              </div>
              <div className="refill-dac-chart__metric">
                <span className="refill-dac-chart__value">{dacCount.toLocaleString()} DAC ({dac.toFixed(1)}%)</span>
                <div className="refill-dac-chart__track">
                  <div className="refill-dac-chart__fill refill-dac-chart__fill--dac" style={{ width: `${dac}%` }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Full-name package distribution with a stacked share bar and ranked rows. */
export function ProductBreakdownChart({ data = [], labelKey = 'label', valueKey = 'value' }) {
  const total = data.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);
  if (!data.length || total === 0) return <div className="chart-empty-state">No product data available.</div>;
  const ranked = [...data].sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0));

  return (
    <div className="product-breakdown-chart">
      <div className="product-breakdown-chart__stack" aria-label="Product refill share distribution">
        {ranked.map((item, index) => {
          const value = Number(item[valueKey]) || 0;
          const share = (value / total) * 100;
          return (
            <span
              key={item[labelKey]}
              title={`${item[labelKey]}: ${value.toLocaleString()} (${share.toFixed(1)}%)`}
              style={{ width: `${share}%`, background: item.color || PALETTE[index % PALETTE.length] }}
            />
          );
        })}
      </div>
      <div className="product-breakdown-chart__list">
        {ranked.map((item, index) => {
          const value = Number(item[valueKey]) || 0;
          const share = (value / total) * 100;
          return (
            <div className="product-breakdown-chart__item" key={item[labelKey]}>
              <span className="product-breakdown-chart__rank">{index + 1}</span>
              <i style={{ background: item.color || PALETTE[index % PALETTE.length] }} />
              <span className="product-breakdown-chart__name">{item[labelKey]}</span>
              <strong>{value.toLocaleString()} Cyl</strong>
              <b>{share.toFixed(1)}%</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Responsive SVG Donut / Pie Chart (For Nature of Consumer, Package Code, Order Source)
 */
export function DonutChart({ data = [], labelKey = 'label', valueKey = 'value', size = 180, maxLegendItems = 6 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const total = data.reduce((sum, d) => sum + (d[valueKey] || 0), 0);

  if (!data.length || total === 0) {
    return <div className="chart-empty-state">No categorical data available.</div>;
  }

  let accumulatedAngle = 0;
  const radius = size / 2;
  const strokeWidth = 32;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const slices = data.map((item, idx) => {
    const val = item[valueKey] || 0;
    const ratio = val / total;
    const strokeDashoffset = circumference - (ratio * circumference);
    const rotation = accumulatedAngle * 360 - 90;
    accumulatedAngle += ratio;
    const color = item.color || PALETTE[idx % PALETTE.length];
    const pct = (ratio * 100).toFixed(1);

    return {
      ...item,
      val,
      pct,
      color,
      rotation,
      strokeDashoffset,
    };
  });

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className="donut-chart-container">
      <div className="donut-svg-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((slice, idx) => (
            <circle
              key={idx}
              cx={radius}
              cy={radius}
              r={normalizedRadius}
              fill="transparent"
              stroke={slice.color}
              strokeWidth={hoveredIdx === idx ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={slice.strokeDashoffset}
              transform={`rotate(${slice.rotation} ${radius} ${radius})`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
            />
          ))}
          {/* Inner circle text */}
          <text x={radius} y={radius - 4} textAnchor="middle" fontSize="16" fontWeight="800" fill="#0f172a">
            {activeSlice ? activeSlice.val.toLocaleString() : total.toLocaleString()}
          </text>
          <text x={radius} y={radius + 14} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">
            {activeSlice ? `${activeSlice.pct}%` : 'Total Qty'}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="donut-legend">
        {slices.slice(0, maxLegendItems).map((slice, idx) => (
          <div
            key={idx}
            className={`donut-legend-item ${hoveredIdx === idx ? 'active' : ''}`}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span className="legend-bullet" style={{ background: slice.color }} />
            <span className="legend-text" title={slice[labelKey]}>{slice[labelKey]}</span>
            <strong className="legend-val">{slice.pct}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Trend Line Chart for Daily / Monthly Sales
 */
export function TrendLineChart({ data = [], xKey = 'label', yKey = 'value', height = 200, strokeColor = '#0284c7' }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  if (!data.length) return <div className="chart-empty-state">No trend records.</div>;

  const chartW = 540;
  const chartH = height;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 30;

  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const maxVal = Math.max(...data.map((d) => d[yKey] || 0), 1);

  const points = data.map((d, i) => {
    const x = padL + (i * (innerW / (data.length - 1 || 1)));
    const y = padT + innerH - ((d[yKey] || 0) / maxVal * innerH);
    return { x, y, item: d };
  });

  const pathD = points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`), '');
  const areaD = points.length > 0 ? `${pathD} L ${points[points.length - 1].x},${padT + innerH} L ${points[0].x},${padT + innerH} Z` : '';

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="sales-svg-chart">
        {/* Fill Area */}
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#trendGradient)" />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={hoveredPoint === i ? 6 : 3.5}
            fill={hoveredPoint === i ? strokeColor : '#ffffff'}
            stroke={strokeColor}
            strokeWidth="2"
            onMouseEnter={() => setHoveredPoint(i)}
            onMouseLeave={() => setHoveredPoint(null)}
            style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          />
        ))}

        {/* Labels at key interval */}
        {points.filter((_, i) => i % Math.ceil(points.length / 8) === 0 || i === points.length - 1).map((pt, i) => (
          <text key={i} x={pt.x} y={chartH - 8} textAnchor="middle" fontSize="10" fill="#64748b">
            {String(pt.item[xKey] || '').slice(0, 5)}
          </text>
        ))}

        {/* Hover detail */}
        {hoveredPoint !== null && (
          <g>
            <rect
              x={Math.max(points[hoveredPoint].x - 45, 10)}
              y={Math.max(points[hoveredPoint].y - 28, 4)}
              width="90"
              height="22"
              rx="4"
              fill="#0f172a"
            />
            <text
              x={Math.max(points[hoveredPoint].x, 55)}
              y={Math.max(points[hoveredPoint].y - 13, 19)}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="11"
              fontWeight="700"
            >
              {points[hoveredPoint].item[xKey]}: {points[hoveredPoint].item[yKey]}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
