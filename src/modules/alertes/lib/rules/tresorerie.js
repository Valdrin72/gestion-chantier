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
    if (ctx.treso.solde_projete_30j >= CYNA_PARAMS.TRESORERIE_SEUIL_ALERTE) return [];
    return [{
      contextRef: { type: 'global', id: 'tresorerie' },
      title: 'Trésorerie tendue à 30 jours',
      message: `Solde projeté ${fmtCHF(ctx.treso.solde_projete_30j)} — sous seuil ${fmtCHF(CYNA_PARAMS.TRESORERIE_SEUIL_ALERTE)}.`,
      data: { soldeProjete: ctx.treso.solde_projete_30j },
      actions: [{ label: 'Voir finances', type: 'navigate', target: 'finances' }],
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
  DSO_DERIVE,
  HYPOTHEQUE_LEGALE_PROCHE,
];
