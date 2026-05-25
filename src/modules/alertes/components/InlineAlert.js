import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

const CONFIG = {
  INFO:     { Icon: Info,          bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
  LOW:      { Icon: Info,          bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  MEDIUM:   { Icon: AlertCircle,   bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  HIGH:     { Icon: AlertTriangle, bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  CRITICAL: { Icon: AlertTriangle, bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
};

export function InlineAlert({ alert }) {
  const { Icon, bg, color, border } = CONFIG[alert.severity] ?? CONFIG.INFO;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      borderRadius: 8, border: `1px solid ${border}`,
      background: bg, padding: '10px 12px',
    }}>
      <Icon size={15} style={{ color, marginTop: 2, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color }}>{alert.title}</p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color, opacity: 0.85 }}>{alert.message}</p>
      </div>
    </div>
  );
}
