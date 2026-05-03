import React from 'react';

const STYLES = {
  'En cours':     { bg: '#dbeafe', color: '#1e40af' },
  'Terminé':      { bg: '#d1fae5', color: '#065f46' },
  'Planifié':     { bg: '#e0e7ff', color: '#3730a3' },
  'Suspendu':     { bg: '#fee2e2', color: '#991b1b' },
  'Facturé':      { bg: '#ede9fe', color: '#5b21b6' },
  'Clôturé':      { bg: '#f3f4f6', color: '#374151' },
  'À chiffrer':   { bg: '#f3f4f6', color: '#4b5563' },
  'Brouillon':    { bg: '#f3f4f6', color: '#4b5563' },
  'Envoyé':       { bg: '#dbeafe', color: '#1e40af' },
  'Accepté':      { bg: '#d1fae5', color: '#065f46' },
  'Refusé':       { bg: '#fee2e2', color: '#991b1b' },
  'Payée':        { bg: '#d1fae5', color: '#065f46' },
  'En attente':   { bg: '#fef3c7', color: '#92400e' },
  'En retard':    { bg: '#fee2e2', color: '#991b1b' },
  'Partielle':    { bg: '#fef3c7', color: '#92400e' },
  'Actif':        { bg: '#d1fae5', color: '#065f46' },
  'Congé':        { bg: '#fef3c7', color: '#92400e' },
  'Rentable':     { bg: '#d1fae5', color: '#065f46' },
  'Attention':    { bg: '#fef3c7', color: '#92400e' },
  'Danger':       { bg: '#fee2e2', color: '#991b1b' },
  'Mensuel':      { bg: '#d1fae5', color: '#065f46' },
  'Trimestriel':  { bg: '#e0e7ff', color: '#3730a3' },
  'Fiscal':       { bg: '#fef3c7', color: '#92400e' },
  'Annuel':       { bg: '#ede9fe', color: '#5b21b6' },
  'RENTABLE':     { bg: '#d1fae5', color: '#065f46' },
  'EN COURS':     { bg: '#dbeafe', color: '#1e40af' },
  'ATTENTION':    { bg: '#fed7aa', color: '#9a3412' },
  'DANGER':       { bg: '#fee2e2', color: '#991b1b' },
  'TERMINÉ':      { bg: '#d1fae5', color: '#065f46' },
  'PLANIFIÉ':     { bg: '#e0e7ff', color: '#3730a3' },
  'PAYÉE':        { bg: '#d1fae5', color: '#065f46' },
  'EN ATTENTE':   { bg: '#fef3c7', color: '#92400e' },
  'EN RETARD':    { bg: '#fee2e2', color: '#991b1b' },
  'BROUILLON':    { bg: '#f3f4f6', color: '#4b5563' },
  'ENVOYÉ':       { bg: '#dbeafe', color: '#1e40af' },
  'ACCEPTÉ':      { bg: '#d1fae5', color: '#065f46' },
  'REFUSÉ':       { bg: '#fee2e2', color: '#991b1b' },
};

export default function Badge({ label, variant, style: extraStyle }) {
  const s = STYLES[variant || label] || { bg: '#f3f4f6', color: '#4b5563' };
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      padding: '4px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      display: 'inline-block',
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
      ...extraStyle,
    }}>
      {label}
    </span>
  );
}
