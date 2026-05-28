import React from 'react';
import { calculerMajorationDate } from '../../calculs/majorations';

/**
 * Badge de majoration LIVE — recalculé à chaque changement de date/canton.
 * Reflète le calcul par canton (Phase 5b-calc) : sur un jour férié GE uniquement,
 * affiche le badge uniquement sur les lignes dont le canton est GE.
 *
 * @param {{ date: string, canton?: string }} props
 */
export default function BadgeMajoration({ date, canton = 'GE' }) {
  if (!date) return null;
  const maj = calculerMajorationDate(date, canton);
  if (!maj) return null;

  const isFerie  = maj.type === 'ferie';
  const isDim    = maj.type === 'dimanche';
  const isSam    = maj.type === 'samedi';

  const bg    = (isFerie || isDim) ? '#fef2f2' : '#fffbeb';
  const color = (isFerie || isDim) ? '#dc2626' : '#b45309';
  const label = isFerie  ? `FÉRIÉ ×${maj.facteur}`
               : isDim   ? `DIM ×${maj.facteur}`
               : isSam   ? `SAM ×${maj.facteur}`
               : `×${maj.facteur}`;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      background: bg,
      color,
      border: `1px solid ${color}33`,
      borderRadius: '6px',
      padding: '2px 7px',
      fontSize: '11px',
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
