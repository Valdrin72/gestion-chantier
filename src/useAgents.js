/**
 * CYNA — useAgents hook v2
 * Orchestre les 20 agents, gère state + mémoire long-terme + timers.
 *
 * Mémoire : chaque agent peut accumuler des données entre les runs.
 * Stockage : localStorage "cyna_agents_state" (alertes, prédictions, statuts)
 *          + localStorage "cyna_agents_memoire" (apprentissage long-terme, jamais purgé)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { runAllAgents } from './AgentEngine';

const STORAGE_KEY   = 'cyna_agents_state';
const MEMOIRE_KEY   = 'cyna_agents_memoire';
const INTERVAL_MS   = 60 * 60 * 1000; // toutes les heures

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
};

function loadState() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
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
  const persisted = loadState();

  const [agentsActifs, setAgentsActifs] = useState(persisted?.agentsActifs || AGENTS_PAR_DEFAUT);
  const [alertes, setAlertes] = useState(persisted?.alertes || []);
  const [predictions, setPredictions] = useState(persisted?.predictions || {});
  const [patterns, setPatterns] = useState(persisted?.patterns || {});
  const [rapports, setRapports] = useState(persisted?.rapports || []);
  const [agentsStatuts, setAgentsStatuts] = useState(persisted?.agentsStatuts || {});
  const [agentsLogs, setAgentsLogs] = useState(persisted?.agentsLogs || {});
  const [agentData, setAgentData] = useState(persisted?.agentData || {});
  const [dernierRun, setDernierRun] = useState(persisted?.dernierRun || null);
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

      // Déduplique les alertes par type+entité
      setAlertes(prev => {
        const lues = prev.filter(a => a.lu);
        const cles = new Set(result.alertes.map(a => `${a.agent}_${a.type}_${a.chantier_id || a.devis_id || ''}`));
        const filtrees = lues.filter(a => !cles.has(`${a.agent}_${a.type}_${a.chantier_id || a.devis_id || ''}`));
        return [...result.alertes, ...filtrees].slice(0, 100);
      });

      setPredictions(result.predictions);
      setPatterns(result.patterns);
      setAgentsStatuts(result.statuts);
      setAgentData(result.agentData || {});
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

  // Exécution initiale + timer horaire
  const hasRunRef = useRef(false);
  useEffect(() => {
    if (!hasRunRef.current && chantiers?.length >= 0) {
      hasRunRef.current = true;
      setTimeout(() => executer(true), 1500);
    }
    const interval = setInterval(() => executer(false), INTERVAL_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistence de l'état courant
  useEffect(() => {
    saveState({ agentsActifs, alertes, predictions, patterns, rapports, agentsStatuts, agentsLogs, agentData, dernierRun });
  }, [agentsActifs, alertes, predictions, patterns, rapports, agentsStatuts, agentsLogs, agentData, dernierRun]);

  const marquerLu = useCallback((id) => setAlertes(prev => prev.map(a => a.id === id ? { ...a, lu: true } : a)), []);
  const marquerTousLus = useCallback(() => setAlertes(prev => prev.map(a => ({ ...a, lu: true }))), []);
  const toggleAgent = useCallback((name) => setAgentsActifs(prev => ({ ...prev, [name]: !prev[name] })), []);
  const forcerExecution = useCallback(() => executer(true), [executer]);

  const effacerMemoire = useCallback((agentName = null) => {
    if (agentName) {
      memoireRef.current = { ...memoireRef.current, [agentName]: {} };
    } else {
      memoireRef.current = {};
    }
    saveMemoire(memoireRef.current);
  }, []);

  const nbNonLues = alertes.filter(a => !a.lu).length;
  const hasNouveauRapport = rapports.some(r => r.nouveau);
  const scoreGlobal = agentData?.CoachDirecteur?.scoreGlobal ?? null;
  const priorites = agentData?.CoachDirecteur?.priorites || [];

  return {
    alertes, predictions, patterns, rapports,
    agentsActifs, agentsStatuts, agentsLogs, agentData,
    dernierRun, running, nbNonLues, hasNouveauRapport,
    scoreGlobal, priorites, memoire: memoireRef.current,
    marquerLu, marquerTousLus, toggleAgent, forcerExecution, effacerMemoire,
  };
}
