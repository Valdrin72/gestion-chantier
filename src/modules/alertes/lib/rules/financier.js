import { calculerEVM } from '../../../../calculs/evm.js';
import { fmtCHF, fmtPct } from '../../../../calculs/format.js';

export const MARGE_NEGATIVE = {
  id: 'fin.marge.negative',
  nom: 'Marge chantier négative',
  description: 'Le chantier est en perte projetée',
  category: 'financier',
  trigger: 'event',
  eventTypes: ['chantier.couts.updated', 'devis.updated', 'avenant.cree'],
  severity: 'CRITICAL',
  destinataires: ['direction', 'conducteur'],
  canaux: ['in_app', 'email'],
  cooldownMinutes: 60 * 12,
  evaluate: (ctx) => ctx.chantiers
    .filter(c => c.statut === 'actif' && typeof c.marge_brute_actuelle === 'number' && c.marge_brute_actuelle < 0)
    .map(c => ({
      contextRef: { type: 'chantier', id: c.id, label: c.nom },
      title: `Marge négative : ${c.nom}`,
      message: `Marge brute projetée : ${fmtCHF(c.marge_brute_actuelle)}. Action immédiate requise.`,
      data: { margeBrute: c.marge_brute_actuelle },
      actions: [{ label: 'Voir le chantier', type: 'navigate', target: 'chantiers' }],
    })),
};

export const MARGE_FAIBLE = {
  id: 'fin.marge.faible',
  nom: 'Marge chantier danger',
  description: 'Marge nette prévisionnelle sous 15% (seuil danger CYNA)',
  category: 'financier',
  trigger: 'event',
  eventTypes: ['chantier.couts.updated', 'devis.updated'],
  severity: 'HIGH',
  destinataires: ['direction', 'conducteur'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24,
  evaluate: (ctx) => ctx.chantiers
    .filter(c => {
      if (c.statut !== 'actif') return false;
      const margeNette = c.marge_nette_actuelle;
      const ca = c.budget_total;
      if (typeof margeNette !== 'number' || ca === 0) return false;
      return margeNette / ca < 0.15;
    })
    .map(c => {
      const taux = (c.marge_nette_actuelle ?? 0) / c.budget_total;
      return {
        contextRef: { type: 'chantier', id: c.id, label: c.nom },
        title: `Marge danger : ${c.nom}`,
        message: `Taux de marge nette ${fmtPct(taux)} — sous le seuil danger CYNA (15%).`,
        data: { tauxMarge: taux },
        actions: [{ label: 'Analyser', type: 'navigate', target: 'chantiers' }],
      };
    }),
};

export const MARGE_LIMITE = {
  id: 'fin.marge.limite',
  nom: 'Marge chantier limite',
  description: 'Marge nette entre 15% et 20% (zone limite CYNA)',
  category: 'financier',
  trigger: 'event',
  eventTypes: ['chantier.couts.updated', 'devis.updated'],
  severity: 'MEDIUM',
  destinataires: ['direction', 'conducteur'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24,
  evaluate: (ctx) => ctx.chantiers
    .filter(c => {
      if (c.statut !== 'actif') return false;
      const margeNette = c.marge_nette_actuelle;
      const ca = c.budget_total;
      if (typeof margeNette !== 'number' || ca === 0) return false;
      const taux = margeNette / ca;
      return taux >= 0.15 && taux < 0.20;
    })
    .map(c => {
      const taux = (c.marge_nette_actuelle ?? 0) / c.budget_total;
      return {
        contextRef: { type: 'chantier', id: c.id, label: c.nom },
        title: `Marge limite : ${c.nom}`,
        message: `Taux de marge nette ${fmtPct(taux)} — zone limite CYNA (cible ≥ 20%).`,
        data: { tauxMarge: taux },
        actions: [{ label: 'Analyser', type: 'navigate', target: 'chantiers' }],
      };
    }),
};

export const CPI_CRITIQUE = {
  id: 'fin.cpi.critique',
  nom: 'CPI < 0.9 — dépassement coût significatif',
  description: 'Earned Value Management détecte un dépassement coût',
  category: 'financier',
  trigger: 'event',
  eventTypes: ['chantier.evm.calcule', 'pointage.ajoute'],
  severity: 'HIGH',
  destinataires: ['direction', 'conducteur'],
  canaux: ['in_app', 'email'],
  cooldownMinutes: 60 * 24,
  evaluate: (ctx) => ctx.chantiers
    .filter(c =>
      c.statut === 'actif'
      && typeof c.pourcent_temps_ecoule === 'number'
      && typeof c.pourcent_travaux_realises === 'number'
      && typeof c.couts_engages === 'number'
      && c.pourcent_travaux_realises >= 30
    )
    .map(c => {
      const evm = calculerEVM({
        budgetTotal: c.budget_total,
        pourcentTempsEcoule: c.pourcent_temps_ecoule,
        pourcentTravauxRealises: c.pourcent_travaux_realises,
        coutsEngages: c.couts_engages,
      });
      return { c, evm };
    })
    .filter(({ evm }) => evm.CPI < 0.9)
    .map(({ c, evm }) => ({
      contextRef: { type: 'chantier', id: c.id, label: c.nom },
      title: `CPI ${evm.CPI.toFixed(2)} : ${c.nom}`,
      message: `Coût final estimé ${fmtCHF(evm.EAC)} vs budget ${fmtCHF(c.budget_total)}. Dépassement projeté ${fmtCHF(evm.EAC - c.budget_total)}.`,
      data: { CPI: evm.CPI, EAC: evm.EAC, depassement: evm.EAC - c.budget_total },
      actions: [{ label: 'Voir chantier', type: 'navigate', target: 'chantiers' }],
    })),
};

export const DEPASSEMENT_BUDGET_25 = {
  id: 'fin.depassement.25',
  nom: 'Dépassement budget > 25%',
  description: 'Les coûts engagés dépassent 25% du budget initial',
  category: 'financier',
  trigger: 'event',
  eventTypes: ['chantier.couts.updated'],
  severity: 'HIGH',
  destinataires: ['direction', 'conducteur'],
  canaux: ['in_app', 'email'],
  cooldownMinutes: 60 * 24,
  evaluate: (ctx) => ctx.chantiers
    .filter(c =>
      c.statut === 'actif'
      && typeof c.couts_engages === 'number'
      && c.budget_total > 0
      && c.couts_engages > c.budget_total * 1.25
    )
    .map(c => {
      const depassementPct = (c.couts_engages - c.budget_total) / c.budget_total;
      return {
        contextRef: { type: 'chantier', id: c.id, label: c.nom },
        title: `Budget dépassé : ${c.nom}`,
        message: `Coûts engagés ${fmtCHF(c.couts_engages)} vs budget ${fmtCHF(c.budget_total)} (+${fmtPct(depassementPct)}).`,
        data: { depassement: depassementPct },
        actions: [{ label: 'Voir chantier', type: 'navigate', target: 'chantiers' }],
      };
    }),
};

export const DEVIS_SANS_RELANCE = {
  id: 'fin.devis.relance',
  nom: 'Devis envoyé sans relance > 14j',
  description: "Un devis envoyé n'a pas été relancé depuis 14 jours",
  category: 'financier',
  trigger: 'schedule',
  cron: '0 8 * * *',
  severity: 'LOW',
  destinataires: ['direction'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24 * 7,
  evaluate: (ctx) => ctx.devis
    .filter(d => {
      if (d.statut !== 'envoye') return false;
      const ref = d.derniere_relance ?? d.date_emission;
      if (!ref) return false;
      const joursDepuis = (ctx.now.getTime() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24);
      return joursDepuis >= 14;
    })
    .map(d => ({
      contextRef: { type: 'devis', id: d.id, label: d.numero },
      title: `Devis ${d.numero} : à relancer`,
      message: `Total HT ${fmtCHF(d.total_ht)}. Pas de relance récente.`,
      actions: [{ label: 'Voir devis', type: 'navigate', target: 'devis' }],
    })),
};

export const FINANCIER_RULES = [
  MARGE_NEGATIVE,
  MARGE_FAIBLE,
  MARGE_LIMITE,
  CPI_CRITIQUE,
  DEPASSEMENT_BUDGET_25,
  DEVIS_SANS_RELANCE,
];
