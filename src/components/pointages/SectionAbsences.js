import React from 'react';
import { DS } from '../../ds';

const TYPES_ABSENCE = [
  { value: 'absence_cp',       label: 'Congés payés (CP)' },
  { value: 'absence_maladie',  label: 'Maladie (IJM)' },
  { value: 'absence_at',       label: 'Accident de travail (AT)' },
  { value: 'intemperie',       label: 'Intempérie' },
  { value: 'formation',        label: 'Formation' },
];

/**
 * Section optionnelle d'absence.
 * Les heures sont éditables pour permettre demi-journée (ex: 4h CP + 4h production).
 *
 * @param {{
 *   absence: { active: boolean, categorie: string, heures: string },
 *   onChange: (partial: object) => void,
 * }} props
 */
export default function SectionAbsences({ absence, onChange }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: absence.active ? '10px' : 0 }}>
        <input
          type="checkbox"
          checked={absence.active}
          onChange={e => onChange({ active: e.target.checked })}
          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Absence ce jour
        </span>
      </label>

      {absence.active && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px' }}>
          {/* Type */}
          <select
            value={absence.categorie}
            onChange={e => onChange({ categorie: e.target.value })}
            style={{ ...DS.input, flex: 1, padding: '7px 10px', fontSize: '13px' }}
            aria-label="Type d'absence"
          >
            {TYPES_ABSENCE.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Heures éditables — permet 4h CP + 4h prod le même jour */}
          <input
            type="number"
            min="0.5"
            max="16"
            step="0.5"
            value={absence.heures}
            onChange={e => onChange({ heures: e.target.value })}
            style={{ ...DS.input, width: '72px', padding: '7px 8px', fontSize: '13px', textAlign: 'center' }}
            aria-label="Heures d'absence"
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>h</span>
        </div>
      )}
    </div>
  );
}
