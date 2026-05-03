import React from 'react';

export default function ProgressBar({ value = 0, color, height = 6, style: extraStyle }) {
  const pct = Math.max(0, Math.min(100, Number(value)));
  const barColor = color || (pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444');
  return (
    <div style={{ background: 'var(--bg-hover)', borderRadius: height, height, overflow: 'hidden', ...extraStyle }}>
      <div style={{ background: barColor, width: `${pct}%`, height: '100%', borderRadius: height, transition: 'width 0.4s ease' }} />
    </div>
  );
}
