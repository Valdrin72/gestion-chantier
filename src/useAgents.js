/**
 * CYNA — useAgents hook v2
 * Orchestre les agents IA, gère state + mémoire long-terme + timers.
 *
 * Mémoire : chaque agent peut accumuler des données entre les runs.
 * Stockage : localStorage "cyna_agents_state" (alertes, prédictions, statuts)
 *          + localStorage "cyna_agents_memoire" (apprentissage long-terme, jamais purgé)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { runAllAgents, simulerRapportLundi } from './AgentEngine';

const STORAGE_KEY   = 'cyna_agents_state';
const MEMOIRE_KEY   = 'cyna_agents_memoire';
const INTERVAL_MS   = 60 * 60 * 1000; // toutes les heures
// Incrémenter pour forcer un reset du cache localStorage si le schéma change
const SCHEMA_VERSION = 4;

// Tous les agents actifs par défaut
const AGENTS_PAR_DEFAUT = {
  // Tier 1
  AlerteChantier: true, SuiviDevis: true, TresoreriePredictor: true,
  RapportAuto: true, MemoireChantier: true, ProductiviteEquipe: true,
  RelancePaiements: true, AnomaliesDonnees: true, OptimisationFacturation: true,
  // Tier 2
  ConflitsPlanning: true, PlanningCoherence: true, ApprentissageMarge: true, SanteClient: true,
  ProjectionAnnuelle: true, BenchmarkTypeTravaux: true, ConformiteBTP: true, DerivePredictor: true,
  // Tier 3
  RadarPrecoce: true, DSOAnalyse: true, Saisonnierte: true,
  CoutMOAnalyse: true, RapportNaturel: true, CoachDirecteur: true,
  AnalyseCycles: true,
  // Nouveaux agents
  PipelineCommercial: true, AlerteRisqueClient: true,
  OptimisationEquipe: true, ScoreOffre: true,
  // Surveillance système
  SentinelAgent: true,
};


function sanitiserAlertes(alertes) {
  if (!Array.isArray(alertes)) return [];
  return alertes
    .filter(a => a && typeof a.message === 'string')
    .map(a => ({
      ...a,
      message: typeof a.message === 'string' ? a.message : '—',
      detail:  typeof a.detail  === 'string' ? a.detail  : undefined,
      // action peut être {page,ctx} (nav) ou string — on normalise : si c'est un objet avec page on garde, sinon string ou supprimé
      action: typeof a.action === 'string' ? a.action
            : (a.action && typeof a.action === 'object' && typeof a.action.page === 'string') ? a.action
            : undefined,
    }));
}

function sanitiserPriorites(priorites) {
  if (!Array.isArray(priorites)) return [];
  return priorites.map(p => ({
    ...p,
    action:   typeof p.action   === 'string' ? p.action   : '',
    detail:   typeof p.detail   === 'string' ? p.detail   : '',
    impact:   typeof p.impact   === 'string' ? p.impact   : '',
    categorie:typeof p.categorie=== 'string' ? p.categorie: '',
  }));
}

function sanitiserAgentData(agentData) {
  if (!agentData || typeof agentData !== 'object') return {};
  const out = { ...agentData };
  // RapportNaturel : paras et actionPrincipale
  if (out.RapportNaturel) {
    const rn = { ...out.RapportNaturel };
    if (Array.isArray(rn.paras)) rn.paras = rn.paras.map(p => typeof p === 'string' ? p : '');
    if (rn.actionPrincipale) {
      rn.actionPrincipale = {
        ...rn.actionPrincipale,
        action: typeof rn.actionPrincipale.action === 'string' ? rn.actionPrincipale.action : '',
        detail: typeof rn.actionPrincipale.detail === 'string' ? rn.actionPrincipale.detail : '',
      };
    }
    out.RapportNaturel = rn;
  }
  // CoachDirecteur : priorités
  if (out.CoachDirecteur?.priorites) {
    out.CoachDirecteur = {
      ...out.CoachDirecteur,
      priorites: sanitiserPriorites(out.CoachDirecteur.priorites),
    };
  }
  return out;
}

function sanitiserRapports(rapports) {
  if (!Array.isArray(rapports)) return [];
  return rapports.map(r => {
    if (!r) return r;
    const out = { ...r };
    if (Array.isArray(out.paras)) out.paras = out.paras.map(p => typeof p === 'string' ? p : '');
    if (out.actionPrincipale) {
      out.actionPrincipale = {
        ...out.actionPrincipale,
        action: typeof out.actionPrincipale.action === 'string' ? out.actionPrincipale.action : '',
        detail: typeof out.actionPrincipale.detail === 'string' ? out.actionPrincipale.detail : '',
      };
    }
    return out;
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Purge automatique si version de schéma obsolète
    if ((parsed?.schemaVersion ?? 0) < SCHEMA_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (parsed?.alertes)   parsed.alertes   = sanitiserAlertes(parsed.alertes);
    if (parsed?.rapports)  parsed.rapports  = sanitiserRapports(parsed.rapports);
    if (parsed?.agentData) parsed.agentData = sanitiserAgentData(parsed.agentData);
    return parsed;
  } catch { return null; }
}
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      agentsActifs: state.agentsActifs,
      alertes: state.alertes.slice(0, 100),
      predictions: state.predictions,
      patterns: state.patterns,
      rapports: state.rapports.slice(0, 10),
      agentsStatuts: state.agentsStatuts,
      agentsLogs: state.agentsLogs,
      agentData: state.agentData,
      dernierRun: state.dernierRun,
    }));
  } catch {}
}
function loadMemoire() {
  try { const raw = localStorage.getItem(MEMOIRE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveMemoire(memoire) {
  try { localStorage.setItem(MEMOIRE_KEY, JSON.stringify(memoire)); } catch {}
}

export default function useAgents({ chantiers, devis, factures, clients, parametres }) {
  // Lecture localStorage unique au mount — partagée entre tous les useState initialiseurs
  const _initStateRef = useRef(undefined);
  const _getInitState = () => {
    if (_initStateRef.current === undefined) _initStateRef.current = loadState();
    return _initStateRef.current;
  };

  // Agents toujours actifs — pas de désactivation possible
  const agentsActifs = AGENTS_PAR_DEFAUT;
  const [alertes, setAlertes] = useState(() => _getInitState()?.alertes || []);
  const [predictions, setPredictions] = useState(() => _getInitState()?.predictions || {});
  const [patterns, setPatterns] = useState(() => _getInitState()?.patterns || {});
  const [rapports, setRapports] = useState(() => _getInitState()?.rapports || []);
  const [agentsStatuts, setAgentsStatuts] = useState(() => _getInitState()?.agentsStatuts || {});
  const [agentsLogs, setAgentsLogs] = useState(() => _getInitState()?.agentsLogs || {});
  const [agentData, setAgentData] = useState(() => _getInitState()?.agentData || {});
  const [dernierRun, setDernierRun] = useState(() => _getInitState()?.dernierRun || null);
  const [running, setRunning] = useState(false);
  const memoireRef = useRef(loadMemoire());

  const dernierRapport = rapports[0] || null;

  const executer = useCallback((force = false) => {
    if (running && !force) return;
    setRunning(true);

    try {
      const result = runAllAgents({
        chantiers: chantiers || [],
        devis: devis || [],
        factures: factures || [],
        clients: clients || [],
        parametres: parametres || { employes: [], localites: [], typesTravaux: [], parametres: {} },
        dernierRapport,
        agentsActifs,
        memoire: memoireRef.current,
      });

      const now = Date.now();

      // Déduplique les alertes par type+entité — sanitise avant d'entrer dans le state
      setAlertes(prev => {
        const lues = prev.filter(a => a.lu);
        const cles = new Set(result.alertes.map(a => `${a.agent}_${a.type}_${a.chantier_id || a.devis_id || ''}`));
        const filtrees = lues.filter(a => !cles.has(`${a.agent}_${a.type}_${a.chantier_id || a.devis_id || ''}`));
        return sanitiserAlertes([...result.alertes, ...filtrees].slice(0, 100));
      });

      setPredictions(result.predictions);
      setPatterns(result.patterns);
      setAgentsStatuts(result.statuts);
      setAgentData(sanitiserAgentData(result.agentData || {}));
      setDernierRun(now);

      // Logs par agent (10 dernières exécutions)
      setAgentsLogs(prev => {
        const next = { ...prev };
        Object.entries(result.statuts).forEach(([name, st]) => {
          if (!st.lastRun) return;
          const entry = {
            timestamp: now, dureeMs: st.dureeMs || 0, erreur: st.erreur || null,
            nbResultats: (result.alertes || []).filter(a => a.agent === name).length,
          };
          next[name] = [entry, ...(prev[name] || [])].slice(0, 10);
        });
        return next;
      });

      if (result.rapport) setRapports(prev => [result.rapport, ...prev].slice(0, 10));

      // Sauvegarde la mémoire long-terme
      if (result.memoire && Object.keys(result.memoire).length > 0) {
        memoireRef.current = { ...memoireRef.current, ...result.memoire };
        saveMemoire(memoireRef.current);
      }

    } catch (e) {
      console.error('[useAgents]', e);
    } finally {
      setRunning(false);
    }
  }, [chantiers, devis, factures, clients, parametres, agentsActifs, dernierRapport, running]);

  // Référence à executer toujours à jour (évite le stale-closure dans setInterval)
  const executerRef = useRef(executer);
  useEffect(() => { executerRef.current = executer; }, [executer]);

  // Exécution initiale (dès que des données arrivent) + timer horaire
  const hasRunRef = useRef(false);
  useEffect(() => {
    const interval = setInterval(() => executerRef.current(false), INTERVAL_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run immédiat :
  //  - quand des entités sont supprimées (purge alertes orphelines)
  //  - quand les données arrivent pour la première fois depuis Supabase (0 → n)
  const prevChantiersLenRef = useRef(chantiers?.length ?? 0);
  const prevDevisLenRef     = useRef(devis?.length ?? 0);
  const prevFacturesLenRef  = useRef(factures?.length ?? 0);
  const rerunTimerRef       = useRef(null);

  useEffect(() => {
    const currC = chantiers?.length ?? 0;
    const currD = devis?.length ?? 0;
    const currF = factures?.length ?? 0;
    const deleted =
      currC < prevChantiersLenRef.current ||
      currD < prevDevisLenRef.current ||
      currF < prevFacturesLenRef.current;
    // Premier chargement depuis Supabase (données vides → données disponibles)
    const justLoaded =
      !hasRunRef.current && (currC > 0 || currD > 0 || currF > 0);

    prevChantiersLenRef.current = currC;
    prevDevisLenRef.current     = currD;
    prevFacturesLenRef.current  = currF;

    if (!deleted && !justLoaded) return;

    if (deleted) {
      // Purge immédiate des alertes qui référencent des IDs supprimés
      const validCIds = new Set((chantiers || []).map(c => String(c.id)));
      const validDIds = new Set((devis || []).map(d => String(d.id)));
      setAlertes(prev => prev.filter(a =>
        (!a.chantier_id || validCIds.has(String(a.chantier_id))) &&
        (!a.devis_id    || validDIds.has(String(a.devis_id)))
      ));
    }

    if (justLoaded) hasRunRef.current = true;

    // Re-run des agents (avec debounce de 600 ms si plusieurs suppressions en rafale)
    if (rerunTimerRef.current) clearTimeout(rerunTimerRef.current);
    rerunTimerRef.current = setTimeout(() => executerRef.current(true), 600);
    return () => { if (rerunTimerRef.current) clearTimeout(rerunTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantiers, devis, factures]);

  // Persistence de l'état courant (debounced 800ms) — agentsActifs non persisté (toujours actifs)
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState({ agentsActifs: AGENTS_PAR_DEFAUT, alertes, predictions, patterns, rapports, agentsStatuts, agentsLogs, agentData, dernierRun });
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [alertes, predictions, patterns, rapports, agentsStatuts, agentsLogs, agentData, dernierRun]);

  const marquerLu = useCallback((id) => setAlertes(prev => prev.map(a => a.id === id ? { ...a, lu: true } : a)), []);
  const marquerTousLus = useCallback(() => setAlertes(prev => prev.map(a => ({ ...a, lu: true }))), []);
  const forcerExecution = useCallback(() => executer(true), [executer]);
  const simulerRapport = useCallback(() =>
    simulerRapportLundi({
      chantiers: chantiers || [],
      factures: factures || [],
      devis: devis || [],
      clients: clients || [],
      parametres: parametres || {},
      rapports,
      agentData,
      alertes,
    }),
  [chantiers, factures, devis, clients, parametres, rapports, agentData, alertes]);

  const nbNonLues = alertes.filter(a => !a.lu).length;
  const hasNouveauRapport = rapports.some(r => r.nouveau);
  const scoreGlobal = agentData?.CoachDirecteur?.scoreGlobal ?? null;
  const priorites = agentData?.CoachDirecteur?.priorites || [];

  return {
    alertes, predictions, patterns, rapports,
    agentsActifs, agentsStatuts, agentsLogs, agentData,
    dernierRun, running, nbNonLues, hasNouveauRapport,
    scoreGlobal, priorites, memoire: memoireRef.current,
    marquerLu, marquerTousLus, forcerExecution, simulerRapport,
  };
}
