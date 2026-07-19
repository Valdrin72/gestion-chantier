/**
 * Phase 7b bis — ORACLE FIGÉ du comportement "lecture journal".
 *
 * Copie VERBATIM de calculerCoutsChantier / calculerEtatChantier / _surcoutMajorations
 * tels qu'ils étaient dans donnees.js AVANT la bascule sur les pointages (commit #61).
 *
 * POURQUOI : après la bascule, donnees.js lit les pointages via les helpers. Le golden
 * master ne peut donc plus comparer donnees ↔ V7 (les deux liraient les pointages → il
 * se comparerait à lui-même et ne prouverait plus rien). Ce fichier fige l'ANCIEN moteur
 * (lecture chantier.journal) comme référence indépendante : le golden master post-bascule
 * compare donnees(pointages) contre cet oracle(journal). Toute divergence = régression.
 *
 * NE JAMAIS modifier ce fichier pour "faire passer" un test : c'est la vérité historique.
 * Seul un consommateur de test l'importe — jamais l'app (exclu du bundle : sous __tests__).
 */

import { calculerMajorationDate, calculerPartSemaine, facteurEffectif } from '../../majorations';
import { COEF_MO_DEFAUT } from '../../constants';
import { calculerCA, heuresEmploye } from '../../../donnees';

// ── Copie verbatim de _surcoutMajorations (donnees.js #61) ────────────────────
function _surcoutMajorations(chantier, employes, pointages, coefficient) {
  const chantierId = String(chantier.id);
  const canton = chantier.canton ?? 'GE';

  const ptgsChantier = pointages.filter(p =>
    p.repartitions.some(r =>
      String(r.chantierId) === chantierId &&
      ['production', 'atelier'].includes(r.categorie)
    )
  );

  let coutMOSansMajoration = 0;
  let coutMajorations = 0;
  let heuresMajorees = 0;
  let coutDeplacementFG = 0;
  const repartitionCategories = {
    production: { heures: 0, cout: 0 },
    atelier:    { heures: 0, cout: 0 },
  };

  for (const p of ptgsChantier) {
    const emp = employes.find(e => String(e.id) === String(p.employeId));
    const tarifJourCharge = emp
      ? (parseFloat(emp.tarifJour) || 0) * (emp.tarifDejaCharge ? 1 : coefficient)
      : 0;
    const tarifH = tarifJourCharge / 8;

    const heuresCeChantier = p.repartitions
      .filter(r => String(r.chantierId) === chantierId && ['production', 'atelier'].includes(r.categorie))
      .reduce((s, r) => s + r.heures, 0);

    if (heuresCeChantier <= 0) continue;

    const majDate = calculerMajorationDate(p.date, canton);
    const majSem  = calculerPartSemaine(p.date, p.employeId, pointages);
    const fe      = facteurEffectif(majDate, majSem);

    const coutBase = heuresCeChantier * tarifH;
    coutMOSansMajoration += coutBase;
    coutMajorations      += coutBase * (fe - 1.0);
    if (fe > 1.0) heuresMajorees += heuresCeChantier;

    for (const r of p.repartitions.filter(r => String(r.chantierId) === chantierId)) {
      if (repartitionCategories[r.categorie]) {
        repartitionCategories[r.categorie].heures += r.heures;
        repartitionCategories[r.categorie].cout   += r.heures * tarifH * fe;
      }
    }
  }

  for (const p of ptgsChantier) {
    if (p.deplacement) {
      coutDeplacementFG += parseFloat(p.deplacement.indemnite_chf) || 0;
    }
  }

  return { coutMOSansMajoration, coutMajorations, heuresMajorees, coutDeplacementFG, repartitionCategories };
}

// ── Copie verbatim de calculerCoutsChantier (lecture chantier.journal) ────────
export const calculerCoutsChantierJournalFige = (chantier, employes = [], localites = [], cfg = {}, devisList = [], pointages = []) => {
  const coefficient = parseFloat(cfg.coefficientMainOeuvre) || COEF_MO_DEFAUT;
  const tauxFG = parseFloat(cfg.tauxFraisGeneraux) || 12;

  const getTarifJour = (emp) => {
    if (!emp) return 0;
    const tarif = parseFloat(emp.tarifJour) || 0;
    return emp.tarifDejaCharge ? tarif : tarif * coefficient;
  };

  const _reel = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };

  const localite = localites.find(l => l.nom === chantier.ville);
  const tarifDeplacement = localite ? localite.tarifJour : 0;
  const nbJours = parseInt(chantier.nombreJours || 0);
  const coutDeplacementPrevu = tarifDeplacement * nbJours;
  const joursReelsJournal = new Set((chantier.journal || []).map(e => e.date).filter(Boolean)).size;
  const coutDeplacementReel = tarifDeplacement * joursReelsJournal;
  const coutDeplacement = joursReelsJournal > 0 ? coutDeplacementReel : coutDeplacementPrevu;

  const journalCouts = chantier.journal || [];

  const coutEquipePrevu = chantier.equipe?.reduce((total, membre) => {
    const emp = employes.find(e => String(e.id) === String(membre.employeId));
    return total + getTarifJour(emp) * parseFloat(membre.joursPlannifies || 0);
  }, 0) || 0;

  const empIdsAvecHeures = [...new Set(
    journalCouts.flatMap(e => (e.employes || []).map(em => parseInt(em.employeId))).filter(Boolean)
  )];
  const empIdsEquipeSansHeures = (chantier.equipe || [])
    .map(m => parseInt(m.employeId))
    .filter(id => !empIdsAvecHeures.includes(id));
  const coutEquipeReelDetaille = [...empIdsAvecHeures, ...empIdsEquipeSansHeures].map(empId => {
    const emp = employes.find(e => String(e.id) === String(empId));
    const joursReels = heuresEmploye(journalCouts, empId) / 8;
    const tarif = getTarifJour(emp);
    return { employeId: empId, joursReels, tarif, cout: tarif * joursReels };
  });
  const coutEquipeReelBase = coutEquipeReelDetaille.reduce((t, m) => t + m.cout, 0);
  const _maj = _surcoutMajorations(chantier, employes, pointages, coefficient);
  const coutEquipeReel = coutEquipeReelBase + _maj.coutMajorations;

  const coutImprevus = chantier.imprevus?.reduce((t, imp) => t + (parseFloat(imp.montant) || 0), 0) || 0;
  const coutMaterielPrevu = parseFloat(chantier.coutMaterielPrevu) || 0;
  const coutSousTraitancePrevu = parseFloat(chantier.coutSousTraitancePrevu) || 0;
  const autresCoutsPrevu = parseFloat(chantier.autresCoutsPrevu) || 0;

  const coutMaterielReelRaw    = _reel(chantier.materielReel)       ?? _reel(chantier.coutMaterielReel);
  const coutSousTraitanceReelRaw = _reel(chantier.sousTraitanceReelle) ?? _reel(chantier.coutSousTraitanceReel);
  const autresCoutsReelRaw     = _reel(chantier.autresCoutsReels)   ?? _reel(chantier.autresCoutsReel);

  const coutMaterielReel    = Math.max(0, coutMaterielReelRaw    ?? 0);
  const coutSousTraitanceReel = Math.max(0, coutSousTraitanceReelRaw ?? 0);
  const autresCoutsReel     = Math.max(0, autresCoutsReelRaw     ?? 0);

  const hasEquipe = (chantier.equipe?.length || 0) > 0 || empIdsAvecHeures.length > 0;
  const equipeHasReel = coutEquipeReelDetaille.some(m => m.joursReels > 0);
  const champsManquants = [];
  if (hasEquipe && !equipeHasReel)                            champsManquants.push('Heures équipe');
  if (coutMaterielPrevu > 0    && coutMaterielReelRaw    === null) champsManquants.push('Matériel');
  if (coutSousTraitancePrevu > 0 && coutSousTraitanceReelRaw === null) champsManquants.push('Sous-traitance');
  if (autresCoutsPrevu > 0     && autresCoutsReelRaw     === null) champsManquants.push('Autres coûts');
  const donneesIncompletes = champsManquants.length > 0;

  const montantTotal = calculerCA(chantier, devisList);
  const caDisponible = montantTotal !== null;

  const totalCoutsPrevu = coutEquipePrevu + coutMaterielPrevu + coutSousTraitancePrevu + coutDeplacementPrevu + autresCoutsPrevu;
  const totalCoutsReel = coutEquipeReel + coutMaterielReel + coutSousTraitanceReel + coutImprevus + autresCoutsReel;

  const margePrevu = caDisponible ? montantTotal - totalCoutsPrevu : null;
  const margeReel = caDisponible ? montantTotal - totalCoutsReel : null;
  const margePrevuPct = (caDisponible && montantTotal > 0) ? Math.round((margePrevu / montantTotal) * 1000) / 10 : null;
  const margeActuellePct  = (caDisponible && montantTotal > 0) ? Math.round((margeReel  / montantTotal) * 1000) / 10 : null;

  const surface = parseFloat(chantier.surface) || 0;
  const coutParM2Prevu = surface > 0 ? Math.round((totalCoutsPrevu / surface) * 100) / 100 : null;
  const coutParM2Reel  = surface > 0 ? Math.round((totalCoutsReel  / surface) * 100) / 100 : null;
  const prixParM2Devis = (caDisponible && surface > 0) ? Math.round((montantTotal / surface) * 100) / 100 : null;

  const ecartMontant = caDisponible ? montantTotal - totalCoutsReel : null;
  const ecartPct = (caDisponible && montantTotal > 0) ? Math.round(((montantTotal - totalCoutsReel) / montantTotal) * 1000) / 10 : null;

  const fraisGeneraux = caDisponible ? montantTotal * (tauxFG / 100) : 0;
  const margeNette = (caDisponible && margeReel !== null) ? margeReel - fraisGeneraux : null;
  const margeNettePct = (caDisponible && montantTotal > 0 && margeNette !== null) ? Math.round((margeNette / montantTotal) * 1000) / 10 : null;

  const budgetRestant = totalCoutsPrevu - totalCoutsReel;
  const joursReelsPourAv = new Set(journalCouts.map(e => e.date).filter(Boolean)).size;
  const avancementJournal = nbJours > 0 && joursReelsPourAv > 0
    ? Math.min(100, Math.round((joursReelsPourAv / nbJours) * 100))
    : 0;
  const statutLower = (chantier.statut || '').trim().toLowerCase();
  const avancement = ['terminé', 'termine', 'clôturé', 'cloture', 'facturé', 'facture'].includes(statutLower)
    ? 100
    : (avancementJournal || Math.min(100, parseFloat(chantier.avancement) || 0));
  const rad = (avancement > 0 && totalCoutsReel > 0)
    ? (totalCoutsReel / avancement) * (100 - avancement)
    : null;

  const ratioEfficacite = (avancement > 10 && totalCoutsPrevu > 0 && totalCoutsReel > 0)
    ? (avancement / 100) / (totalCoutsReel / totalCoutsPrevu)
    : null;
  const alerteRythmeRouge  = ratioEfficacite !== null && ratioEfficacite < 0.70;
  const alerteRythmeOrange = ratioEfficacite !== null && ratioEfficacite >= 0.70 && ratioEfficacite < 0.85;

  const projectionCalculable = caDisponible && avancement > 0 && totalCoutsReel > 0 && montantTotal > 0;
  const projectionFiable = projectionCalculable && !donneesIncompletes;

  const coutFinalEstime = projectionFiable
    ? totalCoutsReel / (avancement / 100)
    : null;

  const margeFinaleEstimeePct = (coutFinalEstime !== null && montantTotal > 0)
    ? Math.round((montantTotal - coutFinalEstime) / montantTotal * 1000) / 10
    : null;

  const margeFinaleNettePct = (margeFinaleEstimeePct !== null && montantTotal > 0)
    ? Math.round((margeFinaleEstimeePct - tauxFG) * 10) / 10
    : null;

  const deriveProjetee = (caDisponible && coutFinalEstime !== null)
    ? coutFinalEstime - montantTotal
    : null;

  const alerteDerive = coutFinalEstime !== null
    && (deriveProjetee > 0 || (margeFinaleNettePct !== null ? margeFinaleNettePct < 10 : margeFinaleEstimeePct < 10));

  const ecartEquipe = coutEquipeReel - coutEquipePrevu;
  const ecartEquipePct = coutEquipePrevu > 0 ? Math.round(((coutEquipeReel - coutEquipePrevu) / coutEquipePrevu) * 1000) / 10 : 0;
  const ecartMateriel = coutMaterielReel - coutMaterielPrevu;
  const ecartMaterielPct = coutMaterielPrevu > 0 ? Math.round(((coutMaterielReel - coutMaterielPrevu) / coutMaterielPrevu) * 1000) / 10 : 0;
  const ecartSousTraitance = coutSousTraitanceReel - coutSousTraitancePrevu;
  const ecartSousTraitancePct = coutSousTraitancePrevu > 0 ? Math.round(((coutSousTraitanceReel - coutSousTraitancePrevu) / coutSousTraitancePrevu) * 1000) / 10 : 0;
  const ecartAutres = autresCoutsReel - autresCoutsPrevu;
  const ecartAutresPct = autresCoutsPrevu > 0 ? Math.round(((autresCoutsReel - autresCoutsPrevu) / autresCoutsPrevu) * 1000) / 10 : 0;

  const depassementBudget = totalCoutsReel > totalCoutsPrevu && totalCoutsPrevu > 0;
  const alerteOrange = !depassementBudget && totalCoutsPrevu > 0
    && avancement > 10
    && (totalCoutsReel / totalCoutsPrevu) >= 0.8
    && avancement < 80;

  return {
    coutDeplacement, coutDeplacementReel, coutDeplacementPrevu, coutEquipePrevu, coutEquipeReel, coutEquipeReelDetaille,
    coutMaterielPrevu, coutMaterielReel, coutMaterielReelRaw,
    coutSousTraitancePrevu, coutSousTraitanceReel, coutSousTraitanceReelRaw,
    autresCoutsPrevu, autresCoutsReel, autresCoutsReelRaw,
    coutImprevus, totalCoutsPrevu, totalCoutsReel,
    montantTotal, margePrevu, margeReel,
    margePrevuPct,
    margeActuellePct,
    avancementPct: avancement,
    coutParM2Prevu, coutParM2Reel, prixParM2Devis,
    ecartMontant, ecartPct,
    fraisGeneraux, margeNette, margeNettePct,
    budgetRestant, rad,
    ecartEquipe, ecartEquipePct,
    ecartMateriel, ecartMaterielPct,
    ecartSousTraitance, ecartSousTraitancePct,
    ecartAutres, ecartAutresPct,
    depassementBudget, alerteOrange,
    alerteRythmeRouge, alerteRythmeOrange, ratioEfficacite,
    donneesIncompletes, champsManquants,
    projectionCalculable, projectionFiable,
    coutFinalEstime, margeFinaleEstimeePct, margeFinaleNettePct, deriveProjetee, alerteDerive,
    coutMOSansMajoration: _maj.coutMOSansMajoration,
    coutMajorations:      _maj.coutMajorations,
    coutDeplacementFG:    _maj.coutDeplacementFG,
    heuresMajorees:       _maj.heuresMajorees,
    repartitionCategories: _maj.repartitionCategories,
  };
};

// ── Copie verbatim de calculerEtatChantier (lecture chantier.journal) ─────────
export const calculerEtatChantierJournalFige = (chantier, employes = [], devisList = [], parametres = null, pointages = []) => {
  const equipe     = chantier.equipe     || [];
  const journal    = chantier.journal    || [];
  const imprevus   = chantier.imprevus   || [];
  const devisTotal = calculerCA(chantier, devisList);

  const coefficientMO = parseFloat(parametres?.coefficientMainOeuvre) || COEF_MO_DEFAUT;

  const empIdsJournal = [...new Set(
    journal.flatMap(e => (e.employes || []).map(em => parseInt(em.employeId))).filter(Boolean)
  )];
  const empIdsEquipe = equipe.map(m => parseInt(m.employeId)).filter(id => !empIdsJournal.includes(id));
  const tousEmpIds = [...empIdsJournal, ...empIdsEquipe];

  const membreDetail = tousEmpIds.map(empId => {
    const emp     = employes.find(e => String(e.id) === String(empId));
    const coeff = emp?.tarifDejaCharge ? 1 : coefficientMO;
    const tarifJour  = (parseFloat(emp?.tarifJour) || 0) * coeff;
    const tarifHeure = tarifJour / 8;

    const heuresReelles = heuresEmploye(journal, empId);
    const joursReels    = heuresReelles / 8;

    const membreEquipe  = equipe.find(m => parseInt(m.employeId) === empId);
    const joursPrevus   = parseFloat(membreEquipe?.joursPlannifies) || 0;
    const heuresPrevues = joursPrevus * 8;

    return {
      employeId:   empId,
      nom:         emp?.nom   || `Employé #${empId}`,
      poste:       emp?.poste || '',
      tarifJour,
      tarifHeure,
      joursPrevus,
      joursReels,
      heuresPrevues,
      heuresReelles,
      cout: heuresReelles * tarifHeure,
    };
  });

  const totalJoursPrevus   = parseInt(chantier.nombreJours) || 0;
  const totalJoursReels    = new Set(journal.map(e => e.date).filter(Boolean)).size;
  const totalHeuresPrevues = membreDetail.reduce((s, m) => s + m.heuresPrevues, 0);
  const totalHeuresReelles = membreDetail.reduce((s, m) => s + m.heuresReelles, 0);

  const _statutChantierLower = (chantier.statut || '').trim().toLowerCase();
  const _chantiClos = ['terminé', 'termine', 'clôturé', 'cloture', 'facturé', 'facture'].includes(_statutChantierLower);
  const avancementPct = _chantiClos
    ? 100
    : totalJoursPrevus === 0
      ? 0
      : Math.min(100, Math.round((totalJoursReels / totalJoursPrevus) * 100));

  const deriveJours = totalJoursReels - totalJoursPrevus;

  const coutMOReelBase = membreDetail.reduce((s, m) => s + m.cout, 0);
  const _majE = _surcoutMajorations(chantier, employes, pointages, coefficientMO);
  const coutMOReel = coutMOReelBase + _majE.coutMajorations;

  const coutMateriel      = parseFloat(chantier.materielReel)          || parseFloat(chantier.coutMaterielReel)      || 0;
  const coutSousTraitance = parseFloat(chantier.sousTraitanceReelle)   || parseFloat(chantier.coutSousTraitanceReel) || 0;
  const coutAutres        = parseFloat(chantier.autresCoutsReels)      || parseFloat(chantier.autresCoutsReel)       || 0;
  const coutImprevus     = imprevus.reduce(
    (s, imp) => s + (parseFloat(imp.montant) || 0), 0
  );

  const coutTotalReel = coutMOReel + coutMateriel + coutSousTraitance
                      + coutAutres + coutImprevus;

  const projectionDisponible = avancementPct >= 20;

  const coutFinalEstime = projectionDisponible
    ? Math.round((coutTotalReel / avancementPct) * 100)
    : null;

  const rad = projectionDisponible && coutFinalEstime !== null
    ? Math.round(coutFinalEstime - coutTotalReel)
    : null;

  const margeEstimee = (projectionDisponible && devisTotal !== null)
    ? Math.round(devisTotal - coutFinalEstime)
    : null;

  const margeProjeteePct = (projectionDisponible && devisTotal !== null && devisTotal > 0)
    ? Math.round((margeEstimee / devisTotal) * 1000) / 10
    : null;

  return {
    totalJoursPrevus,
    totalJoursReels,
    totalHeuresPrevues,
    totalHeuresReelles,
    avancementPct,
    deriveJours,

    coutMOReel,
    coutMateriel,
    coutSousTraitance,
    coutAutres,
    coutImprevus,
    coutTotalReel,

    devisTotal,

    projectionDisponible,
    coutFinalEstime,
    rad,
    margeEstimee,
    margeProjeteePct,

    coutMOSansMajoration: _majE.coutMOSansMajoration,
    coutMajorations:      _majE.coutMajorations,
    coutDeplacementFG:    _majE.coutDeplacementFG,
    heuresMajorees:       _majE.heuresMajorees,
    repartitionCategories: _majE.repartitionCategories,

    equipe: membreDetail,
  };
};
