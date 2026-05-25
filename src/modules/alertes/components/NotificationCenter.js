import React, { useState } from 'react';
import { BellOff } from 'lucide-react';
import { DS } from '../../../ds.js';
import { useAlerts } from '../hooks/useAlerts.js';
import { AlertCard } from './AlertCard.js';

const CATEGORIES = [
  { value: 'all',        label: 'Tout' },
  { value: 'financier',  label: 'Financier' },
  { value: 'tresorerie', label: 'Trésorerie' },
  { value: 'planning',   label: 'Planning' },
  { value: 'rh',         label: 'RH' },
  { value: 'qualite',    label: 'Qualité' },
  { value: 'securite',   label: 'Sécurité' },
];

const SEVERITY_ORDER = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export function NotificationCenter({ role, onNavigate }) {
  const [category, setCategory] = useState('all');
  const alerts = useAlerts({
    role,
    category: category === 'all' ? undefined : category,
  });

  const sorted = [...alerts].sort((a, b) => {
    const diff = (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0);
    if (diff !== 0) return diff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div style={{
      ...DS.card,
      width: 420,
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 580,
      display: 'flex',
      flexDirection: 'column',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ds-card-border)' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          Centre de notifications
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
          {alerts.length} alerte(s) active(s)
        </p>
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 12px',
        borderBottom: '1px solid var(--ds-card-border)',
        overflowX: 'auto', flexShrink: 0,
      }}>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            style={{
              background: category === c.value ? '#0d3d6e' : 'transparent',
              color: category === c.value ? '#fff' : 'var(--text-secondary)',
              border: category === c.value ? 'none' : '1px solid transparent',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
              transition: 'all 0.13s',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {sorted.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '40px 0', textAlign: 'center',
          }}>
            <BellOff size={32} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              Aucune alerte active
            </p>
          </div>
        ) : (
          sorted.map(a => <AlertCard key={a.id} alert={a} onNavigate={onNavigate} />)
        )}
      </div>
    </div>
  );
}
