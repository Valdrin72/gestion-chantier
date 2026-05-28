import React from 'react';
import { DS } from '../../ds';
import BadgeMajoration from './BadgeMajoration';

const CATEGORIES_AVEC_CHANTIER = ['production', 'atelier'];

/**
 * Une ligne de répartition : chantier + catégorie + heures + badge majoration.
 *
 * @param {{
 *   repartition: { chantierId: string, categorie: string, heures: string },
 *   chantiers: object[],
 *   date: string,
 *   onChange: (partial: object) => void,
 *   onDelete: () => void,
 *   canDelete: boolean,
 * }} props
 */
export default function LigneRepartition({ repartition, chantiers, date, onChange, onDelete, canDelete }) {
  const chantierSelectionne = chantiers.find(c => String(c.id) === String(repartition.chantierId));
  const canton = chantierSelectionne?.canton ?? 'GE';

  const selectStyle = {
    ...DS.input,
    padding: '7px 10px',
    fontSize: '13px',
    flex: 1,
    minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      {/* Chantier */}
      <select
        value={repartition.chantierId}
        onChange={e => onChange({ chantierId: e.target.value })}
        style={{ ...selectStyle, flex: 2 }}
        aria-label="Chantier"
      >
        <option value="">— Chantier —</option>
        {chantiers
          .filter(c => ['en cours', 'planifié'].includes(c.statut?.toLowerCase?.() ?? ''))
          .map(c => (
            <option key={c.id} value={String(c.id)}>{c.nom}</option>
          ))
        }
      </select>

      {/* Catégorie (production | atelier uniquement — avec chantier) */}
      <select
        value={repartition.categorie}
        onChange={e => onChange({ categorie: e.target.value })}
        style={{ ...selectStyle, flex: 1 }}
        aria-label="Catégorie"
      >
        {CATEGORIES_AVEC_CHANTIER.map(cat => (
          <option key={cat} value={cat}>
            {cat === 'production' ? 'Production' : 'Atelier'}
          </option>
        ))}
      </select>

      {/* Heures */}
      <input
        type="number"
        min="0.5"
        max="16"
        step="0.5"
        value={repartition.heures}
        onChange={e => onChange({ heures: e.target.value })}
        placeholder="h"
        style={{ ...DS.input, width: '72px', padding: '7px 8px', fontSize: '13px', textAlign: 'center' }}
        aria-label="Heures"
      />

      {/* Badge majoration par canton de ce chantier */}
      <BadgeMajoration date={date} canton={canton} />

      {/* Supprimer la ligne */}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          style={{
            ...DS.btnDanger,
            padding: '6px 10px',
            fontSize: '13px',
            flexShrink: 0,
          }}
          aria-label="Supprimer la ligne"
        >
          ×
        </button>
      )}
    </div>
  );
}
