import React from 'react';
import { Archive, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Toggle réutilisable "Voir les archivés" / "Masquer les archivés".
 * State local au parent (NON persisté) — passé via props.
 *
 * @param {boolean} voirArchives  état courant
 * @param {() => void} onToggle   bascule l'état
 * @param {number} count          nombre d'éléments archivés
 * @param {string} [labelSingulier='archivé']  ex: 'archivé', 'archivée'
 */
export default function ArchiveToggle({ voirArchives, onToggle, count, labelSingulier = 'archivé' }) {
  if (!count || count <= 0) return null;
  const motArchive = count > 1 ? `${labelSingulier}s` : labelSingulier;
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: '1px solid var(--border)',
        borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
        fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
        fontFamily: 'inherit', transition: 'all 0.15s',
      }}
      title={voirArchives ? 'Masquer les archivés' : 'Voir les archivés'}
    >
      <Archive size={14} />
      {voirArchives ? 'Masquer' : 'Voir'} {count} {motArchive}
      {voirArchives ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
  );
}
