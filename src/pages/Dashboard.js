import React, { useState, useMemo } from 'react';
import {
  HardHat, Users, TrendingUp, AlertTriangle, XCircle,
  ChevronRight, CheckCircle, ShieldCheck, DollarSign, Bell, Clock, Bot,
} from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  fmtN, calculerDateFinOuvrables, estRetardJustifie,
  calculerCoutsChantier, statutRentabilite, C, getIntervallesPeriode,
  facturesInPeriode, calculerRentabiliteReelle, calculerEtatChantier,
  calculerCA, isChantierActif, isChantierComptable,
} from '../donnees';
import { DS } from '../ds';
import { STATUTS_CLOS } from '../constants/statuts';
import { useApp } from '../context/AppContext';
import useIsMobile from '../hooks/useIsMobile';
import { calculerAlertes } from '../alertes';

function Dashboard() {
  const isMobile = useIsMobile();
  const { chantiers, clients, factures, devis = [], parametres, naviguer, actionsLog = [], periodeGlobale = 'mois', agentState } = useApp();
  const agentAlertes = agentState?.alertes || [];
  const nbAgentAlertes = agentState?.nbNonLues || 0;
  const marquerLu = agentState?.marquerLu || (() => {});
  const naviguerAgents = () => naviguer('agents');
  const facturesSafe = useMemo(() => factures || [], [factures]);
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
    chantiers.forEach(c => {
      const realises = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
      map[c.id] = c.nombreJours > 0 ? c.nombreJours - realises : null;
    });
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

    // 4. HEURES ENGAGÉES — depuis journal, filtrées sur le mois en cours
    const maintenant = new Date();
    const moisCourant = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
    const heuresEngagees = actifs.reduce((t, c) =>
      t + (c.journal || []).filter(entry => (entry.date || '').startsWith(moisCourant)).reduce((s, entry) =>
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actifs, facturesPeriode, devis, chantiers, parametres.employes, parametres.localites, coutsMap]);

  // ── Prévision trésorerie 30 jours ───────────────────────────
  const previsionTreso30j = useMemo(() => {
    const chantiersActifsAvecFactures = actifs.map(c => {
      const devisTotal = calculerCA(c, devis);
      if (devisTotal === null) return { id: c.id, nom: c.nom || c.numero, encaissementPrevu: 0 };
      // Règle BTP : avancement vient du journal des heures (source unique), avec fallback sur la valeur manuelle
      const etat = calculerEtatChantier(c, parametres?.employes || [], devis, parametres?.parametres || parametres);
      const avancement = etat?.avancementPct ?? 0;
      const montantFacture = (factures || [])
        .filter(f => String(f.chantierId) === String(c.id))
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      ? Math.round(ecarts.reduce((s, e) => s + e, 0) / actives.length * 10) / 10
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



  // ── Alertes ──────────────────────────────────────────────────
  const alertes = useMemo(() => {
    const list = [];

    // Retards chantier
    actifs.forEach(c => {
      const j = joursParChantier[c.id];
      if (j !== null && j < 0) {
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
            : `marge ${Math.round(pct * 10) / 10}%`;
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
    chantiers.filter(c => c.devisId && !isChantierActif(c) && !STATUTS_CLOS.map(s => s.toLowerCase()).includes((c.statut || '').toLowerCase())).forEach(c => {
      list.push({
        id: `devis-inactif-${c.id}`,
        message: `${c.nom || c.numero} — devis lié mais statut "${c.statut}" · CA non comptabilisé`,
        page: 'chantiers', ctx: { chantierActif: c.id },
        critique: false,
      });
    });

    // Alertes métier complémentaires (types non couverts par les calculs ci-dessus)
    const TYPES_ADDITIFS = new Set(['devis_attente', 'factures_brouillon', 'chantier_sans_devis', 'chantier_sans_facture', 'rappel_a_envoyer']);
    const existingIds = new Set(list.map(a => a.id));
    calculerAlertes(
      { chantiers, devis, factures, clients, paiements: {} },
      'direction'
    )
      .filter(a => TYPES_ADDITIFS.has(a.type))
      .forEach(a => {
        const id = `metier-${a.type}-${a.entityId || 'global'}`;
        if (existingIds.has(id)) return;
        list.push({
          id,
          message: a.message,
          page: a.page || 'chantiers',
          ctx: a.entityId ? { chantierActif: a.entityId } : {},
          critique: a.niveau === 'critique',
        });
      });

    return list.sort((a, b) => (b.critique ? 1 : 0) - (a.critique ? 1 : 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actifs, joursParChantier, facturesSafe, rentaReelleParChantier, devis, chantiers, coutsMap, factures, clients]);

  // ── Priorité chantier ────────────────────────────────────────
  // Retourne { niveau: 'critique'|'attention'|'ok', score: 0|1|2 }
  const calculerPriorite = (c) => {
    const j = joursParChantier[c.id];
    const r = rentaParChantier[c.id];
    const reel = rentaReelleParChantier[c.id];
    const retardJ = j !== null && j < 0 && !estRetardJustifie(c) ? Math.abs(j) : 0;
    const avancement = parseFloat(c.avancement) || 0;

    // Critique : retard interne > 5j OU rentabilité négative OU dépassement > 20% des jours OU marge réelle négative
    const depassementCritique = reel && reel.enDepassement && reel.joursPrevu > 0 &&
      (reel.joursRealises - reel.joursPrevu) > Math.max(1, Math.round(reel.joursPrevu * 0.2));
    if (retardJ > 5 || (r !== null && r < 0) || depassementCritique ||
        (reel && !reel.aucuneSaisie && reel.rentabilite < 0))
      return { niveau: 'critique', score: 2 };

    // Attention : retard interne 1-5j OU renta < 10% OU dépassement jours OU marge réelle faible
    // Avancement faible = seulement si >50% des jours planifiés sont déjà consommés mais <30% d'avancement
    const joursRealisesC = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
    const joursPlannedC = c.nombreJours || 0;
    const avancementRetard = joursPlannedC > 0 && joursRealisesC > joursPlannedC * 0.5 && avancement < 30;
    if (retardJ >= 1 || (r !== null && r < 10) || avancementRetard ||
        (reel && reel.enDepassement) || (reel && !reel.aucuneSaisie && Number.isFinite(reel.rentabilitePct) && reel.rentabilitePct < 15))
      return { niveau: 'attention', score: 1 };

    return { niveau: 'ok', score: 0 };
  };

  // ── Cache des priorités — évite O(n log n) appels à calculerPriorite à chaque render ──
  const prioriteMap = useMemo(() => {
    const map = new Map();
    actifs.forEach(c => map.set(c.id, calculerPriorite(c)));
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actifs, joursParChantier, rentaParChantier, rentaReelleParChantier]);

  // Calculé une seule fois, partagé par les deux sections pour garantir l'exclusivité
  // Mémoïsé pour éviter un sort O(n log n) + new Set à chaque render
  const { top3, top3Ids } = useMemo(() => {
    const sorted = [...actifs]
      .sort((a, b) => (prioriteMap.get(b.id) || { score: 0 }).score - (prioriteMap.get(a.id) || { score: 0 }).score)
      .filter(c => (prioriteMap.get(c.id) || { niveau: 'ok' }).niveau !== 'ok')
      .slice(0, 3);
    return { top3: sorted, top3Ids: new Set(sorted.map(c => c.id)) };
  }, [actifs, prioriteMap]);

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
      const etat = calculerEtatChantier(c, parametres.employes, devis, parametres?.parametres || parametres);
      const pct = etat.totalJoursReels > 0 ? etat.avancementPct : (parseFloat(c.avancement) || 0);
      return s + pct;
    }, 0);
    return sum / actifs.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actifs, parametres.employes, devis]);

  const BADGE_STATUT_DASH = {
    ok:        { label: 'En cours',  bg: '#D1FAE5', color: '#065F46' },
    attention: { label: 'Attention', bg: '#FEF3C7', color: '#92400E' },
    critique:  { label: 'Danger',    bg: '#FEE2E2', color: '#991B1B' },
    neutre:    { label: 'Planifié',  bg: 'var(--bg-glass-2)', color: 'var(--text-muted)' },
  };

  const CARD = { background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: 16, padding: isMobile ? '12px' : '20px', boxShadow: 'var(--ds-card-shadow)' };

  // ── MOBILE LAYOUT ────────────────────────────────────────────
  if (isMobile) {
    return (
      <div>
        {/* HEADER compact */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              Bonjour,
              <img src={`${process.env.PUBLIC_URL}/logo-cyna-tech.png`} alt="CYNA Tech" className="logo-cyna-tech-inline" style={{ height: 18, width: 'auto', objectFit: 'contain', verticalAlign: 'middle' }} />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0' }}>
              {new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })} · {actifs.length} chantier{actifs.length !== 1 ? 's' : ''} actif{actifs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* KPI STRIP */}
        <div className="kpi-grid" style={{ display: 'flex', overflowX: 'auto', gap: 10, marginBottom: 14, paddingBottom: 4 }}>
          {[
            { label: "CA actif", Icon: DollarSign, valeur: `CHF ${fmtN(kpi.caEnCours)}`, sous: `En cours + Planifié · ${kpi.nbChantiersActifs} chantier${kpi.nbChantiersActifs !== 1 ? 's' : ''}`, ...DS.kpi.blue, page: 'devis' },
            { label: 'Marge moy.', Icon: TrendingUp, valeur: kpi.rentaMoyenne !== null ? `${Math.round(kpi.rentaMoyenne)}%` : '—', sous: `${kpi.nbChantiersRenta} analysé${kpi.nbChantiersRenta !== 1 ? 's' : ''}`, ...(kpi.rentaMoyenne === null || kpi.rentaMoyenne >= 15 ? DS.kpi.green : kpi.rentaMoyenne >= 0 ? DS.kpi.amber : DS.kpi.red), page: 'analyse' },
            { label: 'Chantiers', Icon: HardHat, valeur: `${kpi.nbChantiersActifs}`, sous: kpiReel.nbDepassement > 0 ? `${kpiReel.nbDepassement} en retard` : 'Tous OK', ...DS.kpi.amber, page: 'chantiers' },
            { label: 'Heures', Icon: Clock, valeur: kpi.heuresEngagees > 0 ? `${fmtN(kpi.heuresEngagees)}h` : '—', sous: `${kpi.nbEmployes} employé${kpi.nbEmployes !== 1 ? 's' : ''}`, ...DS.kpi.purple, page: 'heures' },
          ].map(({ label, Icon, valeur, sous, gradient, glow, page: dest }) => (
            <div key={label} onClick={() => naviguer(dest)} className="kpi-card"
              style={{ background: gradient, borderRadius: 14, padding: '14px 12px', cursor: 'pointer', boxShadow: `0 4px 16px ${glow}`, border: '1px solid rgba(255,255,255,0.15)', flex: '0 0 130px', position: 'relative', overflow: 'hidden' }}
            >
              <div style={{ position: 'absolute', right: -10, top: -10, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Icon size={14} strokeWidth={2} style={{ color: '#fff' }} />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{label}</div>
              <div className="kpi-val" style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 4 }}>{valeur}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)' }}>{sous}</div>
            </div>
          ))}
        </div>

        {/* IA BANDEAU compact */}
        {(() => {
          const scoreDirecteur = agentState?.scoreGlobal ?? null;
          const alertesCritiques = agentAlertes.filter(a => a.niveau === 'CRITIQUE').length;
          const alertesAttention = agentAlertes.filter(a => a.niveau === 'ATTENTION').length;
          if (scoreDirecteur === null && agentAlertes.length === 0) return null;
          const scoreColor = scoreDirecteur >= 70 ? '#10b981' : scoreDirecteur >= 40 ? '#f59e0b' : '#ef4444';
          return (
            <div onClick={() => naviguer('agents')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 12, borderRadius: 10, background: 'var(--bg-glass-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <Bot size={13} color="#8b5cf6" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Intelligence IA</span>
              {scoreDirecteur !== null && <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor, background: scoreColor + '18', border: `1px solid ${scoreColor}30`, borderRadius: 20, padding: '2px 8px' }}>Score {scoreDirecteur}/100</span>}
              {alertesCritiques > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: '#ef444418', border: '1px solid #ef444430', borderRadius: 20, padding: '2px 8px' }}>{alertesCritiques} crit.</span>}
              {alertesAttention > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b30', borderRadius: 20, padding: '2px 8px' }}>{alertesAttention} att.</span>}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>→</span>
            </div>
          );
        })()}

        {/* MES CHANTIERS */}
        <div style={{ ...CARD, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Mes chantiers</div>
            <button onClick={() => naviguer('chantiers')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#2563eb', fontWeight: 600, fontFamily: 'inherit', padding: 0 }}>Voir tous →</button>
          </div>
          {actifs.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, textAlign: 'center', padding: '16px 0' }}>Aucun chantier actif</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...actifs].sort((a, b) => (prioriteMap.get(b.id) || { score: 0 }).score - (prioriteMap.get(a.id) || { score: 0 }).score).slice(0, 4).map(c => {
                  const priorite = prioriteMap.get(c.id) || { niveau: 'ok', score: 0 };
                  const montantCA = calculerCA(c, devis);
                  const couts = coutsMap.get(c.id) || {};
                  const joursTotal = c.nombreJours || 0;
                  const joursRealises = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
                  const avancementVal = joursTotal === 0 ? 0 : Math.min(Math.round((joursRealises / joursTotal) * 100), 100);
                  const mPct = couts.montantTotal > 0 && couts.totalCoutsReel > 0 && couts.margeReelPct !== null ? Math.round(couts.margeReelPct) : null;
                  const statBadge = joursRealises === 0 ? BADGE_STATUT_DASH.neutre : BADGE_STATUT_DASH[priorite.niveau];
                  const couleurBarre = !mPct ? '#CBD5E1' : mPct > 20 ? '#10B981' : mPct > 10 ? '#F59E0B' : '#EF4444';
                  return (
                    <div key={c.id} onClick={() => naviguer('chantiers', { chantierActif: c.id })}
                      style={{ display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 12, border: '1px solid var(--dash-border)', padding: '10px 12px', cursor: 'pointer', background: 'var(--ds-card-bg)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.nom || c.numero}</span>
                        <span style={{ background: statBadge.bg, color: statBadge.color, borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>{statBadge.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>CA</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{montantCA ? `CHF ${fmtN(montantCA)}` : '—'}</div>
                        </div>
                        {mPct !== null && (
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Marge</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: mPct >= 15 ? '#10b981' : mPct >= 0 ? '#f59e0b' : '#ef4444' }}>{mPct}%</div>
                          </div>
                        )}
                        {joursTotal > 0 && (
                          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Jours</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: joursRealises > joursTotal ? '#ef4444' : joursTotal - joursRealises <= 3 ? '#f59e0b' : 'var(--text-primary)' }}>{joursRealises}/{joursTotal}</div>
                          </div>
                        )}
                      </div>
                      <div style={{ height: 4, background: 'var(--dash-border)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${avancementVal}%`, background: couleurBarre, borderRadius: 2, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* 2x2 GRID : Trésorerie + Alertes + Avancement + Coûts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>

          {/* Trésorerie 30j */}
          <div style={{ ...CARD, cursor: 'pointer' }} onClick={() => naviguer('finances')}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Tréso. 30j</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: previsionTreso30j.interpretation?.couleur || '#3b82f6', letterSpacing: '-0.5px', marginBottom: 6, lineHeight: 1 }}>
              CHF {fmtN(previsionTreso30j.total)}
            </div>
            {previsionTreso30j.interpretation && (
              <div style={{ fontSize: 12, color: previsionTreso30j.interpretation.couleur, background: previsionTreso30j.interpretation.couleur + '15', border: `1px solid ${previsionTreso30j.interpretation.couleur}30`, borderRadius: 6, padding: '2px 6px', display: 'inline-block', marginBottom: 4 }}>
                {previsionTreso30j.interpretation.label.split('—')[0].trim()}
              </div>
            )}
            {kpi.cashEnAttente > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>CHF {fmtN(kpi.cashEnAttente)}</span> att.
              </div>
            )}
          </div>

          {/* Alertes IA */}
          <div style={{ ...CARD, cursor: 'pointer' }} onClick={() => naviguer('agents')}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Bot size={10} color="#8b5cf6" /> Alertes IA
            </div>
            {agentAlertes.length === 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <ShieldCheck size={18} strokeWidth={1.5} style={{ color: '#10b981' }} />
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#10b981' }}>Tout OK</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucune alerte</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 28, fontWeight: 900, color: agentAlertes.some(a => a.niveau === 'CRITIQUE') ? '#ef4444' : '#f59e0b', marginBottom: 4, lineHeight: 1 }}>{agentAlertes.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {agentAlertes.filter(a => a.niveau === 'CRITIQUE').length > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}>{agentAlertes.filter(a => a.niveau === 'CRITIQUE').length} crit. · </span>}
                  {agentAlertes.filter(a => a.niveau === 'ATTENTION').length > 0 && <span style={{ color: '#f59e0b' }}>{agentAlertes.filter(a => a.niveau === 'ATTENTION').length} att.</span>}
                </div>
              </>
            )}
          </div>

          {/* Avancement global */}
          <div style={{ ...CARD, cursor: 'pointer' }} onClick={() => naviguer('chantiers')}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Avancement</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#3b82f6', letterSpacing: '-1px', lineHeight: 1 }}>{Math.round(avancementMoyen)}%</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>moy.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { label: 'Rentables', count: kpiReel.nbRentables, dot: '#10b981' },
                { label: 'En retard', count: kpiReel.nbDepassement, dot: '#ef4444' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.dot, display: 'inline-block' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.label}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{l.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Répartition coûts */}
          <div style={{ ...CARD, cursor: 'pointer' }} onClick={() => naviguer('analyse')}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Coûts réels</div>
            {repartitionCouts.total > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>CHF {fmtN(Math.round(repartitionCouts.total))}</div>
                {repartitionCouts.segments.slice(0, 3).map(s => (
                  <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.couleur, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.name.split(' ')[0]}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 4 }}>Aucun coût saisi</div>
            )}
          </div>
        </div>

        {/* ALERTES SYSTEME */}
        {alertes.length > 0 && (
          <div style={{ ...CARD, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} strokeWidth={2} style={{ color: '#f59e0b' }} /> Alertes chantiers
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 20, padding: '2px 8px' }}>{alertes.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {alertes.slice(0, 4).map(a => (
                <div key={a.id} onClick={() => naviguer(a.page, a.ctx)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, background: a.critique ? 'rgba(239,68,68,0.06)' : 'var(--bg-glass-2)', border: `1px solid ${a.critique ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`, cursor: 'pointer' }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.critique ? '#ef4444' : '#f59e0b', marginTop: 4, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}>{a.message}</span>
                  <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* IA INSIGHTS BAR */}
        {!insightsFerme && previsionTreso30j.interpretation && (
          <div style={{ background: previsionTreso30j.interpretation.couleur + '10', border: `1px solid ${previsionTreso30j.interpretation.couleur}22`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={14} strokeWidth={2} style={{ color: previsionTreso30j.interpretation.couleur, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>IA Insights</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previsionTreso30j.interpretation.label}</div>
            </div>
            <button onClick={() => naviguer('finances')} style={{ background: previsionTreso30j.interpretation.couleur, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Voir</button>
            <button onClick={() => setInsightsFerme(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? 14 : 28, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            Bonjour,
            <img
              src={`${process.env.PUBLIC_URL}/logo-cyna-tech.png`}
              alt="CYNA Tech"
              className="logo-cyna-tech-inline"
              style={{ height: 20, width: 'auto', objectFit: 'contain', verticalAlign: 'middle' }}
            />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })} · {actifs.length} chantier{actifs.length !== 1 ? 's' : ''} actif{actifs.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── KPI CARDS ────────────────────────────────────────── */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'var(--g4)', gap: 16, marginBottom: 24 }}>
        {[
          { label: "CA actif", Icon: DollarSign, page: 'devis',
            valeur: `CHF ${fmtN(kpi.caEnCours)}`,
            sous: kpi.nbChantiersActifs > 0 ? `${kpi.nbChantiersActifs} chantier${kpi.nbChantiersActifs !== 1 ? 's' : ''} · En cours + Planifiés` : 'Aucun chantier en cours',
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
          <div key={label} onClick={() => naviguer(dest)} className="kpi-card"
            style={{ background: gradient, borderRadius: 16, padding: '22px 20px', minHeight: 130, cursor: 'pointer', boxShadow: `0 4px 20px ${glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', transition: 'transform 0.18s, box-shadow 0.18s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 10px 30px ${glow}, 0 2px 8px rgba(0,0,0,0.18)`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 4px 20px ${glow}, 0 1px 4px rgba(0,0,0,0.12)`; }}
          >
            <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
              <Icon size={18} strokeWidth={2} style={{ color: '#ffffff' }} />
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{label}</div>
            <div className="kpi-val" style={{ fontSize: 30, fontWeight: 900, color: '#ffffff', letterSpacing: '-1px', lineHeight: 1, marginBottom: 8 }}>{valeur}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: 500 }}>{sous}</span>
              {badge && <span style={{ background: 'rgba(239,68,68,0.85)', color: 'white', borderRadius: 20, padding: '1px 7px', fontSize: 12, fontWeight: 700 }}>{badge}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── BANDEAU INTELLIGENCE IA ──────────────────────────────── */}
      {(() => {
        const scoreDirecteur = agentState?.scoreGlobal ?? null;
        const alertesCritiques = agentAlertes.filter(a => a.niveau === 'CRITIQUE').length;
        const alertesAttention = agentAlertes.filter(a => a.niveau === 'ATTENTION').length;
        const derives = agentState?.agentData?.DerivePredictor?.resultats?.filter(r => r.statut !== 'vert') || [];
        if (scoreDirecteur === null && agentAlertes.length === 0) return null;
        const scoreColor = scoreDirecteur >= 70 ? '#10b981' : scoreDirecteur >= 40 ? '#f59e0b' : '#ef4444';
        return (
          <div onClick={() => naviguer('agents')} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 18px', marginBottom: 20, borderRadius: 12, background: 'var(--bg-glass-2)', border: '1px solid var(--border)', cursor: 'pointer', flexWrap: 'wrap', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#4F46E5'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <Bot size={15} color="#8b5cf6" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginRight: 4 }}>Intelligence IA</span>
            {scoreDirecteur !== null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: scoreColor + '18', border: `1px solid ${scoreColor}30`, borderRadius: 20, padding: '3px 10px' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor }}>Score {scoreDirecteur}/100</span>
              </span>
            )}
            {alertesCritiques > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ef444418', border: '1px solid #ef444430', borderRadius: 20, padding: '3px 10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#ef4444' }}><XCircle size={12} /> {alertesCritiques} critique{alertesCritiques > 1 ? 's' : ''}</span>
              </span>
            )}
            {alertesAttention > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f59e0b18', border: '1px solid #f59e0b30', borderRadius: 20, padding: '3px 10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#f59e0b' }}><AlertTriangle size={12} /> {alertesAttention} attention</span>
              </span>
            )}
            {derives.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#8b5cf618', border: '1px solid #8b5cf630', borderRadius: 20, padding: '3px 10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#8b5cf6' }}><TrendingUp size={12} /> {derives.length} chantier{derives.length > 1 ? 's' : ''} en dérive</span>
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Voir le Centre IA →</span>
          </div>
        );
      })()}

      {/* ── LIGNE 2 : CHANTIERS · FINANCIER · ALERTES ────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-dash)', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 10 : 20 }}>

        {/* ── COLONNE GAUCHE : Mes chantiers ── */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Mes chantiers</div>
            <button onClick={() => naviguer('chantiers')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#2563eb', fontWeight: 600, fontFamily: 'inherit', padding: 0 }}>Voir tous →</button>
          </div>
          {actifs.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, textAlign: 'center', padding: '24px 0' }}>Aucun chantier actif</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...actifs].sort((a, b) => (prioriteMap.get(b.id) || { score: 0 }).score - (prioriteMap.get(a.id) || { score: 0 }).score).slice(0, isMobile ? 2 : 3).map(c => {
                  const priorite = prioriteMap.get(c.id) || { niveau: 'ok', score: 0 };
                  const montantCA = calculerCA(c, devis);
                  const couts = coutsMap.get(c.id) || {};
                  const progress = Math.max(0, Math.min(100, Number(c.avancement ?? 0)));
                  const mPct = couts.montantTotal > 0 && couts.totalCoutsReel > 0 && couts.margeReelPct !== null ? Math.round(couts.margeReelPct) : null;
                  const joursTotal = c.nombreJours || 0;
                  // Jours réellement travaillés = dates distinctes dans le journal des heures
                  const joursRealises = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
                  const statBadge = joursRealises === 0
                    ? BADGE_STATUT_DASH.neutre
                    : BADGE_STATUT_DASH[priorite.niveau];
                  const joursRestants = joursTotal > 0 ? Math.max(0, joursTotal - joursRealises) : null;
                  const margeVal = parseFloat(couts?.margeReelPct) || 0;
                  const sansCouts = !couts?.margeReelPct;
                  const avancementVal = joursTotal === 0 ? 0 : Math.min(Math.round((joursRealises / joursTotal) * 100), 100);
                  const couleurBarre = joursRealises === 0 ? '#CBD5E1'
                    : sansCouts ? '#CBD5E1'
                    : margeVal > 20 ? '#10B981'
                    : margeVal > 10 ? '#F59E0B'
                    : '#EF4444';
                  const depasse = joursTotal > 0 && joursRealises > joursTotal;
                  const statutJours = depasse
                    ? { label: `+${joursRealises - joursTotal}j dépassement`, couleur: '#ef4444' }
                    : joursRestants === 0
                      ? { label: 'Terminé', couleur: '#10b981' }
                      : joursRestants !== null && joursRestants <= 3
                        ? { label: `${joursRestants}j restants`, couleur: '#f59e0b' }
                        : joursRestants !== null
                          ? { label: `${joursRestants}j restants`, couleur: 'var(--text-muted)' }
                          : { label: '—', couleur: 'var(--text-muted)' };
                  return (
                    <div key={c.id} onClick={() => naviguer('chantiers', { chantierActif: c.id })}
                      style={{ display: 'flex', alignItems: 'center', gap: 0, borderRadius: 14, border: '1px solid var(--dash-border)', cursor: 'pointer', background: 'var(--ds-card-bg)', overflow: 'hidden', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(59,130,246,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dash-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      {/* Contenu */}
                      <div className="dash-chantier-row" style={{ flex: 1, padding: '14px 16px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
                        {/* Nom + badge */}
                        <div style={{ flex: '0 1 180px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom || c.numero}</span>
                            <span style={{ background: statBadge.bg, color: statBadge.color, borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>{statBadge.label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>CA</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{montantCA ? `CHF ${fmtN(montantCA)}` : '—'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coût</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{couts.totalCoutsReel > 0 ? `CHF ${fmtN(Math.round(couts.totalCoutsReel))}` : '—'}</div>
                            </div>
                          </div>
                        </div>

                        {/* Séparateur */}
                        <div className="dash-sep" style={{ width: 1, alignSelf: 'stretch', background: 'var(--dash-border)', flexShrink: 0 }} />

                        {/* Marge */}
                        <div style={{ flex: '0 0 90px', textAlign: 'left' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Marge</div>
                          {mPct !== null && couts.margeReel !== undefined
                            ? <>
                                <div style={{ fontSize: 13, fontWeight: 800, color: mPct >= 15 ? '#10b981' : mPct >= 0 ? '#f59e0b' : '#ef4444' }}>CHF {fmtN(Math.round(couts.margeReel ?? 0))}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: mPct >= 15 ? '#10b981' : mPct >= 0 ? '#f59e0b' : '#ef4444' }}>{mPct}%</div>
                              </>
                            : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>
                          }
                        </div>

                        {/* Séparateur */}
                        <div className="dash-sep" style={{ width: 1, alignSelf: 'stretch', background: 'var(--dash-border)', flexShrink: 0 }} />

                        {/* Jours + barre */}
                        <div style={{ flex: '0 0 120px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                            {joursTotal > 0 ? `${joursRealises} / ${joursTotal} jours` : `${progress}%`}
                          </div>
                          <div style={{ height: 5, background: 'var(--dash-border)', borderRadius: 3, marginBottom: 5 }}>
                            <div style={{ height: '100%', width: `${avancementVal}%`, background: couleurBarre, borderRadius: 3, transition: 'width 0.3s ease' }} />
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: statutJours.couleur }}>{statutJours.label}</div>
                        </div>
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
            <ResponsiveContainer width="100%" height={isMobile ? 140 : 210}>
              <LineChart data={donneesMensuelles} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="semaine" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={{ background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }} formatter={(val, name) => [`CHF ${fmtN(val)}`, name]} />
                <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} name="Chiffre d'affaires" />
                <Line type="monotone" dataKey="Couts" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3, fill: '#94a3b8' }} strokeDasharray="5 3" name="Coûts estimés" />
                <Line type="monotone" dataKey="Encaissements" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} name="Encaissements" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: isMobile ? 140 : 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucune donnée disponible</div>
          )}
          <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
            {[['#3b82f6', "Chiffre d'affaires"], ['#94a3b8', 'Coûts estimés'], ['#10b981', 'Encaissements']].map(([col, lbl]) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span style={{ width: 20, height: 2.5, background: col, borderRadius: 2, display: 'inline-block' }} />{lbl}
              </div>
            ))}
          </div>
          {(() => {
            const { total, top3, interpretation, dateLimite, couverture } = previsionTreso30j; // alerteFaible unused
            const couleurTotal = interpretation?.couleur || '#3b82f6';
            return (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Prévision encaissements 30 j</span>
                  {interpretation && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: interpretation.couleur, background: interpretation.couleur + '15', border: `1px solid ${interpretation.couleur}30`, borderRadius: 20, padding: '2px 8px' }}>
                      {interpretation.label}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: couleurTotal, letterSpacing: '-0.5px', marginBottom: 4 }}>
                  CHF {fmtN(total)}
                </div>
                {dateLimite && couverture !== null && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                    Charges couvertes jusqu'au <strong style={{ color: 'var(--text-secondary)' }}>{dateLimite}</strong>
                  </div>
                )}
                {interpretation?.action && (
                  <div style={{ fontSize: 11, color: interpretation.couleur, background: interpretation.couleur + '10', border: `1px solid ${interpretation.couleur}25`, borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
                    {interpretation.action}
                  </div>
                )}
                {top3.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {top3.map(x => (
                      <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{x.nom}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', whiteSpace: 'nowrap' }}>CHF {fmtN(x.encaissementPrevu)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {top3.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>Aucun encaissement prévu — complétez les devis et l'avancement</div>
                )}
              </div>
            );
          })()}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--g3)', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 10 : 20 }}>

        {/* Répartition des coûts (donut) */}
        <div style={CARD}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>Répartition des coûts</div>
          {repartitionCouts.total > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PieChart width={isMobile ? 110 : 156} height={isMobile ? 110 : 156}>
                  <Pie data={repartitionCouts.segments} cx={isMobile ? 55 : 78} cy={isMobile ? 55 : 78} innerRadius={isMobile ? 32 : 48} outerRadius={isMobile ? 48 : 70} dataKey="value" paddingAngle={3}>
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
              <div style={{ position: 'relative', width: isMobile ? 100 : 140, height: isMobile ? 100 : 140, marginBottom: 12 }}>
                <svg width={isMobile ? 100 : 140} height={isMobile ? 100 : 140} viewBox="0 0 140 140">
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2, textTransform: 'uppercase' }}>moy.</div>
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
