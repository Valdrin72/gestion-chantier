import { CYNA_PARAMS } from './constants';

// ── DIRECTEUR DU MATIN — trésorerie projetée HONNÊTE (anti-faillite BTP) ──────────
// Les sorties FOURNISSEURS ne sont PAS modélisables (aucune échéance datée dans l'app)
// → toujours signalées comme hors périmètre. On modélise ce qu'on connaît : la charge
// mensuelle globale saisie, ou à défaut la masse salariale estimée (Σ tarifJour × 20 j).

/**
 * Sorties mensuelles ESTIMÉES (cash-out récurrent). Priorité à la charge mensuelle
 * saisie par le patron ; sinon estimation de la masse salariale. Jamais les fournisseurs.
 * @returns {{ montant: number, source: 'charges_saisies'|'salaires_estimes'|'aucune' }}
 */
export function sortiesMensuellesEstimees(parametres = {}) {
  const cfg = parametres?.parametres || {};
  const chargesMensuelles = parseFloat(cfg.chargesMensuelles) || 0;
  if (chargesMensuelles > 0) return { montant: chargesMensuelles, source: 'charges_saisies' };
  const employes = (parametres?.employes || []).filter(e => e.actif !== false);
  const masse = employes.reduce((s, e) => s + (parseFloat(e.tarifJour) || 0) * 20, 0); // ~20 j ouvrés/mois
  return { montant: masse, source: masse > 0 ? 'salaires_estimes' : 'aucune' };
}

/**
 * Projection HONNÊTE de la trésorerie à 30 jours :
 *   soldeProjete = solde bancaire saisi (si FRAIS) + encaissements attendus 30j − sorties 30j.
 * Retourne modelisable=false si aucun solde bancaire frais → on ne juge JAMAIS sur du vide
 * (pas de faux 0). Les décaissements fournisseurs restent HORS périmètre (toujours signalé).
 */
export function projeterTresorerie30j({ factures = [], parametres = {}, maintenant = Date.now() } = {}) {
  const cfg = parametres?.parametres || {};
  const seuil = parseFloat(cfg.seuilTresorerie) || CYNA_PARAMS.TRESORERIE_SEUIL_ALERTE;
  const fraicheurMax = CYNA_PARAMS.TRESORERIE_FRAICHEUR_JOURS;

  const soldeRaw = cfg.soldeBancaire;
  const soldeSaisi = (soldeRaw === '' || soldeRaw == null || isNaN(parseFloat(soldeRaw))) ? null : parseFloat(soldeRaw);
  const d = cfg.soldeBancaireDate ? new Date(cfg.soldeBancaireDate) : null;
  const ageJours = (d && !isNaN(d.getTime())) ? Math.floor((maintenant - d.getTime()) / 86400000) : null;
  const soldeFrais = soldeSaisi !== null && ageJours !== null && ageJours >= 0 && ageJours <= fraicheurMax;

  const horizon = maintenant + 30 * 86400000;
  const encaissements30j = (factures || [])
    .filter(f => ['envoyee', 'partielle', 'retard'].includes((f.statut || '').toLowerCase()))
    .filter(f => { const e = f.dateEcheance ? new Date(f.dateEcheance).getTime() : NaN; return !f.dateEcheance || (!isNaN(e) && e <= horizon); })
    .reduce((s, f) => s + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);

  const { montant: sorties30j, source: sourceSorties } = sortiesMensuellesEstimees(parametres);
  const soldeProjete = soldeFrais ? soldeSaisi + encaissements30j - sorties30j : null;

  return {
    seuil, soldeSaisi, soldeFrais, ageJours,
    encaissements30j, sorties30j, sourceSorties,
    soldeProjete,                    // null si pas de solde frais → non jugeable
    modelisable: soldeFrais,
    fournisseursNonModelises: true,  // toujours vrai → avertissement à afficher
  };
}

/**
 * Pénalité de trésorerie pour le SCORE SANTÉ /100 (signal de survie BTP).
 * On ne pénalise QUE si le solde projeté est jugeable (solde bancaire frais saisi).
 * Paliers : projeté négatif = −40 (survie), sous le seuil = −20 (tendue), au-dessus = 0.
 */
export function penaliteScoreTresorerie(proj) {
  if (!proj || !proj.modelisable || proj.soldeProjete == null) return 0;
  if (proj.soldeProjete < 0) return 40;
  if (proj.soldeProjete < proj.seuil) return 20;
  return 0;
}

export function calculerDSO(creances, ca, jours) {
  return ca > 0 ? (creances / ca) * jours : 0;
}

export function calculerDPO(dettes, achats, jours) {
  return achats > 0 ? (dettes / achats) * jours : 0;
}

export function calculerBFR({ creancesClients, stocks, travauxEnCours, dettesFournisseurs, acomptesRecus }) {
  return (creancesClients ?? 0) + (stocks ?? 0) + (travauxEnCours ?? 0) -
         (dettesFournisseurs ?? 0) - (acomptesRecus ?? 0);
}

export function interetsMoratoires(montant, joursRetard, taux = 0.05) {
  return montant * taux * joursRetard / 360;
}

export function delaiHypothequeLegale(dateDernierTravail) {
  const limite = new Date(dateDernierTravail);
  limite.setMonth(limite.getMonth() + 4);
  const joursRestants = Math.ceil((limite.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return { dateLimite: limite, joursRestants };
}

export function projectionSolde(soldeInitial, mouvements, joursProjection = 90) {
  const aujourd = new Date();
  aujourd.setHours(0, 0, 0, 0);
  let solde = soldeInitial;
  const resultats = [];

  for (let i = 0; i <= joursProjection; i++) {
    const date = new Date(aujourd);
    date.setDate(date.getDate() + i);
    const dateStr = date.toDateString();
    for (const m of mouvements) {
      if (new Date(m.date).toDateString() === dateStr) {
        solde += m.montant * m.probabilite;
      }
    }
    resultats.push({ date, solde: Math.round(solde * 100) / 100 });
  }
  return resultats;
}
