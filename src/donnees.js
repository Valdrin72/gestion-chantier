// =============================================
// CYNA SÀRL — DONNÉES & CALCULS MÉTIER
// =============================================

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
  if (!dateDebut || !nombreJours) return '-';
  const nb = parseInt(nombreJours);
  if (isNaN(nb) || nb <= 0) return '-';
  const date = new Date(dateDebut);
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
  const dateFin = new Date(calculerDateFinOuvrables(dateDebut, nombreJours, inclusSamedi));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (dateFin < today) {
    let joursDepasse = 0;
    const d = new Date(today);
    while (d > dateFin) {
      d.setDate(d.getDate() - 1);
      const jour = d.getDay();
      if (inclusSamedi ? jour !== 0 : (jour !== 0 && jour !== 6)) joursDepasse++;
    }
    return -joursDepasse;
  }
  
  let joursRestants = 0;
  const d = new Date(today);
  while (d < dateFin) {
    d.setDate(d.getDate() + 1);
    const jour = d.getDay();
    if (inclusSamedi ? jour !== 0 : (jour !== 0 && jour !== 6)) joursRestants++;
  }
  return joursRestants;
};

export const getAlerte = (jours) => {
  if (jours === null) return null;
  if (jours < 0) return { texte: `⛔ DÉPASSÉ de ${Math.abs(jours)} jour(s)`, couleur: '#b71c1c', niveau: 'critique', banniere: 'danger' };
  if (jours === 0) return { texte: '🚨 FIN AUJOURD\'HUI !', couleur: '#b71c1c', niveau: 'critique', banniere: 'danger' };
  if (jours <= 2) return { texte: `⚠️ ${jours} jour(s) restant(s) !`, couleur: '#e65100', niveau: 'danger', banniere: 'warning' };
  if (jours <= 5) return { texte: `📢 ${jours} jours restants`, couleur: '#f57f17', niveau: 'warning', banniere: 'warning' };
  return { texte: `✅ ${jours} jours restants`, couleur: '#2e7d32', niveau: 'ok', banniere: null };
};

/**
 * Calcule l'alerte de retard d'un chantier en tenant compte des jours imprévus.
 * - joursImprevus === 0 → retard interne (faute) → 🔴 critique
 * - joursImprevus > 0 + encore dans fenêtre ajustée → 🟡 retard justifié (pas critique)
 * - joursImprevus > 0 + dépassement même ajusté → 🔴 retard réel (mais pas critique)
 */
export const getAlerteChantier = (chantier) => {
  const { dateDebut, nombreJours, joursImprevus, inclusSamedi = false } = chantier;
  const imprevus = parseInt(joursImprevus) || 0;
  const base = parseInt(nombreJours) || 0;

  const joursBase = joursOuvrableRestants(dateDebut, base, inclusSamedi);
  if (joursBase === null) return null;

  // Pas encore dépassé la date de fin de base → comportement standard
  if (joursBase >= 0) return getAlerte(joursBase);

  // Dépassement de la date de fin de base
  if (imprevus === 0) {
    const abs = Math.abs(joursBase);
    return { texte: `🔴 Retard ${abs} jour${abs > 1 ? 's' : ''}`, couleur: '#b71c1c', niveau: 'critique', banniere: 'danger' };
  }

  // imprevus > 0 : comparer à la date de fin ajustée
  const joursAjustes = joursOuvrableRestants(dateDebut, base + imprevus, inclusSamedi);

  if (joursAjustes !== null && joursAjustes >= 0) {
    // Toujours dans la fenêtre ajustée → retard justifié, pas critique
    return { texte: `🟡 Retard justifié (+${imprevus}j imprévus)`, couleur: '#f59e0b', niveau: 'justifie', banniere: 'warning' };
  }

  // Dépassement même après ajustement → retard réel
  const absReel = Math.abs(joursAjustes ?? joursBase);
  return { texte: `🔴 Retard réel ${absReel}j`, couleur: '#b71c1c', niveau: 'retard_reel', banniere: 'danger' };
};

/** Retourne true si le chantier est en retard mais justifié par des imprévus. */
export const estRetardJustifie = (chantier) => getAlerteChantier(chantier)?.niveau === 'justifie';

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
 *   // → { status: 'warning', label: '🟡 Retard justifié (+3j)', delay: 2, couleur: '#f59e0b' }
 *   <Badge texte={ts.label} couleur={ts.couleur} />
 */
export const getChantierStatus = (chantier) => {
  const { dateDebut, nombreJours, joursImprevus, inclusSamedi = false } = chantier;
  const imprevus = parseInt(joursImprevus) || 0;
  const base = parseInt(nombreJours) || 0;

  if (!dateDebut || !base) return { status: 'ok', label: '–', delay: 0, couleur: '#6b7280' };

  const joursBase = joursOuvrableRestants(dateDebut, base, inclusSamedi);
  if (joursBase === null) return { status: 'ok', label: '–', delay: 0, couleur: '#6b7280' };

  // Pas encore dépassé la date de fin de base → à l'heure
  if (joursBase >= 0) {
    return { status: 'ok', label: '🟢 À l\'heure', delay: 0, couleur: '#22c55e' };
  }

  // Dépassement de la date de fin de base
  const abs = Math.abs(joursBase);

  if (imprevus === 0) {
    // Retard interne — aucun justificatif
    return { status: 'danger', label: `🔴 Retard de ${abs}j`, delay: abs, couleur: '#ef4444' };
  }

  // imprevus > 0 : vérifier par rapport à la date ajustée
  const joursAjustes = joursOuvrableRestants(dateDebut, base + imprevus, inclusSamedi);

  if (joursAjustes !== null && joursAjustes >= 0) {
    // Toujours dans la fenêtre ajustée → retard justifié, pas critique
    return { status: 'warning', label: `🟡 Retard justifié (+${imprevus}j)`, delay: abs, couleur: '#f59e0b' };
  }

  // Dépassement même après ajustement → retard réel
  const absReel = Math.abs(joursAjustes ?? joursBase);
  return { status: 'danger', label: `🔴 Retard de ${absReel}j`, delay: absReel, couleur: '#ef4444' };
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

/** Retourne true si le chantier est actif — comparaison insensible à la casse et aux espaces. */
export const isChantierActif = (c) => c?.statut?.trim().toLowerCase() === 'en cours';

/**
 * Chiffre d'affaires = montantHT du devis accepté lié + somme avenants.
 * Retourne null si aucun devis lié — aucun fallback autorisé.
 */
export const calculerCA = (chantier, devisList = []) => {
  if (!chantier.devisId) return null;
  const devisLie = devisList.find(d => String(d.id) === String(chantier.devisId));
  if (!devisLie) return null;
  // montantHT = champ courant ; prixPropose = rétrocompat anciens devis
  const montantBase = parseFloat(devisLie.montantHT || devisLie.prixPropose) || 0;
  return montantBase + sommeAvenants(chantier);
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
      console.log('[CYNA] Migration devisId: chantier', ch.id, '|', ch.devisId, '→', matchParNumero.id);
      return { ...ch, devisId: matchParNumero.id };
    }
    return ch;
  });
};

export const calculerCoutsChantier = (chantier, employes, localites, cfg = {}, devisList = []) => {
  const coefficient = parseFloat(cfg.coefficientMainOeuvre) || 1.0;
  const tauxFG = parseFloat(cfg.tauxFraisGeneraux) || 0;

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
  const nbJours = parseInt(chantier.nombreJours || 0);
  const coutDeplacement = tarifDeplacement * nbJours;

  // Source unique : journal (heuresTravaillees) — aucun fallback
  const journalCouts = chantier.journal || [];
  const getJoursReels = (membre) =>
    heuresEmploye(journalCouts, parseInt(membre.employeId)) / 8;

  const coutEquipePrevu = chantier.equipe?.reduce((total, membre) => {
    const emp = employes.find(e => e.id === parseInt(membre.employeId));
    return total + getTarifJour(emp) * parseFloat(membre.joursPlannifies || 0);
  }, 0) || 0;

  // Source unique : journal si disponible, sinon joursRealises manuel, sinon 0 (jamais fallback sur prévu)
  const coutEquipeReelDetaille = (chantier.equipe || []).map(membre => {
    const emp = employes.find(e => e.id === parseInt(membre.employeId));
    const joursReels = getJoursReels(membre);
    const tarif = getTarifJour(emp);
    return { employeId: membre.employeId, joursReels, tarif, cout: tarif * joursReels };
  });
  const coutEquipeReel = coutEquipeReelDetaille.reduce((t, m) => t + m.cout, 0);

  // Vérification cohérence (écart > 1 CHF entre somme lignes et total)
  const totalLignes = coutEquipeReelDetaille.reduce((t, m) => t + m.cout, 0);
  if (Math.abs(totalLignes - coutEquipeReel) > 1) {
    console.warn('[CYNA] Incohérence coût équipe détectée', { totalLignes, coutEquipeReel });
  }

  // Coût des jours imprévus = jours de dépassement × coût journalier moyen d'équipe
  const joursImprevus = parseInt(chantier.joursImprevus) || 0;
  const realDaysWorked = coutEquipeReelDetaille.reduce((t, m) => t + m.joursReels, 0);
  const coutJoursImprevus = joursImprevus > 0 && realDaysWorked > 0 && coutEquipeReel > 0
    ? joursImprevus * (coutEquipeReel / realDaysWorked) : 0;

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
  const hasEquipe = (chantier.equipe?.length || 0) > 0;
  const equipeHasReel = hasEquipe && coutEquipeReelDetaille.some(m => m.joursReels > 0);
  const champsManquants = [];
  if (hasEquipe && !equipeHasReel)                            champsManquants.push('Heures équipe');
  if (coutMaterielPrevu > 0    && coutMaterielReelRaw    === null) champsManquants.push('Matériel');
  if (coutSousTraitancePrevu > 0 && coutSousTraitanceReelRaw === null) champsManquants.push('Sous-traitance');
  if (autresCoutsPrevu > 0     && autresCoutsReelRaw     === null) champsManquants.push('Autres coûts');
  const donneesIncompletes = champsManquants.length > 0;

  // CA = null si aucun devis lié (source unique — aucun fallback)
  const montantTotal = calculerCA(chantier, devisList);
  const caDisponible = montantTotal !== null;

  const totalCoutsPrevu = coutEquipePrevu + coutMaterielPrevu + coutSousTraitancePrevu + coutDeplacement + autresCoutsPrevu;
  const totalCoutsReel = coutEquipeReel + coutMaterielReel + coutSousTraitanceReel + coutDeplacement + coutImprevus + autresCoutsReel + coutJoursImprevus;

  const margePrevu = caDisponible ? montantTotal - totalCoutsPrevu : null;
  const margeReel = caDisponible ? montantTotal - totalCoutsReel : null;
  const margePrevuPct = (caDisponible && montantTotal > 0) ? ((margePrevu / montantTotal) * 100).toFixed(1) : null;
  const margeReelPct = (caDisponible && montantTotal > 0) ? ((margeReel / montantTotal) * 100).toFixed(1) : null;

  // P7 : coût/m² uniquement si surface renseignée
  const surface = parseFloat(chantier.surface) || 0;
  const coutParM2Prevu = surface > 0 ? (totalCoutsPrevu / surface).toFixed(2) : null;
  const coutParM2Reel  = surface > 0 ? (totalCoutsReel  / surface).toFixed(2) : null;
  const prixParM2Devis = (caDisponible && surface > 0) ? (montantTotal / surface).toFixed(2) : null;

  const ecartMontant = caDisponible ? montantTotal - totalCoutsReel : null;
  const ecartPct = (caDisponible && montantTotal > 0) ? (((montantTotal - totalCoutsReel) / montantTotal) * 100).toFixed(1) : null;

  // Frais généraux & marge nette
  const fraisGeneraux = caDisponible ? montantTotal * (tauxFG / 100) : 0;
  const margeNette = (caDisponible && margeReel !== null) ? margeReel - fraisGeneraux : null;
  const margeNettePct = (caDisponible && montantTotal > 0 && margeNette !== null) ? ((margeNette / montantTotal) * 100).toFixed(1) : null;

  // P4 : deux valeurs distinctes
  // budgetRestant = ce qui reste dans l'enveloppe budgétaire
  const budgetRestant = totalCoutsPrevu - totalCoutsReel;
  // rad = estimation du coût pour finir à ce rythme (RAD réel métier BTP)
  // = (coutReel / avancement%) × (100 - avancement%)
  const avancement = parseFloat(chantier.avancement) || 0;
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
    ? parseFloat(((montantTotal - coutFinalEstime) / montantTotal * 100).toFixed(1))
    : null;

  // Marge finale estimée nette — après déduction des frais généraux
  const margeFinaleNettePct = margeFinaleEstimeePct !== null
    ? parseFloat((margeFinaleEstimeePct - tauxFG).toFixed(1))
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
  const ecartEquipePct = coutEquipePrevu > 0 ? (((coutEquipeReel - coutEquipePrevu) / coutEquipePrevu) * 100).toFixed(1) : '0';
  const ecartMateriel = coutMaterielReel - coutMaterielPrevu;
  const ecartMaterielPct = coutMaterielPrevu > 0 ? (((coutMaterielReel - coutMaterielPrevu) / coutMaterielPrevu) * 100).toFixed(1) : '0';
  const ecartSousTraitance = coutSousTraitanceReel - coutSousTraitancePrevu;
  const ecartSousTraitancePct = coutSousTraitancePrevu > 0 ? (((coutSousTraitanceReel - coutSousTraitancePrevu) / coutSousTraitancePrevu) * 100).toFixed(1) : '0';
  const ecartAutres = autresCoutsReel - autresCoutsPrevu;
  const ecartAutresPct = autresCoutsPrevu > 0 ? (((autresCoutsReel - autresCoutsPrevu) / autresCoutsPrevu) * 100).toFixed(1) : '0';

  // Alertes dépassement budget
  const depassementBudget = totalCoutsReel > totalCoutsPrevu && totalCoutsPrevu > 0;
  // P6 : alerte orange seulement si chantier réellement démarré (avancement > 10%)
  const alerteOrange = !depassementBudget && totalCoutsPrevu > 0
    && avancement > 10
    && (totalCoutsReel / totalCoutsPrevu) >= 0.8
    && avancement < 80;

  return {
    coutDeplacement, coutEquipePrevu, coutEquipeReel, coutEquipeReelDetaille,
    coutMaterielPrevu, coutMaterielReel, coutMaterielReelRaw,
    coutSousTraitancePrevu, coutSousTraitanceReel, coutSousTraitanceReelRaw,
    autresCoutsPrevu, autresCoutsReel, autresCoutsReelRaw,
    coutImprevus, coutJoursImprevus, joursImprevus, totalCoutsPrevu, totalCoutsReel,
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
  if (v >= 20) return { label: 'Rentable',      couleur: '#10b981' };
  if (v >= 15) return { label: 'Limite',         couleur: '#f59e0b' };
  return             { label: 'Non rentable',    couleur: '#ef4444' };
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
  const totalRevient = coutDirect * (1 + parseFloat(parametres.tauxFraisGeneraux) / 100);

  const margeCible  = parseFloat(form.margeCible || parametres.margeCible) / 100;
  const margeMin    = parseFloat(parametres.seuilRentabiliteMin) / 100;
  const margeExtra  = parseFloat(parametres.plafondCredi) / 100;

  // Règles métier — prix = coût × (1 + taux_marge)
  // Garantit toujours : prixMin ≤ prixConseille ≤ prixPlafond
  const prixMinRentable = totalRevient * (1 + Math.min(margeMin, margeCible));
  const prixConseille   = totalRevient * (1 + margeCible);
  const prixPlafond     = totalRevient * (1 + margeCible + margeExtra);
  const prixPropose = parseFloat(form.prixPropose) || prixConseille;
  const margeEstimee = prixPropose - totalRevient;
  const tauxMarge = prixPropose > 0 ? ((margeEstimee / prixPropose) * 100).toFixed(1) : 0;

  let positionnement = 'Marché';
  let niveauRisque = 'Faible';
  if (prixPropose < prixMinRentable) { positionnement = 'Dangereux ⛔'; niveauRisque = 'Critique'; }
  else if (prixPropose < prixConseille * 0.95) { positionnement = 'Agressif'; niveauRisque = 'Élevé'; }
  else if (prixPropose > prixPlafond) { positionnement = 'Excessif ⚠️'; niveauRisque = 'Commercial'; }
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
 * Basé uniquement sur le CA signé et les coûts directs (matériel + transport + sous-traitance).
 * Formules : coûtTotal = mat + transp + ST, marge = CA − coûtTotal, marge% = marge / CA × 100
 */
export const calculerDevisClient = (devis) => {
  const chiffreAffaires   = parseFloat(devis.prixPropose)       || 0;
  const coutMateriel      = parseFloat(devis.coutMateriel)      || 0;
  const coutTransport     = parseFloat(devis.coutTransport)     || 0;
  const coutSousTraitance = parseFloat(devis.coutSousTraitance) || 0;
  const coutTotal         = coutMateriel + coutTransport + coutSousTraitance;
  const marge             = chiffreAffaires - coutTotal;
  const margePct          = chiffreAffaires > 0 ? (marge / chiffreAffaires) * 100 : 0;
  return { chiffreAffaires, coutMateriel, coutTransport, coutSousTraitance, coutTotal, marge, margePct };
};

// ===== C =====
export const C = {
  primaire: '#3382c2',
  secondaire: '#2e7d32',
  danger: '#b71c1c',
  warning: '#e65100',
  info: '#0288d1',
  violet: '#6a1b9a',
  orange: '#f57f17',
  gris: '#f5f5f5',
  blanc: '#ffffff',
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
  // Source unique : journal (heuresTravaillees) — aucun fallback
  const journalEq = chantier.journal || [];
  const getJoursReelsEq = (m) => heuresEmploye(journalEq, parseInt(m.employeId)) / 8;
  const membres = (chantier.equipe || []).map(m => {
    const emp = employes.find(e => e.id === parseInt(m.employeId));
    const joursReels = getJoursReelsEq(m);
    const coutTotal = (emp?.tarifJour || 0) * joursReels;
    return {
      employeId: m.employeId,
      nom: emp?.nom || 'Inconnu',
      poste: emp?.poste || m.role || '—',
      tarifJour: emp?.tarifJour || 0,
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
        ? parseFloat(((m.coutTotal / coutTotalEquipe) * 100).toFixed(1))
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
    ? parseFloat(((ecartJours / joursPrevu) * 100).toFixed(1))
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
  const etat = calculerEtatChantier(chantier, employes, devisList);

  const joursPrevu    = parseInt(chantier.nombreJours) || 0;
  const joursRealises = etat.totalJoursReels;
  const joursRestants = joursPrevu - joursRealises;
  const enDepassement = joursRealises > 0 && joursRealises > joursPrevu;
  const enAvance      = joursRealises > 0 && joursRealises < joursPrevu;
  const aucuneSaisie  = joursRealises === 0;

  const coutMOReel   = etat.coutMOReel;
  const autresCouts  = etat.coutMateriel + etat.coutSousTraitance + etat.coutAutres + etat.coutImprevus;
  const caTotal      = etat.devisTotal; // null si aucun devis lié
  const totalCoutsReel = etat.coutTotalReel;
  const caDisponible = caTotal !== null;

  const rentabilite    = caDisponible ? caTotal - totalCoutsReel : null;
  const rentabilitePct = (caDisponible && caTotal > 0) ? (rentabilite / caTotal) * 100 : null;

  // Coût MO prévisionnel (somme tarifJour × joursPrévus par membre)
  const coutMOPrevu = (chantier.equipe || []).reduce((total, membre) => {
    const emp = employes.find(e => e.id === parseInt(membre.employeId));
    return total + (parseFloat(emp?.tarifJour) || 0) * (parseFloat(membre.joursPlannifies) || 0);
  }, 0);

  const rentabiliteProjetee = (caDisponible && joursRealises > 0)
    ? caTotal - (coutMOPrevu + autresCouts)
    : null;
  const rentabiliteProjetee_Pct = (rentabiliteProjetee !== null && caTotal > 0)
    ? parseFloat(((rentabiliteProjetee / caTotal) * 100).toFixed(1))
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
    rentabilitePct: rentabilitePct !== null ? parseFloat(rentabilitePct.toFixed(1)) : null,
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
  if (!chantier.dateDebut) return false;
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

// ===== DONNÉES INITIALES =====
export const donneesInitiales = {
  // PARAMÈTRES GLOBAUX
  parametres: {
    margeCible: 25,
    seuilRentabiliteMin: 15,
    plafondCredi: 40,
    tauxFraisGeneraux: 12,
    coefficientMainOeuvre: 1.35,
    joursAlerte: 5,
  },

  // ZONES GÉOGRAPHIQUES
  zones: [
    {
      id: 1, nom: 'Genève',
      tarifs: {
        'Cloisons vitrées': 135,
        'Cloisons amovibles': 95,
        'Faux plancher': 85,
        'Plafonds suspendus': 90,
        'Portes standards': 650,
        'Portes coupe-feu': 950,
        'Panneaux sandwich': 110,
      },
      tarifDeplacement: 60,
    },
    {
      id: 2, nom: 'Lausanne',
      tarifs: {
        'Cloisons vitrées': 120,
        'Cloisons amovibles': 85,
        'Faux plancher': 75,
        'Plafonds suspendus': 80,
        'Portes standards': 580,
        'Portes coupe-feu': 850,
        'Panneaux sandwich': 95,
      },
      tarifDeplacement: 50,
    },
    { id: 3, nom: 'Berne', tarifs: {}, tarifDeplacement: 45 },
    { id: 4, nom: 'Zurich', tarifs: {}, tarifDeplacement: 65 },
    { id: 5, nom: 'Fribourg', tarifs: {}, tarifDeplacement: 40 },
    { id: 6, nom: 'Neuchâtel', tarifs: {}, tarifDeplacement: 40 },
    { id: 7, nom: 'Vaud (autre)', tarifs: {}, tarifDeplacement: 45 },
  ],

  // TYPES DE TRAVAUX
  typesTravaux: [
    { id: 1, nom: 'Cloisons vitrées', unite: 'm²', tarifBase: 125 },
    { id: 2, nom: 'Cloisons amovibles', unite: 'm²', tarifBase: 90 },
    { id: 3, nom: 'Faux plancher', unite: 'm²', tarifBase: 80 },
    { id: 4, nom: 'Plafonds suspendus', unite: 'm²', tarifBase: 85 },
    { id: 5, nom: 'Portes standards', unite: 'unité', tarifBase: 620 },
    { id: 6, nom: 'Portes coupe-feu', unite: 'unité', tarifBase: 900 },
    { id: 7, nom: 'Panneaux sandwich', unite: 'm²', tarifBase: 100 },
    { id: 8, nom: 'Autre', unite: 'forfait', tarifBase: 0 },
  ],

  // LOCALITÉS (déplacement)
  localites: [
    { id: 1, nom: 'Genève', tarifJour: 60 },
    { id: 2, nom: 'Lausanne', tarifJour: 50 },
    { id: 3, nom: 'Berne', tarifJour: 45 },
    { id: 4, nom: 'Zurich', tarifJour: 65 },
    { id: 5, nom: 'Fribourg', tarifJour: 40 },
    { id: 6, nom: 'Neuchâtel', tarifJour: 40 },
    { id: 7, nom: 'Vaud (autre)', tarifJour: 45 },
  ],

  // EMPLOYÉS
  employes: [
    { id: 1, nom: 'Jean Martin', poste: 'Chef de chantier', tarifJour: 420, telephone: '079 111 11 11', email: 'j.martin@cyna.ch', actif: true },
    { id: 2, nom: 'Pierre Durand', poste: 'Ouvrier qualifié', tarifJour: 350, telephone: '079 222 22 22', email: 'p.durand@cyna.ch', actif: true },
    { id: 3, nom: 'Marc Weber', poste: 'Manœuvre', tarifJour: 280, telephone: '079 333 33 33', email: 'm.weber@cyna.ch', actif: true },
  ],

  // PROFILS UTILISATEURS
  profils: [
    { id: 1, nom: 'Direction', acces: ['tout'] },
    { id: 2, nom: 'Conducteur de travaux', acces: ['chantiers', 'equipes', 'couts'] },
    { id: 3, nom: 'Administratif', acces: ['clients', 'devis', 'factures'] },
    { id: 4, nom: 'Métreur / Deviseur', acces: ['devis', 'tarification'] },
    { id: 5, nom: 'Chef d\'équipe', acces: ['mes_chantiers'] },
  ],

  // CLIENTS
  clients: [
    { id: 1, nom: 'Dupont', prenom: 'Marc', entreprise: 'Dupont Immobilier SA', telephone: '022 100 00 01', email: 'marc.dupont@dupont.ch', adresse: 'Rue de Rive 12', ville: 'Genève', canton: 'GE', type: 'Entreprise', notes: 'Client fidèle depuis 2020' },
    { id: 2, nom: 'Schmidt', prenom: 'Anna', entreprise: 'Schmidt Construction', telephone: '021 200 00 02', email: 'anna.schmidt@schmidt.ch', adresse: 'Avenue de la Gare 5', ville: 'Lausanne', canton: 'VD', type: 'Entreprise', notes: '' },
  ],

  // CHANTIERS
  chantiers: [
    {
      id: 1,
      numero: 'CH-2026-001',
      nom: 'Bureaux Dupont Rive Gauche',
      clientId: 1,
      conducteur: 'Jean Martin',
      adresse: 'Rue de Rive 12',
      ville: 'Genève',
      canton: 'GE',
      dateDebut: '2026-03-01',
      nombreJours: 15,
      inclusSamedi: false,
      statut: 'En cours',
      priorite: 'Haute',
      avancement: 60,
      typesTravaux: ['Cloisons vitrées', 'Faux plancher'],
      surface: 280,
      montantDevis: 52000,
      avenants: 3500,
      montantFacture: 0,
      equipe: [
        { employeId: 1, role: 'Chef d\'équipe', joursPlannifies: 15, joursRealises: 9 },
        { employeId: 2, role: 'Ouvrier', joursPlannifies: 15, joursRealises: 9 },
        { employeId: 3, role: 'Manœuvre', joursPlannifies: 10, joursRealises: 6 },
      ],
      coutMaterielPrevu: 18000,
      coutMaterielReel: 19200,
      coutSousTraitancePrevu: 0,
      coutSousTraitanceReel: 0,
      autresCoutsPrevu: 500,
      autresCoutsReel: 650,
      imprevus: [
        { description: 'Vitrage supplémentaire', montant: 1200 },
      ],
      heuresPrevu: 120,
      heuresRealise: 72,
      notes: 'Attention : accès restreint le mardi matin',
      
    },
    {
      id: 2,
      numero: 'CH-2026-002',
      nom: 'Centre Médical Schmidt',
      clientId: 2,
      conducteur: 'Jean Martin',
      adresse: 'Avenue de la Gare 5',
      ville: 'Lausanne',
      canton: 'VD',
      dateDebut: '2026-04-07',
      nombreJours: 20,
      inclusSamedi: false,
      statut: 'Planifié',
      priorite: 'Normale',
      avancement: 0,
      typesTravaux: ['Plafonds suspendus', 'Portes coupe-feu'],
      surface: 350,
      montantDevis: 68000,
      avenants: 0,
      montantFacture: 0,
      equipe: [
        { employeId: 1, role: 'Chef d\'équipe', joursPlannifies: 20, joursRealises: 0 },
        { employeId: 2, role: 'Ouvrier', joursPlannifies: 20, joursRealises: 0 },
      ],
      coutMaterielPrevu: 22000,
      coutMaterielReel: 22000,
      coutSousTraitancePrevu: 5000,
      coutSousTraitanceReel: 5000,
      autresCoutsPrevu: 800,
      autresCoutsReel: 800,
      imprevus: [],
      heuresPrevu: 160,
      heuresRealise: 0,
      notes: '',
    },
  ],

  // DEVIS
  devis: [
    {
      id: 1,
      numero: 'DEV-2026-001',
      clientId: 1,
      date: '2026-02-15',
      statut: 'Validé',
      zone: 'Genève',
      typeTravaux: 'Cloisons vitrées',
      surface: 280,
      complexite: 'Normale',
      urgence: 'Non',
      acces: 'Normal',
      coutMateriel: 18000,
      coutTransport: 800,
      coutSousTraitance: 0,
      margeCible: 25,
      montantHT: 52000,
      prixPropose: 52000,
      notes: '',
    },
  ],
};

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

export const calculerEtatChantier = (chantier, employes = [], devisList = []) => {
  const equipe     = chantier.equipe     || [];
  const journal    = chantier.journal    || [];
  const imprevus   = chantier.imprevus   || [];
  // CA = devis accepté lié (montantHT) + avenants. Si aucun devis : CA = 0.
  const devisTotal = calculerCA(chantier, devisList);

  // ── A. Jours réels par employé (source : journal uniquement) ──────────
  const membreDetail = equipe.map(membre => {
    const empId   = parseInt(membre.employeId);
    const emp     = employes.find(e => e.id === empId);
    const tarifJour  = parseFloat(emp?.tarifJour) || 0;
    const tarifHeure = parseFloat(tarifJour / 8);  // dérivé — 8h/jour convention BTP

    // Heures réelles depuis le journal (format unique — aucun fallback)
    const heuresReelles = heuresEmploye(journal, empId);
    const joursReels    = heuresReelles / 8; // peut être décimal (demi-journées, heures partielles)

    const joursPrevus   = parseFloat(membre.joursPlannifies) || 0;
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
      // Coût = heures × tarifHeure (équivalent à jours × tarifJour)
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
  const avancementPct = totalJoursPrevus === 0
    ? 0
    : Math.min(100, Math.round((totalJoursReels / totalJoursPrevus) * 100));

  // ── D. Dérive temps ───────────────────────────────────────────────────
  const deriveJours = totalJoursReels - totalJoursPrevus;
  // positif = retard, négatif = avance

  // ── E. Coût main d'œuvre réelle ───────────────────────────────────────
  const coutMOReel = membreDetail.reduce((s, m) => s + m.cout, 0);

  // ── F. Coût total réel ────────────────────────────────────────────────
  const coutMateriel     = parseFloat(chantier.materielReel)         || 0;
  const coutSousTraitance= parseFloat(chantier.sousTraitanceReelle)  || 0;
  const coutAutres       = parseFloat(chantier.autresCoutsReels)     || 0;
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

  const margeEstimee = (projectionDisponible && devisTotal !== null)
    ? Math.round(devisTotal - coutFinalEstime)
    : null;

  const margeEstimeePct = (projectionDisponible && devisTotal !== null && devisTotal > 0)
    ? parseFloat(((margeEstimee / devisTotal) * 100).toFixed(1))
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
    console.error('[CYNA] assertEtatValide : etat est null ou undefined');
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
    console.error('[CYNA] assertEtatValide — anomalies détectées :', erreurs);
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
  if (etat.deriveJours !== 0 && etat.totalJoursReels === 0)
    critique.push(`deriveJours=${etat.deriveJours} avec totalJoursReels=0`);
  if (etat.totalJoursPrevus === 0 && etat.totalJoursReels > 0)
    critique.push(`totalJoursPrevus=0 avec activité (totalJoursReels=${etat.totalJoursReels})`);

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
    vitesse: parseFloat(vitesse.toFixed(3)),
    joursCalendaires,
    dureeEstimee,
    retardEstime,
    nbEmployes,
    nouvelleDuree,
    nouveauRetard,
    gainJours,
  };
};