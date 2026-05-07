import React from 'react';
import { fmtN } from '../donnees';

const Badge = React.memo(function Badge({ texte, couleur }) {
  return (
    <span style={{
      background: couleur + '15',
      color: couleur,
      border: `1px solid ${couleur}30`,
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
    }}>
      {texte}
    </span>
  );
});

const CoutBadge = React.memo(function CoutBadge({ label, valeur, couleur }) {
  return (
    <div style={{
      background: couleur + '10',
      border: `1px solid ${couleur}25`,
      borderRadius: '12px',
      padding: '12px 16px',
      minWidth: '130px',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '16px', color: couleur }}>CHF {fmtN(valeur)}</div>
    </div>
  );
});

const BarreAvancement = React.memo(function BarreAvancement({ valeur, couleur }) {
  const progress = Math.max(0, Math.min(100, Number(valeur ?? 0)));
  const c = couleur || 'linear-gradient(90deg, #3b82f6, #10b981)';
  return (
    <div style={{ background: 'var(--bg-hover)', borderRadius: '10px', height: '6px', width: '100%', overflow: 'hidden' }}>
      <div style={{ background: c, width: `${progress}%`, height: '6px', borderRadius: '10px', transition: 'width 0.4s ease' }} />
    </div>
  );
});

// Badge rentabilité — lecture seule, aucun calcul existant modifié
// ca = etat.devisTotal, couts = etat.coutTotalReel
const BadgeRentabilite = React.memo(function BadgeRentabilite({ ca, couts }) {
  if (!ca || !couts || isNaN(ca) || isNaN(couts) || ca <= 0) return null;
  const marge = ca - couts;
  const taux = marge / ca;
  const cfg = taux >= 0.2
    ? { label: 'Rentable',   couleur: '#22c55e' }
    : taux >= 0.1
      ? { label: 'Attention', couleur: '#f59e0b' }
      : { label: 'Danger',    couleur: '#ef4444' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.couleur + '18',
      color: cfg.couleur,
      border: `1px solid ${cfg.couleur}40`,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
});

export { Badge, CoutBadge, BarreAvancement, BadgeRentabilite };
