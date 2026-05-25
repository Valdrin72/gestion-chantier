import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, HardHat, Users, FileText, DollarSign, X, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

const COULEUR = {
  chantier: '#10b981',
  client:   '#3b82f6',
  devis:    '#f59e0b',
  facture:  '#8b5cf6',
};

const ICONE = {
  chantier: HardHat,
  client:   Users,
  devis:    FileText,
  facture:  DollarSign,
};

function match(text, q) {
  if (!text || !q) return false;
  return String(text).toLowerCase().includes(q.toLowerCase());
}

function ResultItem({ type, label, sublabel, badge, onSelect }) {
  const Icon = ICONE[type];
  const couleur = COULEUR[type];
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        background: hovered ? 'var(--bg-glass-2)' : 'transparent',
        border: 'none', borderRadius: 8, padding: '8px 10px',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        transition: 'background 0.12s',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: couleur + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={13} style={{ color: couleur }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            {sublabel}
          </div>
        )}
      </div>
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
          background: couleur + '18', color: couleur, flexShrink: 0,
        }}>{badge}</span>
      )}
      <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.1s' }} />
    </button>
  );
}

function GroupLabel({ label, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 10px 4px', marginTop: 4,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{count}</span>
    </div>
  );
}

export default function GlobalSearch({ naviguer }) {
  const { chantiers, clients, devis, factures } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const overlayRef = useRef(null);

  // Ctrl+K / Cmd+K ouvre la recherche
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const resultats = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.trim();

    const ch = (chantiers || []).filter(c =>
      match(c.nom, q) || match(c.numero, q) || match(c.statut, q) || match(c.localite, q)
    ).slice(0, 5);

    const cl = (clients || []).filter(c =>
      match(c.nom, q) || match(c.entreprise, q) || match(c.email, q) || match(c.telephone, q)
    ).slice(0, 4);

    const dv = (devis || []).filter(d =>
      match(d.numero, q) || match(d.objet, q) || match(d.statut, q)
    ).slice(0, 4);

    const fa = (factures || []).filter(f =>
      match(f.numero, q) || match(f.objet, q) || match(f.statut, q)
    ).slice(0, 4);

    const total = ch.length + cl.length + dv.length + fa.length;
    return { ch, cl, dv, fa, total };
  }, [query, chantiers, clients, devis, factures]);

  const fermer = useCallback(() => setOpen(false), []);

  const aller = useCallback((page, contexte = {}) => {
    naviguer(page, contexte);
    fermer();
  }, [naviguer, fermer]);

  const clientNom = useCallback((clientId) => {
    const c = (clients || []).find(cl => String(cl.id) === String(clientId));
    return c?.entreprise || c?.nom || null;
  }, [clients]);

  const chantierNom = useCallback((chantierId) => {
    const c = (chantiers || []).find(ch => String(ch.id) === String(chantierId));
    return c?.nom || null;
  }, [chantiers]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Recherche globale (Ctrl+K)"
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'var(--bg-glass-2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '5px 10px',
          cursor: 'pointer', color: 'var(--text-muted)',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
          transition: 'all 0.15s', height: 34,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <Search size={13} />
        <span style={{ display: 'none' }}>Rechercher</span>
        <span style={{ fontSize: 10, opacity: 0.6, display: 'flex', alignItems: 'center', gap: 2 }}>
          <kbd style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 4px', fontSize: 9, fontFamily: 'inherit' }}>Ctrl</kbd>
          <kbd style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 4px', fontSize: 9, fontFamily: 'inherit' }}>K</kbd>
        </span>
      </button>
    );
  }

  return (
    <>
      {/* Overlay fond */}
      <div
        ref={overlayRef}
        onClick={fermer}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 9998, backdropFilter: 'blur(3px)',
        }}
      />

      {/* Modale */}
      <div style={{
        position: 'fixed', top: '12%', left: '50%', transform: 'translateX(-50%)',
        width: 'min(560px, 92vw)', zIndex: 9999,
        background: 'var(--ds-card-bg)', border: '1px solid var(--border)',
        borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>
        {/* Barre de recherche */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', borderBottom: '1px solid var(--border)',
        }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un chantier, client, devis, facture…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X size={14} />
            </button>
          )}
          <kbd
            onClick={fermer}
            style={{
              background: 'var(--bg-glass-2)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '2px 6px', fontSize: 10, color: 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Esc</kbd>
        </div>

        {/* Résultats */}
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: '6px 8px 10px' }}>
          {!query.trim() && (
            <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Tapez pour rechercher…
            </div>
          )}

          {query.trim() && resultats?.total === 0 && (
            <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucun résultat pour "<strong>{query}</strong>"
            </div>
          )}

          {resultats && resultats.ch.length > 0 && (
            <>
              <GroupLabel label="Chantiers" count={resultats.ch.length} />
              {resultats.ch.map(c => (
                <ResultItem
                  key={c.id} type="chantier"
                  label={c.nom}
                  sublabel={[c.numero, clientNom(c.clientId), c.statut].filter(Boolean).join(' · ')}
                  badge={c.statut}
                  onSelect={() => aller('chantiers', { chantierId: c.id })}
                />
              ))}
            </>
          )}

          {resultats && resultats.cl.length > 0 && (
            <>
              <GroupLabel label="Clients" count={resultats.cl.length} />
              {resultats.cl.map(c => (
                <ResultItem
                  key={c.id} type="client"
                  label={c.entreprise || c.nom}
                  sublabel={[c.email, c.telephone].filter(Boolean).join(' · ')}
                  onSelect={() => aller('clients', { clientId: c.id })}
                />
              ))}
            </>
          )}

          {resultats && resultats.dv.length > 0 && (
            <>
              <GroupLabel label="Devis" count={resultats.dv.length} />
              {resultats.dv.map(d => (
                <ResultItem
                  key={d.id} type="devis"
                  label={d.numero || `Devis #${d.id}`}
                  sublabel={[d.objet, clientNom(d.clientId)].filter(Boolean).join(' · ')}
                  badge={d.statut}
                  onSelect={() => aller('devis', { devisId: d.id })}
                />
              ))}
            </>
          )}

          {resultats && resultats.fa.length > 0 && (
            <>
              <GroupLabel label="Factures" count={resultats.fa.length} />
              {resultats.fa.map(f => (
                <ResultItem
                  key={f.id} type="facture"
                  label={f.numero || `Facture #${f.id}`}
                  sublabel={[f.objet, chantierNom(f.chantierId)].filter(Boolean).join(' · ')}
                  badge={f.statut}
                  onSelect={() => aller('finances', { factureId: f.id })}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
