/**
 * CYNA — useAgents hook
 * Orchestre les 5 agents, gère le state et les timers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { runAllAgents } from './AgentEngine';

const STORAGE_KEY = 'cyna_agents_state';
const INTERVAL_MS = 60 * 60 * 1000; // 1 heure

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      agentsActifs: state.agentsActifs,
      alertes: state.alertes.slice(0, 50),
      predictions: state.predictions,
      patterns: state.patterns,
      rapports: state.rapports.slice(0, 10),
      agentsStatuts: state.agentsStatuts,
      agentsLogs: state.agentsLogs,
      dernierRun: state.dernierRun,
    }));
  } catch { /* quota exceeded — silencieux */ }
}

export default function useAgents({ chantiers, devis, factures, clients, parametres }) {
  const persisted = loadPersistedState();

  const [agentsActifs, setAgentsActifs] = useState(persisted?.agentsActifs || {
    AlerteChantier: true,
    SuiviDevis: true,
    TresoreriePredictor: true,
    RapportAuto: true,
    MemoireChantier: true,
  });

  const [alertes, setAlertes] = useState(persisted?.alertes || []);
  const [predictions, setPredictions] = useState(persisted?.predictions || {});
  const [patterns, setPatterns] = useState(persisted?.patterns || {});
  const [rapports, setRapports] = useState(persisted?.rapports || []);
  const [agentsStatuts, setAgentsStatuts] = useState(persisted?.agentsStatuts || {});
  const [agentsLogs, setAgentsLogs] = useState(persisted?.agentsLogs || {});
  const [dernierRun, setDernierRun] = useState(persisted?.dernierRun || null);
  const [running, setRunning] = useState(false);

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
        parametres: parametres || { employes: [], localites: [], parametres: {} },
        dernierRapport,
        agentsActifs,
      });

      const now = Date.now();

      // Déduplique les alertes (garde uniquement les nouvelles par type+chantier)
      setAlertes(prev => {
        const anciennesLues = prev.filter(a => a.lu);
        const cles = new Set(result.alertes.map(a => `${a.type}_${a.chantier_id || a.devis_id || ''}`));
        const filtrees = anciennesLues.filter(a => !cles.has(`${a.type}_${a.chantier_id || a.devis_id || ''}`));
        return [...result.alertes, ...filtrees].slice(0, 50);
      });

      setPredictions(result.predictions);
      setPatterns(result.patterns);
      setAgentsStatuts(result.statuts);
      setDernierRun(now);

      // Logs par agent
      setAgentsLogs(prev => {
        const next = { ...prev };
        Object.entries(result.statuts).forEach(([name, st]) => {
          if (!st.lastRun) return;
          const entry = {
            timestamp: now,
            dureeMs: st.dureeMs || 0,
            erreur: st.erreur || null,
            nbResultats: name === 'AlerteChantier' ? result.alertes.filter(a => a.agent === 'AlerteChantier').length
              : name === 'SuiviDevis' ? result.alertes.filter(a => a.agent === 'SuiviDevis').length
              : name === 'TresoreriePredictor' ? result.alertes.filter(a => a.agent === 'TresoreriePredictor').length
              : name === 'MemoireChantier' ? Object.keys(result.patterns).length
              : result.rapport ? 1 : 0,
          };
          next[name] = [entry, ...(prev[name] || [])].slice(0, 10);
        });
        return next;
      });

      // Nouveau rapport hebdomadaire
      if (result.rapport) {
        setRapports(prev => [result.rapport, ...prev].slice(0, 10));
      }

    } catch (e) {
      console.error('[useAgents] Erreur orchestrateur', e);
    } finally {
      setRunning(false);
    }
  }, [chantiers, devis, factures, clients, parametres, agentsActifs, dernierRapport, running]);

  // Exécution initiale au mount + toutes les heures
  const hasRunRef = useRef(false);
  useEffect(() => {
    if (!hasRunRef.current && chantiers?.length >= 0) {
      hasRunRef.current = true;
      setTimeout(() => executer(true), 1500); // légère pause pour laisser l'app monter
    }
    const interval = setInterval(() => executer(false), INTERVAL_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistence à chaque changement d'état significatif
  const stateRef = useRef({});
  useEffect(() => {
    const state = { agentsActifs, alertes, predictions, patterns, rapports, agentsStatuts, agentsLogs, dernierRun };
    stateRef.current = state;
    saveState(state);
  }, [agentsActifs, alertes, predictions, patterns, rapports, agentsStatuts, agentsLogs, dernierRun]);

  const marquerLu = useCallback((id) => {
    setAlertes(prev => prev.map(a => a.id === id ? { ...a, lu: true } : a));
  }, []);

  const marquerTousLus = useCallback(() => {
    setAlertes(prev => prev.map(a => ({ ...a, lu: true })));
  }, []);

  const toggleAgent = useCallback((name) => {
    setAgentsActifs(prev => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const forcerExecution = useCallback((agentName = null) => {
    executer(true);
  }, [executer]);

  const nbNonLues = alertes.filter(a => !a.lu).length;
  const hasNouveauRapport = rapports.some(r => r.nouveau);

  return {
    alertes,
    predictions,
    patterns,
    rapports,
    agentsActifs,
    agentsStatuts,
    agentsLogs,
    dernierRun,
    running,
    nbNonLues,
    hasNouveauRapport,
    marquerLu,
    marquerTousLus,
    toggleAgent,
    forcerExecution,
  };
}
