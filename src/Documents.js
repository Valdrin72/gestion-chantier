import React, { useState } from 'react';
import { Folder, FileText, Upload, Search, Filter, Download, Eye, MoreHorizontal } from 'lucide-react';
import { DS } from './ds';
import { fmtN } from './donnees';

const DOSSIERS = [
  { label: 'Devis 2026',       icon: FileText,  color: '#3b82f6', bgColor: '#dbeafe', key: 'devis' },
  { label: 'Factures 2026',    icon: FileText,  color: '#10b981', bgColor: '#d1fae5', key: 'factures' },
  { label: 'Plans & métrés',   icon: Folder,    color: '#f59e0b', bgColor: '#fef3c7', key: 'plans' },
  { label: 'Contrats',         icon: FileText,  color: '#8b5cf6', bgColor: '#ede9fe', key: 'contrats' },
  { label: 'Photos chantiers', icon: Folder,    color: '#ec4899', bgColor: '#fce7f3', key: 'photos' },
  { label: 'Administratif',    icon: Folder,    color: '#14b8a6', bgColor: '#ccfbf1', key: 'admin' },
];

const TYPE_BADGE = {
  PDF: { bg: '#fee2e2', color: '#991b1b' },
  DOC: { bg: '#dbeafe', color: '#1e40af' },
  XLS: { bg: '#d1fae5', color: '#065f46' },
  ZIP: { bg: '#fef3c7', color: '#92400e' },
  IMG: { bg: '#fce7f3', color: '#9d174d' },
};

export default function Documents({ chantiers = [], devis = [], factures = [], clients = [] }) {
  const [search, setSearch] = useState('');

  // Build document list from real data
  const documents = [
    ...devis.slice(-8).map(d => ({
      id: `devis-${d.id}`,
      nom: `Devis-${d.numero || d.id}.pdf`,
      type: 'PDF',
      chantier: d.chantierId ? (chantiers.find(c => c.id === d.chantierId)?.nom || '—') : '—',
      taille: '245 KB',
      modifie: d.date || d.dateEmission || '',
      dossier: 'Devis 2026',
    })),
    ...factures.slice(-8).map(f => ({
      id: `facture-${f.id}`,
      nom: `Facture-${f.numero || f.id}.pdf`,
      type: 'PDF',
      chantier: f.chantierId ? (chantiers.find(c => c.id === f.chantierId)?.nom || '—') : '—',
      taille: '189 KB',
      modifie: f.dateEmission || '',
      dossier: 'Factures 2026',
    })),
  ];

  const filtered = documents.filter(d =>
    !search || d.nom.toLowerCase().includes(search.toLowerCase()) || d.chantier.toLowerCase().includes(search.toLowerCase())
  );

  const totalFichiers = documents.length;

  const dossierCounts = {};
  DOSSIERS.forEach(d => dossierCounts[d.label] = documents.filter(doc => doc.dossier === d.label).length);

  const formatDate = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-CH'); } catch { return iso; }
  };

  const inputStyle = {
    background: 'var(--ds-input-bg)', border: '1px solid var(--ds-input-border)',
    borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none', width: 200,
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Documents</div>
          <div className="page-title-sub">{totalFichiers} fichiers générés · {devis.length} devis · {factures.length} factures</div>
        </div>
        <div className="page-actions-group">
          <button style={{ ...DS.btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
            Tout exporter
          </button>
          <button style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} strokeWidth={2.5} /> Importer
          </button>
        </div>
      </div>

      {/* Folder cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 24 }}>
        {DOSSIERS.map(d => {
          const count = dossierCounts[d.label] || 0;
          return (
            <div key={d.label} style={{ ...DS.card, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--ds-card-shadow)'; }}
            >
              <div style={{ width: 48, height: 48, background: d.bgColor, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <d.icon size={22} strokeWidth={1.8} style={{ color: d.color }} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{count} fichier{count !== 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </div>

      {/* Documents table */}
      <div style={DS.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Documents récents</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                style={{ ...inputStyle, paddingLeft: 32 }}
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <Folder size={40} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun document trouvé</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Les devis et factures exportés apparaîtront ici</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['NOM', 'DOSSIER', 'CHANTIER', 'TAILLE', 'MODIFIÉ', 'ACTIONS'].map(h => (
                    <th key={h} style={{ ...DS.th, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => {
                  const typStyle = TYPE_BADGE[doc.type] || TYPE_BADGE.PDF;
                  return (
                    <tr key={doc.id}>
                      <td style={DS.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ background: typStyle.bg, color: typStyle.color, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, flexShrink: 0, minWidth: 30, textAlign: 'center' }}>{doc.type}</span>
                          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{doc.nom}</span>
                        </div>
                      </td>
                      <td style={{ ...DS.td, fontSize: 12, color: 'var(--text-muted)' }}>{doc.dossier}</td>
                      <td style={{ ...DS.td, fontSize: 13, color: 'var(--text-primary)' }}>{doc.chantier}</td>
                      <td style={{ ...DS.td, fontSize: 12, color: 'var(--text-muted)' }}>{doc.taille}</td>
                      <td style={{ ...DS.td, fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(doc.modifie)}</td>
                      <td style={DS.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button title="Voir" style={{ ...DS.iconBtn }}><Eye size={13} /></button>
                          <button title="Télécharger" style={{ ...DS.iconBtn }}><Download size={13} /></button>
                          <button title="Plus" style={{ ...DS.iconBtn }}><MoreHorizontal size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
