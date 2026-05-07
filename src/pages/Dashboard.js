import React, { useState, useMemo } from 'react';
import {
  HardHat, Users, TrendingUp, Plus, AlertTriangle,
  ChevronRight, CheckCircle, ShieldCheck, DollarSign, Bell, Clock, CreditCard, Bot,
} from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  fmtN, calculerDateFinOuvrables, joursOuvrableRestants, estRetardJustifie,
  calculerCoutsChantier, statutRentabilite, C, getIntervallesPeriode,
  facturesInPeriode, calculerRentabiliteReelle, calculerEtatChantier,
  calculerCA, isChantierActif, isChantierComptable,
} from '../donnees';
import { DS } from '../ds';
import { STATUTS_CLOS } from '../constants/statuts';
import { useApp } from '../context/AppContext';

function Dashboard() {
  const { chantiers, clients, factures, devis = [], parametres, naviguer, actionsLog = [], logAction = () => {}, periodeGlobale = 'mois', setPeriodeGlobale = () => {}, profil = null, agentState } = useApp();
  const agentAlertes = agentState?.alertes || [];
  const nbAgentAlertes = agentState?.nbNonLues || 0;
  const agentPredictions = agentState?.predictions || {};
  const marquerLu = agentState?.marquerLu || (() => {});
  const naviguerAgents = () => naviguer('agents');
  const facturesSafe = factures || [];
  const [insightsFerme, setInsightsFerme] = useState(false);

  // ── Actifs = tous les chantiers "En cours", sans filtre de période ─
  const actifs = useMemo(() => chantiers.filter(isChantierActif), [chantiers]);

  // ── Cache unique calculerCoutsChantier — évite 5+ appels redondants par chantier ──
  const coutsMap = useMemo(() => {
    const map = new Map();
    chantiers.forEach(c => {
      map.set(c.id, calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis));
    });
    return map;
  }, [chantiers, parametres.employes, parametres.localites, parametres.parametres, devis]);

  // ── Factures filtrées par période ────────────────────────────
  const facturesPeriode = useMemo(() => {
    const { debut, fin } = getIntervallesPeriode(periodeGlobale);
    return (factures || []).filter(f => facturesInPeriode(f, debut, fin));
  }, [factures, periodeGlobale]);

  const joursParChantier = useMemo(() => {
    const map = {};
    chantiers.forEach(c => { map[c.id] = joursOuvrableRestants(c.dateDebut, c.nombreJours, c.inclusSamedi); });
    return map;
  }, [chantiers]);

  // ── KPI dashboard ────────────────────────────────────────────
  const kpi = useMemo(() => {
    // 1. CA EN COURS — inclut Planifié + En cours (isChantierComptable)
    const comptables = chantiers.filter(isChantierComptable);
    const actifsAvecDevis = comptables.map(c => ({ c, ca: calculerCA(c, devis) })).filter(x => x.ca !== null);
    const caEnCours = actifsAvecDevis.reduce((t, x) => t + x.ca, 0);
    const nbChantiersActifs = actifs.length;
    const nbActifsSansDevis = comptables.length - actifsAvecDevis.length;

    // 2. CASH EN ATTENTE — factures non encaissées
    const cashEnAttente = facturesPeriode
      .filter(f => ['envoyee', 'partielle', 'retard'].includes(f.statut))
      .reduce((t, f) => t + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);

    // 3. RENTABILITÉ MOYENNE — même moteur que la fiche chantier (coefficient + FG inclus)
    // Exclus : chantiers sans CA, sans coûts réels saisis, ou données incomplètes
    const chantiersRenta = chantiers
      .map(c => coutsMap.get(c.id))
      .filter(r => r && r.montantTotal > 0 && r.totalCoutsReel > 0 && !r.donneesIncompletes);
    const rentaMoyenne = chantiersRenta.length > 0
      ? chantiersRenta.reduce((sum, r) => sum + (r.margeReelPct ?? 0), 0) / chantiersRenta.length
      : null;
    const nbChantiersRenta = chantiersRenta.length;

    // 4. HEURES ENGAGÉES — depuis journal (format groupé)
    const heuresEngagees = actifs.reduce((t, c) =>
      t + (c.journal || []).reduce((s, entry) =>
        s + (entry.employes || []).reduce((es, e) => es + (parseFloat(e.heuresTravaillees) || 0), 0)
      , 0)
    , 0);

    const nbFacturesEnAttente = facturesPeriode.filter(f => ['envoyee', 'partielle', 'retard'].includes(f.statut)).length;
    const nbFacturesRetard    = facturesPeriode.filter(f =>
      f.statut === 'retard' || (f.statut === 'envoyee' && f.dateEcheance && new Date(f.dateEcheance) < new Date())
    ).length;
    const nbEmployes = actifs.reduce((set, c) => {
      (c.equipe || []).forEach(m => { if (m.employeId) set.add(String(m.employeId)); });
      return set;
    }, new Set()).size;

    return { caEnCours, cashEnAttente, rentaMoyenne, nbChantiersRenta, heuresEngagees, nbFacturesEnAttente, nbFacturesRetard, nbEmployes, nbChantiersActifs, nbActifsSansDevis };
  }, [actifs, facturesPeriode, devis, chantiers, parametres.employes, parametres.localites, coutsMap]);

  // ── Prévision trésorerie 30 jours ───────────────────────────
  const previsionTreso30j = useMemo(() => {
    const chantiersActifsAvecFactures = actifs.map(c => {
      const devisTotal = calculerCA(c, devis);
      if (devisTotal === null) return { id: c.id, nom: c.nom || c.numero, encaissementPrevu: 0 };
      const avancement = Math.max(0, Math.min(100, Math.round(parseFloat(c.avancement) || 0)));
      const montantFacture = (factures || [])
        .filter(f => parseInt(f.chantierId) === c.id)
        .reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);
      const facturationPotentielle = (avancement / 100) * devisTotal;
      const resteAFacturer = Math.max(0, facturationPotentielle - montantFacture);
      const encaissementPrevu = Math.round(resteAFacturer * 0.5);
      return { id: c.id, nom: c.nom || c.numero, encaissementPrevu };
    }).filter(x => x.encaissementPrevu > 0);
    const total = chantiersActifsAvecFactures.reduce((s, x) => s + x.encaissementPrevu, 0);
    const top3 = [...chantiersActifsAvecFactures].sort((a, b) => b.encaissementPrevu - a.encaissementPrevu).slice(0, 3);
    const seuil = parseFloat(parametres.parametres?.seuilTresorerie) || 20000;
    const charges = parseFloat(parametres.parametres?.chargesMensuelles) || 0;
    const couverture = charges > 0 ? total / charges : null;
    const interpretation = couverture === null ? null
      : couverture < 0.7
        ? { label: 'Trésorerie insuffisante — risque court terme', couleur: C.danger, action: 'Accélérer la facturation ou réduire les dépenses' }
        : couverture < 1
          ? { label: 'Trésorerie juste — vigilance', couleur: C.warning, action: null }
          : { label: 'Trésorerie sécurisée', couleur: C.secondaire, action: null };
    const dateLimite = couverture !== null ? (() => {
      const d = new Date();
      d.setDate(d.getDate() + Math.round(couverture * 30));
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    })() : null;
    return { total, top3, alerteFaible: total < seuil && actifs.length > 0, couverture, interpretation, dateLimite };
  }, [actifs, factures, parametres.parametres, devis]);

  // ── Rentabilité par chantier (calcul complet via calculerCoutsChantier) ─
  const rentaParChantier = useMemo(() => {
    const map = {};
    actifs.forEach(c => {
      const couts = coutsMap.get(c.id);
      map[c.id] = couts && couts.montantTotal > 0 && couts.totalCoutsReel > 0 && couts.margeReelPct !== null
        ? Math.round(couts.margeReelPct)
        : null;
    });
    return map;
  }, [actifs, coutsMap]);

  // ── Rentabilité réelle par chantier (basé sur jours réalisés) ─
  const rentaReelleParChantier = useMemo(() => {
    const map = {};
    actifs.forEach(c => { map[c.id] = calculerRentabiliteReelle(c, parametres, devis); });
    return map;
  }, [actifs, parametres, devis]);

  // ── KPI rentabilité réelle + écarts prévu/réel ───────────────
  const kpiReel = useMemo(() => {
    const vals = Object.values(rentaReelleParChantier);
    const actives = vals.filter(r => !r.aucuneSaisie);
    // Pour marges : uniquement les chantiers avec devis (montantDevis non null)
    const activesAvecDevis = actives.filter(r => r.montantDevis !== null);
    const nbEnRetard  = actives.filter(r => r.enDepassement).length;
    const ecarts      = actives.map(r => r.joursRealises - r.joursPrevu);
    const moyenneEcartJours = actives.length > 0
      ? parseFloat((ecarts.reduce((s, e) => s + e, 0) / actives.length).toFixed(1))
      : null;
    const margeReelleTotale = activesAvecDevis.reduce((s, r) => s + r.rentabilite, 0);
    const caActifTotal = activesAvecDevis.reduce((s, r) => s + r.montantDevis, 0);
    const margeReellePct = caActifTotal > 0 ? Math.round((margeReelleTotale / caActifTotal) * 100) : null;
    return {
      nbRentables:       actives.filter(r => r.rentabilitePct !== null && r.rentabilitePct >= 15).length,
      nbDepassement:     nbEnRetard,
      nbSansSaisie:      vals.filter(r => r.aucuneSaisie).length,
      margeReelleTotale,
      margeReellePct,
      nbActives:         actives.length,
      moyenneEcartJours,
    };
  }, [rentaReelleParChantier]);

  // ── KPI équipe (Dashboard) — moteur ─────────────────────────
  const kpiEquipe = useMemo(() => {
    const resultsAvecEquipe = actifs
      .map(c => {
        const etatC = calculerEtatChantier(c, parametres.employes, devis);
        const reel = rentaReelleParChantier[c.id];
        return { c, coutMOReel: etatC.coutMOReel, reel };
      })
      .filter(r => r.coutMOReel > 0);

    if (resultsAvecEquipe.length === 0) return null;

    const coutMoyenEquipe = Math.round(
      resultsAvecEquipe.reduce((s, r) => s + r.coutMOReel, 0) / resultsAvecEquipe.length
    );
    const plusCher = resultsAvecEquipe.reduce(
      (max, r) => r.coutMOReel > (max?.coutMOReel || 0) ? r : max, null
    );
    const plusRentable = resultsAvecEquipe
      .filter(r => r.reel && !r.reel.aucuneSaisie && r.reel.montantDevis !== null && r.reel.montantDevis > 0)
      .reduce((max, r) => !max || (r.reel.rentabilitePct ?? -Infinity) > (max.reel.rentabilitePct ?? -Infinity) ? r : max, null);

    return { coutMoyenEquipe, plusCher, plusRentable };
  }, [actifs, parametres, rentaReelleParChantier]);

  // ── Analyse chantiers — "À traiter en priorité" ─────────────
  const analyseChantiers = useMemo(() => {
    const ORDRE = { perte: 0, depassement: 1, faible: 2, non_saisi: 3 };
    return actifs.map(c => {
      const reel = rentaReelleParChantier[c.id];
      const client = clients.find(cl => String(cl.id) === String(c.clientId));
      let statut, probleme, marge, couleur;

      if (!reel || reel.aucuneSaisie) {
        statut = 'non_saisi';
        probleme = 'Aucun jour réalisé saisi';
        marge = null;
        couleur = '#78909c';
      } else if (reel.montantDevis === null) {
        statut = 'non_saisi';
        probleme = 'Aucun devis lié — CA indisponible';
        marge = null;
        couleur = '#78909c';
      } else if (reel.rentabilite !== null && reel.rentabilite < 0) {
        statut = 'perte';
        probleme = `Déficit CHF ${fmtN(Math.abs(Math.round(reel.rentabilite)))}`;
        marge = reel.rentabilitePct;
        couleur = C.danger;
      } else if (reel.enDepassement) {
        statut = 'depassement';
        const surplus = reel.joursRealises - reel.joursPrevu;
        probleme = `Dépassement ${surplus}j réalisé${surplus > 1 ? 's' : ''} (prévu : ${reel.joursPrevu}j)`;
        marge = reel.rentabilitePct;
        couleur = C.warning;
      } else if (reel.rentabilitePct !== null && reel.rentabilitePct < 10) {
        statut = 'faible';
        probleme = `Marge ${reel.rentabilitePct.toFixed(1)}% — sous le seuil cible de 10%`;
        marge = reel.rentabilitePct;
        couleur = C.warning;
      } else {
        return null; // chantier sain → hors liste
      }

      return { c, client, statut, probleme, marge, couleur, reel, ordre: ORDRE[statut] };
    })
    .filter(Boolean)
    .sort((a, b) => a.ordre - b.ordre);
  }, [actifs, rentaReelleParChantier, clients]);

  // ── Alertes ──────────────────────────────────────────────────
  const alertes = useMemo(() => {
    const list = [];

    // Retards chantier
    actifs.forEach(c => {
      const j = joursParChantier[c.id];
      if (j !== null && j < 0) {
        {
          const absEffectif = Math.abs(j);
          const dateFin = calculerDateFinOuvrables(c.dateDebut, parseInt(c.nombreJours) || 0, c.inclusSamedi);
          const dateFinStr = dateFin ? new Date(dateFin).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }) : null;
          list.push({
            id: `retard-${c.id}`,
            message: `${c.nom || c.numero} — retard de ${absEffectif} jour${absEffectif > 1 ? 's' : ''}${dateFinStr ? ` · fin prévue dépassée (${dateFinStr})` : ''}`,
            page: 'chantiers', ctx: { chantierActif: c.id },
            critique: absEffectif > 7,
          });
        }
      }
    });

    // Chantiers non rentables (calcul complet)
    actifs.forEach(c => {
      const couts = coutsMap.get(c.id);
      const { montantTotal, totalCoutsReel, margeReel, margeReelPct } = couts;
      if (montantTotal > 0 && totalCoutsReel > 0) {
        const pct = margeReelPct;
        if (pct !== null && pct < 15) {
          const s = statutRentabilite(pct);
          const detail = margeReel < 0
            ? `déficit CHF ${fmtN(Math.abs(Math.round(margeReel)))}`
            : `marge ${pct.toFixed(1)}%`;
          list.push({
            id: `nonrentable-${c.id}`,
            message: `${c.nom || c.numero} — ${s.label} · ${detail}`,
            page: 'chantiers', ctx: { chantierActif: c.id },
            critique: margeReel < 0,
          });
        }
      }
    });

    // Factures en retard
    const fRetard = facturesSafe.filter(f =>
      f.statut === 'retard' ||
      (f.statut === 'envoyee' && f.dateEcheance && new Date(f.dateEcheance) < new Date())
    );
    if (fRetard.length > 0) {
      const montant = fRetard.reduce((t, f) =>
        t + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);
      list.push({
        id: 'factures-retard',
        message: `${fRetard.length} facture${fRetard.length > 1 ? 's' : ''} en retard · CHF ${fmtN(montant)} à encaisser`,
        page: 'finances', ctx: {},
        critique: false,
      });
    }

    // Dépassement de jours réalisés vs prévus
    actifs.forEach(c => {
      const r = rentaReelleParChantier[c.id];
      if (!r || r.aucuneSaisie || !r.enDepassement) return;
      const surplus = r.joursRealises - r.joursPrevu;
      // Ne pas dupliquer si déjà une alerte retard-date pour ce chantier
      if (list.some(a => a.id === `retard-${c.id}`)) return;
      list.push({
        id: `depassement-jours-${c.id}`,
        message: `${c.nom || c.numero} — ${surplus}j de plus que prévu (${r.joursRealises}j réalisés / ${r.joursPrevu}j prévus)`,
        page: 'chantiers', ctx: { chantierActif: c.id },
        critique: r.joursPrevu > 0 && surplus > Math.max(1, Math.round(r.joursPrevu * 0.2)),
      });
    });

    // Chantier sans saisie de jours réalisés, démarré depuis > 3 jours
    actifs.forEach(c => {
      const r = rentaReelleParChantier[c.id];
      if (!r || !r.aucuneSaisie || !c.dateDebut) return;
      const joursDemarre = Math.floor((Date.now() - new Date(c.dateDebut)) / 86400000);
      if (joursDemarre < 3) return;
      list.push({
        id: `sans-saisie-${c.id}`,
        message: `${c.nom || c.numero} — aucun jour réalisé saisi (démarré il y a ${joursDemarre}j)`,
        page: 'chantiers', ctx: { chantierActif: c.id },
        critique: false,
      });
    });

    // Chantiers avec devis mais statut ≠ En cours (CA non comptabilisé)
    chantiers.filter(c => c.devisId && !isChantierActif(c) && !STATUTS_CLOS.includes(c.statut)).forEach(c => {
      list.push({
        id: `devis-inactif-${c.id}`,
        message: `${c.nom || c.numero} — devis lié mais statut "${c.statut}" · CA non comptabilisé`,
        page: 'chantiers', ctx: { chantierActif: c.id },
        critique: false,
      });
    });

    return list.sort((a, b) => (b.critique ? 1 : 0) - (a.critique ? 1 : 0));
  }, [actifs, joursParChantier, facturesSafe, parametres, rentaReelleParChantier, devis, chantiers, coutsMap]);

  // ── Couleur état chantier ────────────────────────────────────
  const couleurEtat = (c) => {
    const j = joursParChantier[c.id];
    const r = rentaParChantier[c.id];
    const retardInterne = j !== null && j < 0 && !estRetardJustifie(c);
    if (retardInterne || (r !== null && r < 0)) return C.danger;
    if ((j !== null && j < 3) || (r !== null && r < 10)) return C.warning;
    return C.secondaire;
  };

  // ── Priorité chantier ────────────────────────────────────────
  // Retourne { niveau: 'critique'|'attention'|'ok', score: 0|1|2 }
  const calculerPriorite = (c) => {
    const j = joursParChantier[c.id];
    const r = rentaParChantier[c.id];
    const reel = rentaReelleParChantier[c.id];
    const retardJ = j !== null && j < 0 && !estRetardJustifie(c) ? Math.abs(j) : 0;
    const avancement = parseFloat(c.avancement) || 0;
    const aCommence = !!c.dateDebut && new Date(c.dateDebut) <= new Date();

    // Critique : retard interne > 5j OU rentabilité négative OU dépassement > 20% des jours OU marge réelle négative
    const depassementCritique = reel && reel.enDepassement && reel.joursPrevu > 0 &&
      (reel.joursRealises - reel.joursPrevu) > Math.max(1, Math.round(reel.joursPrevu * 0.2));
    if (retardJ > 5 || (r !== null && r < 0) || depassementCritique ||
        (reel && !reel.aucuneSaisie && reel.rentabilite < 0))
      return { niveau: 'critique', score: 2 };

    // Attention : retard interne 1-5j OU renta < 10% OU avancement faible OU dépassement jours OU faible marge réelle
    if (retardJ >= 1 || (r !== null && r < 10) || (aCommence && avancement < 20) ||
        (reel && reel.enDepassement) || (reel && !reel.aucuneSaisie && reel.rentabilitePct < 15))
      return { niveau: 'attention', score: 1 };

    return { niveau: 'ok', score: 0 };
  };

  const PRIORITE_BADGE = {
    critique: { label: 'Critique',    bg: 'rgba(239,68,68,0.12)',  color: C.danger,     border: 'rgba(239,68,68,0.28)' },
    attention: { label: 'À surveiller', bg: 'rgba(245,158,11,0.12)', color: C.warning,    border: 'rgba(245,158,11,0.28)' },
    ok:        { label: 'OK',           bg: 'rgba(16,185,129,0.12)', color: C.secondaire, border: 'rgba(16,185,129,0.28)' },
  };

  // Calculé une seule fois, partagé par les deux sections pour garantir l'exclusivité
  const top3 = [...actifs]
    .sort((a, b) => calculerPriorite(b).score - calculerPriorite(a).score)
    .filter(c => calculerPriorite(c).niveau !== 'ok')
    .slice(0, 3);
  const top3Ids = new Set(top3.map(c => c.id));

  // ── Actions recommandées ─────────────────────────────────────
  const actionsRecommandees = (() => {
    const list = [];

    actifs.forEach(c => {
      const j = joursParChantier[c.id];
      const r = rentaParChantier[c.id];
      const retardJ = j !== null && j < 0 ? Math.abs(j) : 0;

      if (r !== null && r < 0) {
        list.push({ id: `urgence-${c.id}`, nom: c.nom || c.numero, action: 'Chantier à perte — analyser les coûts', btnLabel: 'Urgence', btnCouleur: C.danger, Icon: AlertTriangle, page: 'chantiers', ctx: { chantierActif: c.id }, score: 4, type: 'urgence' });
      } else if (retardJ > 3) {
        list.push({ id: `ressource-${c.id}`, nom: c.nom || c.numero, action: 'Retard important — ajouter des ressources', btnLabel: 'Voir chantier', btnCouleur: C.warning, Icon: Plus, page: 'chantiers', ctx: { chantierActif: c.id }, score: 3, type: 'ressource' });
      } else if (r !== null && r >= 0 && r < 10) {
        list.push({ id: `marge-${c.id}`, nom: c.nom || c.numero, action: 'Marge faible — vérifier les coûts', btnLabel: 'Analyser', btnCouleur: C.primaire, Icon: TrendingUp, page: 'chantiers', ctx: { chantierActif: c.id }, score: 2, type: 'analyse' });
      }
    });

    // Factures en retard → relancer client (une action groupée)
    const fRetard = facturesSafe.filter(f =>
      f.statut === 'retard' ||
      (f.statut === 'envoyee' && f.dateEcheance && new Date(f.dateEcheance) < new Date())
    );
    if (fRetard.length > 0) {
      list.push({ id: 'relance-factures', nom: `${fRetard.length} facture${fRetard.length > 1 ? 's' : ''} en retard`, action: 'Relancer le client', btnLabel: 'Relancer', btnCouleur: C.violet, Icon: CreditCard, page: 'finances', ctx: {}, score: 3, type: 'relance', factureIds: fRetard.map(f => f.id) });
    }

    return list.sort((a, b) => b.score - a.score).slice(0, 5);
  })();

  // ── À ne pas oublier ─────────────────────────────────────────
  const aNesPasOublier = (() => {
    const list = [];
    const now = Date.now();

    // 1. Factures en retard sans relance depuis > 7 jours
    const facturesEnRetard = facturesSafe.filter(f =>
      f.statut === 'retard' ||
      (f.statut === 'envoyee' && f.dateEcheance && new Date(f.dateEcheance) < new Date())
    );
    const facsSansRelance = facturesEnRetard.filter(f => {
      const derniere = actionsLog
        .filter(a => a.type === 'relance' && (a.factureIds || []).includes(f.id))
        .sort((a, b) => b.date - a.date)[0];
      return !derniere || Math.floor((now - derniere.date) / 86400000) > 7;
    });
    if (facsSansRelance.length > 0) {
      const montant = facsSansRelance.reduce((t, f) =>
        t + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);
      list.push({
        id: 'factures-sans-relance',
        nom: `${facsSansRelance.length} facture${facsSansRelance.length > 1 ? 's' : ''} en retard`,
        probleme: `Aucune relance depuis > 7 jours · CHF ${fmtN(montant)}`,
        btnLabel: 'Relancer', btnCouleur: C.violet, page: 'finances', ctx: {}, score: 4,
      });
    }

    // 2. Chantier actif sans aucune action depuis > 14 jours
    actifs.forEach(c => {
      if (!c.dateDebut) return;
      const joursDemarre = Math.floor((now - new Date(c.dateDebut)) / 86400000);
      if (joursDemarre < 7) return;
      const derniere = actionsLog.filter(a => a.chantierId === c.id).sort((a, b) => b.date - a.date)[0];
      const joursInactivite = derniere ? Math.floor((now - derniere.date) / 86400000) : joursDemarre;
      if (joursInactivite > 14) {
        list.push({
          id: `inactivite-${c.id}`,
          nom: c.nom || c.numero,
          probleme: `Aucune action depuis ${joursInactivite} jour${joursInactivite > 1 ? 's' : ''}`,
          btnLabel: 'Voir', btnCouleur: C.primaire, page: 'chantiers', ctx: { chantierActif: c.id }, score: 1,
        });
      }
    });

    // 3. Action récente (≤ 5 jours) mais problème toujours présent
    actifs.forEach(c => {
      const j = joursParChantier[c.id];
      const r = rentaParChantier[c.id];
      const retardJ = j !== null && j < 0 ? Math.abs(j) : 0;
      const actionRecente = actionsLog
        .filter(a => a.chantierId === c.id && Math.floor((now - a.date) / 86400000) <= 5)
        .sort((a, b) => b.date - a.date)[0];
      if (!actionRecente) return;
      const problemePersiste =
        (retardJ > 3 && actionRecente.type === 'ressource') ||
        (r !== null && r < 0 && actionRecente.type === 'urgence');
      if (problemePersiste) {
        list.push({
          id: `persistant-${c.id}`,
          nom: c.nom || c.numero,
          probleme: 'Action effectuée mais problème toujours présent',
          btnLabel: 'Analyser', btnCouleur: C.warning, page: 'chantiers', ctx: { chantierActif: c.id }, score: 3,
        });
      }
    });

    // 4. Devis envoyé sans réponse > 14 jours
    devis.filter(d => d.statut === 'Envoyé' && !d.chantierId).forEach(d => {
      const joursAttente = Math.floor((now - new Date(d.dateEmission || d.date || 0)) / 86400000);
      if (joursAttente > 14) {
        list.push({
          id: `devis-attente-${d.id}`,
          nom: d.numero || 'Devis',
          probleme: `Sans réponse depuis ${joursAttente} jour${joursAttente > 1 ? 's' : ''}`,
          btnLabel: 'Relancer', btnCouleur: C.primaire, page: 'devis', ctx: {}, score: 2,
        });
      }
    });

    return list.sort((a, b) => b.score - a.score).slice(0, 5);
  })();

  // ── À anticiper ──────────────────────────────────────────────
  const aAnticiper = (() => {
    const list = [];
    const now = new Date();

    // 1. Chantier proche du retard : ≤ 3 jours restants et avancement < 80%
    actifs.forEach(c => {
      const j = joursParChantier[c.id];
      const avancement = parseFloat(c.avancement) || 0;
      if (j !== null && j >= 0 && j <= 3 && avancement < 80) {
        list.push({
          id: `proche-retard-${c.id}`,
          nom: c.nom || c.numero,
          probleme: `${j === 0 ? 'Dernier jour' : `${j}j restant${j > 1 ? 's' : ''}`} · avancement ${avancement}%`,
          btnLabel: 'Voir', btnCouleur: C.warning,
          page: 'chantiers', ctx: { chantierActif: c.id }, score: 3 - j,
        });
      }
    });

    // 2. Rentabilité en danger : coûts > 80% du devis, chantier non terminé
    actifs.forEach(c => {
      const ca = calculerCA(c, devis);
      const cout = (parseFloat(c.materielReel) || parseFloat(c.coutMaterielReel) || 0)
        + (parseFloat(c.sousTraitanceReelle) || parseFloat(c.coutSousTraitanceReel) || 0)
        + (parseFloat(c.autresCoutsReels) || parseFloat(c.autresCoutsReel) || 0);
      if (ca > 0 && cout > ca * 0.8 && cout <= ca) {
        const margePct = Math.round((ca - cout) / ca * 100);
        list.push({
          id: `renta-danger-${c.id}`,
          nom: c.nom || c.numero,
          probleme: `Coûts à ${Math.round(cout / ca * 100)}% du devis · marge restante ${margePct}%`,
          btnLabel: 'Analyser', btnCouleur: C.warning,
          page: 'chantiers', ctx: { chantierActif: c.id }, score: 2,
        });
      }
    });

    // 3. Facture dont l'échéance arrive dans ≤ 3 jours
    facturesSafe
      .filter(f => ['envoyee', 'partielle'].includes(f.statut) && f.dateEcheance)
      .forEach(f => {
        const joursAvantEcheance = Math.floor((new Date(f.dateEcheance) - now) / 86400000);
        if (joursAvantEcheance >= 0 && joursAvantEcheance <= 3) {
          const restant = Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0));
          list.push({
            id: `echeance-${f.id}`,
            nom: f.numero || 'Facture',
            probleme: `Échéance ${joursAvantEcheance === 0 ? "aujourd'hui" : `dans ${joursAvantEcheance}j`} · CHF ${fmtN(restant)}`,
            btnLabel: 'Suivre', btnCouleur: C.primaire,
            page: 'finances', ctx: {}, score: 3 - joursAvantEcheance,
          });
        }
      });

    return list.sort((a, b) => b.score - a.score).slice(0, 3);
  })();

  // ── Risque futur (pré-calculé pour réutilisation dans JSX) ───
  const risqueFuturData = (() => {
    const evaluerRisque = (c) => {
      if (top3Ids.has(c.id)) return null;
      const j = joursParChantier[c.id];
      const r = rentaParChantier[c.id];
      const retardJ = j !== null && j < 0 ? Math.abs(j) : 0;
      const joursRestants = j !== null && j >= 0 ? j : null;
      const avancement = parseFloat(c.avancement) || 0;
      const aCommence = !!c.dateDebut && new Date(c.dateDebut) <= new Date();
      const raisons = [];
      let score = 0;
      if (retardJ >= 1 && retardJ <= 3) { raisons.push('léger retard'); score += 3; }
      else if (joursRestants !== null && joursRestants <= 3) { raisons.push('fin imminente'); score += 2; }
      if (r !== null && r >= 0 && r < 10) { raisons.push('marge faible'); score += 2; }
      if (aCommence && avancement < 30) { raisons.push('avancement lent'); score += 1; }
      return raisons.length > 0 ? { score, raisons } : null;
    };
    return actifs.map(c => ({ c, risque: evaluerRisque(c) })).filter(({ risque }) => risque !== null).sort((a, b) => b.risque.score - a.risque.score).slice(0, 3);
  })();

  // ── Chart data : aperçu financier (4 dernières semaines) ──
  const donneesMensuelles = useMemo(() => {
    const now = new Date();
    const totalCoutsActifs = actifs.reduce((sum, c) => {
      const r = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
      return sum + (r.totalCoutsReel || 0);
    }, 0);
    const coutsParSemaine = Math.round(totalCoutsActifs / 4);
    return Array.from({ length: 4 }, (_, i) => {
      const w = 4 - i;
      const deb = new Date(now); deb.setDate(now.getDate() - w * 7);
      const fin = new Date(now); fin.setDate(now.getDate() - (w - 1) * 7);
      const ca = (factures || []).filter(f => { const d = f.dateEmission ? new Date(f.dateEmission) : null; return d && d >= deb && d < fin; })
        .reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);
      const enc = (factures || []).flatMap(f => f.paiementsHistorique || [])
        .filter(p => { const d = p.date ? new Date(p.date) : null; return d && d >= deb && d < fin; })
        .reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
      return { semaine: deb.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }), CA: Math.round(ca), Couts: coutsParSemaine, Encaissements: Math.round(enc) };
    });
  }, [factures, actifs, parametres, devis]);

  // ── Répartition des coûts (donut) ──────────────────────────
  const repartitionCouts = useMemo(() => {
    let mo = 0, mat = 0, st = 0, dep = 0, autres = 0;
    actifs.forEach(c => {
      const r = coutsMap.get(c.id) || {};
      mo += r.coutEquipeReel || 0;
      mat += r.coutMaterielReel || 0;
      st += r.coutSousTraitanceReel || 0;
      dep += r.coutDeplacement || 0;
      autres += r.autresCoutsReel || 0;
    });
    const total = mo + mat + st + dep + autres;
    if (total === 0) return { total: 0, segments: [] };
    return { total, segments: [
      { name: "Main d'œuvre", value: (mo / total) * 100, couleur: '#3b82f6' },
      { name: 'Matériaux',    value: (mat / total) * 100, couleur: '#8b5cf6' },
      { name: 'Sous-traitance', value: (st / total) * 100, couleur: '#10b981' },
      { name: 'Déplacement',  value: (dep / total) * 100, couleur: '#f59e0b' },
      { name: 'Autres',       value: (autres / total) * 100, couleur: '#94a3b8' },
    ].filter(s => s.value > 0.5) };
  }, [actifs, coutsMap]);

  // ── Avancement moyen global — source unique : journal (calculerEtatChantier)
  // Fallback sur c.avancement (valeur manuelle) uniquement si journal vide
  const avancementMoyen = useMemo(() => {
    if (actifs.length === 0) return 0;
    const sum = actifs.reduce((s, c) => {
      const etat = calculerEtatChantier(c, parametres.employes, devis);
      const pct = etat.totalJoursReels > 0 ? etat.avancementPct : (parseFloat(c.avancement) || 0);
      return s + pct;
    }, 0);
    return sum / actifs.length;
  }, [actifs, parametres.employes, devis]);

  const BADGE_STATUT_DASH = {
    ok:       { label: 'Rentable',  bg: '#D1FAE5', color: '#065F46' },
    attention:{ label: 'Attention', bg: '#FEF3C7', color: '#92400E' },
    critique: { label: 'Danger',    bg: '#FEE2E2', color: '#991B1B' },
  };

  // ── Helpers JSX (conservés pour compatibilité) ──────────────
  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
      <span style={{ width: 3, height: 12, borderRadius: 2, background: '#2563eb', flexShrink: 0, display: 'inline-block' }} />
      {children}
    </div>
  );

  const ActionRow = ({ nom, texte, btnLabel, btnCouleur, onAction, Icon: RowIcon }) => (
    <div
      onClick={onAction}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, marginBottom: 6, background: 'var(--bg-glass)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.3s ease, border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)'; e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-glass)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      {RowIcon && <RowIcon size={14} strokeWidth={1.8} style={{ color: btnCouleur, flexShrink: 0 }} />}
      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', flexShrink: 0 }}>{nom}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{texte}</span>
      <button
        onClick={e => { e.stopPropagation(); onAction(); }}
        style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0, transition: 'all 0.2s ease', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
        onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.32) 0%, rgba(99,102,241,0.24) 100%)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,0.3), 0 0 0 1px rgba(59,130,246,0.5)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.55)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(99,102,241,0.14) 100%)'; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)'; }}
      >{btnLabel}</button>
    </div>
  );

  const CARD = { background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: 16, padding: '20px', boxShadow: 'var(--ds-card-shadow)' };

  return (
    <div>

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            Bonjour, {profil?.nom?.split(' ')[0] || 'Direction'} 👋</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })} · {actifs.length} chantier{actifs.length !== 1 ? 's' : ''} actif{actifs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '3px' }}>
            {[{ id: 'semaine', label: 'Semaine' }, { id: 'mois', label: 'Mois' }, { id: 'annee', label: 'Année' }].map(p => (
              <button key={p.id} onClick={() => setPeriodeGlobale(p.id)}
                style={{ background: periodeGlobale === p.id ? '#2563eb' : 'transparent', border: 'none', color: periodeGlobale === p.id ? '#fff' : 'var(--text-muted)', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s', fontFamily: 'inherit' }}
              >{p.label}</button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={naviguerAgents} title="Alertes Agents IA" style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 10, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: nbAgentAlertes > 0 ? '#f59e0b' : 'var(--text-secondary)' }}>
              <Bell size={16} strokeWidth={2} />
            </button>
            {nbAgentAlertes > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>{nbAgentAlertes}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: "CA en cours", Icon: DollarSign, page: 'devis',
            valeur: `CHF ${fmtN(kpi.caEnCours)}`,
            sous: kpi.nbChantiersActifs > 0 ? `${kpi.nbChantiersActifs} chantier${kpi.nbChantiersActifs !== 1 ? 's' : ''} en cours · devis signés` : 'Aucun chantier en cours',
            ...DS.kpi.blue },
          { label: 'Marge moyenne', Icon: TrendingUp, page: 'analyse',
            valeur: kpi.rentaMoyenne !== null ? `${Math.round(kpi.rentaMoyenne)}%` : '—',
            sous: kpi.nbChantiersRenta > 0 ? `${kpi.nbChantiersRenta} chantier${kpi.nbChantiersRenta > 1 ? 's' : ''} analysé${kpi.nbChantiersRenta > 1 ? 's' : ''}` : 'Aucun coût saisi',
            ...(kpi.rentaMoyenne === null || kpi.rentaMoyenne >= 15 ? DS.kpi.green : kpi.rentaMoyenne >= 0 ? DS.kpi.amber : DS.kpi.red) },
          { label: 'Chantiers actifs', Icon: HardHat, page: 'chantiers',
            valeur: `${kpi.nbChantiersActifs}`,
            sous: kpiReel.nbDepassement > 0 ? `${kpiReel.nbDepassement} en retard` : 'Tous dans les temps',
            ...DS.kpi.amber,
            badge: kpiReel.nbDepassement > 0 ? `${kpiReel.nbDepassement} en retard` : null },
          { label: 'Heures ce mois', Icon: Clock, page: 'heures',
            valeur: kpi.heuresEngagees > 0 ? `${fmtN(kpi.heuresEngagees)}h` : '—',
            sous: kpi.nbEmployes > 0 ? `${kpi.nbEmployes} employé${kpi.nbEmployes > 1 ? 's' : ''} mobilisé${kpi.nbEmployes > 1 ? 's' : ''}` : 'Équipes non renseignées',
            ...DS.kpi.purple },
        ].map(({ label, Icon, page: dest, valeur, sous, gradient, glow, badge }) => (
          <div key={label} onClick={() => naviguer(dest)}
            style={{ background: gradient, borderRadius: 16, padding: '22px 20px', minHeight: 130, cursor: 'pointer', boxShadow: `0 4px 20px ${glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', transition: 'transform 0.18s, box-shadow 0.18s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 10px 30px ${glow}, 0 2px 8px rgba(0,0,0,0.18)`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 4px 20px ${glow}, 0 1px 4px rgba(0,0,0,0.12)`; }}
          >
            <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
              <Icon size={18} strokeWidth={2} style={{ color: '#ffffff' }} />
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#ffffff', letterSpacing: '-1px', lineHeight: 1, marginBottom: 8 }}>{valeur}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: 500 }}>{sous}</span>
              {badge && <span style={{ background: 'rgba(239,68,68,0.85)', color: 'white', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{badge}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── LIGNE 2 : CHANTIERS · FINANCIER · ALERTES ────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 0.75fr', gap: 16, marginBottom: 20 }}>

        {/* ── COLONNE GAUCHE : Mes chantiers ── */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Mes chantiers</div>
            <button onClick={() => naviguer('chantiers')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#2563eb', fontWeight: 600, fontFamily: 'inherit', padding: 0 }}>Voir tous →</button>
          </div>
          {actifs.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, textAlign: 'center', padding: '24px 0' }}>Aucun chantier actif</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...actifs].sort((a, b) => calculerPriorite(b).score - calculerPriorite(a).score).slice(0, 3).map(c => {
                  const priorite = calculerPriorite(c);
                  const statBadge = BADGE_STATUT_DASH[priorite.niveau];
                  const montantCA = calculerCA(c, devis);
                  const couts = coutsMap.get(c.id) || {};
                  const progress = Math.max(0, Math.min(100, Number(c.avancement ?? 0)));
                  const j = joursParChantier[c.id];
                  const retardJ = j !== null && j < 0 ? Math.abs(j) : 0;
                  const mPct = couts.montantTotal > 0 && couts.totalCoutsReel > 0 && couts.margeReelPct !== null ? Math.round(couts.margeReelPct) : null;
                  const joursTotal = c.nombreJours || 0;
                  const joursEcoules = c.dateDebut
                    ? Math.max(0, Math.floor((Date.now() - new Date(c.dateDebut).getTime()) / 86400000))
                    : null;
                  const margeVal = parseFloat(couts?.margeReelPct) || 0;
                  const sansCouts = !couts?.margeReelPct;
                  const avancementVal = sansCouts ? 0 : Math.min(Math.round(((joursEcoules || 0) / (joursTotal || 1)) * 100), 100);
                  const couleurBarre = sansCouts ? '#CBD5E1'
                    : margeVal > 20 ? '#10B981'
                    : margeVal > 10 ? '#F59E0B'
                    : '#EF4444';
                  const statutJours = retardJ > 0 ? { label: `En retard ${retardJ}j`, couleur: '#ef4444' }
                    : j === 0 ? { label: "Fin aujourd'hui", couleur: '#f59e0b' }
                    : j !== null && j <= 3 ? { label: `${j}j restants`, couleur: '#f59e0b' }
                    : j !== null ? { label: 'En avance', couleur: '#10b981' }
                    : { label: '—', couleur: 'var(--text-muted)' };
                  return (
                    <div key={c.id} onClick={() => naviguer('chantiers', { chantierActif: c.id })}
                      style={{ padding: '14px', borderRadius: 12, border: '1px solid var(--dash-border)', cursor: 'pointer', background: 'var(--bg-glass)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dash-border)'; e.currentTarget.style.background = 'var(--bg-glass)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom || c.numero}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[c.ville, c.canton].filter(Boolean).join(' · ')}</div>
                        </div>
                        <span style={{ background: statBadge.bg, color: statBadge.color, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{statBadge.label}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                        {[
                          { label: 'CA', val: montantCA ? `CHF ${fmtN(montantCA)}` : '—' },
                          { label: 'Coût', val: couts.totalCoutsReel > 0 ? `CHF ${fmtN(Math.round(couts.totalCoutsReel))}` : '—' },
                          { label: 'Marge', val: mPct !== null ? `${mPct}%` : '—', couleur: mPct !== null ? (mPct >= 15 ? '#10b981' : mPct >= 0 ? '#f59e0b' : '#ef4444') : undefined },
                        ].map(m => (
                          <div key={m.label} style={{ background: 'var(--bg-glass-2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{m.label}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: m.couleur || 'var(--text-primary)' }}>{m.val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, margin: '10px 0 6px 0' }}>
                        <div style={{ height: '100%', width: `${avancementVal}%`, background: couleurBarre, borderRadius: 2, transition: 'width 0.3s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {joursTotal > 0
                            ? `${joursEcoules !== null ? joursEcoules : '—'} / ${joursTotal} jours`
                            : `${progress}% d'avancement`}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: statutJours.couleur }}>{statutJours.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* ── COLONNE CENTRE : Aperçu financier ── */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Aperçu financier</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px' }}>4 dernières semaines</span>
          </div>
          {donneesMensuelles.some(d => d.CA > 0 || d.Couts > 0) ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={donneesMensuelles} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="semaine" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={{ background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }} formatter={(val, name) => [`CHF ${fmtN(val)}`, name]} />
                <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} name="Chiffre d'affaires" />
                <Line type="monotone" dataKey="Couts" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3, fill: '#94a3b8' }} strokeDasharray="5 3" name="Coûts estimés" />
                <Line type="monotone" dataKey="Encaissements" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} name="Encaissements" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucune donnée disponible</div>
          )}
          <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
            {[['#3b82f6', "Chiffre d'affaires"], ['#94a3b8', 'Coûts estimés'], ['#10b981', 'Encaissements']].map(([col, lbl]) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span style={{ width: 20, height: 2.5, background: col, borderRadius: 2, display: 'inline-block' }} />{lbl}
              </div>
            ))}
          </div>
        </div>

        {/* ── COLONNE DROITE : Alertes agents IA ── */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Bot size={15} strokeWidth={2} style={{ color: '#8b5cf6' }} />
              Alertes intelligentes
            </div>
            <button onClick={naviguerAgents} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', fontWeight: 600, padding: 0, fontFamily: 'inherit' }}>Tout voir →</button>
          </div>
          {agentAlertes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={32} strokeWidth={1.5} style={{ color: '#10b981' }} />
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Tout est sous contrôle</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucune alerte détectée sur vos chantiers</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 340, overflowY: 'auto' }}>
              {agentAlertes.slice(0, 7).map((a) => {
                const DOTS = { DANGER: '#EF4444', CRITIQUE: '#ef4444', ATTENTION: '#F59E0B', INFO: '#3B82F6' };
                const dot = DOTS[a.niveau] || '#3B82F6';
                const handleClick = () => { marquerLu(a.id); if (a.action?.page) naviguer(a.action.page, a.action.ctx); else naviguerAgents(); };
                return (
                  <div key={a.id} onClick={handleClick}
                    style={{ padding: '9px 11px', borderRadius: 10, border: `1px solid ${a.lu ? 'var(--dash-border)' : dot + '40'}`, cursor: 'pointer', background: a.lu ? 'var(--bg-glass)' : dot + '08', transition: 'all 0.15s', display: 'flex', alignItems: 'flex-start', gap: 9 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = dot; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = a.lu ? 'var(--dash-border)' : dot + '40'; e.currentTarget.style.background = a.lu ? 'var(--bg-glass)' : dot + '08'; }}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, marginTop: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: a.lu ? 500 : 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</div>
                      {a.detail && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail}</div>}
                    </div>
                    <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── LIGNE 3 : RÉPARTITION COÛTS · AVANCEMENT · ACTIVITÉ ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>

        {/* Répartition des coûts (donut) */}
        <div style={CARD}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>Répartition des coûts</div>
          {repartitionCouts.total > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PieChart width={156} height={156}>
                  <Pie data={repartitionCouts.segments} cx={78} cy={78} innerRadius={48} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {repartitionCouts.segments.map((entry, i) => <Cell key={i} fill={entry.couleur} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: 8, fontSize: 11 }} formatter={v => [`${v.toFixed(0)}%`, '']} />
                </PieChart>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
                {repartitionCouts.segments.map(s => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.couleur, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>Aucun coût saisi</div>
          )}
        </div>

        {/* Avancement global (circle progress) */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20, width: '100%' }}>Avancement global</div>
          {actifs.length > 0 ? (
            <>
              <div style={{ position: 'relative', width: 140, height: 140, marginBottom: 20 }}>
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="58" fill="none" stroke="var(--border)" strokeWidth="10" />
                  <circle cx="70" cy="70" r="58" fill="none" stroke="#3b82f6" strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 58}`}
                    strokeDashoffset={`${2 * Math.PI * 58 * (1 - avancementMoyen / 100)}`}
                    strokeLinecap="round" transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{Math.round(avancementMoyen)}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2, textTransform: 'uppercase' }}>moy.</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {[
                  { label: 'En avance', count: kpiReel.nbRentables, dot: '#10b981' },
                  { label: 'Dans les temps', count: Math.max(0, actifs.length - kpiReel.nbDepassement - kpiReel.nbSansSaisie), dot: '#3b82f6' },
                  { label: 'En retard', count: kpiReel.nbDepassement, dot: '#ef4444' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.dot, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.label}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{l.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: '40px 0', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Aucun chantier actif</div>
          )}
        </div>

        {/* Activité récente */}
        <div style={CARD}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>Activité récente</div>
          {actionsLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: 13 }}>Aucune action enregistrée</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {actionsLog.slice(0, 5).map((a) => {
                const typeConf = { urgence: { I: AlertTriangle, c: '#ef4444' }, ressource: { I: Users, c: '#f59e0b' }, relance: { I: Bell, c: '#8b5cf6' }, analyse: { I: TrendingUp, c: '#3b82f6' } };
                const tc = typeConf[a.type] || { I: CheckCircle, c: '#10b981' };
                const AIcon = tc.I;
                const joursDiff = Math.floor((Date.now() - a.date) / 86400000);
                const timeLabel = joursDiff === 0 ? "Aujourd'hui" : joursDiff === 1 ? 'Hier' : `il y a ${joursDiff}j`;
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: tc.c + '18', border: `1px solid ${tc.c}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AIcon size={14} strokeWidth={2} style={{ color: tc.c }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label || a.type}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{timeLabel}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── IA INSIGHTS BAR ──────────────────────────────────────── */}
      {!insightsFerme && previsionTreso30j.interpretation && (
        <div style={{ background: previsionTreso30j.interpretation.couleur + '10', border: `1px solid ${previsionTreso30j.interpretation.couleur}22`, borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: previsionTreso30j.interpretation.couleur + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={16} strokeWidth={2} style={{ color: previsionTreso30j.interpretation.couleur }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>IA Insights</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {previsionTreso30j.interpretation.label}{previsionTreso30j.dateLimite && ` · Couverture jusqu'au ${previsionTreso30j.dateLimite}`}
            </div>
          </div>
          <button onClick={() => naviguer('finances')}
            style={{ background: previsionTreso30j.interpretation.couleur, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            Voir les détails
          </button>
          <button onClick={() => setInsightsFerme(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>
            ×
          </button>
        </div>
      )}

    </div>
  );
}

export default Dashboard;
