import React from 'react';

export default function Toggle({ value = false, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        onClick={() => onChange && onChange(!value)}
        style={{ width: 44, height: 24, borderRadius: 12, background: value ? '#3b82f6' : '#d1d5db', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
      >
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: 2, transform: value ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
      {label && <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{label}</span>}
    </div>
  );
}
