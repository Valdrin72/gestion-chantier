// =============================================
// CYNA SÀRL — DONNÉES & CALCULS MÉTIER
// =============================================
import { donneesDemo } from './donnees-demo';

// ===== SEUILS DE RENTABILITÉ BTP SUISSE — SOURCE UNIQUE DE VÉRITÉ =====
// Tous les modules (Dashboard, Marges, Analyse, Statistiques, ChantierDetail)
// doivent importer ces constantes. Ne jamais dupliquer ces valeurs.
export const SEUILS = {
  margeRentable: 20,  // ≥20% → Rentable (vert)
  margeLimite:   15,  // 15–19.9% → Limite (orange)
  // <15% → Non rentable (rouge)
};

/** Retourne la couleur hex correspondant à un pourcentage de marge. */
export const couleurMarge = (pct) => {
  const v = parseFloat(pct) || 0;
  if (v >= SEUILS.margeRentable) return '#10b981';
  if (v >= SEUILS.margeLimite)   return '#f59e0b';
  return '#ef4444';
};

// ===== FORMATEUR DE NOMBRE — APOSTROPHE SUISSE =====
// Usage : fmtN(12000) → "12'000"  |  fmtN(1500.5, 2) → "1'500.50"
export const fmtN = (n, dec = 0) => {
  const num = parseFloat(n) || 0;
  const [int, frac] = num.toFixed(dec).split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return dec > 0 ? `${intFmt}.${frac}` : intFmt;
};

// ===== JOURS OUVRABLES =====
export const calculerDateFinOuvrables = (dateDebut, nombreJours, inclusSamedi = false) => {
  if (!dateDebut || !nombreJours) return null;
  const nb = parseInt(nombreJours);
  if (isNaN(nb) || nb <= 0) return null;
  const date = new Date(dateDebut);
  if (isNaN(date.getTime())) return null; // Protection date invalide
  let joursComptés = 0;
  let iterations = 0;
  const maxIterations = nb * 3 + 30;
  while (joursComptés < nb) {
    if (++iterations > maxIterations) break;
    date.setDate(date.getDate() + 1);
    const jour = date.getDay();
    if (inclusSamedi) {
      if (jour !== 0) joursComptés++; // Exclure dimanche
    } else {
      if (jour !== 0 && jour !== 6) joursComptés++; // Exclure sam+dim
    }
  }
  return date.toISOString().split('T')[0];
};

export const joursOuvrableRestants = (dateDebut, nombreJours, inclusSamedi = false) => {
  if (!dateDebut || !nombreJours) return null;
  const datefinStr = calculerDateFinOuvrables(dateDebut, nombreJours, inclusSamedi);
  if (!datefinStr) return null; // Protection : date invalide ou paramètres manquants
  const dateFin = new Date(datefinStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const maxIter = nombreJours * 3 + 400;
  if (dateFin < today) {
    let joursDepasse = 0;
    let iter = 0;
    const d = new Date(today);
    while (d > dateFin && ++iter < maxIter) {
      d.setDate(d.getDate() - 1);
      const jour = d.getDay();
      if (inclusSamedi ? jour !== 0 : (jour !== 0 && jour !== 6)) joursDepasse++;
    }
    return -joursDepasse;
  }

  let joursRestants = 0;
  let iter = 0;
  const d = new Date(today);
  while (d < dateFin && ++iter < maxIter) {
    d.setDate(d.getDate() + 1);
    const jour = d.getDay();
    if (inclusSamedi ? jour !== 0 : (jour !== 0 && jour !== 6)) joursRestants++;
  }
  return joursRestants;
};

export const getAlerte = (jours) => {
  if (jours === null) return null;
  if (jours < 0) return { texte: `DÉPASSÉ de ${Math.abs(jours)} jour(s)`, couleur: '#b71c1c', niveau: 'critique', banniere: 'danger' };
  if (jours === 0) return { texte: 'FIN AUJOURD\'HUI !', couleur: '#b71c1c', niveau: 'critique', banniere: 'danger' };
  if (jours <= 2) return { texte: `${jours} jour(s) restant(s) !`, couleur: '#e65100', niveau: 'danger', banniere: 'warning' };
  if (jours <= 5) return { texte: `${jours} jours restants`, couleur: '#f57f17', niveau: 'warning', banniere: 'warning' };
  return { texte: `${jours} jours restants`, couleur: '#2e7d32', niveau: 'ok', banniere: null };
};

export const getAlerteChantier = (chantier) => {
  const { dateDebut, nombreJours, inclusSamedi = false } = chantier;
  const base = parseInt(nombreJours) || 0;
  const jours = joursOuvrableRestants(dateDebut, base, inclusSamedi);
  if (jours === null) return null;
  if (jours >= 0) return getAlerte(jours);
  const abs = Math.abs(jours);
  return { texte: `Retard ${abs} jour${abs > 1 ? 's' : ''}`, couleur: '#b71c1c', niveau: 'critique', banniere: 'danger' };
};

export const estRetardJustifie = (chantier) => false;

/**
 * Retourne le statut planning d'un chantier pour affichage sur les cartes.
 * @param {object} chantier
 * @returns {{ status: 'ok'|'warning'|'danger', label: string, delay: number, couleur: string }}
 *   - status  : 'ok' = à l'heure, 'warning' = retard justifié, 'danger' = retard réel
 *   - label   : texte du badge
 *   - delay   : jours de retard (0 si à l'heure)
 *   - couleur : couleur hex du badge
 *
 * Exemple :
 *   const ts = getChantierStatus(chantier);
 *   // → { status: 'warning', label: 'Retard justifié (+3j)', delay: 2, couleur: '#f59e0b' }
 *   <Badge texte={ts.label} couleur={ts.couleur} />
 */
export const getChantierStatus = (chantier) => {
  const { dateDebut, nombreJours, inclusSamedi = false } = chantier;
  const base = parseInt(nombreJours) || 0;
  if (!dateDebut || !base) return { status: 'ok', label: '–', delay: 0, couleur: '#6b7280' };
  const jours = joursOuvrableRestants(dateDebut, base, inclusSamedi);
  if (jours === null) return { status: 'ok', label: '–', delay: 0, couleur: '#6b7280' };
  if (jours >= 0) return { status: 'ok', label: 'À l\'heure', delay: 0, couleur: '#22c55e' };
  const abs = Math.abs(jours);
  return { status: 'danger', label: `Retard de ${abs}j`, delay: abs, couleur: '#ef4444' };
};

// ===== CALCULS FINANCIERS =====
/**
 * Retourne la somme des avenants d'un chantier.
 * Gère les deux formats : tableau [{ montant }] ou nombre (rétrocompatibilité).
 */
export const sommeAvenants = (chantier) =>
  Array.isArray(chantier.avenants)
    ? chantier.avenants.reduce((s, a) => s + (parseFloat(a.montant) || 0), 0)
    : (parseFloat(chantier.avenants) || 0);

/**
 * Construit une map { employeId: { isoDate: totalHeures } } depuis tous les journaux chantiers.
 * Utilisé par la page Heures pour construire le tableau hebdomadaire.
 */
export const getHeuresParEmployeParDate = (chantiers, employes = []) => {
  const map = {};
  employes.forEach(e => { map[e.id] = {}; });
  chantiers.forEach(c => {
    (c.journal || []).forEach(entry => {
      if (!entry.date) return;
      (entry.employes || []).forEach(ej => {
        const empId = ej.employeId;
        if (!map[empId]) map[empId] = {};
        if (!map[empId][entry.date]) map[empId][entry.date] = 0;
        map[empId][entry.date] += parseFloat(ej.heuresTravaillees) || 0;
      });
    });
  });
  return map;
};

/**
 * Retourne le CA généré par les heures en régie d'un devis.
 * Structure : devis.heuresRegie = [{ id, description, heures, tarifHeure }]
 * Les heures en régie sont du CA supplémentaire attaché au devis (pas au chantier).
 */
export const sommeHeuresRegie = (devis) =>
  Array.isArray(devis?.heuresRegie)
    ? devis.heuresRegie.reduce((s, r) => s + (parseFloat(r.heures) || 0) * (parseFloat(r.tarifHeure) || 0), 0)
    : 0;

/** Retourne true si le chantier est opérationnellement actif ("En cours"). */
export const isChantierActif = (c) => c?.statut?.trim().toLowerCase() === 'en cours';

/** Retourne true si le chantier doit être comptabilisé dans le CA (En cours + Planifié). */
export const isChantierComptable = (c) => ['en cours', 'planifié'].includes(c?.statut?.trim().toLowerCase());

/**
 * Chiffre d'affaires = montantHT du devis lié + avenants (devis) + avenants (chantier) + heures en régie (devis).
 * Retourne null si aucun devis lié — aucun fallback autorisé.
 *
 * Séparation claire :
 *   - avenants devis   → travaux supplémentaires négociés, documentés sur le devis
 *   - avenants chantier → ancienne structure (rétrocompat)
 *   - heuresRegie      → stockées sur le devis (heures facturées au temps passé)
 */
export const calculerCA = (chantier, devisList = []) => {
  if (!chantier.devisId) return null;
  const devisLie = devisList.find(d => String(d.id) === String(chantier.devisId));
  if (!devisLie) return null;
  const montantBase = parseFloat(devisLie.montantHT || devisLie.prixPropose) || 0;
  const avenantDevis = Array.isArray(devisLie.avenants)
    ? devisLie.avenants.reduce((s, a) => s + (parseFloat(a.montant) || 0), 0)
    : 0;
  return montantBase + avenantDevis + sommeAvenants(chantier) + sommeHeuresRegie(devisLie);
};

/**
 * Migration unique : corrige les chantiers dont devisId contient devis.numero au lieu de devis.id.
 * Retourne un nouveau tableau de chantiers avec les devisId corrigés.
 * Ne touche pas aux chantiers dont le devisId est déjà cohérent avec un devis.id.
 */
export const migrerDevisId = (chantiers, devisList) => {
  return chantiers.map(ch => {
    if (!ch.devisId) return ch;
    // Déjà cohérent par id → rien à faire
    const matchParId = devisList.find(d => String(d.id) === String(ch.devisId));
    if (matchParId) return ch;
    // Tenter de retrouver par numero
    const matchParNumero = devisList.find(d => String(d.numero) === String(ch.devisId));
    if (matchParNumero) {
      if (process.env.NODE_ENV !== 'production') console.log('[CYNA] Migration devisId: chantier', ch.id, '|', ch.devisId, '→', matchParNumero.id);
      return { ...ch, devisId: matchParNumero.id };
    }
    return ch;
  });
};

export const calculerCoutsChantier = (chantier, employes = [], localites = [], cfg = {}, devisList = []) => {
  const coefficient = parseFloat(cfg.coefficientMainOeuvre) || 1.35;
  const tauxFG = parseFloat(cfg.tauxFraisGeneraux) || 12;

  // Helper : tarif journalier chargé (applique le coefficient si tarif non déjà chargé)
  const getTarifJour = (emp) => {
    if (!emp) return 0;
    const tarif = parseFloat(emp.tarifJour) || 0;
    return emp.tarifDejaCharge ? tarif : tarif * coefficient;
  };

  // Helper : lit une valeur réelle sans fallback sur le prévu
  // Retourne null si la valeur n'est pas renseignée (absence = inconnue, pas = prévu)
  const _reel = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };

  const localite = localites.find(l => l.nom === chantier.ville);
  const tarifDeplacement = localite ? localite.tarifJour : 0;
  // Coût déplacement PRÉVU : basé sur les jours planifiés (nombreJours)
  const nbJours = parseInt(chantier.nombreJours || 0);
  const coutDeplacementPrevu = tarifDeplacement * nbJours;
  // Coût déplacement RÉEL : basé sur les jours uniques du journal (source de vérité)
  const joursReelsJournal = new Set((chantier.journal || []).map(e => e.date).filter(Boolean)).size;
  const coutDeplacementReel = tarifDeplacement * joursReelsJournal;
  // Alias rétrocompat — utilisé dans les exports (représente le réel si journal disponible, sinon prévu)
  const coutDeplacement = joursReelsJournal > 0 ? coutDeplacementReel : coutDeplacementPrevu;

  // Source unique : journal (heuresTravaillees) — aucun fallback
  const journalCouts = chantier.journal || [];

  const coutEquipePrevu = chantier.equipe?.reduce((total, membre) => {
    const emp = employes.find(e => String(e.id) === String(membre.employeId));
    return total + getTarifJour(emp) * parseFloat(membre.joursPlannifies || 0);
  }, 0) || 0;

  // Source unique : journal — tous les employés ayant des heures, sans nécessiter c.equipe
  const empIdsAvecHeures = [...new Set(
    journalCouts.flatMap(e => (e.employes || []).map(em => parseInt(em.employeId))).filter(Boolean)
  )];
  // Compléter avec les membres de l'équipe planifiée sans heures encore
  const empIdsEquipeSansHeures = (chantier.equipe || [])
    .map(m => parseInt(m.employeId))
    .filter(id => !empIdsAvecHeures.includes(id));
  const coutEquipeReelDetaille = [...empIdsAvecHeures, ...empIdsEquipeSansHeures].map(empId => {
    const emp = employes.find(e => e.id === empId);
    const joursReels = heuresEmploye(journalCouts, empId) / 8;
    const tarif = getTarifJour(emp);
    return { employeId: empId, joursReels, tarif, cout: tarif * joursReels };
  });
  const coutEquipeReel = coutEquipeReelDetaille.reduce((t, m) => t + m.cout, 0);

  const coutImprevus = chantier.imprevus?.reduce((t, imp) => t + (parseFloat(imp.montant) || 0), 0) || 0;
  const coutMaterielPrevu = parseFloat(chantier.coutMaterielPrevu) || 0;
  const coutSousTraitancePrevu = parseFloat(chantier.coutSousTraitancePrevu) || 0;
  const autresCoutsPrevu = parseFloat(chantier.autresCoutsPrevu) || 0;

  // P2 : coûts réels SANS fallback sur le prévu — null = non renseigné
  const coutMaterielReelRaw    = _reel(chantier.materielReel)       ?? _reel(chantier.coutMaterielReel);
  const coutSousTraitanceReelRaw = _reel(chantier.sousTraitanceReelle) ?? _reel(chantier.coutSousTraitanceReel);
  const autresCoutsReelRaw     = _reel(chantier.autresCoutsReels)   ?? _reel(chantier.autresCoutsReel);

  // Pour les calculs arithmétiques, null → 0 (valeur neutre)
  const coutMaterielReel    = coutMaterielReelRaw    ?? 0;
  const coutSousTraitanceReel = coutSousTraitanceReelRaw ?? 0;
  const autresCoutsReel     = autresCoutsReelRaw     ?? 0;

  // P8 : détection des champs non renseignés (coûts attendus mais absents)
  const hasEquipe = (chantier.equipe?.length || 0) > 0 || empIdsAvecHeures.length > 0;
  const equipeHasReel = coutEquipeReelDetaille.some(m => m.joursReels > 0);
  const champsManquants = [];
  if (hasEquipe && !equipeHasReel)                            champsManquants.push('Heures équipe');
  if (coutMaterielPrevu > 0    && coutMaterielReelRaw    === null) champsManquants.push('Matériel');
  if (coutSousTraitancePrevu > 0 && coutSousTraitanceReelRaw === null) champsManquants.push('Sous-traitance');
  if (autresCoutsPrevu > 0     && autresCoutsReelRaw     === null) champsManquants.push('Autres coûts');
  const donneesIncompletes = champsManquants.length > 0;

  // CA = null si aucun devis lié (source unique — aucun fallback)
  const montantTotal = calculerCA(chantier, devisList);
  const caDisponible = montantTotal !== null;

  const totalCoutsPrevu = coutEquipePrevu + coutMaterielPrevu + coutSousTraitancePrevu + coutDeplacementPrevu + autresCoutsPrevu;
  const totalCoutsReel = coutEquipeReel + coutMaterielReel + coutSousTraitanceReel + coutDeplacementReel + coutImprevus + autresCoutsReel;

  const margePrevu = caDisponible ? montantTotal - totalCoutsPrevu : null;
  const margeReel = caDisponible ? montantTotal - totalCoutsReel : null;
  const margePrevuPct = (caDisponible && montantTotal > 0) ? Math.round((margePrevu / montantTotal) * 1000) / 10 : null;
  const margeReelPct  = (caDisponible && montantTotal > 0) ? Math.round((margeReel  / montantTotal) * 1000) / 10 : null;

  // P7 : coût/m² uniquement si surface renseignée
  const surface = parseFloat(chantier.surface) || 0;
  const coutParM2Prevu = surface > 0 ? Math.round((totalCoutsPrevu / surface) * 100) / 100 : null;
  const coutParM2Reel  = surface > 0 ? Math.round((totalCoutsReel  / surface) * 100) / 100 : null;
  const prixParM2Devis = (caDisponible && surface > 0) ? Math.round((montantTotal / surface) * 100) / 100 : null;

  const ecartMontant = caDisponible ? montantTotal - totalCoutsReel : null;
  const ecartPct = (caDisponible && montantTotal > 0) ? Math.round(((montantTotal - totalCoutsReel) / montantTotal) * 1000) / 10 : null;

  // Frais généraux & marge nette
  const fraisGeneraux = caDisponible ? montantTotal * (tauxFG / 100) : 0;
  const margeNette = (caDisponible && margeReel !== null) ? margeReel - fraisGeneraux : null;
  const margeNettePct = (caDisponible && montantTotal > 0 && margeNette !== null) ? Math.round((margeNette / montantTotal) * 1000) / 10 : null;

  // P4 : deux valeurs distinctes
  // budgetRestant = ce qui reste dans l'enveloppe budgétaire
  const budgetRestant = totalCoutsPrevu - totalCoutsReel;
  // rad = estimation du coût pour finir à ce rythme (RAD réel métier BTP)
  // = (coutReel / avancement%) × (100 - avancement%)
  // Source avancement : journal si des jours sont saisis (cohérent avec calculerEtatChantier),
  // sinon fallback sur la valeur manuelle (chantier non démarré).
  const joursReelsPourAv = new Set(journalCouts.map(e => e.date).filter(Boolean)).size;
  const avancementJournal = nbJours > 0 && joursReelsPourAv > 0
    ? Math.min(100, Math.round((joursReelsPourAv / nbJours) * 100))
    : 0;
  const statutLower = (chantier.statut || '').trim().toLowerCase();
  const avancement = ['terminé', 'termine', 'clôturé', 'cloture', 'facturé', 'facture'].includes(statutLower)
    ? 100
    : (avancementJournal || parseFloat(chantier.avancement) || 0);
  const rad = (avancement > 0 && totalCoutsReel > 0)
    ? (totalCoutsReel / avancement) * (100 - avancement)
    : null;

  // ── Alerte rythme de dépense (dérive précoce) ──────────────────
  // ratioEfficacite = (avancement%) / (% budget consommé)
  // < 1 = on dépense plus vite qu'on n'avance
  const ratioEfficacite = (avancement > 10 && totalCoutsPrevu > 0 && totalCoutsReel > 0)
    ? (avancement / 100) / (totalCoutsReel / totalCoutsPrevu)
    : null;
  const alerteRythmeRouge  = ratioEfficacite !== null && ratioEfficacite < 0.70;
  const alerteRythmeOrange = ratioEfficacite !== null && ratioEfficacite >= 0.70 && ratioEfficacite < 0.85;

  // ── Projection à terminaison (EAC) ──────────────────────────────
  // projectionCalculable : on a les données minimales pour calculer
  const projectionCalculable = caDisponible && avancement > 0 && totalCoutsReel > 0 && montantTotal > 0;
  // projectionFiable : les données sont complètes — sinon la projection est invalide
  const projectionFiable = projectionCalculable && !donneesIncompletes;

  // Coût final estimé si on continue au même rythme
  const coutFinalEstime = projectionFiable
    ? totalCoutsReel / (avancement / 100)
    : null;

  // Marge finale estimée brute (%)
  const margeFinaleEstimeePct = (coutFinalEstime !== null && montantTotal > 0)
    ? Math.round((montantTotal - coutFinalEstime) / montantTotal * 1000) / 10
    : null;

  // Marge finale estimée nette — frais généraux déduits du CA (formule correcte)
  const margeFinaleNettePct = (margeFinaleEstimeePct !== null && montantTotal > 0)
    ? Math.round((margeFinaleEstimeePct - tauxFG) * 10) / 10
    : null;

  // Dérive projetée (positif = perte, négatif = gain)
  const deriveProjetee = (caDisponible && coutFinalEstime !== null)
    ? coutFinalEstime - montantTotal
    : null;

  // Alerte critique : perte probable ou marge finale nette sous 10%
  const alerteDerive = coutFinalEstime !== null
    && (deriveProjetee > 0 || (margeFinaleNettePct !== null ? margeFinaleNettePct < 10 : margeFinaleEstimeePct < 10));

  // Écarts par poste (réel − prévu), positif = dépassement
  const ecartEquipe = coutEquipeReel - coutEquipePrevu;
  const ecartEquipePct = coutEquipePrevu > 0 ? Math.round(((coutEquipeReel - coutEquipePrevu) / coutEquipePrevu) * 1000) / 10 : 0;
  const ecartMateriel = coutMaterielReel - coutMaterielPrevu;
  const ecartMaterielPct = coutMaterielPrevu > 0 ? Math.round(((coutMaterielReel - coutMaterielPrevu) / coutMaterielPrevu) * 1000) / 10 : 0;
  const ecartSousTraitance = coutSousTraitanceReel - coutSousTraitancePrevu;
  const ecartSousTraitancePct = coutSousTraitancePrevu > 0 ? Math.round(((coutSousTraitanceReel - coutSousTraitancePrevu) / coutSousTraitancePrevu) * 1000) / 10 : 0;
  const ecartAutres = autresCoutsReel - autresCoutsPrevu;
  const ecartAutresPct = autresCoutsPrevu > 0 ? Math.round(((autresCoutsReel - autresCoutsPrevu) / autresCoutsPrevu) * 1000) / 10 : 0;

  // Alertes dépassement budget
  const depassementBudget = totalCoutsReel > totalCoutsPrevu && totalCoutsPrevu > 0;
  // P6 : alerte orange seulement si chantier réellement démarré (avancement > 10%)
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
    margePrevuPct, margeReelPct,
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
  };
};

// ===== STATUT RENTABILITÉ =====
export const statutRentabilite = (margeReelPct) => {
  const v = parseFloat(margeReelPct) || 0;
  if (v >= SEUILS.margeRentable) return { label: 'Rentable',      couleur: '#10b981' };
  if (v >= SEUILS.margeLimite)   return { label: 'Limite',         couleur: '#f59e0b' };
  return                                 { label: 'Non rentable',    couleur: '#ef4444' };
};

// ===== CALCUL DEVIS =====
export const calculerDevis = (form, parametres) => {
  const surface = parseFloat(form.surface) || 0;
  const typeT = parametres.typesTravaux.find(t => t.nom === form.typeTravaux);
  const zone = parametres.zones.find(z => z.nom === form.zone);
  
  if (!typeT || !zone || surface === 0) return null;

  const tarifBase = zone.tarifs[form.typeTravaux] || typeT.tarifBase;
  
  // Ajustements
  let multiplicateur = 1;
  if (form.complexite === 'Élevée') multiplicateur += 0.20;
  if (form.complexite === 'Très élevée') multiplicateur += 0.35;
  if (form.urgence === 'Oui') multiplicateur += 0.15;
  if (form.acces === 'Difficile') multiplicateur += 0.10;
  if (form.acces === 'Très difficile') multiplicateur += 0.20;

  const prixPoseM2 = tarifBase * multiplicateur;
  const coutPose = prixPoseM2 * surface;
  const coutMateriel = parseFloat(form.coutMateriel) || 0;
  const coutTransport = parseFloat(form.coutTransport) || 0;
  const coutSousTraitance = parseFloat(form.coutSousTraitance) || 0;
  const coutDirect = coutPose + coutMateriel + coutTransport + coutSousTraitance;
  const totalRevient = coutDirect * (1 + (parseFloat(parametres.tauxFraisGeneraux) || 12) / 100);

  const margeCible  = parseFloat(form.margeCible || parametres.margeCible) / 100;
  const margeMin    = parseFloat(parametres.seuilRentabiliteMin) / 100;
  const margeExtra  = parseFloat(parametres.plafondCredi) / 100;

  // Règles métier — prix = coût / (1 - marge%) — mark-up sur vente (BTP suisse)
  // prixMinRentable utilise toujours margeMin (jamais margeCible) — plancher absolu
  const prixMinRentable = (margeMin >= 0 && margeMin < 1) ? totalRevient / (1 - margeMin) : totalRevient;
  const prixConseille   = (margeCible >= 0 && margeCible < 1) ? totalRevient / (1 - margeCible) : totalRevient;
  const prixPlafond     = totalRevient * (1 + margeCible + margeExtra);
  const prixPropose = parseFloat(form.prixPropose) || prixConseille;
  const margeEstimee = prixPropose - totalRevient;
  const tauxMarge = prixPropose > 0 ? Math.round((margeEstimee / prixPropose) * 1000) / 10 : 0;

  let positionnement = 'Marché';
  let niveauRisque = 'Faible';
  if (prixPropose < prixMinRentable) { positionnement = 'Dangereux'; niveauRisque = 'Critique'; }
  else if (prixPropose < prixConseille * 0.95) { positionnement = 'Agressif'; niveauRisque = 'Élevé'; }
  else if (prixPropose > prixPlafond) { positionnement = 'Excessif'; niveauRisque = 'Commercial'; }
  else if (prixPropose > prixConseille * 1.15) { positionnement = 'Premium'; niveauRisque = 'Faible'; }

  return {
    surface, tarifBase, prixPoseM2, coutPose, coutMateriel,
    coutTransport, coutSousTraitance, coutDirect,
    totalRevient, prixMinRentable, prixConseille,
    prixPlafond, prixPropose, margeEstimee,
    tauxMarge, positionnement, niveauRisque,
  };
};

/**
 * Calcul devis client (mode réel — devis signé).
 * coutMO : coût main d'œuvre (optionnel, passé par l'appelant depuis calculerCoutsChantier si disponible).
 * Formules : coûtTotal = coutMO + mat + transp + ST, marge = CA − coûtTotal, marge% = marge / CA × 100
 */
export const calculerDevisClient = (devis, coutMO = 0) => {
  const chiffreAffaires   = parseFloat(devis.montantHT || devis.prixPropose) || 0;
  const coutMainOeuvre    = parseFloat(coutMO)                  || 0;
  const coutMateriel      = parseFloat(devis.coutMateriel)      || 0;
  const coutTransport     = parseFloat(devis.coutTransport)     || 0;
  const coutSousTraitance = parseFloat(devis.coutSousTraitance) || 0;
  const coutTotal         = coutMainOeuvre + coutMateriel + coutTransport + coutSousTraitance;
  const marge             = chiffreAffaires - coutTotal;
  const margePct          = chiffreAffaires > 0 ? Math.round((marge / chiffreAffaires) * 1000) / 10 : 0;
  return { chiffreAffaires, coutMainOeuvre, coutMateriel, coutTransport, coutSousTraitance, coutTotal, marge, margePct };
};

// ===== C =====
export const C = {
  primaire:   '#0d3d6e',  // CYNA brand blue
  secondaire: '#10b981',  // emerald-500
  danger:     '#ef4444',  // red-500
  warning:    '#f59e0b',  // amber-500
  info:       '#0d3d6e',  // same as primaire
  violet:     '#6366f1',  // indigo-500
  orange:     '#f97316',  // orange-500
  cyan:       '#06b6d4',  // cyan-500 (Technicien)
  mauve:      '#a855f7',  // purple-500 (Comptable)
  gris:       '#f8fafc',
  blanc:      '#ffffff',
};

// ===== RENTABILITÉ PAR JOURS (sans dates) =====

/**
 * Retourne le nombre de jours restants basé uniquement sur les jours saisis,
 * sans utiliser les dates calendaires.
 * Positif = chantier en avance, Négatif = chantier en dépassement.
 */
export const calculerJoursRestants = (chantier) => {
  const joursPrevu    = parseInt(chantier.nombreJours) || 0;
  const joursRealises = new Set((chantier.journal || []).map(e => e.date).filter(Boolean)).size;
  return joursPrevu - joursRealises;
};

/**
 * Calcule le coût réel par membre d'équipe (tarifJour × joursRealises du membre)
 * et retourne la répartition en % du coût équipe total.
 */
export const calculerRentabiliteEquipe = (chantier, parametres) => {
  const employes = parametres?.employes || [];
  const coefficient = parseFloat(parametres?.parametres?.coefficientMainOeuvre) || 1.35;
  // Source unique : journal (heuresTravaillees) — aucun fallback
  const journalEq = chantier.journal || [];
  const getJoursReelsEq = (m) => heuresEmploye(journalEq, parseInt(m.employeId)) / 8;
  const membres = (chantier.equipe || []).map(m => {
    const emp = employes.find(e => e.id === parseInt(m.employeId));
    const joursReels = getJoursReelsEq(m);
    const tarifJourBrut = emp?.tarifJour || 0;
    const tarifJour = emp?.tarifDejaCharge ? tarifJourBrut : tarifJourBrut * coefficient;
    const coutTotal = tarifJour * joursReels;
    return {
      employeId: m.employeId,
      nom: emp?.nom || 'Inconnu',
      poste: emp?.poste || m.role || '—',
      tarifJour,
      joursRealises: joursReels,
      coutTotal,
    };
  });

  const coutTotalEquipe = membres.reduce((s, m) => s + m.coutTotal, 0);
  const nbAvecReel = membres.filter(m => m.joursRealises > 0).length;
  const hasReel = nbAvecReel > 0;
  const allReel = membres.length > 0 && nbAvecReel === membres.length;

  return {
    membres: membres.map(m => ({
      ...m,
      partPct: coutTotalEquipe > 0
        ? Math.round((m.coutTotal / coutTotalEquipe) * 1000) / 10
        : 0,
    })),
    coutTotalEquipe,
    hasReel,
    allReel,
  };
};

/**
 * Compare les jours prévus (devis) aux jours réalisés (réel) et retourne l'écart.
 * ecartJours > 0 = dépassement (rouge), < 0 = en avance (vert), = 0 = parfait.
 */
export const calculerEcartChantier = (chantier) => {
  const joursPrevu    = parseInt(chantier.nombreJours) || 0;
  const joursRealises = new Set((chantier.journal || []).map(e => e.date).filter(Boolean)).size;
  const ecartJours    = joursRealises - joursPrevu;
  const ecartPct      = joursPrevu > 0
    ? Math.round((ecartJours / joursPrevu) * 1000) / 10
    : null;
  const statut = joursRealises === 0
    ? 'non_saisi'
    : ecartJours > 0 ? 'en_retard'
    : ecartJours < 0 ? 'en_avance'
    : 'ok';
  return { joursPrevu, joursRealises, ecartJours, ecartPct, statut };
};

/**
 * Calcule la rentabilité réelle d'un chantier à partir des jours réalisés
 * et du coût journalier de l'équipe (sans utiliser les dates).
 *
 * Logique :
 *   coût MO réel = joursRealises × (somme des tarifJour de tous les membres)
 *   rentabilité  = montantDevis - (coût MO réel + autres coûts réels)
 */
export const calculerRentabiliteReelle = (chantier, parametres, devisList = []) => {
  // ── Source unique : calculerEtatChantier ─────────────────────────────────
  const employes = parametres?.employes || [];
  const etat = calculerEtatChantier(chantier, employes, devisList, parametres?.parametres || parametres);

  const joursPrevu    = parseInt(chantier.nombreJours) || 0;
  const joursRealises = etat.totalJoursReels;
  const joursRestants = joursPrevu - joursRealises;
  const joursCalendaireRestants = joursOuvrableRestants(chantier.dateDebut, joursPrevu, chantier.inclusSamedi);
  const enDepassement = joursCalendaireRestants !== null && joursCalendaireRestants < 0;
  const enAvance      = false; // "avance" calendaire n'existe pas — travailler moins que prévu = travail restant
  const aucuneSaisie  = joursRealises === 0;

  const coutMOReel   = etat.coutMOReel;
  const autresCouts  = etat.coutMateriel + etat.coutSousTraitance + etat.coutAutres + etat.coutImprevus;
  const caTotal      = etat.devisTotal; // null si aucun devis lié
  const totalCoutsReel = etat.coutTotalReel;
  const caDisponible = caTotal !== null;

  const rentabilite    = caDisponible ? caTotal - totalCoutsReel : null;
  const rentabilitePct = (caDisponible && caTotal > 0) ? (rentabilite / caTotal) * 100 : null;

  // Coût MO prévisionnel (somme tarifJour × joursPrévus par membre, chargé du coefficient)
  const coutMOPrevu = (chantier.equipe || []).reduce((total, membre) => {
    const emp = employes.find(e => String(e.id) === String(membre.employeId));
    const coeff = emp?.tarifDejaCharge ? 1 : (parseFloat(parametres?.parametres?.coefficientMainOeuvre) || parseFloat(parametres?.coefficientMainOeuvre) || 1.35);
    return total + (parseFloat(emp?.tarifJour) || 0) * coeff * (parseFloat(membre.joursPlannifies) || 0);
  }, 0);

  const rentabiliteProjetee = (caDisponible && joursRealises > 0)
    ? caTotal - (coutMOPrevu + autresCouts)
    : null;
  const rentabiliteProjetee_Pct = (rentabiliteProjetee !== null && caTotal > 0)
    ? Math.round((rentabiliteProjetee / caTotal) * 1000) / 10
    : null;

  return {
    joursPrevu,
    joursRealises,
    joursRestants,
    enDepassement,
    enAvance,
    aucuneSaisie,
    coutMOPrevu,
    coutMOReel,
    autresCouts,
    montantDevis: caTotal,       // null si aucun devis
    totalCoutsReel: Math.round(totalCoutsReel),
    rentabilite: rentabilite !== null ? Math.round(rentabilite) : null,
    rentabilitePct: rentabilitePct !== null ? Math.round(rentabilitePct * 10) / 10 : null,
    rentabiliteProjetee: rentabiliteProjetee !== null ? Math.round(rentabiliteProjetee) : null,
    rentabiliteProjetee_Pct,
  };
};

// ===== FILTRE PÉRIODE GLOBALE =====
export const getIntervallesPeriode = (periode) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (periode === 'semaine') {
    const jourSemaine = today.getDay(); // 0=dim, 1=lun...
    const diffVersLundi = jourSemaine === 0 ? -6 : 1 - jourSemaine;
    const debut = new Date(today);
    debut.setDate(today.getDate() + diffVersLundi);
    // Fin = samedi (inclus pour chantiers travaillant le samedi), sinon vendredi
    const fin = new Date(debut);
    fin.setDate(debut.getDate() + 5); // Lundi + 5 = Samedi
    return { debut, fin };
  }
  if (periode === 'mois') {
    const debut = new Date(today.getFullYear(), today.getMonth(), 1);
    const fin = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { debut, fin };
  }
  // 'annee'
  const debut = new Date(today.getFullYear(), 0, 1);
  const fin = new Date(today.getFullYear(), 11, 31);
  return { debut, fin };
};

export const getPeriodeLabel = (periode) => {
  const today = new Date();
  if (periode === 'semaine') {
    const jourSemaine = today.getDay();
    const diffVersLundi = jourSemaine === 0 ? -6 : 1 - jourSemaine;
    const lundi = new Date(today);
    lundi.setDate(today.getDate() + diffVersLundi);
    const vendredi = new Date(lundi);
    vendredi.setDate(lundi.getDate() + 4);
    const fmt = (d) => d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' });
    return `Semaine du ${fmt(lundi)} au ${fmt(vendredi)}`;
  }
  if (periode === 'mois') {
    return today.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
  }
  return `Année ${today.getFullYear()}`;
};

// Retourne vrai si le chantier a des jours ouvrables dans la période [debut, fin]
export const chantiersInPeriode = (chantier, debut, fin) => {
  if (!chantier.dateDebut) {
    // Chantier sans date planifiée : inclure si statut actif (ne peut pas être daté autrement)
    const s = (chantier.statut || '').trim().toLowerCase();
    return ['en cours', 'planifié'].includes(s);
  }
  const debutChantier = new Date(chantier.dateDebut);
  const finStr = calculerDateFinOuvrables(chantier.dateDebut, chantier.nombreJours, chantier.inclusSamedi);
  const finChantier = finStr && finStr !== '-' ? new Date(finStr) : new Date(debutChantier);
  // Chevauchement : le chantier commence avant la fin de la période ET se termine après le début
  return debutChantier <= fin && finChantier >= debut;
};

// Retourne vrai si la facture a été émise dans la période [debut, fin]
export const facturesInPeriode = (facture, debut, fin) => {
  const dateStr = facture.dateEmission || facture.creeLe;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d >= debut && d <= fin;
};

// ===== FACTURES — UTILITAIRES =====

export const genererNumeroFacture = (factures, prefix = 'F') => {
  const annee = new Date().getFullYear();
  const debutAnnee = `${prefix}-${annee}-`;
  const existants = (factures || [])
    .map(f => f.numero || '')
    .filter(n => n.startsWith(debutAnnee))
    .map(n => parseInt(n.slice(debutAnnee.length)) || 0);
  const seq = existants.length > 0 ? existants.reduce((a, b) => a > b ? a : b, 0) + 1 : 1;
  return `${prefix}-${annee}-${String(seq).padStart(3, '0')}`;
};

export const calculerStatutFacture = (facture) => {
  if (facture.statut === 'annulee' || facture.statut === 'brouillon') return facture.statut;
  const total = parseFloat(facture.montantTTC) || 0;
  // Prendre le maximum entre paiementsHistorique et montantPaye (champ direct)
  const payeHistorique = (facture.paiementsHistorique || []).reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
  const totalPaye = Math.max(payeHistorique, parseFloat(facture.montantPaye) || 0);
  if (totalPaye >= total - 0.01 && total > 0) return 'payee';
  if (totalPaye > 0) return 'partielle';
  // Respecter le statut 'payee' positionné manuellement même si montantPaye non renseigné
  if (facture.statut === 'payee') return 'payee';
  if (facture.dateEcheance) {
    const ech = new Date(facture.dateEcheance);
    if (!isNaN(ech.getTime()) && ech < new Date()) return 'retard';
  }
  return facture.statut || 'envoyee';
};

export const creerFactureDepuisDevis = (devis, chantier, factures, tva = 8.1) => {
  // Si le devis a déjà des lignes avec TVA, on les propage telles quelles
  let lignes;
  if (Array.isArray(devis.lignes) && devis.lignes.length > 0) {
    lignes = devis.lignes.map(l => ({
      description: l.description || '',
      quantite: parseFloat(l.quantite) || 0,
      prixUnitaire: parseFloat(l.prixUnitaire) || 0,
      tva: parseFloat(l.tva) >= 0 ? parseFloat(l.tva) : tva,
    }));
  } else {
    const montantBase = parseFloat(devis.montantHT || devis.prixPropose) || 0;
    lignes = [
      { description: `Travaux selon devis ${devis.numero}`, quantite: 1, prixUnitaire: montantBase, tva },
      ...(Array.isArray(devis.avenants) ? devis.avenants
        .filter(a => parseFloat(a.montant) > 0)
        .map(a => ({ description: a.description || 'Avenant', quantite: 1, prixUnitaire: parseFloat(a.montant) || 0, tva }))
        : []),
      ...(Array.isArray(devis.heuresRegie) ? devis.heuresRegie
        .filter(r => parseFloat(r.heures) > 0)
        .map(r => ({ description: r.description || 'Heures en régie', quantite: parseFloat(r.heures) || 0, prixUnitaire: parseFloat(r.tarifHeure) || 0, tva }))
        : []),
    ];
  }

  const totalHT = lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prixUnitaire) || 0), 0);
  const montantTVA = lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prixUnitaire) || 0) * (parseFloat(l.tva) || 0) / 100, 0);
  const echeance = new Date();
  echeance.setDate(echeance.getDate() + 30);

  return {
    id: `fact_${Date.now()}`,
    numero: genererNumeroFacture(factures),
    clientId: devis.clientId,
    chantierId: chantier ? chantier.id : '',
    devisId: devis.id,
    type: 'standard',
    source: 'devis',
    statut: 'brouillon',
    dateEmission: new Date().toISOString().slice(0, 10),
    dateEcheance: echeance.toISOString().slice(0, 10),
    objet: `Travaux ${devis.numero}`,
    lignes,
    montantHT: totalHT,
    montantTVA,
    montantTTC: totalHT + montantTVA,
    montantPaye: 0,
    paiementsHistorique: [],
    notes: '',
    creeLe: new Date().toISOString(),
  };
};

// ===== DONNÉES INITIALES — issues des données de démonstration complètes =====
// donneesDemo contient 10 employés, 6 clients, 9 devis, 7 chantiers avec journals, 7 factures
export const donneesInitiales = donneesDemo;

// =============================================
// MOTEUR MÉTIER CYNA — SOURCE UNIQUE DE VÉRITÉ
// =============================================
//
// calculerEtatChantier(chantier, employes)
//
// Format journal (unique) :
//   { date: string, employeId: number, heuresTravaillees: number }
//
// Règles absolues :
//   - joursPlannifies n'entre JAMAIS dans un calcul réel
//   - Si aucune heure saisie → coût = 0, pas d'estimation
//   - Projection bloquée si avancement < 20%
// =============================================

/**
 * Migre un journal vers le format groupé : { date, employes: [{ employeId, heuresTravaillees }] }
 * Gère 3 formats sources :
 *   - Déjà groupé  : { date, employes: [...] }
 *   - Plat         : { date, employeId, heuresTravaillees }
 *   - Ancienne présence : { date, employesPresents: [id, ...] }
 * Appeler une seule fois au chargement des données.
 */
export const migrerJournal = (journal) => {
  if (!Array.isArray(journal)) return [];
  const parDate = {};
  const merge = (date, empId, heures) => {
    if (!parDate[date]) parDate[date] = {};
    parDate[date][empId] = (parDate[date][empId] || 0) + heures;
  };
  for (const entry of journal) {
    if (Array.isArray(entry.employes)) {
      // Déjà groupé
      for (const e of entry.employes) merge(entry.date, parseInt(e.employeId), parseFloat(e.heuresTravaillees) || 0);
    } else if (entry.employeId != null) {
      // Format plat
      merge(entry.date, parseInt(entry.employeId), parseFloat(entry.heuresTravaillees) || 0);
    } else if (Array.isArray(entry.employesPresents)) {
      // Ancienne présence → 8h par défaut
      for (const id of entry.employesPresents) merge(entry.date, parseInt(id), 8);
    }
  }
  return Object.entries(parDate).map(([date, emps]) => ({
    date,
    employes: Object.entries(emps).map(([empId, h]) => ({ employeId: parseInt(empId), heuresTravaillees: h })),
  }));
};

/**
 * Retourne les heures totales d'un employé depuis le journal (format groupé).
 * Aucun fallback — si aucune entrée, retourne 0.
 */
export const heuresEmploye = (journal, empId) => {
  let heures = 0;
  for (const entry of journal) {
    const e = (entry.employes || []).find(e => parseInt(e.employeId) === empId);
    if (e) heures += parseFloat(e.heuresTravaillees) || 0;
  }
  return heures;
};

/**
 * Retourne { [employeId]: heures } pour une date donnée.
 * Utilisé pour pré-remplir le panneau de saisie.
 */
export const heuresJour = (journal, date) => {
  const entry = journal.find(e => e.date === date);
  if (!entry) return {};
  const result = {};
  for (const e of (entry.employes || [])) result[parseInt(e.employeId)] = parseFloat(e.heuresTravaillees) || 0;
  return result;
};

export const calculerEtatChantier = (chantier, employes = [], devisList = [], parametres = null) => {
  const equipe     = chantier.equipe     || [];
  const journal    = chantier.journal    || [];
  const imprevus   = chantier.imprevus   || [];
  // CA = devis accepté lié (montantHT) + avenants. Si aucun devis : CA = 0.
  const devisTotal = calculerCA(chantier, devisList);

  // Coefficient charges sociales employeur (règle BTP Suisse : défaut 1.35 = +35%)
  const coefficientMO = parseFloat(parametres?.coefficientMainOeuvre) || 1.35;

  // ── A. Jours réels par employé (source : journal uniquement) ──────────
  // Tous les employés ayant des heures dans le journal — sans nécessiter c.equipe
  const empIdsJournal = [...new Set(
    journal.flatMap(e => (e.employes || []).map(em => parseInt(em.employeId))).filter(Boolean)
  )];
  // Compléter avec les membres de l'équipe planifiée (joursPrevus) qui n'ont pas encore d'heures
  const empIdsEquipe = equipe.map(m => parseInt(m.employeId)).filter(id => !empIdsJournal.includes(id));
  const tousEmpIds = [...empIdsJournal, ...empIdsEquipe];

  const membreDetail = tousEmpIds.map(empId => {
    const emp     = employes.find(e => e.id === empId);
    // Règle BTP : appliquer le coefficient MO si le tarif n'est pas déjà chargé
    const coeff = emp?.tarifDejaCharge ? 1 : coefficientMO;
    const tarifJour  = (parseFloat(emp?.tarifJour) || 0) * coeff;
    const tarifHeure = tarifJour / 8;  // dérivé — 8h/jour convention BTP

    // Heures réelles depuis le journal (format unique — aucun fallback)
    const heuresReelles = heuresEmploye(journal, empId);
    const joursReels    = heuresReelles / 8;

    // Jours prévus depuis c.equipe si disponible
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

  // ── B. Totaux temps ───────────────────────────────────────────────────
  // Règle métier : les jours chantier sont à la granularité CHANTIER, pas employé.
  // 3 employés pendant 15 jours = 15 jours chantier (pas 45).
  const totalJoursPrevus   = parseInt(chantier.nombreJours) || 0;
  const totalJoursReels    = new Set(journal.map(e => e.date).filter(Boolean)).size;
  // Heures : somme réelle des saisies par employé (base des coûts MO)
  const totalHeuresPrevues = membreDetail.reduce((s, m) => s + m.heuresPrevues, 0);
  const totalHeuresReelles = membreDetail.reduce((s, m) => s + m.heuresReelles, 0);

  // ── C. Avancement (0–100, calculé, jamais saisi) ──────────────────────
  const _statutChantierLower = (chantier.statut || '').trim().toLowerCase();
  const _chantiClos = ['terminé', 'termine', 'clôturé', 'cloture', 'facturé', 'facture'].includes(_statutChantierLower);
  const avancementPct = _chantiClos
    ? 100
    : totalJoursPrevus === 0
      ? 0
      : Math.min(100, Math.round((totalJoursReels / totalJoursPrevus) * 100));

  // ── D. Dérive temps ───────────────────────────────────────────────────
  const deriveJours = totalJoursReels - totalJoursPrevus;
  // positif = retard, négatif = avance

  // ── E. Coût main d'œuvre réelle ───────────────────────────────────────
  const coutMOReel = membreDetail.reduce((s, m) => s + m.cout, 0);

  // ── F. Coût total réel ────────────────────────────────────────────────
  // Fallback sur les anciens noms de champs pour rétrocompatibilité
  const coutMateriel      = parseFloat(chantier.materielReel)          || parseFloat(chantier.coutMaterielReel)      || 0;
  const coutSousTraitance = parseFloat(chantier.sousTraitanceReelle)   || parseFloat(chantier.coutSousTraitanceReel) || 0;
  const coutAutres        = parseFloat(chantier.autresCoutsReels)      || parseFloat(chantier.autresCoutsReel)       || 0;
  const coutImprevus     = imprevus.reduce(
    (s, imp) => s + (parseFloat(imp.montant) || 0), 0
  );

  const coutTotalReel = coutMOReel + coutMateriel + coutSousTraitance
                      + coutAutres + coutImprevus;

  // ── G. Projection (disponible uniquement si avancement >= 20%) ────────
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

  const margeEstimeePct = (projectionDisponible && devisTotal !== null && devisTotal > 0)
    ? Math.round((margeEstimee / devisTotal) * 1000) / 10
    : null;

  // ── Résultat ──────────────────────────────────────────────────────────
  return {
    // Temps (jours — pour planning/affichage)
    totalJoursPrevus,
    totalJoursReels,
    // Temps (heures — pour calculs financiers, convention 8h/j)
    totalHeuresPrevues,
    totalHeuresReelles,
    avancementPct,
    deriveJours,

    // Coûts
    coutMOReel,
    coutMateriel,
    coutSousTraitance,
    coutAutres,
    coutImprevus,
    coutTotalReel,

    // CA (source unique : devis accepté lié — null si aucun devis)
    devisTotal,

    // Projection (null si non disponible)
    projectionDisponible,
    coutFinalEstime,
    rad,
    margeEstimee,
    margeEstimeePct,

    // Détail équipe
    equipe: membreDetail,
  };
};

// =============================================
// VALIDATION MOTEUR — PROTECTION ANTI-ANOMALIE
// =============================================
//
// assertEtatValide(etat)
//
// Vérifie que le résultat du moteur est cohérent
// avant affichage UI. Logue une erreur claire si
// une valeur critique est absente ou incohérente.
//
// Usage : appeler immédiatement après calculerEtatChantier
// =============================================

export const assertEtatValide = (etat) => {
  if (!etat) {
    if (process.env.NODE_ENV !== 'production') console.error('[CYNA] assertEtatValide : etat est null ou undefined');
    return false;
  }

  const erreurs = [];

  // Vérifications numériques — NaN interdit
  const numeriques = [
    'totalJoursPrevus', 'totalJoursReels', 'avancementPct', 'deriveJours',
    'coutMOReel', 'coutTotalReel',
  ];
  for (const champ of numeriques) {
    if (typeof etat[champ] !== 'number' || isNaN(etat[champ])) {
      erreurs.push(`${champ} invalide : ${etat[champ]}`);
    }
  }

  // Avancement entre 0 et 100
  if (etat.avancementPct < 0 || etat.avancementPct > 100) {
    erreurs.push(`avancementPct hors limites : ${etat.avancementPct}`);
  }

  // Coûts non négatifs
  if (etat.coutMOReel < 0) erreurs.push(`coutMOReel négatif : ${etat.coutMOReel}`);
  if (etat.coutTotalReel < 0) erreurs.push(`coutTotalReel négatif : ${etat.coutTotalReel}`);

  // Cohérence : coutMOReel <= coutTotalReel
  if (etat.coutMOReel > etat.coutTotalReel + 1) {
    erreurs.push(`coutMOReel (${etat.coutMOReel}) > coutTotalReel (${etat.coutTotalReel})`);
  }

  // Projection : si disponible, coutFinalEstime doit être un nombre
  if (etat.projectionDisponible && (etat.coutFinalEstime === null || isNaN(etat.coutFinalEstime))) {
    erreurs.push(`projectionDisponible=true mais coutFinalEstime invalide : ${etat.coutFinalEstime}`);
  }

  // Si projection non disponible, les valeurs doivent être null
  if (!etat.projectionDisponible && etat.coutFinalEstime !== null) {
    erreurs.push(`projectionDisponible=false mais coutFinalEstime n'est pas null`);
  }

  // Équipe : tableau attendu
  if (!Array.isArray(etat.equipe)) {
    erreurs.push(`equipe n'est pas un tableau`);
  }

  if (erreurs.length > 0) {
    if (process.env.NODE_ENV !== 'production') console.error('[CYNA] assertEtatValide — anomalies détectées :', erreurs);
    return false;
  }

  return true;
};

// ===== COHÉRENCE MÉTIER =====
// Retourne { ok, critique: string[], warnings: string[] }
// ok=false si au moins une erreur CRITIQUE (données inexploitables → fallback UI)
// warnings = incohérences mineures (console.warn uniquement)
export const assertEtatCoherent = (etat) => {
  if (!etat) return { ok: false, critique: ['etat null'], warnings: [] };

  const critique = [];
  const warnings = [];
  const isProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

  // ── CRITIQUES — données inexploitables ──────────────────────────
  if (typeof etat.avancementPct !== 'number' || isNaN(etat.avancementPct) || etat.avancementPct < 0 || etat.avancementPct > 100)
    critique.push(`avancementPct invalide: ${etat.avancementPct}`);
  if (etat.coutTotalReel < 0)
    critique.push(`coutTotalReel négatif: ${etat.coutTotalReel}`);
  // Ne pas signaler si aucune heure saisie — normal pour un chantier planifié non démarré
  if (etat.deriveJours !== 0 && etat.totalJoursReels === 0 && etat.totalJoursPrevus === 0)
    critique.push(`deriveJours=${etat.deriveJours} avec totalJoursReels=0`);
  if (etat.totalJoursPrevus === 0 && etat.totalJoursReels > 0)
    warnings.push(`totalJoursPrevus=0 avec activité (totalJoursReels=${etat.totalJoursReels}) — renseigner nombreJours`);

  // ── WARNINGS — incohérences mineures ────────────────────────────
  if (etat.margeEstimee !== null && etat.margeEstimee < 0 && !etat.projectionDisponible)
    warnings.push('margeEstimee négative sans projection disponible');
  if (etat.coutMOReel < 0)
    warnings.push(`coutMOReel négatif: ${etat.coutMOReel}`);
  if (etat.coutMateriel < 0)
    warnings.push(`coutMateriel négatif: ${etat.coutMateriel}`);
  if (etat.projectionDisponible && etat.coutFinalEstime !== null && etat.coutFinalEstime < 0)
    warnings.push(`coutFinalEstime négatif: ${etat.coutFinalEstime}`);

  // ── Logs conditionnels (silencieux en production) ────────────────
  if (!isProd) {
    if (critique.length > 0) console.error('[CYNA] assertEtatCoherent — CRITIQUE:', critique);
    if (warnings.length > 0) console.warn('[CYNA] assertEtatCoherent — WARNING:', warnings);
  }
  // Hook monitoring : if (critique.length > 0) Sentry.captureMessage('etat critique', { extra: { critique } });

  return { ok: critique.length === 0, critique, warnings };
};

// ===== VITESSE RÉELLE & PROJECTION DURÉE =====
// Retourne null si données insuffisantes (pas de dateDebut, pas de jours réalisés, pas de jours prévus)
export const calculerVitesseChantier = (chantier, etat) => {
  const nombreJoursPrevus = parseInt(chantier.nombreJours) || 0;
  if (!chantier.dateDebut || etat.totalJoursReels === 0 || etat.totalJoursPrevus === 0 || nombreJoursPrevus === 0) return null;

  const joursCalendaires = Math.max(1, Math.floor((Date.now() - new Date(chantier.dateDebut).getTime()) / 86400000));
  const vitesse = etat.totalJoursReels / joursCalendaires; // jours de travail par jour calendaire
  if (vitesse <= 0) return null;

  // Durée calendaire estimée pour accomplir tous les jours prévus au rythme actuel
  const dureeEstimee = Math.round(etat.totalJoursPrevus / vitesse);
  const retardEstime = dureeEstimee - nombreJoursPrevus;

  // Simulation : +1 ouvrier
  const nbEmployes = etat.equipe.length;
  if (nbEmployes === 0) return null;

  const nouvelleVitesse = vitesse * (nbEmployes + 1) / nbEmployes;
  const nouvelleDuree = Math.round(etat.totalJoursPrevus / nouvelleVitesse);
  const nouveauRetard = nouvelleDuree - nombreJoursPrevus;
  const gainJours = Math.max(0, retardEstime - nouveauRetard);

  return {
    vitesse: Math.round(vitesse * 1000) / 1000,
    joursCalendaires,
    dureeEstimee,
    retardEstime,
    nbEmployes,
    nouvelleDuree,
    nouveauRetard,
    gainJours,
  };
};