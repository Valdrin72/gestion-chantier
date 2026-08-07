import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { fmtN, calculerCA } from '../../donnees';
import { useApp } from '../../context/AppContext';
import { V1, mono, carteV1, barreProgression, pastille } from '../../design/v1';

// Couleurs d'état C8 — cohérentes avec le socle v1 et la vue Liste.
// (Planifié gris · En cours bleu · Suspendu ambre · Attente paiement ambre foncé ·
//  Terminé vert · Facturé bleu clair · Clôturé gris foncé.)
const STATUT_COULEUR = {
  'Planifié':          V1.texteMuted,
  'En cours':          V1.bleu,
  'Suspendu':          V1.warn,
  'Attente paiement':  '#B45309',
  'Terminé':           V1.ok,
  'Facturé':           V1.bleuMoyen,
  'Clôturé':           '#475569',
};
// Ordre des colonnes (identique à l'ancien — répartition inchangée).
const COLONNES = ['Planifié', 'En cours', 'Suspendu', 'Attente paiement', 'Terminé', 'Facturé', 'Clôturé'];

function couleurEtat(statut) {
  return STATUT_COULEUR[(statut || '').trim()] || V1.texteMuted;
}

function KanbanCard({ c, etatC, decision, onSelect }) {
  const { clients, devis } = useApp();
  const client = clients.find(cl => String(cl.id) === String(c.clientId));
  const ca = calculerCA(c, devis);
  const avancePct = Math.min(100, Math.max(0, etatC.avancementPct || 0));
  const accent = couleurEtat(c.statut);
  const barre = barreProgression(avancePct, decision.couleur);
  const clientNom = client?.entreprise || client?.nom || '—';
  const lieu = c.ville || c.localite || '';

  // Verdict perte / bénéfice — même source que la vue Liste (marge projetée).
  const pct = etatC.margeProjeteePct;
  const verdict = pct == null ? null
    : pct < 0    ? { txt: 'PERTE',    couleur: V1.danger }
    : pct >= 15  ? { txt: 'BÉNÉFICE', couleur: V1.ok }
    :              { txt: `${pct}%`,  couleur: V1.warn };

  return (
    <div
      onClick={() => onSelect(c)}
      role="button" tabIndex={0}
      style={{
        ...carteV1, padding: '11px 13px', borderRadius: 10,
        borderTop: `2px solid ${accent}`,
        cursor: 'pointer', userSelect: 'none',
        transition: 'box-shadow 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,38,73,0.12)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = carteV1.boxShadow;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Nom (Inter, 1 ligne tronquée) */}
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: V1.texte, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
        {c.nom}
      </div>
      {/* Ligne mono : CLIENT · LIEU */}
      <div style={{ ...mono(10, V1.texteMuted), marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {clientNom.toUpperCase()}{lieu ? ` · ${String(lieu).toUpperCase()}` : ''}
      </div>

      {/* Avancement + barre 4px colorée par l'état (santé) */}
      <div style={{ marginTop: 9 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: V1.texteMuted }}>Avancement</span>
          <span style={mono(11, decision.couleur, 600)}>{avancePct}%</span>
        </div>
        <div style={{ ...barre.piste, height: 4 }}><div style={barre.remplissage} /></div>
      </div>

      {/* Pied : filet fin + montant mono + badge verdict */}
      <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${V1.separation}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={mono(11, ca !== null ? V1.texte : V1.texteMuted, 500)}>
          {ca !== null ? `CHF ${fmtN(Math.round(ca))}` : '—'}
        </span>
        {verdict && (
          <span style={{
            ...mono(9, verdict.couleur, 700),
            background: verdict.couleur + '18', border: `1px solid ${verdict.couleur}30`,
            borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap', letterSpacing: '0.04em',
          }}>{verdict.txt}</span>
        )}
      </div>
    </div>
  );
}

function ColonneKanban({ statut, items, onSelect }) {
  const couleur = couleurEtat(statut);
  const nb = items.length;
  return (
    <div style={{ flexShrink: 0, width: 224, display: 'flex', flexDirection: 'column' }}>
      {/* En-tête colonne : pastille d'état + nom + compteur mono */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        background: V1.carte, border: `1px solid ${V1.separation}`, borderTop: `2px solid ${couleur}`,
        borderRadius: '10px 10px 0 0',
      }}>
        <span style={pastille(couleur)} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, color: V1.texte, flex: 1 }}>{statut}</span>
        <span style={{ ...mono(11, V1.texteMuted, 600), background: V1.bleuFond, borderRadius: 20, padding: '1px 8px', minWidth: 20, textAlign: 'center' }}>{nb}</span>
      </div>

      {/* Corps colonne */}
      <div style={{
        background: V1.page, border: `1px solid ${V1.separation}`, borderTop: 'none',
        borderRadius: '0 0 10px 10px', padding: 8,
        display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120, flex: 1,
      }}>
        {nb === 0 ? (
          <div style={{ fontSize: 18, color: V1.texteMuted, textAlign: 'center', padding: '18px 8px', opacity: 0.5 }}>—</div>
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
    return COLONNES.map(statut => ({
      statut,
      items: statutsMap[statut] || [],
    }));
  }, [scored]);

  const total = scored.length;
  const nbVisibles = colonnesData.reduce((s, col) => s + col.items.length, 0);
  const nbAutres = total - nbVisibles;

  return (
    <div>
      {nbAutres > 0 && (
        <div style={{ marginBottom: 12, ...mono(11, V1.texteMuted), display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevronRight size={12} />
          {nbAutres} chantier{nbAutres > 1 ? 's' : ''} avec statut non standard non affichés en Kanban.
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
        {colonnesData.map(({ statut, items }) => (
          <ColonneKanban key={statut} statut={statut} items={items} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
