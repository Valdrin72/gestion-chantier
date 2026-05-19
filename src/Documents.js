import React, { useState, useMemo } from 'react';
import { FileText, Search } from 'lucide-react';
import { DS } from './ds';

const ONGLETS = ['devis', 'factures'];

export default function Documents({ chantiers = [], devis = [], factures = [], clients = [], naviguer }) {
  const [onglet, setOnglet] = useState('devis');
  const [search, setSearch] = useState('');

  const client = (id) => clients.find(c => String(c.id) === String(id));
  const chantier = (id) => chantiers.find(c => String(c.id) === String(id));

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    if (onglet === 'devis') {
      return devis
        .map(d => ({
          id: d.id,
          nom: d.numero || `Devis #${d.id}`,
          client: client(d.clientId)?.nom || '—',
          chantier: chantier(d.chantierId)?.nom || '—',
          date: d.date || d.dateEmission || '',
          montant: d.montantTTC ?? d.total ?? null,
          statut: d.statut || 'Brouillon',
          page: 'devis',
        }))
        .filter(r => !q || r.nom.toLowerCase().includes(q) || r.client.toLowerCase().includes(q) || r.chantier.toLowerCase().includes(q))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } else {
      return factures
        .map(f => ({
          id: f.id,
          nom: f.numero || `Facture #${f.id}`,
          client: client(f.clientId)?.nom || '—',
          chantier: chantier(f.chantierId)?.nom || '—',
          date: f.dateEmission || '',
          montant: f.montantTTC ?? f.total ?? null,
          statut: f.statut || 'Brouillon',
          page: 'finances',
        }))
        .filter(r => !q || r.nom.toLowerCase().includes(q) || r.client.toLowerCase().includes(q) || r.chantier.toLowerCase().includes(q))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
  }, [onglet, devis, factures, clients, chantiers, search]);

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-CH'); } catch { return iso; }
  };

  const fmtMontant = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    return `CHF ${parseFloat(v).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const tabStyle = (active) => ({
    padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
    background: active ? '#EEF2FF' : 'transparent',
    color: active ? '#4F46E5' : 'var(--text-muted)',
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Documents</div>
          <div className="page-title-sub">{devis.length} devis · {factures.length} factures</div>
        </div>
      </div>

      <div style={DS.card}>
        {/* Onglets + recherche */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-glass)', borderRadius: 10, padding: 4 }}>
            {ONGLETS.map(o => (
              <button key={o} onClick={() => { setOnglet(o); setSearch(''); }} style={tabStyle(onglet === o)}>
                {o === 'devis' ? `Devis (${devis.length})` : `Factures (${factures.length})`}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              style={{ ...DS.input, paddingLeft: 32, width: 200 }}
            />
          </div>
        </div>

        {/* Tableau */}
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <FileText size={40} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun document trouvé</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['RÉFÉRENCE', 'CLIENT', 'CHANTIER', 'DATE', 'MONTANT TTC', 'STATUT', ''].map(h => (
                    <th key={h} style={{ ...DS.th, textAlign: h === 'MONTANT TTC' ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(doc => {
                  const bs = DS.statuts[doc.statut] || { bg: '#F1F5F9', color: '#475569' };
                  return (
                    <tr key={doc.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => naviguer && naviguer(doc.page)}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={DS.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: onglet === 'devis' ? '#e8f0f9' : '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={14} strokeWidth={2} style={{ color: onglet === 'devis' ? '#0d3d6e' : '#065f46' }} />
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{doc.nom}</span>
                        </div>
                      </td>
                      <td style={{ ...DS.td, color: 'var(--text-secondary)' }}>{doc.client}</td>
                      <td style={{ ...DS.td, color: 'var(--text-secondary)' }}>{doc.chantier}</td>
                      <td style={{ ...DS.td, color: 'var(--text-muted)', fontSize: 12 }}>{fmtDate(doc.date)}</td>
                      <td style={{ ...DS.td, textAlign: 'right', fontWeight: 700 }}>{fmtMontant(doc.montant)}</td>
                      <td style={DS.td}>
                        <span style={{ background: bs.bg, color: bs.color, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                          {doc.statut}
                        </span>
                      </td>
                      <td style={DS.td}>
                        <button
                          onClick={e => { e.stopPropagation(); naviguer && naviguer(doc.page); }}
                          style={{ ...DS.btnGhost, padding: '5px 12px', fontSize: 12 }}>
                          Ouvrir →
                        </button>
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
