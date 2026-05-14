import React from 'react';
import { C } from '../../../donnees';
import { DS } from '../../../ds';

function DetailProjection({ etat, fmtK }) {
  const carteStyle = DS.card;
  const urgence = etat.margeEstimeePct === null ? 'ok'
    : etat.margeEstimeePct < 0 ? 'critique'
    : etat.margeEstimeePct <= 10 ? 'surveillance'
    : 'ok';
  const urgenceConfig = {
    critique:     { couleur: C.danger,     decision: 'Perte estimée — action immédiate' },
    surveillance: { couleur: C.warning,    decision: 'Surveiller de près' },
    ok:           { couleur: C.secondaire, decision: 'Chantier maîtrisé' },
  }[urgence];
  const fiab = etat.avancementPct < 40
    ? { label: 'Projection à confirmer', couleur: C.warning }
    : { label: 'Projection fiable', couleur: C.secondaire };
  if (!etat.projectionDisponible) return (
    <div style={{ ...carteStyle, borderLeft: `4px solid var(--text-muted)`, opacity: 0.6 }}>
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
        Projection disponible dès 20% d'avancement — saisir les heures dans le journal
      </div>
    </div>
  );
  const margeVal = etat.margeEstimee ?? 0;
  const margePct = etat.margeEstimeePct ?? 0;
  return (
    <div style={{ ...carteStyle, borderLeft: `4px solid ${urgenceConfig.couleur}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Projection à terminaison</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-glass-2)', borderRadius: 20, padding: '3px 10px' }}>{etat.avancementPct}% réalisé</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: fiab.couleur, background: fiab.couleur + '18', border: `1px solid ${fiab.couleur}40`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{fiab.label}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: urgenceConfig.couleur, letterSpacing: '-0.3px', marginBottom: 16 }}>{urgenceConfig.decision}</div>
        <div style={{ fontSize: 46, fontWeight: 900, color: urgenceConfig.couleur, letterSpacing: '-2px', lineHeight: 1 }}>{margeVal >= 0 ? '+' : '−'}CHF {fmtK(Math.abs(margeVal))}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{margeVal >= 0 ? 'marge estimée' : 'perte estimée'}</div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Coût final estimé&nbsp;<span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14 }}>CHF {fmtK(etat.coutFinalEstime)}</span></div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.8 }}>Marge estimée&nbsp;<span style={{ color: margePct >= 15 ? C.secondaire : margePct >= 5 ? C.warning : C.danger, fontWeight: 600 }}>{margePct}%</span></div>
      </div>
    </div>
  );
}

export default DetailProjection;
