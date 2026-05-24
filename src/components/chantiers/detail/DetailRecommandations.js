import React from 'react';
import { AlertTriangle, DollarSign, Clock, CheckCircle, TrendingUp, FileText } from 'lucide-react';
import { C, fmtN } from '../../../donnees';
import { DS } from '../../../ds';

const ICONES = {
  facturation: DollarSign,
  couts:       TrendingUp,
  planning:    Clock,
  avenant:     FileText,
  ok:          CheckCircle,
};

const URGENCE_CONFIG = {
  haute:   { couleur: C.danger,     fond: C.danger    + '10', bordure: C.danger    + '35' },
  moyenne: { couleur: C.warning,    fond: C.warning   + '10', bordure: C.warning   + '35' },
  basse:   { couleur: C.secondaire, fond: C.secondaire + '10', bordure: C.secondaire + '35' },
};

function genererRecommandations(etat, couts, chantier, factures, devis) {
  const recs = [];
  const ca = etat.devisTotal;

  const montantFactureHT = factures.reduce((s, f) => s + (parseFloat(f.montantHT) || 0), 0);
  const montantFactureTTC = factures.reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);
  const avancement = etat.avancementPct;
  const deriveJours = etat.deriveJours;

  const potentielFacturation = ca > 0
    ? Math.max(0, Math.round(ca * (avancement / 100) - montantFactureHT))
    : null;

  if (potentielFacturation !== null && potentielFacturation > 500) {
    const pctFacture = ca > 0 ? Math.round((montantFactureHT / ca) * 100) : 0;
    recs.push({
      type: 'facturation',
      titre: 'Émettre une facture de situation',
      detail: `Avancement ${avancement}% · déjà facturé CHF ${fmtN(montantFactureHT)} (${pctFacture}% du CA) → potentiel facturable maintenant : CHF ${fmtN(potentielFacturation)}`,
      impactCHF: potentielFacturation,
      urgence: potentielFacturation > 5000 ? 'haute' : 'moyenne',
    });
  }

  if (etat.projectionDisponible && etat.margeEstimee !== null && etat.margeEstimee < 0) {
    const deficit = Math.abs(etat.margeEstimee);
    const avenantSuggere = Math.round(deficit * 1.1);
    recs.push({
      type: 'avenant',
      titre: 'Déposer un avenant — chantier en perte',
      detail: `EAC CHF ${fmtN(etat.coutFinalEstime)} > CA CHF ${fmtN(ca)} → déficit estimé CHF ${fmtN(deficit)}. Avenant recommandé : CHF ${fmtN(avenantSuggere)} (déficit + 10% marge).`,
      impactCHF: avenantSuggere,
      urgence: 'haute',
    });
  }

  if (couts.ecartEquipe > 0 && couts.coutEquipePrevu > 0) {
    const ecartPct = Math.round(couts.ecartEquipePct * 10) / 10;
    const joursRestants = Math.max(0, (etat.totalJoursPrevus || 0) - (etat.totalJoursReels || 0));
    const economiePossible = joursRestants > 0 && etat.equipe.length > 0
      ? Math.round(
          etat.equipe.reduce((s, m) => s + m.tarifJour, 0) * joursRestants * 0.25
        )
      : null;
    const detailEco = economiePossible && economiePossible > 0
      ? ` Supprimer les heures supplémentaires sur les ${joursRestants} j restants économiserait ≈ CHF ${fmtN(economiePossible)}.`
      : '';
    recs.push({
      type: 'couts',
      titre: 'Dépassement MO détecté',
      detail: `+CHF ${fmtN(couts.ecartEquipe)} vs budget (${ecartPct > 0 ? '+' : ''}${ecartPct}%).${detailEco} Vérifier productivité ou dimensionnement équipe.`,
      impactCHF: economiePossible,
      urgence: ecartPct > 20 ? 'haute' : 'moyenne',
    });
  }

  if (deriveJours > 7) {
    const joursRetard = Math.abs(deriveJours);
    const coutRetardEst = etat.equipe.length > 0
      ? Math.round(etat.equipe.reduce((s, m) => s + m.tarifJour, 0) * joursRetard)
      : null;
    const detailCout = coutRetardEst
      ? ` Coût estimé du retard : CHF ${fmtN(coutRetardEst)}.`
      : '';
    recs.push({
      type: 'planning',
      titre: `Retard de ${joursRetard} jours ouvrables`,
      detail: `${etat.totalJoursReels} j réalisés vs ${etat.totalJoursPrevus} j prévus (dérive +${joursRetard} j).${detailCout} Replanifier avec l'équipe ou renforcer les ressources.`,
      impactCHF: coutRetardEst,
      urgence: joursRetard > 14 ? 'haute' : 'moyenne',
    });
  } else if (deriveJours > 3 && deriveJours <= 7) {
    recs.push({
      type: 'planning',
      titre: `Léger retard : ${deriveJours} jours`,
      detail: `${etat.totalJoursReels} j réalisés vs ${etat.totalJoursPrevus} j prévus. Surveiller le rythme d'avancement sur les prochains jours.`,
      impactCHF: null,
      urgence: 'basse',
    });
  }

  if (couts.ratioEfficacite !== null && couts.ratioEfficacite < 0.7 && ca > 0) {
    const surCout = ca > 0
      ? Math.round(etat.coutTotalReel - ca * (avancement / 100))
      : null;
    recs.push({
      type: 'couts',
      titre: 'Rythme de dépense trop élevé',
      detail: `Ratio efficacité ${Math.round(couts.ratioEfficacite * 100)}% — on dépense bien plus vite qu'on n'avance${surCout ? ` (surcoût actuel ≈ CHF ${fmtN(surCout)})` : ''}. Revoir l'organisation chantier.`,
      impactCHF: surCout,
      urgence: 'haute',
    });
  } else if (couts.ratioEfficacite !== null && couts.ratioEfficacite < 0.85) {
    recs.push({
      type: 'couts',
      titre: 'Efficacité dépense à surveiller',
      detail: `Ratio efficacité ${Math.round(couts.ratioEfficacite * 100)}% — consommation budgétaire légèrement supérieure à l'avancement. Contrôler les commandes et la productivité.`,
      impactCHF: null,
      urgence: 'basse',
    });
  }

  if (couts.ecartMateriel > 0 && couts.coutMaterielPrevu > 0) {
    const ecartPct = Math.round(couts.ecartMaterielPct * 10) / 10;
    recs.push({
      type: 'couts',
      titre: 'Dépassement matériel',
      detail: `CHF ${fmtN(couts.coutMaterielReel)} réel vs CHF ${fmtN(couts.coutMaterielPrevu)} prévu (${ecartPct > 0 ? '+' : ''}${ecartPct}% · écart CHF ${fmtN(couts.ecartMateriel)}). Contrôler commandes ou pertes chantier.`,
      impactCHF: null,
      urgence: ecartPct > 20 ? 'haute' : 'moyenne',
    });
  }

  if (factures.length === 0 && avancement >= 25 && ca > 0) {
    const premierAcompte = Math.round(ca * 0.30);
    recs.push({
      type: 'facturation',
      titre: 'Aucune facture émise à 25% d\'avancement',
      detail: `Le chantier est à ${avancement}% sans facture émise. Émettre un acompte de 30% recommandé : CHF ${fmtN(premierAcompte)} (selon usage BTP Suisse).`,
      impactCHF: premierAcompte,
      urgence: 'moyenne',
    });
  }

  recs.sort((a, b) => {
    const ordre = { haute: 0, moyenne: 1, basse: 2 };
    return (ordre[a.urgence] ?? 3) - (ordre[b.urgence] ?? 3);
  });

  return recs;
}

function BadgeImpact({ montant }) {
  if (!montant || montant <= 0) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 11, fontWeight: 700,
      background: DS.badges.info.bg, color: DS.badges.info.color,
      borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap',
    }}>
      Impact estimé : CHF {fmtN(montant)}
    </span>
  );
}

function RecoCard({ rec }) {
  const cfg = URGENCE_CONFIG[rec.urgence] || URGENCE_CONFIG.basse;
  const Icone = ICONES[rec.type] || AlertTriangle;
  return (
    <div style={{
      background: cfg.fond,
      border: `1px solid ${cfg.bordure}`,
      borderLeft: `4px solid ${cfg.couleur}`,
      borderRadius: 12,
      padding: '14px 18px',
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <div style={{
        flexShrink: 0, marginTop: 2,
        width: 32, height: 32, borderRadius: 8,
        background: cfg.couleur + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icone size={16} color={cfg.couleur} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: cfg.couleur }}>{rec.titre}</span>
          <BadgeImpact montant={rec.impactCHF} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rec.detail}</div>
      </div>
    </div>
  );
}

function DetailRecommandations({ etat, couts, chantier, factures = [], devis = [], fmtK }) {
  const recs = genererRecommandations(etat, couts, chantier, factures, devis);

  if (recs.length === 0) {
    return (
      <div style={{
        background: C.secondaire + '10',
        border: `1px solid ${C.secondaire}35`,
        borderLeft: `4px solid ${C.secondaire}`,
        borderRadius: 12,
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        marginBottom: 4,
      }}>
        <CheckCircle size={20} color={C.secondaire} strokeWidth={2} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.secondaire }}>
          Ce chantier est sur les rails — aucune action corrective requise
        </span>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ ...DS.sectionLabel, marginBottom: 12 }}>
        <AlertTriangle size={13} />
        Recommandations ({recs.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recs.map((r, i) => <RecoCard key={i} rec={r} />)}
      </div>
    </div>
  );
}

export default DetailRecommandations;
