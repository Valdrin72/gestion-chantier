import React, { useMemo } from 'react';
import { AlertTriangle, TrendingUp, ChevronRight } from 'lucide-react';
import { fmtN, calculerCA } from '../../donnees';
import { useApp } from '../../context/AppContext';

const COLONNES = [
  { statut: 'Planifié',  couleur: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  { statut: 'En cours',  couleur: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  { statut: 'Suspendu',  couleur: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  { statut: 'Terminé',   couleur: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
  { statut: 'Facturé',   couleur: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  { statut: 'Clôturé',   couleur: '#475569', bg: 'rgba(71,85,105,0.08)' },
];

function KanbanCard({ c, etatC, decision, onSelect }) {
  const { clients, devis } = useApp();
  const client = clients.find(cl => String(cl.id) === String(c.clientId));
  const ca = calculerCA(c, devis);
  const avancePct = Math.min(100, Math.max(0, etatC.avancementPct || 0));
  const initiales = (c.nom || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <div
      onClick={() => onSelect(c)}
      style={{
        background: 'var(--ds-card-bg)',
        border: `1px solid var(--ds-card-border)`,
        borderLeft: `3px solid ${decision.couleur}`,
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.1s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Header: initiales + nom */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 9 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7, flexShrink: 0,
          background: decision.couleur + '22', border: `1px solid ${decision.couleur}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: decision.couleur,
        }}>{initiales}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
            {c.nom}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {client?.entreprise || client?.nom || '—'}
          </div>
        </div>
      </div>

      {/* Barre avancement */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Avancement</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: decision.couleur }}>{avancePct}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${avancePct}%`, background: decision.couleur, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Infos bas: CA + badge décision */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
        {ca !== null ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <TrendingUp size={9} />
            CHF {fmtN(Math.round(ca))}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>
        )}
        {decision.niveau !== 'ok' && (
          <span style={{
            fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3,
            background: decision.couleur + '18', color: decision.couleur,
            border: `1px solid ${decision.couleur}35`, borderRadius: 20, padding: '2px 7px', whiteSpace: 'nowrap',
          }}>
            {decision.niveau === 'critique' && <AlertTriangle size={8} />}
            {decision.label}
          </span>
        )}
      </div>

      {/* Référence */}
      {c.numero && (
        <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--ds-card-border)', fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.4px' }}>
          {c.numero}
        </div>
      )}
    </div>
  );
}

function ColonneKanban({ cfg, items, onSelect }) {
  const nb = items.length;
  return (
    <div style={{
      flexShrink: 0,
      width: 220,
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      {/* En-tête colonne */}
      <div style={{
        background: cfg.bg,
        border: `1px solid ${cfg.couleur}30`,
        borderRadius: '10px 10px 0 0',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: `2px solid ${cfg.couleur}`,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.couleur, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.couleur, flex: 1 }}>{cfg.statut}</span>
        <span style={{
          fontSize: 11, fontWeight: 800, color: '#fff',
          background: nb > 0 ? cfg.couleur : 'var(--text-muted)',
          borderRadius: 20, padding: '1px 7px', minWidth: 20, textAlign: 'center',
        }}>{nb}</span>
      </div>

      {/* Corps colonne */}
      <div style={{
        background: cfg.bg,
        border: `1px solid ${cfg.couleur}20`,
        borderTop: 'none',
        borderRadius: '0 0 10px 10px',
        padding: '8px',
        display: 'flex', flexDirection: 'column', gap: 8,
        minHeight: 120,
        flex: 1,
      }}>
        {nb === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 8px', fontStyle: 'italic' }}>
            Aucun chantier
          </div>
        ) : (
          items.map(({ c, etatC, decision }) => (
            <KanbanCard key={c.id} c={c} etatC={etatC} decision={decision} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  );
}

export default function KanbanChantiers({ scored, onSelect }) {
  const colonnesData = useMemo(() => {
    const statutsMap = {};
    for (const item of scored) {
      const s = (item.c.statut || 'Planifié');
      if (!statutsMap[s]) statutsMap[s] = [];
      statutsMap[s].push(item);
    }
    return COLONNES.map(cfg => ({
      cfg,
      items: statutsMap[cfg.statut] || [],
    }));
  }, [scored]);

  const total = scored.length;
  const nbVisibles = colonnesData.reduce((s, col) => s + col.items.length, 0);
  const nbAutres = total - nbVisibles;

  return (
    <div>
      {nbAutres > 0 && (
        <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevronRight size={12} />
          {nbAutres} chantier{nbAutres > 1 ? 's' : ''} avec statut non standard non affichés en Kanban.
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
        {colonnesData.map(({ cfg, items }) => (
          <ColonneKanban key={cfg.statut} cfg={cfg} items={items} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
