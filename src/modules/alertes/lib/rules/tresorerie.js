import { interetsMoratoires, delaiHypothequeLegale } from '../../../../calculs/tresorerie.js';
import { fmtCHF } from '../../../../calculs/format.js';
import { CYNA_PARAMS } from '../../../../calculs/constants.js';

function joursDepuis(d, now) {
  return Math.floor((now.getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

export const FACTURE_RETARD_30J = {
  id: 'treso.facture.retard.30',
  nom: 'Facture en retard > 30 jours',
  description: 'Relance amiable requise',
  category: 'tresorerie',
  trigger: 'schedule',
  cron: '0 8 * * *',
  severity: 'MEDIUM',
  destinataires: ['direction', 'administratif'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24 * 3,
  evaluate: (ctx) => ctx.factures
    .filter(f => {
      if (f.statut !== 'emise' && f.statut !== 'partiellement_payee') return false;
      const restant = f.total_ttc - f.total_paye;
      if (restant <= 0) return false;
      const retard = joursDepuis(f.date_echeance, ctx.now);
      return retard > 30 && retard <= 60;
    })
    .map(f => {
      const retard = joursDepuis(f.date_echeance, ctx.now);
      const restant = f.total_ttc - f.total_paye;
      return {
        contextRef: { type: 'facture', id: f.id, label: f.numero },
        title: `Facture ${f.numero} en retard de ${retard}j`,
        message: `Solde dû ${fmtCHF(restant)}. Intérêts moratoires : ${fmtCHF(interetsMoratoires(restant, retard))}.`,
        actions: [{ label: 'Voir factures', type: 'navigate', target: 'finances' }],
      };
    }),
};

export const FACTURE_RETARD_60J = {
  id: 'treso.facture.retard.60',
  nom: 'Facture en retard > 60 jours — mise en demeure',
  description: 'Démarche formelle requise',
  category: 'tresorerie',
  trigger: 'schedule',
  cron: '0 8 * * *',
  severity: 'HIGH',
  destinataires: ['direction', 'administratif'],
  canaux: ['in_app', 'email'],
  cooldownMinutes: 60 * 24 * 3,
  evaluate: (ctx) => ctx.factures
    .filter(f => {
      if (f.statut !== 'emise' && f.statut !== 'partiellement_payee') return false;
      const restant = f.total_ttc - f.total_paye;
      if (restant <= 0) return false;
      return joursDepuis(f.date_echeance, ctx.now) > 60;
    })
    .map(f => {
      const retard = joursDepuis(f.date_echeance, ctx.now);
      const restant = f.total_ttc - f.total_paye;
      return {
        contextRef: { type: 'facture', id: f.id, label: f.numero },
        title: `Facture ${f.numero} : ${retard}j de retard`,
        message: `Solde dû ${fmtCHF(restant)}. Mise en demeure formelle recommandée. Intérêts : ${fmtCHF(interetsMoratoires(restant, retard))}.`,
        actions: [{ label: 'Voir factures', type: 'navigate', target: 'finances' }],
      };
    }),
};

function fmtJJMM(d) {
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
}

export const TRESORERIE_TENDUE = {
  id: 'treso.solde.alerte',
  nom: 'Trésorerie projetée sous seuil',
  description: 'Solde projeté à 30j sous le seuil alerte CYNA',
  category: 'tresorerie',
  trigger: 'schedule',
  cron: '0 9 * * *',
  severity: 'HIGH',
  destinataires: ['direction'],
  canaux: ['in_app', 'email'],
  cooldownMinutes: 60 * 24,
  evaluate: (ctx) => {
    const t = ctx.treso;
    // Ne se déclenche QUE sur un solde saisi ET frais (< fraîcheur). Jamais sur 0/périmé.
    if (!t.solde_configure || !t.solde_frais) return [];
    const seuil = t.seuil_alerte ?? CYNA_PARAMS.TRESORERIE_SEUIL_ALERTE;
    if (t.solde_projete_30j >= seuil) return [];
    return [{
      contextRef: { type: 'global', id: 'tresorerie' },
      title: 'Trésorerie tendue à 30 jours',
      // Projection OPTIMISTE (aucune sortie soustraite) → on le dit explicitement pour ne pas
      // rassurer à tort : le vrai solde sera plus bas une fois les charges payées.
      message: `Trésorerie projetée à 30j : ${fmtCHF(t.solde_projete_30j)} — sous seuil ${fmtCHF(seuil)} (hors salaires, charges sociales et fournisseurs — sorties non modélisées).`,
      data: { soldeProjete: t.solde_projete_30j, seuil },
      actions: [{ label: 'Voir finances', type: 'navigate', target: 'finances' }],
    }];
  },
};

// Solde bancaire périmé (> fraîcheur) : on ne projette PAS sur une valeur obsolète.
export const SOLDE_PERIME = {
  id: 'treso.solde.perime',
  nom: 'Solde bancaire périmé',
  description: 'Le solde bancaire saisi est trop ancien pour surveiller la trésorerie',
  category: 'tresorerie',
  trigger: 'schedule',
  cron: '0 9 * * *',
  severity: 'MEDIUM',
  destinataires: ['direction'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24 * 3,
  evaluate: (ctx) => {
    const t = ctx.treso;
    if (!t.solde_configure || t.solde_frais) return [];
    return [{
      contextRef: { type: 'global', id: 'tresorerie' },
      title: `Solde bancaire daté du ${fmtJJMM(t.solde_date)} — à mettre à jour`,
      message: `Solde vieux de ${t.solde_age_jours}j (> ${t.fraicheur_max_jours}j). La surveillance de trésorerie est suspendue tant qu'il n'est pas actualisé.`,
      data: { soldeDate: t.solde_date, ageJours: t.solde_age_jours },
      actions: [{ label: 'Mettre à jour', type: 'navigate', target: 'parametres' }],
    }];
  },
};

// Aucun solde saisi : surveillance trésorerie explicitement DÉSACTIVÉE (jamais de calcul sur 0).
export const SOLDE_ABSENT = {
  id: 'treso.solde.absent',
  nom: 'Solde bancaire non renseigné',
  description: 'Surveillance de trésorerie inactive faute de solde de départ',
  category: 'tresorerie',
  trigger: 'schedule',
  cron: '0 9 * * 1',
  severity: 'LOW',
  destinataires: ['direction'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24 * 7,
  evaluate: (ctx) => {
    if (ctx.treso.solde_configure) return [];
    return [{
      contextRef: { type: 'global', id: 'tresorerie' },
      title: 'Surveillance de trésorerie inactive',
      message: 'Renseigne ton solde bancaire dans Paramètres pour activer la surveillance de trésorerie.',
      data: {},
      actions: [{ label: 'Renseigner le solde', type: 'navigate', target: 'parametres' }],
    }];
  },
};

export const DSO_DERIVE = {
  id: 'treso.dso.derive',
  nom: 'DSO supérieur à 75 jours',
  description: 'Le délai moyen encaissement dérive vers le rouge',
  category: 'tresorerie',
  trigger: 'schedule',
  cron: '0 9 * * 1',
  severity: 'HIGH',
  destinataires: ['direction', 'administratif'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24 * 7,
  evaluate: (ctx) => {
    if (ctx.treso.dso_actuel <= 75) return [];
    return [{
      contextRef: { type: 'global', id: 'dso' },
      title: `DSO ${ctx.treso.dso_actuel.toFixed(0)} jours`,
      message: `Cible CYNA : ${CYNA_PARAMS.DSO_CIBLE}j. Lancer relances ciblées.`,
      data: { dso: ctx.treso.dso_actuel },
      actions: [{ label: 'Voir finances', type: 'navigate', target: 'finances' }],
    }];
  },
};

export const HYPOTHEQUE_LEGALE_PROCHE = {
  id: 'treso.hypotheque.legale',
  nom: "Délai inscription hypothèque légale proche",
  description: "Plus que 30j pour inscrire l'hypothèque légale (CC 837)",
  category: 'tresorerie',
  trigger: 'schedule',
  cron: '0 9 * * *',
  severity: 'HIGH',
  destinataires: ['direction'],
  canaux: ['in_app', 'email'],
  cooldownMinutes: 60 * 24 * 7,
  evaluate: (ctx) => ctx.factures
    .filter(f => {
      if (f.statut !== 'emise' && f.statut !== 'partiellement_payee') return false;
      if ((f.total_ttc - f.total_paye) <= 0) return false;
      if (!f.dernier_travail_chantier) return false;
      const r = delaiHypothequeLegale(new Date(f.dernier_travail_chantier));
      return r.joursRestants > 0 && r.joursRestants <= 30;
    })
    .map(f => {
      const r = delaiHypothequeLegale(new Date(f.dernier_travail_chantier));
      return {
        contextRef: { type: 'facture', id: f.id, label: f.numero },
        title: `Hypothèque légale ${f.numero} : J-${r.joursRestants}`,
        message: `Inscrire avant ${r.dateLimite.toLocaleDateString('fr-CH')}.`,
        data: { joursRestants: r.joursRestants },
      };
    }),
};

export const TRESORERIE_RULES = [
  FACTURE_RETARD_30J,
  FACTURE_RETARD_60J,
  TRESORERIE_TENDUE,
  SOLDE_PERIME,
  SOLDE_ABSENT,
  DSO_DERIVE,
  HYPOTHEQUE_LEGALE_PROCHE,
];
