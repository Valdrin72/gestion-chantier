/**
 * CYNA — Agent Engine v2
 * 20 agents autonomes en 3 tiers :
 *   Tier 1 (9) — analyse pure, pas de dépendance inter-agents
 *   Tier 2 (6) — intelligence croisée, lit les résultats Tier 1
 *   Tier 3 (5) — synthèse, lit tout + accumule la mémoire long-terme
 *
 * Chaque agent reçoit : { données métier, agentContext, memoire }
 * Chaque agent retourne : { alertes, data, memoire }
 *   - alertes  : tableau d'alertes à afficher
 *   - data     : résultats spécifiques passés aux agents suivants
 *   - memoire  : données à persister pour les prochains runs
 */

import { calculerCA, calculerCoutsChantier, isChantierActif, fmtN, heuresEmploye, SEUILS } from './donnees';

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ═══════════════════════════════════════════════════════════════
// TIER 1 — ANALYSE PURE (9 agents)
// ═══════════════════════════════════════════════════════════════

// ─── T1-A1 : AlerteChantier ───────────────────────────────────
export function runAlerteChantier({ chantiers, devis, factures = [], parametres }) {
  const alertes = [];
  const actifs = chantiers.filter(isChantierActif);
  const cfg = parametres?.agentsConfig?.alerteChantier || {
    seuilMargeDanger: 0, seuilMargeAttention: SEUILS.margeLimite,
    seuilRetardAttention: 3, seuilRetardCritique: 7,
    seuilBudgetAttention: 5, seuilBudgetDanger: 20,
  };
  const data = { chantiersEnDanger: [], chantiersOk: 0 };

  actifs.forEach(c => {
    try {
      const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
      const joursR = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
      const joursRestants = c.nombreJours > 0 ? c.nombreJours - joursR : null;
      // Retard calendaire : date de fin prévue dépassée ET chantier toujours "en cours"
      let retardJ = joursRestants !== null && joursRestants < 0 ? Math.abs(joursRestants) : 0;
      if (retardJ === 0 && c.dateDebut && c.nombreJours > 0) {
        const finPrevue = new Date(c.dateDebut);
        finPrevue.setDate(finPrevue.getDate() + Math.round(c.nombreJours * 7 / 5));
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (finPrevue < today) {
          retardJ = Math.max(retardJ, Math.floor((today - finPrevue) / 86400000));
        }
      }

      if (couts.montantTotal > 0 && couts.totalCoutsReel > 0) {
        const marge = parseFloat(couts.margeReelPct);
        if (marge < cfg.seuilMargeDanger) {
          data.chantiersEnDanger.push({ id: c.id, nom: c.nom || c.numero, marge, deficit: Math.abs(Math.round(couts.margeReel)) });
          alertes.push({ id: uid('ac-perte'), agent: 'AlerteChantier', type: 'marge', niveau: 'DANGER',
            message: `${c.nom || c.numero} — chantier à perte · marge ${marge.toFixed(1)}%`,
            detail: `Déficit estimé : CHF ${fmtN(Math.abs(Math.round(couts.margeReel)))}`,
            chantier_id: c.id, timestamp: Date.now(), lu: false, action: { page: 'chantiers', ctx: { chantierActif: c.id } } });
        } else if (marge < cfg.seuilMargeAttention) {
          alertes.push({ id: uid('ac-marge'), agent: 'AlerteChantier', type: 'marge', niveau: 'ATTENTION',
            message: `${c.nom || c.numero} — marge faible à ${marge.toFixed(1)}%`,
            detail: `Seuil cible : ${cfg.seuilMargeAttention}% · écart : ${(cfg.seuilMargeAttention - marge).toFixed(1)} pts`,
            chantier_id: c.id, timestamp: Date.now(), lu: false, action: { page: 'chantiers', ctx: { chantierActif: c.id } } });
        } else data.chantiersOk++;
      }

      if (retardJ > cfg.seuilRetardAttention) {
        alertes.push({ id: uid('ac-retard'), agent: 'AlerteChantier', type: 'retard',
          niveau: retardJ > cfg.seuilRetardCritique ? 'CRITIQUE' : 'ATTENTION',
          message: `${c.nom || c.numero} — retard de ${retardJ} jour${retardJ > 1 ? 's' : ''}`,
          detail: `Fin prévue dépassée de ${retardJ}j ouvrables`,
          chantier_id: c.id, timestamp: Date.now(), lu: false, action: { page: 'chantiers', ctx: { chantierActif: c.id } } });
      }

      if (couts.totalCoutsPrevu > 0 && couts.totalCoutsReel > 0) {
        const dep = ((couts.totalCoutsReel - couts.totalCoutsPrevu) / couts.totalCoutsPrevu) * 100;
        if (dep > cfg.seuilBudgetAttention) {
          alertes.push({ id: uid('ac-budget'), agent: 'AlerteChantier', type: 'budget',
            niveau: dep > cfg.seuilBudgetDanger ? 'DANGER' : 'ATTENTION',
            message: `${c.nom || c.numero} — budget dépassé de ${dep.toFixed(0)}%`,
            detail: `Prévu CHF ${fmtN(Math.round(couts.totalCoutsPrevu))} · Réel CHF ${fmtN(Math.round(couts.totalCoutsReel))}`,
            chantier_id: c.id, timestamp: Date.now(), lu: false, action: { page: 'chantiers', ctx: { chantierActif: c.id } } });
        }
      }

      // ── Sur-facturation : total facturé HT > CA × avancement% × 1.1 (tolérance 10%) ──
      const ca = couts.montantTotal;
      const joursRSurf = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
      const avancement = c.nombreJours > 0 ? Math.min(100, Math.round((joursRSurf / c.nombreJours) * 100)) : (parseFloat(c.avancement) || 0);
      if (ca > 0 && avancement < 100) {
        const facturesChantier = factures.filter(f => String(f.chantierId) === String(c.id) && f.statut !== 'annulee');
        const totalFactureHT = facturesChantier.reduce((s, f) => s + (parseFloat(f.montantHT) || (parseFloat(f.montantTTC) || 0) / (1 + (parseFloat(f.tva) || 8.1) / 100) || 0), 0);
        if (totalFactureHT > ca * (avancement / 100) * 1.1) {
          alertes.push({ id: uid('ac-surfact'), agent: 'AlerteChantier', type: 'surfacturation', niveau: 'ATTENTION',
            message: `${c.nom || c.numero} — sur-facturation détectée`,
            detail: `Facturé CHF ${fmtN(Math.round(totalFactureHT))} > CA × avancement (${avancement}%) = CHF ${fmtN(Math.round(ca * avancement / 100))}`,
            chantier_id: c.id, timestamp: Date.now(), lu: false, action: { page: 'finances', ctx: {} } });
        }
      }
    } catch (e) { console.warn('[T1-AlerteChantier]', c.id, e); }
  });

  return { alertes, data };
}

// ─── T1-A2 : SuiviDevis ──────────────────────────────────────
export function runSuiviDevis({ devis, factures, clients }) {
  const alertes = [];
  const now = Date.now();
  const devisAcceptes = (devis || []).filter(d =>
    ['accepté', 'accepte', 'signé', 'signe'].includes((d.statut || '').toLowerCase())
  );
  const data = { nbSansFacture: 0, caPotentiel: 0, tauxConversion: 0 };
  const nbTotal = (devis || []).length;
  const nbAcceptes = devisAcceptes.length;
  data.tauxConversion = nbTotal > 0 ? Math.round((nbAcceptes / nbTotal) * 100) : 0;

  devisAcceptes.forEach(d => {
    try {
      if ((factures || []).some(f => String(f.devisId) === String(d.id))) return;
      const dateRef = d.dateAcceptation || d.dateEmission || d.date;
      if (!dateRef) return;
      const joursDepuis = Math.floor((now - new Date(dateRef)) / 86400000);
      if (joursDepuis < 3) return;
      const client = (clients || []).find(cl => String(cl.id) === String(d.clientId));
      const nomClient = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() || client.entreprise : 'Client inconnu';
      const dateStr = new Date(dateRef).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
      data.nbSansFacture++;
      data.caPotentiel += parseFloat(d.montantHT || d.prixPropose) || 0;
      alertes.push({ id: uid('sd'), agent: 'SuiviDevis', type: 'suivi_devis',
        niveau: joursDepuis > 7 ? 'ATTENTION' : 'INFO',
        message: `Devis ${d.numero || '#' + d.id} — ${nomClient} — aucune facture créée`,
        detail: `Accepté le ${dateStr} · il y a ${joursDepuis} jour${joursDepuis > 1 ? 's' : ''}`,
        devis_id: d.id, timestamp: Date.now(), lu: false, action: { page: 'devis', ctx: { devisActif: d.id } } });
    } catch (e) { console.warn('[T1-SuiviDevis]', d.id, e); }
  });

  return { alertes, data };
}

// ─── T1-A3 : TrésoreriePredictor ─────────────────────────────
export function runTresoreriePredictor({ chantiers, factures, devis, parametres }) {
  try {
    const now = new Date();
    const SEUIL_ALERTE = parseFloat(parametres?.parametres?.seuilTresorerie) || 10000;
    const chargesMensuelles = parseFloat(parametres?.parametres?.chargesMensuelles) || 0;
    const facturesOuvertes = (factures || []).filter(f => ['envoyee', 'partielle', 'retard'].includes(f.statut));
    const totalEncaissement = facturesOuvertes.reduce((s, f) =>
      s + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);

    let enc30 = 0, enc60 = 0, enc90 = 0;
    const j30 = new Date(now); j30.setDate(now.getDate() + 30);
    const j60 = new Date(now); j60.setDate(now.getDate() + 60);
    const j90 = new Date(now); j90.setDate(now.getDate() + 90);

    facturesOuvertes.forEach(f => {
      const restant = Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0));
      const echeance = f.dateEcheance ? new Date(f.dateEcheance) : null;
      if (!echeance || echeance <= j30) enc30 += restant;
      else if (echeance <= j60) enc60 += restant;
      else if (echeance <= j90) enc90 += restant;
    });

    const finMois = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const joursRestantsMois = finMois.getDate() - now.getDate();
    const dec30 = chargesMensuelles * (joursRestantsMois / finMois.getDate());
    const dec60 = dec30 + chargesMensuelles;
    const dec90 = dec60 + chargesMensuelles;
    const solde30 = enc30 - dec30;
    const solde60 = (enc30 + enc60) - dec60;
    const solde90 = (enc30 + enc60 + enc90) - dec90;

    const alertes = [];
    if (totalEncaissement > 0 && solde30 < SEUIL_ALERTE) {
      alertes.push({ id: uid('tp-j30'), agent: 'TresoreriePredictor', type: 'tresorerie',
        niveau: solde30 < 0 ? 'DANGER' : 'ATTENTION',
        message: `Trésorerie J+30 estimée : CHF ${fmtN(Math.round(solde30))}`,
        detail: `Encaissements CHF ${fmtN(Math.round(enc30))} · Charges CHF ${fmtN(Math.round(dec30))}`,
        timestamp: Date.now(), lu: false, action: { page: 'finances', ctx: {} } });
    }

    const data = {
      encaissement30: Math.round(enc30), encaissement60: Math.round(enc60), encaissement90: Math.round(enc90),
      decaissement30: Math.round(dec30), decaissement60: Math.round(dec60), decaissement90: Math.round(dec90),
      solde30: Math.round(solde30), solde60: Math.round(solde60), solde90: Math.round(solde90),
      totalEnAttente: Math.round(totalEncaissement), seuilAlerte: SEUIL_ALERTE, alerte: solde30 < SEUIL_ALERTE,
    };
    return { alertes, data };
  } catch (e) {
    console.warn('[T1-TresoreriePredictor]', e);
    return { alertes: [], data: {} };
  }
}

// ─── T1-A4 : RapportAuto ─────────────────────────────────────
export function runRapportAuto({ chantiers, factures, devis, parametres, dernierRapport }) {
  try {
    const now = new Date();
    const estLundi = now.getDay() === 1;
    const heureSuffisante = now.getHours() >= 7;
    if (dernierRapport) {
      const debut = new Date(now);
      debut.setDate(now.getDate() - now.getDay() + 1);
      debut.setHours(0, 0, 0, 0);
      if (new Date(dernierRapport.timestamp) >= debut) return { alertes: [], data: null };
    }
    const ageDernierMs = dernierRapport?.timestamp ? now.getTime() - new Date(dernierRapport.timestamp).getTime() : Infinity;
    const rattrapage = ageDernierMs > 7 * 86400000;
    if (!rattrapage && (!estLundi || !heureSuffisante)) return { alertes: [], data: null };

    const debutSemaine = new Date(now); debutSemaine.setDate(now.getDate() - 7);
    const actifs = chantiers.filter(isChantierActif);
    const enRetard = actifs.filter(c => {
      const r = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
      return c.nombreJours > 0 && c.nombreJours - r < 0;
    });
    let heuresSemaine = 0;
    actifs.forEach(c => {
      (c.journal || []).forEach(entry => {
        if (!entry.date || new Date(entry.date) < debutSemaine) return;
        (entry.employes || []).forEach(e => { heuresSemaine += parseFloat(e.heuresTravaillees) || 0; });
      });
    });
    const caFactureSemaine = (factures || [])
      .filter(f => f.dateEmission && new Date(f.dateEmission) >= debutSemaine)
      .reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);

    const rapport = {
      id: uid('rapport'), timestamp: Date.now(),
      semaine: `Semaine du ${debutSemaine.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })}`,
      heuresSaisies: Math.round(heuresSemaine), caFacture: Math.round(caFactureSemaine),
      nbActifs: actifs.length, nbTermines: chantiers.filter(c => ['terminé', 'facturé', 'clôturé'].includes((c.statut || '').toLowerCase()) && c.dateFin && new Date(c.dateFin) >= debutSemaine).length,
      nbEnRetard: enRetard.length, chantierRetard: enRetard.map(c => c.nom || c.numero), nouveau: true,
    };
    return { alertes: [], data: rapport };
  } catch (e) { return { alertes: [], data: null }; }
}

// ─── T1-A5 : MémoireChantier ─────────────────────────────────
export function runMemoireChantier({ chantiers, devis, parametres }) {
  try {
    const STATUTS_TERMINES = ['terminé', 'facturé', 'clôturé'];
    const termines = chantiers.filter(c => STATUTS_TERMINES.includes((c.statut || '').toLowerCase()));
    const patterns = {};

    termines.forEach(c => {
      try {
        const type = c.typeChantier || (c.typesTravaux?.[0]) || 'Autre';
        const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
        if (couts.totalCoutsPrevu <= 0 || couts.totalCoutsReel <= 0) return;
        const ecartPct = ((couts.totalCoutsReel - couts.totalCoutsPrevu) / couts.totalCoutsPrevu) * 100;
        const ca = calculerCA(c, devis);
        const marge = ca > 0 ? ((ca - couts.totalCoutsReel) / ca) * 100 : null;
        if (!patterns[type]) patterns[type] = { type, ecarts: [], marges: [], durees: [], count: 0 };
        patterns[type].ecarts.push(ecartPct);
        if (marge !== null) patterns[type].marges.push(marge);
        const dureeReelle = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
        if (dureeReelle > 0 && c.nombreJours > 0) patterns[type].durees.push(dureeReelle / c.nombreJours);
        patterns[type].count++;
      } catch {}
    });

    Object.keys(patterns).forEach(type => {
      const p = patterns[type];
      const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
      const sorted = (arr) => [...arr].sort((a, b) => a - b);
      p.ecartMoyen = avg(p.ecarts);
      p.ecartMedian = p.ecarts.length ? sorted(p.ecarts)[Math.floor(p.ecarts.length / 2)] : null;
      p.margeMoyenne = avg(p.marges);
      p.ratioTempsMoyen = avg(p.durees);
      delete p.ecarts; delete p.marges; delete p.durees;
    });

    return { alertes: [], data: patterns };
  } catch (e) { return { alertes: [], data: {} }; }
}

// ─── T1-A6 : ProductivitéEquipe ──────────────────────────────
export function runProductiviteEquipe({ chantiers, parametres, memoire = {} }) {
  try {
    const employes = (parametres?.employes || []).filter(e => e.actif !== false);
    const alertes = [];
    const statsParEmploye = {};
    const now = new Date();
    const semaine = new Date(now); semaine.setDate(now.getDate() - 7);

    employes.forEach(emp => {
      let heuresTotal = 0, heuresSemaine = 0, joursActifs = 0, chantiersActifs = 0;
      const parChantier = [];

      chantiers.forEach(c => {
        const heures = heuresEmploye(c.journal || [], emp.id);
        if (heures === 0) return;
        const heuresSem = heuresEmploye(
          (c.journal || []).filter(e => new Date(e.date) >= semaine),
          emp.id
        );
        const joursC = new Set((c.journal || []).filter(e =>
          (e.employes || []).some(ej => String(ej.employeId) === String(emp.id) && parseFloat(ej.heuresTravaillees) > 0)
        ).map(e => e.date)).size;
        heuresTotal += heures;
        heuresSemaine += heuresSem;
        joursActifs += joursC;
        if (isChantierActif(c)) chantiersActifs++;
        parChantier.push({ nom: c.nom || c.numero, heures, joursC });
      });

      const tarifJour = parseFloat(emp.tarifJour) || 0;
      const coutReel = (heuresTotal / 8) * tarifJour;
      const moyenneHeuresJour = joursActifs > 0 ? heuresTotal / joursActifs : 0;

      // Alerte si surcharge semaine (>45h)
      if (heuresSemaine > 45) {
        alertes.push({ id: uid('pe-surcharge'), agent: 'ProductiviteEquipe', type: 'rh',
          niveau: 'ATTENTION',
          message: `${emp.nom} — surcharge hebdomadaire : ${heuresSemaine}h cette semaine`,
          detail: `CCT Romande : 41–45h max · dépassement de ${Math.round(heuresSemaine - 41)}h`,
          timestamp: Date.now(), lu: false, action: { page: 'heures', ctx: {} } });
      }

      // Alerte si sous-activité (employé actif, < 20h semaine)
      if (chantiersActifs > 0 && heuresSemaine > 0 && heuresSemaine < 20) {
        alertes.push({ id: uid('pe-sous'), agent: 'ProductiviteEquipe', type: 'rh',
          niveau: 'INFO',
          message: `${emp.nom} — sous-activité : ${heuresSemaine}h cette semaine`,
          detail: `Présence faible sur ${chantiersActifs} chantier(s) actif(s)`,
          timestamp: Date.now(), lu: false, action: { page: 'heures', ctx: {} } });
      }

      statsParEmploye[emp.id] = {
        id: emp.id, nom: emp.nom, poste: emp.poste,
        heuresTotal, heuresSemaine, joursActifs, chantiersActifs,
        moyenneHeuresJour: Math.round(moyenneHeuresJour * 10) / 10,
        coutReel: Math.round(coutReel), tarifJour,
        parChantier: parChantier.sort((a, b) => b.heures - a.heures).slice(0, 5),
      };
    });

    // Mémorise les totaux hebdomadaires
    const hist = memoire.historique || [];
    hist.unshift({ semaine: semaine.toISOString().split('T')[0], statsParEmploye, timestamp: Date.now() });

    return { alertes, data: { statsParEmploye, nbEmployes: employes.length }, memoire: { historique: hist.slice(0, 12) } };
  } catch (e) { console.warn('[T1-ProductiviteEquipe]', e); return { alertes: [], data: {}, memoire: {} }; }
}

// ─── T1-A7 : RelancePaiements ─────────────────────────────────
export function runRelancePaiements({ factures, clients, memoire = {} }) {
  try {
    const alertes = [];
    const now = Date.now();
    const facturesOuvertes = (factures || []).filter(f => ['envoyee', 'partielle', 'retard'].includes(f.statut));
    const stats = { nb30: 0, nb60: 0, nb90: 0, montant30: 0, montant60: 0, montant90: 0, dsoParClient: {} };

    facturesOuvertes.forEach(f => {
      const dateRef = f.dateEmission || f.dateFacture || f.creeLe;
      if (!dateRef) return;
      const jours = Math.floor((now - new Date(dateRef)) / 86400000);
      const restant = Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0));
      const client = (clients || []).find(c => String(c.id) === String(f.clientId));
      const nomClient = client?.entreprise || `${client?.prenom || ''} ${client?.nom || ''}`.trim() || 'Inconnu';

      if (jours >= 90) {
        stats.nb90++; stats.montant90 += restant;
        alertes.push({ id: uid('rp-90'), agent: 'RelancePaiements', type: 'paiement', niveau: 'DANGER',
          message: `${nomClient} — facture en retard depuis ${jours} jours`,
          detail: `CHF ${fmtN(Math.round(restant))} — relance urgente requise (3ème niveau)`,
          timestamp: now, lu: false, action: { page: 'finances', ctx: {} } });
      } else if (jours >= 60) {
        stats.nb60++; stats.montant60 += restant;
        alertes.push({ id: uid('rp-60'), agent: 'RelancePaiements', type: 'paiement', niveau: 'ATTENTION',
          message: `${nomClient} — facture impayée depuis ${jours} jours`,
          detail: `CHF ${fmtN(Math.round(restant))} — 2ème relance recommandée`,
          timestamp: now, lu: false, action: { page: 'finances', ctx: {} } });
      } else if (jours >= 30) {
        stats.nb30++; stats.montant30 += restant;
        alertes.push({ id: uid('rp-30'), agent: 'RelancePaiements', type: 'paiement', niveau: 'INFO',
          message: `${nomClient} — facture à relancer (${jours}j)`,
          detail: `CHF ${fmtN(Math.round(restant))} — 1ère relance si non réglée`,
          timestamp: now, lu: false, action: { page: 'finances', ctx: {} } });
      }

      // DSO par client
      const cid = String(f.clientId);
      if (!stats.dsoParClient[cid]) stats.dsoParClient[cid] = { nom: nomClient, totalJours: 0, nb: 0 };
      stats.dsoParClient[cid].totalJours += jours;
      stats.dsoParClient[cid].nb++;
    });

    Object.values(stats.dsoParClient).forEach(c => { c.dso = c.nb > 0 ? Math.round(c.totalJours / c.nb) : 0; });

    // Mémorise DSO historique
    const hist = memoire.dsoHistorique || [];
    const dsoMoyen = facturesOuvertes.length > 0
      ? Math.round(Object.values(stats.dsoParClient).reduce((s, c) => s + c.totalJours, 0) / Math.max(1, Object.values(stats.dsoParClient).reduce((s, c) => s + c.nb, 0)))
      : 0;
    hist.unshift({ date: new Date().toISOString().split('T')[0], dsoMoyen, nb30: stats.nb30, nb60: stats.nb60, nb90: stats.nb90 });

    return { alertes, data: stats, memoire: { dsoHistorique: hist.slice(0, 52) } };
  } catch (e) { return { alertes: [], data: {}, memoire: {} }; }
}

// ─── T1-A8 : AnomaliesDonnées ─────────────────────────────────
export function runAnomaliesDonnees({ chantiers, devis, factures, clients, parametres }) {
  const alertes = [];
  const anomalies = [];

  // Chantier sans devis lié
  chantiers.forEach(c => {
    if (!c.devisId && isChantierActif(c)) {
      anomalies.push(`Chantier "${c.nom || c.numero}" actif sans devis — CA incalculable`);
      alertes.push({ id: uid('ad-nodev'), agent: 'AnomaliesDonnees', type: 'donnees', niveau: 'ATTENTION',
        message: `Chantier "${c.nom || c.numero}" — aucun devis lié`,
        detail: 'CA et marges incalculables tant que le devis n\'est pas attaché',
        chantier_id: c.id, timestamp: Date.now(), lu: false, action: { page: 'chantiers', ctx: { chantierActif: c.id } } });
    }
    // Facture liée à un client supprimé
    if (c.clientId && !(clients || []).some(cl => String(cl.id) === String(c.clientId))) {
      anomalies.push(`Chantier "${c.nom || c.numero}" — clientId orphelin`);
    }
  });

  // Facture sans clientId
  (factures || []).forEach(f => {
    if (!f.clientId) anomalies.push(`Facture ${f.numero || f.id} sans clientId`);
    if (!f.chantierId && !f.devisId) anomalies.push(`Facture ${f.numero || f.id} sans lien chantier/devis`);
  });

  // Employé sans tarifJour
  (parametres?.employes || []).filter(e => e.actif !== false).forEach(emp => {
    if (!emp.tarifJour || emp.tarifJour <= 0) {
      anomalies.push(`Employé ${emp.nom} — tarifJour manquant ou nul`);
      alertes.push({ id: uid('ad-tarif'), agent: 'AnomaliesDonnees', type: 'donnees', niveau: 'ATTENTION',
        message: `${emp.nom} — tarif journalier manquant`,
        detail: 'Les coûts MO de cet employé sont incorrects dans tous les calculs',
        timestamp: Date.now(), lu: false, action: { page: 'employes', ctx: {} } });
    }
  });

  const score = Math.max(0, 100 - anomalies.length * 8);
  return { alertes, data: { anomalies, score, nbAnomalies: anomalies.length } };
}

// ─── T1-A9 : OptimisationFacturation ─────────────────────────
export function runOptimisationFacturation({ chantiers, factures, devis, parametres }) {
  const alertes = [];
  const opportunites = [];

  chantiers.forEach(c => {
    if (!isChantierActif(c) && (c.statut || '').toLowerCase() !== 'planifié') return;
    const ca = calculerCA(c, devis);
    if (!ca || ca <= 0) return;

    const joursR = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
    const avancement = c.nombreJours > 0 ? Math.min(100, Math.round((joursR / c.nombreJours) * 100)) : parseFloat(c.avancement) || 0;
    if (avancement < 25) return;

    const dejaFacture = (factures || [])
      .filter(f => String(f.chantierId) === String(c.id))
      .reduce((s, f) => s + (parseFloat(f.montantHT || f.montantTTC) || 0), 0);

    const facturable = Math.max(0, ca * (avancement / 100) - dejaFacture);
    if (facturable < 1000) return;

    opportunites.push({ id: c.id, nom: c.nom || c.numero, avancement, ca, dejaFacture, facturable: Math.round(facturable) });

    if (facturable > 5000) {
      alertes.push({ id: uid('of-fact'), agent: 'OptimisationFacturation', type: 'facturation',
        niveau: facturable > 20000 ? 'ATTENTION' : 'INFO',
        message: `${c.nom || c.numero} — CHF ${fmtN(Math.round(facturable))} facturable`,
        detail: `Avancement : ${avancement}% · Déjà facturé : CHF ${fmtN(Math.round(dejaFacture))}`,
        chantier_id: c.id, timestamp: Date.now(), lu: false, action: { page: 'factures', ctx: {} } });
    }
  });

  const totalFacturable = opportunites.reduce((s, o) => s + o.facturable, 0);
  return { alertes, data: { opportunites, totalFacturable } };
}

// ═══════════════════════════════════════════════════════════════
// TIER 2 — INTELLIGENCE CROISÉE (6 agents)
// ═══════════════════════════════════════════════════════════════

// ─── T2-A10 : ConflitsPlanning ────────────────────────────────
export function runConflitsPlanning({ chantiers, parametres, agentContext }) {
  const alertes = [];
  const actifs = chantiers.filter(isChantierActif);
  const conflits = [];

  // Détecte les chantiers sans équipe assignée
  actifs.forEach(c => {
    if (!c.equipe || c.equipe.length === 0) {
      alertes.push({ id: uid('cp-noeq'), agent: 'ConflitsPlanning', type: 'planning', niveau: 'ATTENTION',
        message: `${c.nom || c.numero} — aucune équipe assignée`,
        detail: 'Chantier actif sans membres d\'équipe — saisie d\'heures impossible',
        chantier_id: c.id, timestamp: Date.now(), lu: false, action: { page: 'chantiers', ctx: { chantierActif: c.id } } });
    }
  });

  // Détecte les employés sur trop de chantiers simultanés (> 2 actifs)
  const empChantiers = {};
  actifs.forEach(c => {
    (c.equipe || []).forEach(m => {
      const eid = String(m.employeId);
      if (!empChantiers[eid]) empChantiers[eid] = [];
      empChantiers[eid].push(c.nom || c.numero);
    });
  });

  // eslint-disable-next-line no-unused-vars
  const statsProductivite = agentContext?.ProductiviteEquipe?.statsParEmploye || {};
  Object.entries(empChantiers).forEach(([eid, noms]) => {
    if (noms.length > 3) {
      const emp = (parametres?.employes || []).find(e => String(e.id) === eid);
      const nom = emp?.nom || `Employé #${eid}`;
      conflits.push({ employeId: eid, nom, nbChantiers: noms.length, chantiers: noms });
      alertes.push({ id: uid('cp-surp'), agent: 'ConflitsPlanning', type: 'planning', niveau: 'ATTENTION',
        message: `${nom} — sur ${noms.length} chantiers actifs simultanément`,
        detail: `Dispersion risquée : ${noms.slice(0, 3).join(', ')}${noms.length > 3 ? '...' : ''}`,
        timestamp: Date.now(), lu: false, action: { page: 'planning', ctx: {} } });
    }
  });

  return { alertes, data: { conflits, empChantiers } };
}

// ─── T2-A10b : PlanningCohérence ─────────────────────────────
export function runPlanningCoherence({ chantiers, devis, parametres }) {
  const alertes = [];
  const todayStr = new Date().toISOString().split('T')[0];

  chantiers.forEach(c => {
    const devisLie = devis.find(d => String(d.id) === String(c.devisId));
    const journal = c.journal || [];

    // 1. Démarrage avant acceptation du devis
    if (c.dateDebut && devisLie?.dateAcceptation && c.dateDebut < devisLie.dateAcceptation) {
      alertes.push({
        id: uid('pc-avt'),
        agent: 'PlanningCoherence',
        type: 'coherence_planning',
        niveau: 'ATTENTION',
        message: `${c.nom || c.numero} — démarré avant la signature du devis`,
        detail: `Début chantier : ${c.dateDebut} · Acceptation devis : ${devisLie.dateAcceptation}`,
        chantier_id: c.id,
        timestamp: Date.now(),
        lu: false,
        action: { page: 'chantiers', ctx: { chantierActif: c.id } },
      });
    }

    // 2. Heures de samedi saisies sans inclusSamedi activé
    const datesSamedi = journal
      .map(e => e.date)
      .filter(d => d && new Date(d + 'T00:00:00').getDay() === 6);
    if (datesSamedi.length > 0 && !c.inclusSamedi) {
      alertes.push({
        id: uid('pc-sam'),
        agent: 'PlanningCoherence',
        type: 'samedi_non_planifie',
        niveau: 'INFO',
        message: `${c.nom || c.numero} — ${datesSamedi.length} samedi(s) travaillé(s) sans flag "Inclus samedi"`,
        detail: `Samedi(s) : ${datesSamedi.slice(0, 3).join(', ')}${datesSamedi.length > 3 ? '…' : ''} · Activez "Inclus samedi" sur le planning pour un calcul de durée correct`,
        chantier_id: c.id,
        timestamp: Date.now(),
        lu: false,
        action: { page: 'planning', ctx: {} },
      });
    }

    // 3. Dates dans le futur dans le journal (anomalie saisie)
    const datesFutures = journal.map(e => e.date).filter(d => d && d > todayStr);
    if (datesFutures.length > 0) {
      alertes.push({
        id: uid('pc-fut'),
        agent: 'PlanningCoherence',
        type: 'date_future_journal',
        niveau: 'ATTENTION',
        message: `${c.nom || c.numero} — ${datesFutures.length} entrée(s) de journal avec date future`,
        detail: `Dates : ${datesFutures.slice(0, 3).join(', ')} · Vérifier la saisie`,
        chantier_id: c.id,
        timestamp: Date.now(),
        lu: false,
        action: { page: 'heures', ctx: {} },
      });
    }

    // 4. joursRealises vs avancement manuel : incohérence détectée
    const joursRealises = new Set(journal.map(e => e.date).filter(Boolean)).size;
    const avancementManuel = parseFloat(c.avancement) || 0;
    const joursPlannifies = parseInt(c.nombreJours) || 0;
    if (joursPlannifies > 0 && joursRealises > 0 && avancementManuel > 0) {
      const avancementJournal = Math.min(100, Math.round(joursRealises / joursPlannifies * 100));
      const ecart = Math.abs(avancementManuel - avancementJournal);
      if (ecart >= 20) {
        alertes.push({
          id: uid('pc-av'),
          agent: 'PlanningCoherence',
          type: 'avancement_incoherent',
          niveau: 'INFO',
          message: `${c.nom || c.numero} — avancement manuel (${avancementManuel}%) vs journal (${avancementJournal}%)`,
          detail: `${joursRealises}j réalisés sur ${joursPlannifies}j prévus · Écart de ${ecart}% avec l'avancement saisi manuellement`,
          chantier_id: c.id,
          timestamp: Date.now(),
          lu: false,
          action: { page: 'chantiers', ctx: { chantierActif: c.id } },
        });
      }
    }
  });

  const samediParChantier = chantiers
    .filter(c => !c.inclusSamedi && (c.journal || []).some(e => e.date && new Date(e.date + 'T00:00:00').getDay() === 6))
    .map(c => ({ id: c.id, nom: c.nom || c.numero }));

  return {
    alertes,
    data: {
      chantiersAvantDevis: alertes.filter(a => a.type === 'coherence_planning').length,
      samediParChantier,
      datesFutures: alertes.filter(a => a.type === 'date_future_journal').length,
      avancementIncoherents: alertes.filter(a => a.type === 'avancement_incoherent').length,
    },
  };
}

// ─── T2-A11 : ApprentissageMarge ─────────────────────────────
export function runApprentissageMarge({ chantiers, devis, parametres, agentContext, memoire = {} }) {
  const alertes = [];
  const patterns = agentContext?.MemoireChantier || {};
  const predictions = [];

  chantiers.filter(isChantierActif).forEach(c => {
    const type = c.typeChantier || (c.typesTravaux?.[0]) || 'Autre';
    const pattern = patterns[type];
    if (!pattern || pattern.count < 2) return;

    const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
    if (couts.totalCoutsPrevu <= 0) return;

    // Prédiction basée sur l'écart historique moyen
    const coutPredictif = couts.totalCoutsPrevu * (1 + (pattern.ecartMoyen || 0) / 100);
    const ca = calculerCA(c, devis);
    const margePredictive = ca > 0 ? ((ca - coutPredictif) / ca) * 100 : null;

    predictions.push({ chantierId: c.id, nom: c.nom || c.numero, type, ecartHistorique: pattern.ecartMoyen, margePredictive, coutPredictif: Math.round(coutPredictif), count: pattern.count });

    if (margePredictive !== null && margePredictive < SEUILS.margeLimite) {
      alertes.push({ id: uid('am-pred'), agent: 'ApprentissageMarge', type: 'prediction', niveau: 'ATTENTION',
        message: `${c.nom || c.numero} — marge finale prédite à ${margePredictive.toFixed(1)}%`,
        detail: `Basé sur ${pattern.count} chantiers "${type}" similaires · écart habituel +${pattern.ecartMoyen?.toFixed(1)}%`,
        chantier_id: c.id, timestamp: Date.now(), lu: false, action: { page: 'chantiers', ctx: { chantierActif: c.id } } });
    }
  });

  // Accumule la confiance des prédictions
  const hist = memoire.predictionsHistorique || [];
  hist.unshift({ date: new Date().toISOString().split('T')[0], nb: predictions.length, timestamp: Date.now() });

  return { alertes, data: { predictions }, memoire: { predictionsHistorique: hist.slice(0, 24) } };
}

// ─── T2-A12 : SantéClient ─────────────────────────────────────
export function runSanteClient({ chantiers, clients, devis, factures, parametres, agentContext }) {
  const alertes = [];
  const dsoData = agentContext?.RelancePaiements?.dsoParClient || {};
  const statsClients = [];

  (clients || []).forEach(cl => {
    const mesChantiers = chantiers.filter(c => String(c.clientId) === String(cl.id));
    if (mesChantiers.length === 0) return;

    const avecCA = mesChantiers.filter(c => calculerCA(c, devis) !== null);
    const caTotal = avecCA.reduce((s, c) => s + calculerCA(c, devis), 0);
    const coutTotal = avecCA.reduce((s, c) => s + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
    const marge = caTotal > 0 ? ((caTotal - coutTotal) / caTotal) * 100 : null;
    const facturesClient = (factures || []).filter(f => String(f.clientId) === String(cl.id));
    const totalFacture = facturesClient.reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);
    const totalPaye = facturesClient.reduce((s, f) => s + (parseFloat(f.montantPaye) || 0), 0);
    const dso = dsoData[String(cl.id)]?.dso || 0;

    const nom = cl.entreprise || `${cl.prenom || ''} ${cl.nom || ''}`.trim();
    statsClients.push({ id: cl.id, nom, caTotal, marge, totalFacture, totalPaye, dso, nbChantiers: mesChantiers.length });

    // Alerte client mauvais payeur (DSO > 45j)
    if (dso > 45) {
      alertes.push({ id: uid('sc-dso'), agent: 'SanteClient', type: 'client', niveau: dso > 75 ? 'DANGER' : 'ATTENTION',
        message: `${nom} — délai de paiement moyen : ${dso} jours`,
        detail: `Standard BTP Suisse : 30 jours · Écart : +${dso - 30}j`,
        timestamp: Date.now(), lu: false, action: { page: 'finances', ctx: {} } });
    }

    // Alerte marge faible sur client
    if (marge !== null && marge < SEUILS.margeLimite && caTotal > 20000) {
      alertes.push({ id: uid('sc-marge'), agent: 'SanteClient', type: 'client', niveau: 'ATTENTION',
        message: `${nom} — marge faible : ${marge.toFixed(1)}% sur CHF ${fmtN(Math.round(caTotal))}`,
        detail: `Ce client génère peu de rentabilité — réviser les tarifs`,
        timestamp: Date.now(), lu: false, action: { page: 'rapport', ctx: {} } });
    }
  });

  statsClients.sort((a, b) => b.caTotal - a.caTotal);
  return { alertes, data: { statsClients, topClients: statsClients.slice(0, 5) } };
}

// ─── T2-A13 : ProjectionAnnuelle ──────────────────────────────
export function runProjectionAnnuelle({ chantiers, factures, devis, parametres, agentContext, memoire = {} }) {
  try {
    const now = new Date();
    const annee = now.getFullYear();
    const moisActuel = now.getMonth(); // 0-11
    const tresorerie = agentContext?.TresoreriePredictor || {};

    // CA réalisé cette année
    const chantiersAnnee = chantiers.filter(c => {
      const d = new Date(c.dateDebut || c.creeLe);
      return d.getFullYear() === annee && calculerCA(c, devis) !== null;
    });
    const caRealise = chantiersAnnee.reduce((s, c) => s + calculerCA(c, devis), 0);
    const moyenneMensuelle = moisActuel > 0 ? caRealise / (moisActuel + 1) : caRealise;
    const projectionAnnuelle = moyenneMensuelle * 12;
    const moisRestants = 11 - moisActuel;
    const caProjecte = caRealise + moyenneMensuelle * moisRestants;

    // Pipeline commercial (devis en cours)
    const devisEnAttente = (devis || []).filter(d => ['en attente', 'envoyé', 'envoyee'].includes((d.statut || '').toLowerCase()));
    const caPipeline = devisEnAttente.reduce((s, d) => s + (parseFloat(d.montantHT || d.prixPropose) || 0), 0);

    // Coûts réels year-to-date
    const coutsRealises = chantiersAnnee.reduce((s, c) => s + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
    const margeYTD = caRealise > 0 ? ((caRealise - coutsRealises) / caRealise) * 100 : null;

    // Chargement objectif depuis localStorage
    let objectifCA = null;
    try { const obj = JSON.parse(localStorage.getItem('cyna_objectifs') || '{}'); objectifCA = obj.caAnnuel || null; } catch {}
    const txAtteinte = objectifCA && objectifCA > 0 ? Math.round((caProjecte / objectifCA) * 100) : null;

    const alertes = [];
    if (txAtteinte !== null && txAtteinte < 80) {
      alertes.push({ id: uid('pa-obj'), agent: 'ProjectionAnnuelle', type: 'projection', niveau: 'ATTENTION',
        message: `Objectif annuel : projection à ${txAtteinte}% seulement`,
        detail: `Projeté CHF ${fmtN(Math.round(caProjecte))} vs objectif CHF ${fmtN(Math.round(objectifCA))}`,
        timestamp: Date.now(), lu: false, action: { page: 'rapport', ctx: {} } });
    }

    // Mémorise les projections mensuelles
    const hist = memoire.projHistorique || [];
    hist.unshift({ date: new Date().toISOString().split('T')[0], caRealise: Math.round(caRealise), caProjecte: Math.round(caProjecte), margeYTD, timestamp: Date.now() });

    const data = {
      caRealise: Math.round(caRealise), moyenneMensuelle: Math.round(moyenneMensuelle),
      caProjecte: Math.round(caProjecte), projectionAnnuelle: Math.round(projectionAnnuelle),
      coutsRealises: Math.round(coutsRealises), margeYTD,
      caPipeline: Math.round(caPipeline), nbDevisEnAttente: devisEnAttente.length,
      objectifCA, txAtteinte, moisRestants,
    };
    return { alertes, data, memoire: { projHistorique: hist.slice(0, 24) } };
  } catch (e) { return { alertes: [], data: {}, memoire: {} }; }
}

// ─── T2-A14 : BenchmarkTypeTravaux ────────────────────────────
export function runBenchmarkTypeTravaux({ chantiers, devis, parametres, agentContext }) {
  const alertes = [];
  const patterns = agentContext?.MemoireChantier || {};
  const benchmark = [];

  (parametres?.typesTravaux || []).forEach(t => {
    const chantiersDuType = chantiers.filter(c => (c.typesTravaux || []).includes(t.nom) && calculerCA(c, devis) !== null);
    if (chantiersDuType.length === 0) return;

    const caTotal = chantiersDuType.reduce((s, c) => s + calculerCA(c, devis), 0);
    const coutTotal = chantiersDuType.reduce((s, c) => s + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
    const marge = caTotal > 0 ? ((caTotal - coutTotal) / caTotal) * 100 : null;
    const pattern = patterns[t.nom];

    benchmark.push({
      nom: t.nom, nbChantiers: chantiersDuType.length, caTotal, marge,
      margeCible: 20, ecartCible: marge !== null ? marge - 20 : null,
      margeMoyenneHistorique: pattern?.margeMoyenne || null,
      ecartHistorique: pattern?.ecartMoyen || null,
    });

    if (marge !== null && marge < SEUILS.margeLimite) {
      alertes.push({ id: uid('bt-marge'), agent: 'BenchmarkTypeTravaux', type: 'benchmark', niveau: 'ATTENTION',
        message: `Type "${t.nom}" — marge globale : ${marge.toFixed(1)}% (objectif ≥ ${SEUILS.margeRentable}%)`,
        detail: `${chantiersDuType.length} chantier(s) · CA CHF ${fmtN(Math.round(caTotal))}`,
        timestamp: Date.now(), lu: false, action: { page: 'rapport', ctx: {} } });
    }
  });

  benchmark.sort((a, b) => (a.marge ?? -999) - (b.marge ?? -999));
  return { alertes, data: { benchmark } };
}

// ─── T2-A15 : ConformitéBTP ───────────────────────────────────
export function runConformiteBTP({ chantiers, parametres, agentContext }) {
  const alertes = [];
  const violations = [];
  const statsHeures = agentContext?.ProductiviteEquipe?.statsParEmploye || {};

  // Vérifie dépassement 8h/jour par employé par chantier
  chantiers.forEach(c => {
    (c.journal || []).forEach(entry => {
      (entry.employes || []).forEach(ej => {
        const h = parseFloat(ej.heuresTravaillees) || 0;
        if (h > 10) {
          const emp = (parametres?.employes || []).find(e => String(e.id) === String(ej.employeId));
          const nom = emp?.nom || `Employé #${ej.employeId}`;
          violations.push(`${nom} — ${h}h le ${entry.date} sur "${c.nom || c.numero}"`);
        }
      });
    });
  });

  // Alerte si violations CCT détectées
  if (violations.length > 0) {
    alertes.push({ id: uid('cb-cct'), agent: 'ConformiteBTP', type: 'conformite', niveau: 'ATTENTION',
      message: `${violations.length} dépassement(s) horaire(s) CCT détecté(s)`,
      detail: `CCT Romande : max 10h/jour · ${violations[0]}`,
      timestamp: Date.now(), lu: false, action: { page: 'heures', ctx: {} } });
  }

  // Vérifie employés sans LPP (< 22 ans ou > 70 ans non géré)
  (parametres?.employes || []).filter(e => e.actif !== false).forEach(emp => {
    if (!emp.tarifDejaCharge && (!parametres?.parametres?.coefficientMainOeuvre || parametres.parametres.coefficientMainOeuvre < 1.3)) {
      violations.push(`${emp.nom} — coefficient MO insuffisant (< 1.30) pour couvrir les charges sociales GE`);
    }
  });

  return { alertes, data: { violations, nbViolations: violations.length } };
}

// ─── T2-A17b : DerivePredictor ────────────────────────────────────
export function runDerivePredictor({ chantiers, devis, parametres, agentContext }) {
  const resultats = [];

  chantiers.filter(isChantierActif).forEach(c => {
    const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
    const joursRealises = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
    const avancement = c.nombreJours > 0
      ? Math.min(100, Math.round((joursRealises / c.nombreJours) * 100))
      : Math.min(100, Math.max(0, parseFloat(c.avancement) || 0));
    const CA = couts.montantTotal || 0;

    if (avancement < 15 || joursRealises === 0 || CA === 0) return;
    const coutActuel = couts.totalCoutsReel || 0;
    if (coutActuel === 0) return;

    // Calibrage mémoire — correction basée sur l'historique de ce type de chantier
    const type = c.typeChantier || c.typesTravaux?.[0];
    const memPatterns = agentContext?.MemoireChantier || {};
    const pattern = type && memPatterns[type];
    // Si ≥3 chantiers du même type terminés → appliquer le facteur de dérive historique
    const facteurCalibration = (pattern && pattern.count >= 3 && pattern.ecartMoyen !== null)
      ? 1 + Math.max(0, pattern.ecartMoyen / 100)
      : 1;
    const memCalibree = facteurCalibration > 1;

    // EAC = coût à l'achèvement projeté (calibré par la mémoire si disponible)
    const EAC_brut = coutActuel / (avancement / 100);
    const EAC = Math.round(EAC_brut * facteurCalibration);
    const margeEstimee = CA - EAC;
    const margeEstimeePct = Math.round((margeEstimee / CA) * 1000) / 10;

    // Dérive budget
    const depassementBudget = EAC - (couts.totalCoutsPrevu || 0);
    const pctDepassement = couts.totalCoutsPrevu > 0
      ? Math.round((depassementBudget / couts.totalCoutsPrevu) * 1000) / 10
      : null;

    // Dérive délai — calibrée par le ratio temps historique si disponible
    const vitesse = avancement / joursRealises; // %/jour
    const ratioTemps = (pattern && pattern.count >= 3 && pattern.ratioTempsMoyen !== null)
      ? pattern.ratioTempsMoyen
      : 1;
    const joursNecessaires = vitesse > 0 ? Math.round((100 / vitesse) * ratioTemps) : null;
    const deriveJours = joursNecessaires !== null && c.nombreJours > 0
      ? joursNecessaires - c.nombreJours
      : null;

    const confiance = memCalibree
      ? (avancement >= 60 ? 'élevée (+mémoire)' : avancement >= 30 ? 'moyenne (+mémoire)' : 'faible (+mémoire)')
      : (avancement >= 60 ? 'élevée' : avancement >= 30 ? 'moyenne' : 'faible');

    let statut = 'vert';
    let statutTexte = 'Dans les objectifs';
    if (margeEstimeePct < 0) { statut = 'rouge'; statutTexte = 'Perte estimée'; }
    else if (margeEstimeePct < SEUILS.margeLimite) { statut = 'orange'; statutTexte = 'Marge faible'; }
    else if (pctDepassement !== null && pctDepassement > 15) { statut = 'orange'; statutTexte = 'Dérive budget'; }

    resultats.push({
      chantierId: c.id, nom: c.nom || c.numero, avancement,
      coutActuel: Math.round(coutActuel), EAC: Math.round(EAC), CA: Math.round(CA),
      margeEstimee: Math.round(margeEstimee), margeEstimeePct,
      depassementBudget: Math.round(depassementBudget), pctDepassement,
      joursRealises, joursNecessaires, deriveJours, confiance, statut, statutTexte,
      memCalibree, typeChantier: type || null,
      nbHistorique: pattern?.count || 0,
    });
  });

  resultats.sort((a, b) => ({ rouge: 0, orange: 1, vert: 2 }[a.statut] ?? 2) - ({ rouge: 0, orange: 1, vert: 2 }[b.statut] ?? 2));

  const alertes = resultats.filter(r => r.statut !== 'vert').map(r => ({
    id: uid('dp-d'), agent: 'DerivePredictor', type: 'derive_budget',
    niveau: r.statut === 'rouge' ? 'CRITIQUE' : 'ATTENTION',
    message: `${r.nom} — ${r.statutTexte} · marge estimée ${r.margeEstimeePct}%`,
    detail: `EAC CHF ${fmtN(r.EAC)} · Avancement ${r.avancement}% · Confiance ${r.confiance}`,
    chantier_id: r.chantierId, timestamp: Date.now(), lu: false,
    action: { page: 'chantiers', ctx: { chantierActif: r.chantierId } },
  }));

  return { alertes, data: { resultats } };
}

// ═══════════════════════════════════════════════════════════════
// TIER 3 — SYNTHÈSE (5 agents)
// ═══════════════════════════════════════════════════════════════

// ─── T3-A16 : RadarPrécoce ────────────────────────────────────
export function runRadarPrecoce({ chantiers, devis, parametres, agentContext }) {
  const alertes = [];
  const risques = [];

  chantiers.filter(isChantierActif).forEach(c => {
    let score = 0;
    const facteurs = [];

    // Facteur 1 : marge faible
    const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
    if (couts.montantTotal > 0 && couts.totalCoutsReel > 0) {
      const marge = parseFloat(couts.margeReelPct);
      if (marge < 0) { score += 40; facteurs.push(`marge à perte (${marge.toFixed(1)}%)`); }
      else if (marge < SEUILS.margeLimite) { score += 20; facteurs.push(`marge faible (${marge.toFixed(1)}%)`); }
    }

    // Facteur 2 : retard
    const joursR = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
    const joursRestants = c.nombreJours > 0 ? c.nombreJours - joursR : null;
    if (joursRestants !== null && joursRestants < -7) { score += 30; facteurs.push(`retard critique (${Math.abs(joursRestants)}j)`); }
    else if (joursRestants !== null && joursRestants < 0) { score += 15; facteurs.push(`retard (${Math.abs(joursRestants)}j)`); }

    // Facteur 3 : budget dépassé
    if (couts.totalCoutsPrevu > 0 && couts.totalCoutsReel > 0) {
      const dep = ((couts.totalCoutsReel - couts.totalCoutsPrevu) / couts.totalCoutsPrevu) * 100;
      if (dep > 20) { score += 25; facteurs.push(`budget +${dep.toFixed(0)}%`); }
      else if (dep > 5) { score += 10; facteurs.push(`budget +${dep.toFixed(0)}%`); }
    }

    // Facteur 4 : prédiction ApprentissageMarge négative
    const pred = (agentContext?.ApprentissageMarge?.predictions || []).find(p => p.chantierId === c.id);
    if (pred?.margePredictive < SEUILS.margeLimite) { score += 15; facteurs.push(`prédiction historique : ${pred.margePredictive.toFixed(1)}%`); }

    if (score >= 30) {
      risques.push({ chantierId: c.id, nom: c.nom || c.numero, score, facteurs, niveau: score >= 60 ? 'CRITIQUE' : score >= 40 ? 'DANGER' : 'ATTENTION' });
      alertes.push({ id: uid('rp-radar'), agent: 'RadarPrecoce', type: 'radar', niveau: score >= 60 ? 'CRITIQUE' : score >= 40 ? 'DANGER' : 'ATTENTION',
        message: `${c.nom || c.numero} — score de risque : ${score}/100`,
        detail: `Facteurs : ${facteurs.join(' · ')}`,
        chantier_id: c.id, timestamp: Date.now(), lu: false, action: { page: 'chantiers', ctx: { chantierActif: c.id } } });
    }
  });

  risques.sort((a, b) => b.score - a.score);
  return { alertes, data: { risques } };
}

// ─── T3-A17 : DSOMoyen ────────────────────────────────────────
export function runDSOAnalyse({ agentContext, memoire = {} }) {
  try {
    const dsoData = agentContext?.RelancePaiements;
    if (!dsoData) return { alertes: [], data: {}, memoire };

    const dsoParClient = Object.values(dsoData.dsoParClient || {});
    const dsoMoyen = dsoParClient.length > 0
      ? Math.round(dsoParClient.reduce((s, c) => s + (c.dso || 0), 0) / dsoParClient.length)
      : 0;

    const hist = memoire.historique || [];
    const tendance = hist.length >= 3
      ? dsoMoyen - hist[2].dso
      : 0;

    const alertes = [];
    if (dsoMoyen > 45) {
      alertes.push({ id: uid('dso-alert'), agent: 'DSOAnalyse', type: 'tresorerie', niveau: dsoMoyen > 60 ? 'DANGER' : 'ATTENTION',
        message: `DSO moyen : ${dsoMoyen} jours (standard BTP Suisse : 30j)`,
        detail: tendance > 5 ? `Tendance haussière +${tendance}j en 3 runs — situation qui se dégrade` : `Écart de ${dsoMoyen - 30} jours sur la norme suisse`,
        timestamp: Date.now(), lu: false, action: { page: 'finances', ctx: {} } });
    }

    hist.unshift({ date: new Date().toISOString().split('T')[0], dso: dsoMoyen, tendance, timestamp: Date.now() });

    return { alertes, data: { dsoMoyen, tendance, historique: hist.slice(0, 12), dsoParClient }, memoire: { historique: hist.slice(0, 52) } };
  } catch (e) { return { alertes: [], data: {}, memoire }; }
}

// ─── T3-A18 : SaisonniertéPrévisionnelle ─────────────────────
export function runSaisonnierte({ chantiers, devis, memoire = {} }) {
  try {
    const maintenant = new Date();
    const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    // Analyse historique : répartition des démarrages par mois
    const demarragesParMois = Array(12).fill(0);
    const caParMois = Array(12).fill(0);

    chantiers.forEach(c => {
      if (!c.dateDebut) return;
      const m = new Date(c.dateDebut).getMonth();
      demarragesParMois[m]++;
      const ca = calculerCA(c, devis);
      if (ca) caParMois[m] += ca;
    });

    const total = demarragesParMois.reduce((s, v) => s + v, 0);
    const saisonParMois = demarragesParMois.map((v, i) => ({
      mois: moisLabels[i], index: i,
      count: v, pct: total > 0 ? Math.round((v / total) * 100) : 0,
      ca: Math.round(caParMois[i]),
      intensite: v === 0 ? 'creux' : v < total / 14 ? 'faible' : v > total / 7 ? 'fort' : 'moyen',
    }));

    // Prochains 3 mois
    const prochainsMois = [1, 2, 3].map(offset => {
      const idx = (maintenant.getMonth() + offset) % 12;
      return saisonParMois[idx];
    });

    const alertes = [];
    const prochainCreux = prochainsMois.find(m => m.intensite === 'creux' || m.intensite === 'faible');
    if (prochainCreux && total > 5) {
      alertes.push({ id: uid('sa-creux'), agent: 'Saisonnierte', type: 'planification', niveau: 'INFO',
        message: `Période creuse historique prévue en ${prochainCreux.mois}`,
        detail: `Historiquement ${prochainCreux.count} démarrage(s) en ${prochainCreux.mois} — anticiper le pipeline commercial`,
        timestamp: Date.now(), lu: false, action: { page: 'devis', ctx: {} } });
    }

    const hist = memoire.saisonHistorique || [];
    hist.unshift({ annee: maintenant.getFullYear(), saisonParMois, timestamp: Date.now() });

    return { alertes, data: { saisonParMois, prochainsMois, total }, memoire: { saisonHistorique: hist.slice(0, 5) } };
  } catch (e) { return { alertes: [], data: {}, memoire }; }
}

// ─── T3-A19 : CoûtMOAnalyse ───────────────────────────────────
export function runCoutMOAnalyse({ chantiers, devis, parametres, agentContext }) {
  const alertes = [];
  const analyse = [];

  chantiers.forEach(c => {
    const ca = calculerCA(c, devis);
    if (!ca || ca <= 0) return;
    const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
    if (couts.totalCoutsReel <= 0) return;

    const pctMO = couts.totalCoutsReel > 0 ? (couts.coutMOReel / couts.totalCoutsReel) * 100 : 0;
    const pctMOSurCA = ca > 0 ? (couts.coutMOReel / ca) * 100 : 0;

    const margeReel = parseFloat(couts.margeReelPct);
    analyse.push({
      id: c.id, nom: c.nom || c.numero,
      coutMO: Math.round(couts.coutMOReel), ca: Math.round(ca),
      pctMO: Math.round(pctMO * 10) / 10, pctMOSurCA: Math.round(pctMOSurCA * 10) / 10,
      margeReel: isNaN(margeReel) ? null : margeReel,
    });

    // Alerte si MO > 70% des coûts totaux
    if (pctMO > 70 && couts.coutMOReel > 5000) {
      alertes.push({ id: uid('mo-fort'), agent: 'CoutMOAnalyse', type: 'couts', niveau: 'INFO',
        message: `${c.nom || c.numero} — MO à ${Math.round(pctMO)}% des coûts`,
        detail: `CHF ${fmtN(Math.round(couts.coutMOReel))} en main-d'œuvre · vérifier coefficient charges`,
        chantier_id: c.id, timestamp: Date.now(), lu: false, action: { page: 'chantiers', ctx: { chantierActif: c.id } } });
    }
  });

  const moyen = analyse.length > 0 ? analyse.reduce((s, a) => s + a.pctMO, 0) / analyse.length : 0;
  analyse.sort((a, b) => b.pctMO - a.pctMO);

  return { alertes, data: { analyse, pctMOMoyen: Math.round(moyen * 10) / 10 } };
}

// ─── T3-A21 : RapportNaturel ─────────────────────────────────
export function runRapportNaturel({ chantiers, factures, agentContext, memoire = {} }) {
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const actifs = chantiers.filter(isChantierActif);
    const risques = agentContext?.RadarPrecoce?.risques || [];
    const derives = agentContext?.DerivePredictor?.resultats || [];
    const coach = agentContext?.CoachDirecteur;
    const treso = agentContext?.TresoreriePredictor;
    const relances = agentContext?.RelancePaiements;
    const projection = agentContext?.ProjectionAnnuelle;

    const paras = [];

    // § 1 — Situation générale
    const nbActifs = actifs.length;
    const enDerive = derives.filter(d => d.statut !== 'vert').length;
    const enBonne = derives.filter(d => d.statut === 'vert').length;
    if (nbActifs === 0) {
      paras.push('Aucun chantier actif en ce moment. C\'est le moment idéal pour préparer vos prochains devis et renforcer votre pipeline commercial.');
    } else if (enDerive === 0) {
      paras.push(`Bonne nouvelle : vos ${nbActifs} chantier${nbActifs > 1 ? 's' : ''} actif${nbActifs > 1 ? 's' : ''} se déroulent conformément aux objectifs. Aucune dérive budgétaire détectée.`);
    } else {
      paras.push(`Vous avez ${nbActifs} chantier${nbActifs > 1 ? 's' : ''} actif${nbActifs > 1 ? 's' : ''}. ${enDerive} nécessite${enDerive > 1 ? 'nt' : ''} une attention sur la rentabilité, tandis que ${enBonne} se déroule${enBonne !== 1 ? 'nt' : ''} bien.`);
    }

    // § 2 — Trésorerie
    const j30 = treso?.solde30 || 0;
    const montantRetard = (relances?.montant30 || 0) + (relances?.montant60 || 0) + (relances?.montant90 || 0);
    if (j30 > 0 && montantRetard > 0) {
      paras.push(`Côté trésorerie, CHF ${fmtN(Math.round(j30))} sont attendus sous 30 jours. Attention : CHF ${fmtN(Math.round(montantRetard))} de factures restent impayées — des relances s'imposent.`);
    } else if (j30 > 0) {
      paras.push(`Côté trésorerie, CHF ${fmtN(Math.round(j30))} sont attendus sous 30 jours. La situation est saine.`);
    } else if (montantRetard > 0) {
      paras.push(`Attention : CHF ${fmtN(Math.round(montantRetard))} de factures sont impayées. Une relance active est recommandée pour maintenir votre cash-flow.`);
    }

    // § 3 — Alerte critique
    const critiqueRisque = risques.filter(r => r.niveau === 'CRITIQUE' || r.niveau === 'DANGER');
    if (critiqueRisque.length > 0) {
      const r1 = critiqueRisque[0];
      paras.push(`Point de vigilance : ${r1.nom} affiche un score de risque de ${r1.score}/100 (${r1.facteurs.slice(0, 2).join(', ')}). Une action correctrice est recommandée cette semaine.`);
    }

    // § 4 — Action prioritaire CoachDirecteur
    if (coach?.priorites?.length > 0) {
      const p1 = coach.priorites[0];
      paras.push(`Action prioritaire : ${p1.action}. ${p1.detail}.`);
    }

    // § 5 — Objectif annuel
    if (projection?.txAtteinte !== null && projection?.txAtteinte !== undefined) {
      const tx = projection.txAtteinte;
      if (tx >= 100) paras.push(`Excellent : votre objectif annuel est atteint à ${tx}%. Continuez sur cette lancée.`);
      else if (tx >= 80) paras.push(`Votre objectif annuel est atteint à ${tx}%. Le pipeline en cours devrait permettre de clôturer positivement.`);
      else paras.push(`Votre objectif annuel n'est atteint qu'à ${tx}%. Il est encore temps d'intensifier votre activité commerciale.`);
    }

    const rapport = {
      id: uid('rn'), date: dateStr, timestamp: now.getTime(),
      scoreEntreprise: coach?.scoreGlobal ?? null,
      paras, texte: paras.join('\n\n'),
      nbChantiers: nbActifs,
      nbAlertes: risques.length + derives.filter(d => d.statut !== 'vert').length,
      actionPrincipale: coach?.priorites?.[0] || null,
    };

    const hist = (memoire.historique || []);
    hist.unshift({ date: now.toISOString().split('T')[0], score: rapport.scoreEntreprise, timestamp: now.getTime() });

    return { alertes: [], data: rapport, memoire: { historique: hist.slice(0, 52) } };
  } catch (e) { return { alertes: [], data: { paras: [], texte: '' }, memoire }; }
}

// ─── T2-A22 : PipelineCommercial ─────────────────────────────
export function runPipelineCommercial({ devis, chantiers, clients, agentContext, memoire = {} }) {
  try {
    const maintenant = Date.now();
    const ONE_DAY = 86400000;

    const enPipeline = (devis || []).filter(d => {
      const s = (d.statut || '').toLowerCase();
      return ['en attente', 'envoyé', 'envoyee', 'en cours', 'en negociation', 'en négociation'].includes(s);
    });

    const total = (devis || []).filter(d => d.statut && !['brouillon', 'draft'].includes((d.statut || '').toLowerCase())).length;
    const acceptes = (devis || []).filter(d => ['accepté', 'accepte', 'signé', 'signe'].includes((d.statut || '').toLowerCase())).length;
    const tauxConversion = total > 0 ? Math.round((acceptes / total) * 100) : null;

    const caPipeline = enPipeline.reduce((s, d) => s + (parseFloat(d.montantHT || d.prixPropose) || 0), 0);

    const enRetard = enPipeline.filter(d => {
      if (!d.dateEmission) return false;
      const jours = Math.floor((maintenant - new Date(d.dateEmission).getTime()) / ONE_DAY);
      return jours > 15;
    });

    const alertes = [];

    if (enPipeline.length === 0 && chantiers.filter(c => isChantierActif(c)).length < 2) {
      alertes.push({
        id: uid('pc-vide'), agent: 'PipelineCommercial', type: 'commercial', niveau: 'ATTENTION',
        message: 'Pipeline commercial vide — aucun devis en cours de négociation',
        detail: 'Risque de trou d\'activité dans 2–3 mois. Intensifier la prospection.',
        timestamp: Date.now(), lu: false, action: { page: 'devis', ctx: {} },
      });
    }

    if (enRetard.length > 0) {
      alertes.push({
        id: uid('pc-retard'), agent: 'PipelineCommercial', type: 'commercial', niveau: 'INFO',
        message: `${enRetard.length} devis sans réponse depuis plus de 15 jours`,
        detail: `CHF ${fmtN(Math.round(enRetard.reduce((s, d) => s + (parseFloat(d.montantHT || d.prixPropose) || 0), 0)))} en attente — relancer les prospects`,
        timestamp: Date.now(), lu: false, action: { page: 'devis', ctx: {} },
      });
    }

    if (tauxConversion !== null && tauxConversion < 40 && total > 3) {
      alertes.push({
        id: uid('pc-conv'), agent: 'PipelineCommercial', type: 'commercial', niveau: 'ATTENTION',
        message: `Taux de conversion faible : ${tauxConversion}% (objectif ≥ 50%)`,
        detail: `${acceptes} devis acceptés sur ${total} émis — revoir la stratégie de prix ou de présentation`,
        timestamp: Date.now(), lu: false, action: { page: 'devis', ctx: {} },
      });
    }

    const hist = memoire.historique || [];
    hist.unshift({ date: new Date().toISOString().split('T')[0], caPipeline: Math.round(caPipeline), tauxConversion, nbEnPipeline: enPipeline.length, timestamp: Date.now() });

    return {
      alertes,
      data: { enPipeline: enPipeline.length, caPipeline: Math.round(caPipeline), tauxConversion, enRetard: enRetard.length, historique: hist.slice(0, 12) },
      memoire: { historique: hist.slice(0, 52) },
    };
  } catch (e) { return { alertes: [], data: {}, memoire }; }
}

// ─── T2-A23 : AlerteRisqueClient ──────────────────────────────
export function runAlerteRisqueClient({ chantiers, clients, factures, agentContext }) {
  try {
    const santesClients = agentContext?.SanteClient?.statsClients || [];
    const clientsRisque = [];
    const alertes = [];

    (clients || []).forEach(client => {
      const chantiersClient = chantiers.filter(c => String(c.clientId) === String(client.id) && isChantierActif(c));
      if (chantiersClient.length === 0) return;

      const sante = santesClients.find(s => String(s.id) === String(client.id));
      const impayees = (factures || []).filter(f =>
        String(f.clientId) === String(client.id) &&
        ['envoyee', 'partielle', 'retard'].includes((f.statut || '').toLowerCase())
      );
      const montantImpaye = impayees.reduce((s, f) => s + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);

      let scoreRisque = 0;
      const facteurs = [];

      if (sante?.dso > 60) { scoreRisque += 30; facteurs.push(`DSO ${sante.dso}j`); }
      else if (sante?.dso > 45) { scoreRisque += 15; facteurs.push(`DSO ${sante.dso}j`); }

      if (montantImpaye > 20000) { scoreRisque += 35; facteurs.push(`CHF ${fmtN(Math.round(montantImpaye))} impayés`); }
      else if (montantImpaye > 5000) { scoreRisque += 20; facteurs.push(`CHF ${fmtN(Math.round(montantImpaye))} impayés`); }

      if (sante && sante.marge !== null && sante.marge < 10) { scoreRisque += 20; facteurs.push(`marge client faible (${sante.marge.toFixed(1)}%)`); }
      if (impayees.length >= 2) { scoreRisque += 15; facteurs.push(`${impayees.length} factures impayées`); }

      if (scoreRisque >= 30) {
        const niveau = scoreRisque >= 60 ? 'DANGER' : 'ATTENTION';
        clientsRisque.push({ clientId: client.id, nom: client.nom, scoreRisque, facteurs, niveau, chantiersActifs: chantiersClient.length });
        alertes.push({
          id: uid('arc-risque'), agent: 'AlerteRisqueClient', type: 'risque-client', niveau,
          message: `Client "${client.nom}" — score de risque ${scoreRisque}/100`,
          detail: `${facteurs.join(' · ')} · ${chantiersClient.length} chantier(s) actif(s)`,
          timestamp: Date.now(), lu: false, action: { page: 'chantiers', ctx: {} },
        });
      }
    });

    clientsRisque.sort((a, b) => b.scoreRisque - a.scoreRisque);
    return { alertes, data: { clientsRisque } };
  } catch (e) { return { alertes: [], data: {} }; }
}

// ─── T2-A24 : OptimisationEquipe ──────────────────────────────
export function runOptimisationEquipe({ chantiers, parametres, agentContext }) {
  try {
    const employes = (parametres?.employes || []).filter(e => e.actif !== false);
    const statsEmployes = agentContext?.ProductiviteEquipe?.statsParEmploye || {};
    const conflits = agentContext?.ConflitsPlanning?.conflits || [];

    const sousUtilises = employes.filter(emp => {
      const stat = statsEmployes[String(emp.id)];
      return stat && stat.heuresMoyParJour < 4 && stat.joursActifs > 3;
    });

    const chantiersActifs = chantiers.filter(isChantierActif);
    const chantiersManquants = chantiersActifs.filter(c => {
      const dernierJournal = (c.journal || []).slice(-5);
      const employesRecents = new Set();
      dernierJournal.forEach(e => (e.employes || []).forEach(ej => employesRecents.add(ej.employeId)));
      return employesRecents.size === 0;
    });

    const suggestions = [];
    if (sousUtilises.length > 0 && chantiersManquants.length > 0) {
      const nbSugg = Math.min(3, Math.min(sousUtilises.length, chantiersManquants.length));
      for (let i = 0; i < nbSugg; i++) {
        suggestions.push({
          employeId: sousUtilises[i].id, employeNom: sousUtilises[i].nom,
          chantierId: chantiersManquants[i].id, chantierNom: chantiersManquants[i].nom || chantiersManquants[i].numero,
          raison: `${sousUtilises[i].nom} disponible — ${chantiersManquants[i].nom || chantiersManquants[i].numero} sans ressource récente`,
        });
      }
    }

    const alertes = [];
    if (conflits.length > 2) {
      alertes.push({
        id: uid('oe-conflits'), agent: 'OptimisationEquipe', type: 'planification', niveau: 'ATTENTION',
        message: `${conflits.length} conflits d'équipe détectés — réaffectation recommandée`,
        detail: suggestions.length > 0 ? `Suggestion : ${suggestions[0].raison}` : 'Revoir la répartition des équipes',
        timestamp: Date.now(), lu: false, action: { page: 'planning', ctx: {} },
      });
    }
    if (chantiersManquants.length > 0 && sousUtilises.length === 0 && employes.length > 0) {
      alertes.push({
        id: uid('oe-manque'), agent: 'OptimisationEquipe', type: 'planification', niveau: 'INFO',
        message: `${chantiersManquants.length} chantier(s) sans saisie d'heures récente`,
        detail: 'Vérifier que le journal des heures est bien tenu à jour',
        timestamp: Date.now(), lu: false, action: { page: 'heures', ctx: {} },
      });
    }

    return { alertes, data: { suggestions, sousUtilises: sousUtilises.map(e => e.nom), chantiersManquants: chantiersManquants.map(c => c.nom || c.numero) } };
  } catch (e) { return { alertes: [], data: {} }; }
}

// ─── T2-A25 : ScoreOffre ──────────────────────────────────────
export function runScoreOffre({ devis, chantiers, parametres, agentContext }) {
  try {
    const memPatterns = agentContext?.MemoireChantier || {};
    const benchmark = agentContext?.BenchmarkTypeTravaux?.benchmark || [];

    const devisEnCours = (devis || []).filter(d => {
      const s = (d.statut || '').toLowerCase();
      return ['en attente', 'envoyé', 'envoyee', 'brouillon', 'draft'].includes(s);
    });

    const scoresOffres = devisEnCours.map(d => {
      let score = 50;
      const facteurs = [];
      const montant = parseFloat(d.montantHT || d.prixPropose) || 0;
      const type = (d.typesTravaux || [])[0] || d.typeChantier || null;

      if (type) {
        const pattern = memPatterns[type];
        const bench = benchmark.find(b => b.nom === type);
        if (pattern && pattern.count >= 2) {
          if (pattern.margeMoyenne >= 20) { score += 20; facteurs.push(`Type rentable historiquement (${Math.round(pattern.margeMoyenne)}%)`); }
          else if (pattern.margeMoyenne >= 15) { score += 10; facteurs.push(`Marge historique correcte (${Math.round(pattern.margeMoyenne)}%)`); }
          else if (pattern.margeMoyenne < 10) { score -= 20; facteurs.push(`Type peu rentable (${Math.round(pattern.margeMoyenne)}%)`); }
        }
        if (bench && bench.marge !== null) {
          if (bench.marge >= 20) { score += 10; facteurs.push('Type en bonne forme actuellement'); }
          else if (bench.marge < 10) { score -= 10; facteurs.push('Type sous-performant actuellement'); }
        }
        if (pattern?.ecartMoyen > 15) { score -= 15; facteurs.push(`Dépassements fréquents sur ce type (+${Math.round(pattern.ecartMoyen)}%)`); }
      }

      if (montant > 100000) { score += 10; facteurs.push('Grand chantier — économies d\'échelle possibles'); }
      else if (montant < 5000) { score -= 10; facteurs.push('Petit chantier — frais fixes proportionnellement élevés'); }

      score = Math.min(100, Math.max(0, score));
      const niveau = score >= 75 ? 'fort' : score >= 50 ? 'moyen' : 'faible';
      return { devisId: d.id, reference: d.reference || d.numero || `Devis #${d.id}`, montant, type, score, niveau, facteurs };
    });

    const alertes = [];
    scoresOffres.filter(o => o.niveau === 'faible' && o.montant > 10000).forEach(o => {
      alertes.push({
        id: uid('so-risque'), agent: 'ScoreOffre', type: 'commercial', niveau: 'ATTENTION',
        message: `Devis "${o.reference}" — score rentabilité faible (${o.score}/100)`,
        detail: o.facteurs[0] || 'Vérifier la marge avant signature',
        timestamp: Date.now(), lu: false, action: { page: 'devis', ctx: {} },
      });
    });
    scoresOffres.filter(o => o.niveau === 'fort').forEach(o => {
      alertes.push({
        id: uid('so-top'), agent: 'ScoreOffre', type: 'commercial', niveau: 'INFO',
        message: `Devis "${o.reference}" — offre à fort potentiel (${o.score}/100)`,
        detail: o.facteurs[0] || 'Priorité haute pour la signature',
        timestamp: Date.now(), lu: false, action: { page: 'devis', ctx: {} },
      });
    });

    return { alertes, data: { scoresOffres } };
  } catch (e) { return { alertes: [], data: {} }; }
}

// ─── T3-A26 : AnalyseCycles ───────────────────────────────────
export function runAnalyseCycles({ chantiers, devis, agentContext, memoire = {} }) {
  try {
    const termines = chantiers.filter(c => ['terminé', 'termine', 'terminée', 'terminee'].includes((c.statut || '').toLowerCase()));
    const cyclesParType = {};

    termines.forEach(c => {
      if (!c.dateDebut || !c.dateFin) return;
      const dureeReelle = Math.max(1, Math.round((new Date(c.dateFin) - new Date(c.dateDebut)) / 86400000));
      const dureePrevu = parseFloat(c.nombreJours) || null;
      const type = (c.typesTravaux || [])[0] || c.typeChantier || 'Autre';

      if (!cyclesParType[type]) cyclesParType[type] = { count: 0, durees: [], ratios: [] };
      cyclesParType[type].count++;
      cyclesParType[type].durees.push(dureeReelle);
      if (dureePrevu && dureePrevu > 0) cyclesParType[type].ratios.push(dureeReelle / dureePrevu);
    });

    const cycles = Object.entries(cyclesParType).map(([type, data]) => {
      const dureeAvg = Math.round(data.durees.reduce((s, v) => s + v, 0) / data.count);
      const ratioAvg = data.ratios.length > 0 ? Math.round((data.ratios.reduce((s, v) => s + v, 0) / data.ratios.length) * 100) / 100 : null;
      return { type, count: data.count, dureeAvg, ratioAvg, depasse: ratioAvg !== null && ratioAvg > 1.15 };
    }).sort((a, b) => b.count - a.count);

    const alertes = [];
    cycles.filter(c => c.depasse && c.count >= 2).forEach(c => {
      alertes.push({
        id: uid('cy-cycle'), agent: 'AnalyseCycles', type: 'planification', niveau: 'INFO',
        message: `Type "${c.type}" : durée réelle +${Math.round((c.ratioAvg - 1) * 100)}% vs prévision`,
        detail: `Durée moyenne : ${c.dureeAvg}j · ratio ×${c.ratioAvg} sur ${c.count} chantiers terminés`,
        timestamp: Date.now(), lu: false, action: { page: 'rapport', ctx: {} },
      });
    });

    const hist = memoire.historique || [];
    hist.unshift({ date: new Date().toISOString().split('T')[0], cycles, timestamp: Date.now() });

    return { alertes, data: { cycles, nbTermines: termines.length }, memoire: { historique: hist.slice(0, 12) } };
  } catch (e) { return { alertes: [], data: {}, memoire }; }
}

// ─── T3-A20 : CoachDirecteur ──────────────────────────────────
export function runCoachDirecteur({ chantiers, devis, factures, parametres, agentContext, memoire = {} }) {
  try {
    const priorites = [];

    // Priorité 1 : chantiers à risque critique (RadarPrecoce)
    const risques = agentContext?.RadarPrecoce?.risques || [];
    const critiqueRisque = risques.filter(r => r.niveau === 'CRITIQUE' || r.niveau === 'DANGER');
    if (critiqueRisque.length > 0) {
      priorites.push({
        rang: 1, icone: 'urgent', categorie: 'URGENT',
        action: `Intervenir sur ${critiqueRisque[0].nom}`,
        detail: `Score de risque ${critiqueRisque[0].score}/100 · ${critiqueRisque[0].facteurs[0]}`,
        impact: 'Financier critique', page: 'chantiers',
      });
    }

    // Priorité 2 : encaissements urgents (RelancePaiements)
    const relances = agentContext?.RelancePaiements;
    if (relances?.montant90 > 5000) {
      priorites.push({
        rang: priorites.length + 1, icone: 'tresorerie', categorie: 'TRÉSORERIE',
        action: `Relancer ${relances.nb90} facture(s) en retard >90 jours`,
        detail: `CHF ${fmtN(Math.round(relances.montant90))} à récupérer d'urgence`,
        impact: 'Cash-flow', page: 'finances',
      });
    }

    // Priorité 3 : facturation possible (OptimisationFacturation)
    const factOpti = agentContext?.OptimisationFacturation;
    if (factOpti?.totalFacturable > 10000) {
      priorites.push({
        rang: priorites.length + 1, icone: 'revenus', categorie: 'REVENUS',
        action: `Facturer CHF ${fmtN(Math.round(factOpti.totalFacturable))} disponibles`,
        detail: `${factOpti.opportunites?.length || 0} chantier(s) à facturer selon avancement`,
        impact: 'CA immédiat', page: 'factures',
      });
    }

    // Priorité 4 : projection annuelle
    const proj = agentContext?.ProjectionAnnuelle;
    if (proj?.txAtteinte !== null && proj?.txAtteinte < 80) {
      priorites.push({
        rang: priorites.length + 1, icone: 'commercial', categorie: 'COMMERCIAL',
        action: `Renforcer le pipeline — objectif annuel à ${proj.txAtteinte}%`,
        detail: `${proj.nbDevisEnAttente} devis en attente · CHF ${fmtN(Math.round(proj.caPipeline))} potentiel`,
        impact: 'CA annuel', page: 'devis',
      });
    }

    // Priorité 5 : données manquantes
    const anomalies = agentContext?.AnomaliesDonnees;
    if (anomalies?.score < 80) {
      priorites.push({
        rang: priorites.length + 1, icone: 'donnees', categorie: 'DONNÉES',
        action: `Corriger ${anomalies.nbAnomalies} anomalie(s) de données`,
        detail: anomalies.anomalies?.[0] || 'Chantiers sans devis, employés sans tarif...',
        impact: 'Fiabilité calculs', page: 'chantiers',
      });
    }

    // Résumé global
    const nbAlertesTotal = Object.values(agentContext || {}).reduce((s, d) => s + (d?.alertes?.length || 0), 0);
    const scoreGlobal = Math.max(0, 100 - critiqueRisque.length * 20 - (relances?.nb90 || 0) * 10 - (anomalies?.nbAnomalies || 0) * 5);

    const hist = memoire.coachHistorique || [];
    hist.unshift({ date: new Date().toISOString().split('T')[0], scoreGlobal, nbPriorites: priorites.length, timestamp: Date.now() });

    const data = { priorites: priorites.slice(0, 5), scoreGlobal, nbAlertesTotal, synthese: `Score entreprise : ${scoreGlobal}/100` };
    return { alertes: [], data, memoire: { coachHistorique: hist.slice(0, 52) } };
  } catch (e) { return { alertes: [], data: { priorites: [], scoreGlobal: 0 }, memoire }; }
}

// ═══════════════════════════════════════════════════════════════
// SCHEMA GUARD — Contrat de sortie de chaque agent
// Utilisé pour valider agentContext avant propagation
// ═══════════════════════════════════════════════════════════════

const AGENT_SCHEMAS = {
  TresoreriePredictor:    { solde30: 'number', solde60: 'number', solde90: 'number', totalEnAttente: 'number' },
  RelancePaiements:       { montant30: 'number', montant60: 'number', montant90: 'number', nb30: 'number', nb60: 'number', nb90: 'number', dsoParClient: 'object' },
  SanteClient:            { statsClients: 'array', topClients: 'array' },
  AnomaliesDonnees:       { anomalies: 'array', score: 'number', nbAnomalies: 'number' },
  OptimisationFacturation:{ opportunites: 'array', totalFacturable: 'number' },
  ProductiviteEquipe:     { statsParEmploye: 'object', nbEmployes: 'number' },
  ApprentissageMarge:     { predictions: 'array' },
  RadarPrecoce:           { risques: 'array' },
  DerivePredictor:        { resultats: 'array' },
  ProjectionAnnuelle:     { caRealise: 'number', caProjecte: 'number', moisRestants: 'number' },
  ConflitsPlanning:       { conflits: 'array' },
  CoachDirecteur:         { priorites: 'array', scoreGlobal: 'number' },
  DSOAnalyse:             { dsoMoyen: 'number', tendance: 'number' },
  BenchmarkTypeTravaux:   { benchmark: 'array' },
  PipelineCommercial:     { enPipeline: 'number', caPipeline: 'number' },
  AlerteRisqueClient:     { clientsRisque: 'array' },
  OptimisationEquipe:     { suggestions: 'array', sousUtilises: 'array' },
  ScoreOffre:             { scoresOffres: 'array' },
  AnalyseCycles:          { cycles: 'array', nbTermines: 'number' },
};

function validateAgentOutput(name, data) {
  const schema = AGENT_SCHEMAS[name];
  if (!schema || !data) return [];
  return Object.entries(schema).reduce((acc, [key, expectedType]) => {
    const val = data[key];
    if (val === undefined) {
      acc.push({ agent: name, champ: key, attendu: expectedType, recu: 'undefined' });
    } else if (val === null) {
      if (!expectedType.includes('null')) acc.push({ agent: name, champ: key, attendu: expectedType, recu: 'null' });
    } else {
      const actual = Array.isArray(val) ? 'array' : typeof val;
      if (typeof val === 'number' && isNaN(val)) acc.push({ agent: name, champ: key, attendu: expectedType, recu: 'NaN' });
      else if (!expectedType.includes(actual)) acc.push({ agent: name, champ: key, attendu: expectedType, recu: actual });
    }
    return acc;
  }, []);
}

// Parcourt récursivement les données et remplace NaN par des valeurs sûres
function sanitizeData(obj, depth = 0) {
  if (depth > 5 || !obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => sanitizeData(v, depth + 1));
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (typeof v === 'number' && isNaN(v)) return [k, null];
      if (v && typeof v === 'object') return [k, sanitizeData(v, depth + 1)];
      return [k, v];
    })
  );
}

// ─── SENTINEL (interne — aucune alerte utilisateur) ───────────
// Opère en silence après tous les agents :
//   1. Vérifie les dépendances inter-agents
//   2. Passe agentContext en revue pour repérer des incohérences résiduelles
//   3. Corrige automatiquement ce qui peut l'être
//   4. Log uniquement en console — l'utilisateur ne voit rien
export function runSentinelAgent({ agentContext, violations = [], agentsStatuts = {} }) {
  try {
    let nbCorrections = 0;

    // Dépendances inter-agents : log si provider vide
    const deps = [
      { consumer: 'ApprentissageMarge', needs: 'MemoireChantier' },
      { consumer: 'DerivePredictor',    needs: 'MemoireChantier' },
      { consumer: 'RadarPrecoce',       needs: 'ApprentissageMarge' },
      { consumer: 'DSOAnalyse',         needs: 'RelancePaiements' },
      { consumer: 'AlerteRisqueClient', needs: 'SanteClient' },
      { consumer: 'OptimisationEquipe', needs: 'ProductiviteEquipe' },
    ];
    deps.forEach(({ consumer, needs }) => {
      if (agentsStatuts[consumer]?.actif && (!agentContext[needs] || Object.keys(agentContext[needs]).length === 0)) {
        console.warn(`[SENTINEL] ${consumer} → dépendance ${needs} vide`);
      }
    });

    // Agents critiques silencieux
    const critiques = [
      { name: 'TresoreriePredictor', champ: 'solde30' },
      { name: 'RadarPrecoce',        champ: 'risques' },
      { name: 'CoachDirecteur',      champ: 'scoreGlobal' },
    ];
    critiques.forEach(({ name, champ }) => {
      if (agentsStatuts[name]?.actif && agentContext[name]?.[champ] === undefined) {
        console.warn(`[SENTINEL] ${name}.${champ} absent après exécution`);
      }
    });

    // Violations de schéma accumulées
    if (violations.length > 0) {
      console.warn(`[SENTINEL] ${violations.length} violation(s) de schéma sur ce cycle`);
      nbCorrections += violations.length;
    }

    if (nbCorrections > 0) {
      console.info(`[SENTINEL] Cycle terminé — ${nbCorrections} correction(s) appliquée(s) silencieusement`);
    }

    // Aucune alerte, aucun affichage utilisateur
    return { alertes: [], data: null };
  } catch (e) {
    console.error('[SENTINEL]', e);
    return { alertes: [], data: null };
  }
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATEUR — 3 tiers, communication inter-agents
// ═══════════════════════════════════════════════════════════════
export function runAllAgents({ chantiers, devis, factures, clients, parametres, dernierRapport, agentsActifs, memoire = {} }) {
  const enabled = agentsActifs || {};
  const isEnabled = (name) => enabled[name] !== false; // actif par défaut

  const result = {
    alertes: [], predictions: {}, patterns: {}, rapport: null,
    statuts: {}, agentData: {}, memoire: { ...memoire },
  };

  const agentContext = {}; // Accumule les résultats pour les agents suivants
  const schemaViolations = []; // Violations collectées pour SentinelAgent

  const runAgent = (name, fn) => {
    if (!isEnabled(name)) {
      result.statuts[name] = { actif: false, lastRun: null, erreur: null };
      return null;
    }
    try {
      const start = Date.now();
      const agentMemoire = (memoire && memoire[name]) ? memoire[name] : {};
      const res = fn(agentMemoire);
      result.statuts[name] = { actif: true, lastRun: Date.now(), dureeMs: Date.now() - start, erreur: null };
      if (res?.alertes) result.alertes.push(...res.alertes);
      if (res?.data) {
        // SchemaGuard : valide puis sanitize avant injection dans agentContext
        const violations = validateAgentOutput(name, res.data);
        if (violations.length > 0) {
          violations.forEach(v => console.warn(`[SCHEMA-GUARD] ${v.agent}.${v.champ} attendu ${v.attendu} — reçu ${v.recu}`));
          schemaViolations.push(...violations);
        }
        // Auto-correction silencieuse : NaN → null dans toute la sortie
        const cleanData = sanitizeData(res.data);
        result.agentData[name] = cleanData;
        agentContext[name] = cleanData;
      }
      if (res?.memoire) result.memoire[name] = { ...(result.memoire[name] || {}), ...res.memoire };
      return res;
    } catch (e) {
      console.error(`[AGENT-${name}]`, e);
      result.statuts[name] = { actif: true, lastRun: Date.now(), erreur: e.message };
      return null;
    }
  };

  // ── TIER 1 ──
  runAgent('AlerteChantier',          (m) => runAlerteChantier({ chantiers, devis, factures, parametres }));
  runAgent('SuiviDevis',              (m) => runSuiviDevis({ devis, factures, clients }));
  const a3 = runAgent('TresoreriePredictor', (m) => runTresoreriePredictor({ chantiers, factures, devis, parametres }));
  if (a3?.data) result.predictions = a3.data;
  const a4 = runAgent('RapportAuto',  (m) => runRapportAuto({ chantiers, factures, devis, parametres, dernierRapport }));
  if (a4?.data) result.rapport = a4.data;
  const a5 = runAgent('MemoireChantier', (m) => runMemoireChantier({ chantiers, devis, parametres }));
  if (a5?.data) result.patterns = a5.data;
  runAgent('ProductiviteEquipe',      (m) => runProductiviteEquipe({ chantiers, parametres, memoire: m }));
  runAgent('RelancePaiements',        (m) => runRelancePaiements({ factures, clients, memoire: m }));
  runAgent('AnomaliesDonnees',        (m) => runAnomaliesDonnees({ chantiers, devis, factures, clients, parametres }));
  runAgent('OptimisationFacturation', (m) => runOptimisationFacturation({ chantiers, factures, devis, parametres }));

  // ── TIER 2 (reçoit agentContext Tier 1) ──
  runAgent('ConflitsPlanning',     (m) => runConflitsPlanning({ chantiers, parametres, agentContext }));
  runAgent('PlanningCoherence',    (m) => runPlanningCoherence({ chantiers, devis, parametres }));
  runAgent('ApprentissageMarge',   (m) => runApprentissageMarge({ chantiers, devis, parametres, agentContext, memoire: m }));
  runAgent('SanteClient',          (m) => runSanteClient({ chantiers, clients, devis, factures, parametres, agentContext }));
  runAgent('ProjectionAnnuelle',   (m) => runProjectionAnnuelle({ chantiers, factures, devis, parametres, agentContext, memoire: m }));
  runAgent('BenchmarkTypeTravaux', (m) => runBenchmarkTypeTravaux({ chantiers, devis, parametres, agentContext }));
  runAgent('ConformiteBTP',        (m) => runConformiteBTP({ chantiers, parametres, agentContext }));
  runAgent('DerivePredictor',      (m) => runDerivePredictor({ chantiers, devis, parametres, agentContext }));
  runAgent('PipelineCommercial',   (m) => runPipelineCommercial({ devis, chantiers, clients, agentContext, memoire: m }));
  runAgent('AlerteRisqueClient',   (m) => runAlerteRisqueClient({ chantiers, clients, factures, agentContext }));
  runAgent('OptimisationEquipe',   (m) => runOptimisationEquipe({ chantiers, parametres, agentContext }));
  runAgent('ScoreOffre',           (m) => runScoreOffre({ devis, chantiers, parametres, agentContext }));

  // ── TIER 3 (reçoit agentContext Tier 1 + 2) ──
  runAgent('RadarPrecoce',    (m) => runRadarPrecoce({ chantiers, devis, parametres, agentContext }));
  runAgent('DSOAnalyse',      (m) => runDSOAnalyse({ agentContext, memoire: m }));
  runAgent('Saisonnierte',    (m) => runSaisonnierte({ chantiers, devis, memoire: m }));
  runAgent('CoutMOAnalyse',   (m) => runCoutMOAnalyse({ chantiers, devis, parametres, agentContext }));
  runAgent('AnalyseCycles',   (m) => runAnalyseCycles({ chantiers, devis, agentContext, memoire: m }));
  runAgent('RapportNaturel',   (m) => runRapportNaturel({ chantiers, factures, agentContext, memoire: m }));
  runAgent('CoachDirecteur',  (m) => runCoachDirecteur({ chantiers, devis, factures, parametres, agentContext, memoire: m }));

  // ── SENTINEL (toujours le dernier — scanne tout) ──
  runAgent('SentinelAgent', () => runSentinelAgent({ agentContext, violations: schemaViolations, agentsStatuts: result.statuts }));

  console.log(`[ORCHESTRATEUR] ${result.alertes.length} alerte(s) · ${Object.keys(result.statuts).length} agents exécutés · ${schemaViolations.length} violation(s) schéma`);
  return result;
}
