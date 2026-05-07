/**
 * CYNA — Agent Engine
 * 5 agents autonomes d'analyse locale (aucune API externe).
 * Chaque agent est une fonction pure qui reçoit les données et retourne des alertes/résultats.
 */

import { calculerCA, calculerCoutsChantier, isChantierActif, fmtN } from './donnees';

// ── Identifiant unique d'alerte ──────────────────────────────
const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─────────────────────────────────────────────────────────────
// AGENT 1 — AlerteChantier
// Vérifie marge, retard, dépassement budget sur tous les chantiers actifs
// ─────────────────────────────────────────────────────────────
export function runAlerteChantier({ chantiers, devis, parametres }) {
  const alertes = [];
  const actifs = chantiers.filter(isChantierActif);

  const config = parametres?.agentsConfig?.alerteChantier || {
    seuilMargeDanger: 0,
    seuilMargeAttention: 15,
    seuilRetardAttention: 3,
    seuilRetardCritique: 7,
    seuilBudgetAttention: 5,
    seuilBudgetDanger: 20,
  };

  actifs.forEach(c => {
    try {
      const couts = calculerCoutsChantier(
        c, parametres.employes, parametres.localites, parametres.parametres, devis
      );
      const ca = calculerCA(c, devis);
      const joursRealisesC = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
      const joursRestants = c.nombreJours > 0 ? c.nombreJours - joursRealisesC : null;
      const retardJ = joursRestants !== null && joursRestants < 0 ? Math.abs(joursRestants) : 0;

      // Marge — seuils configurables
      if (couts.montantTotal > 0 && couts.totalCoutsReel > 0) {
        const marge = parseFloat(couts.margeReelPct);
        if (marge < config.seuilMargeDanger) {
          alertes.push({
            id: uid('ac-perte'),
            agent: 'AlerteChantier',
            type: 'marge',
            niveau: 'DANGER',
            message: `${c.nom || c.numero} — chantier à perte · marge ${marge.toFixed(1)}%`,
            detail: `Déficit estimé : CHF ${fmtN(Math.abs(Math.round(couts.margeReel)))}`,
            chantier_id: c.id,
            timestamp: Date.now(),
            lu: false,
            action: { page: 'chantiers', ctx: { chantierActif: c.id } },
          });
        } else if (marge < config.seuilMargeAttention) {
          alertes.push({
            id: uid('ac-marge'),
            agent: 'AlerteChantier',
            type: 'marge',
            niveau: 'ATTENTION',
            message: `${c.nom || c.numero} — marge faible à ${marge.toFixed(1)}%`,
            detail: `Seuil cible : ${config.seuilMargeAttention}% · écart : ${(config.seuilMargeAttention - marge).toFixed(1)} pts`,
            chantier_id: c.id,
            timestamp: Date.now(),
            lu: false,
            action: { page: 'chantiers', ctx: { chantierActif: c.id } },
          });
        }
      }

      // Retard — seuils configurables
      if (retardJ > config.seuilRetardAttention) {
        alertes.push({
          id: uid('ac-retard'),
          agent: 'AlerteChantier',
          type: 'retard',
          niveau: retardJ > config.seuilRetardCritique ? 'CRITIQUE' : 'ATTENTION',
          message: `${c.nom || c.numero} — retard de ${retardJ} jour${retardJ > 1 ? 's' : ''}`,
          detail: `Fin prévue dépassée de ${retardJ}j ouvrables`,
          chantier_id: c.id,
          timestamp: Date.now(),
          lu: false,
          action: { page: 'chantiers', ctx: { chantierActif: c.id } },
        });
      }

      // Budget dépassé — seuils configurables
      if (couts.totalCoutsPrevu > 0 && couts.totalCoutsReel > 0) {
        const depassPct = ((couts.totalCoutsReel - couts.totalCoutsPrevu) / couts.totalCoutsPrevu) * 100;
        if (depassPct > config.seuilBudgetAttention) {
          alertes.push({
            id: uid('ac-budget'),
            agent: 'AlerteChantier',
            type: 'budget',
            niveau: depassPct > config.seuilBudgetDanger ? 'DANGER' : 'ATTENTION',
            message: `${c.nom || c.numero} — budget dépassé de ${depassPct.toFixed(0)}%`,
            detail: `Prévu CHF ${fmtN(Math.round(couts.totalCoutsPrevu))} · Réel CHF ${fmtN(Math.round(couts.totalCoutsReel))}`,
            chantier_id: c.id,
            timestamp: Date.now(),
            lu: false,
            action: { page: 'chantiers', ctx: { chantierActif: c.id } },
          });
        }
      }
    } catch (e) {
      console.warn('[AGENT-AlerteChantier] Erreur sur chantier', c.id, e);
    }
  });

  console.log(`[AGENT-AlerteChantier] ${alertes.length} alerte(s) générée(s)`);
  return alertes;
}

// ─────────────────────────────────────────────────────────────
// AGENT 2 — SuiviDevis
// Détecte les devis acceptés sans facture liée
// ─────────────────────────────────────────────────────────────
export function runSuiviDevis({ devis, factures, clients }) {
  const alertes = [];
  const now = Date.now();

  const devisAcceptes = (devis || []).filter(d =>
    ['Accepté', 'accepte', 'accepté', 'Signé', 'signe'].includes(d.statut)
  );

  devisAcceptes.forEach(d => {
    try {
      const aFacture = (factures || []).some(f =>
        String(f.devisId) === String(d.id)
      );
      if (aFacture) return;

      const dateRef = d.dateAcceptation || d.dateEmission || d.date;
      if (!dateRef) return;

      const joursDepuis = Math.floor((now - new Date(dateRef)) / 86400000);
      if (joursDepuis < 3) return; // grace period

      const client = (clients || []).find(cl => String(cl.id) === String(d.clientId));
      const nomClient = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() || client.entreprise : 'Client inconnu';
      const dateStr = new Date(dateRef).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });

      alertes.push({
        id: uid('sd'),
        agent: 'SuiviDevis',
        type: 'suivi_devis',
        niveau: joursDepuis > 7 ? 'ATTENTION' : 'INFO',
        message: `Devis ${d.numero || '#' + d.id} — ${nomClient} — aucune facture créée`,
        detail: `Accepté le ${dateStr} · il y a ${joursDepuis} jour${joursDepuis > 1 ? 's' : ''}`,
        devis_id: d.id,
        timestamp: Date.now(),
        lu: false,
        action: { page: 'devis', ctx: { devisActif: d.id } },
      });
    } catch (e) {
      console.warn('[AGENT-SuiviDevis] Erreur sur devis', d.id, e);
    }
  });

  console.log(`[AGENT-SuiviDevis] ${alertes.length} devis sans facture`);
  return alertes;
}

// ─────────────────────────────────────────────────────────────
// AGENT 3 — TrésoreriePredictor
// Prédit le solde à J+30 et J+60
// ─────────────────────────────────────────────────────────────
export function runTresoreriePredictor({ chantiers, factures, devis, parametres }) {
  try {
    const now = new Date();
    const SEUIL_ALERTE = parseFloat(parametres?.parametres?.seuilTresorerie) || 10000;
    const chargesMensuelles = parseFloat(parametres?.parametres?.chargesMensuelles) || 0;

    // Encaissements attendus = factures envoyées/partiellement payées
    const facturesOuvertes = (factures || []).filter(f =>
      ['envoyee', 'partielle', 'retard'].includes(f.statut)
    );
    const totalEncaissement = facturesOuvertes.reduce((s, f) =>
      s + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0
    );

    // Encaissements dans 30j vs 60j selon échéances
    let encaissement30 = 0, encaissement60 = 0;
    const j30 = new Date(now); j30.setDate(now.getDate() + 30);
    const j60 = new Date(now); j60.setDate(now.getDate() + 60);

    facturesOuvertes.forEach(f => {
      const restant = Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0));
      const echeance = f.dateEcheance ? new Date(f.dateEcheance) : null;
      if (!echeance || echeance <= j30) encaissement30 += restant;
      else if (echeance <= j60) encaissement60 += restant;
    });

    // Décaissements prévus — charges proratisées sur le mois en cours pour J+30
    const finMois = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const joursRestantsMois = finMois.getDate() - now.getDate();
    const joursTotalMois = finMois.getDate();
    const chargesProratisees = joursTotalMois > 0
      ? chargesMensuelles * (joursRestantsMois / joursTotalMois)
      : chargesMensuelles;
    const decaissement30 = chargesProratisees;
    const decaissement60 = chargesProratisees + chargesMensuelles;

    const solde30 = encaissement30 - decaissement30;
    const solde60 = (encaissement30 + encaissement60) - decaissement60;

    const alertes = [];
    if (solde30 < SEUIL_ALERTE && totalEncaissement > 0) {
      alertes.push({
        id: uid('tp-j30'),
        agent: 'TresoreriePredictor',
        type: 'tresorerie',
        niveau: solde30 < 0 ? 'DANGER' : 'ATTENTION',
        message: `Trésorerie J+30 estimée : CHF ${fmtN(Math.round(solde30))}`,
        detail: `Encaissements attendus CHF ${fmtN(Math.round(encaissement30))} · Charges CHF ${fmtN(Math.round(decaissement30))}`,
        timestamp: Date.now(),
        lu: false,
        action: { page: 'finances', ctx: {} },
      });
    }
    if (solde60 < SEUIL_ALERTE && totalEncaissement > 0) {
      alertes.push({
        id: uid('tp-j60'),
        agent: 'TresoreriePredictor',
        type: 'tresorerie_j60',
        niveau: 'INFO',
        message: `Solde prévu à J+60 : CHF ${fmtN(Math.round(solde60))} — en dessous du seuil`,
        detail: `Encaissements cumulés CHF ${fmtN(Math.round(encaissement30 + encaissement60))} · Charges CHF ${fmtN(Math.round(decaissement60))}`,
        timestamp: Date.now(),
        lu: false,
        action: { page: 'finances', ctx: {} },
      });
    }

    console.log(`[AGENT-TresoreriePredictor] J+30: CHF ${Math.round(solde30)} · J+60: CHF ${Math.round(solde60)}`);
    return {
      alertes,
      predictions: {
        encaissement30: Math.round(encaissement30),
        encaissement60: Math.round(encaissement60),
        decaissement30: Math.round(decaissement30),
        decaissement60: Math.round(decaissement60),
        solde30: Math.round(solde30),
        solde60: Math.round(solde60),
        totalEnAttente: Math.round(totalEncaissement),
        seuilAlerte: SEUIL_ALERTE,
        alerte: solde30 < SEUIL_ALERTE,
      },
    };
  } catch (e) {
    console.warn('[AGENT-TresoreriePredictor] Erreur', e);
    return { alertes: [], predictions: {} };
  }
}

// ─────────────────────────────────────────────────────────────
// AGENT 4 — RapportAuto
// Génère un résumé hebdomadaire (lundi matin)
// ─────────────────────────────────────────────────────────────
export function runRapportAuto({ chantiers, factures, devis, parametres, dernierRapport }) {
  try {
    const now = new Date();
    const estLundi = now.getDay() === 1;
    const heureSuffisante = now.getHours() >= 7;

    // Ne génère pas si déjà fait cette semaine
    if (dernierRapport) {
      const debut = new Date(now);
      debut.setDate(now.getDate() - now.getDay() + 1); // lundi de cette semaine
      debut.setHours(0, 0, 0, 0);
      if (new Date(dernierRapport.timestamp) >= debut) {
        console.log('[AGENT-RapportAuto] Rapport déjà généré cette semaine');
        return null;
      }
    }

    // Rattrapage : aucun rapport depuis plus de 7 jours → générer même hors lundi
    const ageDernierRapportMs = dernierRapport?.timestamp
      ? (now.getTime() - new Date(dernierRapport.timestamp).getTime())
      : Infinity;
    const rattrapage = ageDernierRapportMs > 7 * 24 * 60 * 60 * 1000;

    if (!rattrapage && (!estLundi || !heureSuffisante)) {
      console.log('[AGENT-RapportAuto] Pas lundi ou trop tôt, rapport non généré');
      return null;
    }

    // Données de la semaine écoulée
    const debutSemaine = new Date(now);
    debutSemaine.setDate(now.getDate() - 7);

    const actifs = chantiers.filter(isChantierActif);
    const terminesRecemment = chantiers.filter(c =>
      ['Terminé', 'Facturé', 'Clôturé'].includes(c.statut) &&
      c.dateFin && new Date(c.dateFin) >= debutSemaine
    );

    // Heures saisies cette semaine
    let heuresSemaine = 0;
    actifs.forEach(c => {
      (c.journal || []).forEach(entry => {
        if (!entry.date || new Date(entry.date) < debutSemaine) return;
        (entry.employes || []).forEach(e => {
          heuresSemaine += parseFloat(e.heuresTravaillees) || 0;
        });
      });
    });

    // CA facturé cette semaine
    const caFactureSemaine = (factures || [])
      .filter(f => f.dateEmission && new Date(f.dateEmission) >= debutSemaine)
      .reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);

    // Chantiers en retard
    const enRetard = actifs.filter(c => {
      const rC = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
      const j = c.nombreJours > 0 ? c.nombreJours - rC : null;
      return j !== null && j < 0;
    });

    const labelSemaine = debutSemaine.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' });
    const rapport = {
      id: uid('rapport'),
      timestamp: Date.now(),
      semaine: rattrapage && !estLundi
        ? `Rapport de rattrapage — semaine du ${labelSemaine}`
        : `Semaine du ${labelSemaine}`,
      heuresSaisies: Math.round(heuresSemaine),
      caFacture: Math.round(caFactureSemaine),
      nbActifs: actifs.length,
      nbTermines: terminesRecemment.length,
      nbEnRetard: enRetard.length,
      chantierRetard: enRetard.map(c => c.nom || c.numero),
      nouveau: true,
    };

    console.log('[AGENT-RapportAuto] Rapport hebdomadaire généré', rapport);
    return rapport;
  } catch (e) {
    console.warn('[AGENT-RapportAuto] Erreur', e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// AGENT 5 — MémoireChantier
// Calcule les patterns d'écart budget par type de chantier
// ─────────────────────────────────────────────────────────────
export function runMemoireChantier({ chantiers, devis, parametres }) {
  try {
    const STATUTS_TERMINES = ['Terminé', 'Facturé', 'Clôturé'];
    const termines = chantiers.filter(c => STATUTS_TERMINES.includes(c.statut));

    const patterns = {};

    termines.forEach(c => {
      try {
        const type = c.typeChantier || c.type || 'Autre';
        const couts = calculerCoutsChantier(
          c, parametres.employes, parametres.localites, parametres.parametres, devis
        );
        if (couts.totalCoutsPrevu <= 0 || couts.totalCoutsReel <= 0) return;

        const ecartPct = ((couts.totalCoutsReel - couts.totalCoutsPrevu) / couts.totalCoutsPrevu) * 100;

        if (!patterns[type]) patterns[type] = { type, ecarts: [], count: 0 };
        patterns[type].ecarts.push(ecartPct);
        patterns[type].count++;
      } catch (e) {
        // silencieux sur chantier individuel
      }
    });

    // Calcul des moyennes
    Object.keys(patterns).forEach(type => {
      const p = patterns[type];
      p.ecartMoyen = p.ecarts.reduce((s, v) => s + v, 0) / p.ecarts.length;
      p.ecartMedian = [...p.ecarts].sort((a, b) => a - b)[Math.floor(p.ecarts.length / 2)];
      delete p.ecarts; // économie mémoire
    });

    console.log(`[AGENT-MemoireChantier] ${Object.keys(patterns).length} type(s) de chantier analysé(s)`, patterns);
    return patterns;
  } catch (e) {
    console.warn('[AGENT-MemoireChantier] Erreur', e);
    return {};
  }
}

// ─────────────────────────────────────────────────────────────
// ORCHESTRATEUR — Lance tous les agents et retourne l'état consolidé
// ─────────────────────────────────────────────────────────────
export function runAllAgents({ chantiers, devis, factures, clients, parametres, dernierRapport, agentsActifs }) {
  const enabled = agentsActifs || {
    AlerteChantier: true,
    SuiviDevis: true,
    TresoreriePredictor: true,
    RapportAuto: true,
    MemoireChantier: true,
  };

  const result = {
    alertes: [],
    predictions: {},
    patterns: {},
    rapport: null,
    statuts: {},
  };

  const runAgent = (name, fn) => {
    if (!enabled[name]) {
      result.statuts[name] = { actif: false, lastRun: null, erreur: null };
      return;
    }
    try {
      const start = Date.now();
      const res = fn();
      result.statuts[name] = { actif: true, lastRun: Date.now(), dureeMs: Date.now() - start, erreur: null };
      return res;
    } catch (e) {
      console.error(`[AGENT-${name}] Erreur critique`, e);
      result.statuts[name] = { actif: true, lastRun: Date.now(), erreur: e.message };
      return null;
    }
  };

  const a1 = runAgent('AlerteChantier', () => runAlerteChantier({ chantiers, devis, parametres }));
  if (a1) result.alertes.push(...a1);

  const a2 = runAgent('SuiviDevis', () => runSuiviDevis({ devis, factures, clients }));
  if (a2) result.alertes.push(...a2);

  const a3 = runAgent('TresoreriePredictor', () => runTresoreriePredictor({ chantiers, factures, devis, parametres }));
  if (a3) { result.alertes.push(...a3.alertes); result.predictions = a3.predictions; }

  const a4 = runAgent('RapportAuto', () => runRapportAuto({ chantiers, factures, devis, parametres, dernierRapport }));
  if (a4) result.rapport = a4;

  const a5 = runAgent('MemoireChantier', () => runMemoireChantier({ chantiers, devis, parametres }));
  if (a5) result.patterns = a5;

  return result;
}
