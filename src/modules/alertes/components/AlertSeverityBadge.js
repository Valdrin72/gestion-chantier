import React from 'react';
import { mono } from '../../../design/v1.js';

// Badges de gravité — design v1 (mono, couleurs socle, aucun violet).
const SEVERITY_STYLES = {
  INFO:     { background: '#EEF1F5', color: '#5B6B80' },
  LOW:      { background: '#E6EDF5', color: '#1E5FAF' },
  MEDIUM:   { background: '#FAEEDA', color: '#854F0B' },
  HIGH:     { background: '#FBE4D3', color: '#C2410C' },
  CRITICAL: { background: '#FCEBEB', color: '#A32D2D' },
};

const SEVERITY_LABELS = {
  INFO: 'Info', LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé', CRITICAL: 'Critique',
};

export function AlertSeverityBadge({ severity }) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.INFO;
  return (
    <span style={{
      ...mono(10, style.color, 700),
      background: style.background,
      border: `1px solid ${style.color}30`,
      borderRadius: 20,
      padding: '2px 9px',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      display: 'inline-flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      lineHeight: 1.6,
    }}>
      {SEVERITY_LABELS[severity] ?? severity}
    </span>
  );
}
