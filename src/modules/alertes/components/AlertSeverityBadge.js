import React from 'react';

const SEVERITY_STYLES = {
  INFO:     { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' },
  LOW:      { background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' },
  MEDIUM:   { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' },
  HIGH:     { background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa' },
  CRITICAL: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' },
};

const SEVERITY_LABELS = {
  INFO: 'Info', LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé', CRITICAL: 'Critique',
};

export function AlertSeverityBadge({ severity }) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.INFO;
  return (
    <span style={{
      ...style,
      borderRadius: 20,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      lineHeight: 1.6,
    }}>
      {SEVERITY_LABELS[severity] ?? severity}
    </span>
  );
}
