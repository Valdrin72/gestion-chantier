import React from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * Ligne grisée représentant une entité ARCHIVÉE, avec bouton Restaurer.
 * Réutilisable pour chantiers, clients, devis…
 *
 * @param {string} label          titre principal (ex: nom du chantier)
 * @param {string} [sublabel]     sous-texte (ex: "CH-2026-001 · Terminé")
 * @param {string} [dateArchivage]  ISO string — affichée formatée
 * @param {() => void} onRestaurer clic Restaurer
 * @param {() => void} [onClick]   clic sur la ligne (optionnel — voir détail)
 */
export default function ArchivedRow({ label, sublabel, dateArchivage, onRestaurer, onClick }) {
  const dateFmt = dateArchivage
    ? new Date(dateArchivage).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)',
        opacity: 0.45, cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sublabel}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {dateFmt && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Archivé le {dateFmt}
          </span>
        )}
        <button
          type="button"
          onClick={onRestaurer}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'transparent', border: '1px solid var(--border-hover)',
            borderRadius: 8, padding: '5px 11px', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit',
          }}
          title="Restaurer — remettre dans la liste active"
        >
          <RotateCcw size={13} /> Restaurer
        </button>
      </div>
    </div>
  );
}
