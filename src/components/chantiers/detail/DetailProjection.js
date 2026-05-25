import React from 'react';
import { ArrowRight } from 'lucide-react';
import { C, fmtN } from '../../../donnees';
import { DS } from '../../../ds';

function calculerProchaineEtape(etat, couts, chantier, factures) {
  const avancement = etat.avancementPct;
  const ca = etat.devisTotal;

  const montantFactureHT = (factures || []).reduce((s, f) => s + (parseFloat(f.montantHT) || 0), 0);
  const aucuneFacture = (factures || []).length === 0;

  if (etat.projectionDisponible && etat.margeEstimee !== null && etat.margeEstimee < 0) {
    const deficit = Math.abs(etat.margeEstimee);
    const avenantSuggere = Math.round(deficit * 1.1);
    return {
      action: `Émettre un avenant de CHF ${fmtN(avenantSuggere)} au client`,
      raison: `EAC dépasse le CA — déficit estimé CHF ${fmtN(deficit)}`,
      couleur: C.danger,
      fond: C.danger + '12',
      bordure: C.danger + '35',
    };
  }

  if (etat.deriveJours > 7) {
    return {
      action: `Replanifier avec l'équipe (retard ${etat.deriveJours} j)`,
      raison: `${etat.totalJoursReels} j réalisés vs ${etat.totalJoursPrevus} j prévus`,
      couleur: C.warning,
      fond: C.warning + '12',
      bordure: C.warning + '35',
    };
  }

  if (avancement >= 25 && ca > 0) {
    const potentiel = Math.max(0, Math.round(ca * (avancement / 100) - montantFactureHT));
    if (aucuneFacture || potentiel > 500) {
      const montantLabel = potentiel > 0 ? `CHF ${fmtN(potentiel)}` : `acompte 30% = CHF ${fmtN(Math.round(ca * 0.3))}`;
      return {
        action: `Émettre une facture de situation (${montantLabel})`,
        raison: `Avancement ${avancement}% · déjà facturé CHF ${fmtN(montantFactureHT)}`,
        couleur: DS.colors.brand,
        fond: DS.colors.brand + '10',
        bordure: DS.colors.brand + '30',
      };
    }
  }

  return {
    action: 'Continuer selon le plan',
    raison: `Avancement ${avancement}% — aucune action corrective requise`,
    couleur: C.secondaire,
    fond: C.secondaire + '10',
    bordure: C.secondaire + '30',
  };
}

function PanneauProchaineEtape({ etat, couts, chantier, factures }) {
  const etape = calculerProchaineEtape(etat, couts, chantier, factures);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: etape.fond,
      border: `1px solid ${etape.bordure}`,
      borderRadius: 10,
      padding: '12px 16px',
      marginTop: 12,
    }}>
      <ArrowRight size={16} color={etape.couleur} strokeWidth={2.5} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: etape.couleur, opacity: 0.75 }}>
          Prochaine étape recommandée
        </span>
        <div style={{ fontSize: 13, fontWeight: 700, color: etape.couleur, marginTop: 1 }}>{typeof etape.action === 'string' ? etape.action : ''}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{etape.raison}</div>
      </div>
    </div>
  );
}

function DetailProjection({ etat, couts, chantier, factures, fmtK }) {
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
      <PanneauProchaineEtape etat={etat} couts={couts} chantier={chantier} factures={factures} />
    </div>
  );
}

export default DetailProjection;
