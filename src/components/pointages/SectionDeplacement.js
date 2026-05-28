import React from 'react';
import { DS } from '../../ds';

/**
 * Section optionnelle de déplacement (hors heures travaillées — F1).
 * Utilise le champ Pointage.deplacement {duree_h, indemnite_chf} uniquement.
 * La catégorie 'deplacement' dans repartitions n'est PAS utilisée ici (Phase 5b-calc §Q3).
 *
 * @param {{
 *   deplacement: { active: boolean, duree_h: string, indemnite_chf: string },
 *   onChange: (partial: object) => void,
 * }} props
 */
export default function SectionDeplacement({ deplacement, onChange }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: deplacement.active ? '10px' : 0 }}>
        <input
          type="checkbox"
          checked={deplacement.active}
          onChange={e => onChange({ active: e.target.checked })}
          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Trajet ce jour{' '}
          <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--text-muted)' }}>
            (hors heures travaillées)
          </span>
        </span>
      </label>

      {deplacement.active && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '24px', flexWrap: 'wrap' }}>
          {/* Durée trajet */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Durée A/R</span>
            <input
              type="number"
              min="0.25"
              max="8"
              step="0.25"
              value={deplacement.duree_h}
              onChange={e => onChange({ duree_h: e.target.value })}
              placeholder="0.75"
              style={{ ...DS.input, width: '72px', padding: '7px 8px', fontSize: '13px', textAlign: 'center' }}
              aria-label="Durée du trajet"
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>h</span>
          </label>

          {/* Indemnité CHF */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Indemnité</span>
            <input
              type="number"
              min="0"
              step="0.50"
              value={deplacement.indemnite_chf}
              onChange={e => onChange({ indemnite_chf: e.target.value })}
              placeholder="0"
              style={{ ...DS.input, width: '80px', padding: '7px 8px', fontSize: '13px', textAlign: 'center' }}
              aria-label="Indemnité de déplacement"
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>CHF</span>
          </label>
        </div>
      )}
    </div>
  );
}
