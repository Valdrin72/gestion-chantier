/**
 * Design v1 — page IA, LOT 1 : hero/onglets partagés + onglet AGENTS IA.
 * ⚠ Page = moteur IA (multi-agents, prédictions, audit). ZÉRO logique touchée :
 *   rhabillage pur (JSX + styles). Claude AI / Audit gardent leur rendu, accessibles
 *   via les nouveaux onglets du hero.
 *
 * Preuve RTL RÉELLE (vrai CentreIA rendu via renderWithApp, vrai composant Agents) :
 *   1. le hero affiche les 3 onglets (Agents IA / Claude AI / Audit) ; ☰ appelle ouvrirMenu ;
 *   2. bascule d'onglet : cliquer « Audit » puis « Claude AI » change le contenu ;
 *   3. onglet Agents : les 4 chiffres du hero affichent les VRAIES valeurs d'agentState ;
 *   4. onglet Agents : les 3 priorités et les indicateurs affichent les vraies valeurs ;
 *   5. « Forcer exécution » du hero déclenche agentState.forcerExecution (action inchangée).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import CentreIA from '../pages/CentreIA';
import { NB_AGENTS } from '../Agents';

// L'onglet Claude AI importe useClaudeAI → lib/supabase, qui exige des variables .env.
// On neutralise le client Supabase (rhabillage, aucun appel réseau testé ici).
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })), auth: { getSession: vi.fn() } },
}));

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

// agentState réaliste — mêmes formes que celles produites par useAgents.
function makeAgentState(over = {}) {
  return {
    scoreGlobal: 62,
    alertes: [
      { id: 'a1', lu: false }, { id: 'a2', lu: false }, { id: 'a3', lu: true },
    ],
    memoire: { AlerteChantier: {}, SuiviDevis: {} },
    running: false,
    priorites: [
      { categorie: 'Trésorerie', impact: 'CHF 12 000', action: 'Relancer Villa Dupont', detail: 'Facture 45 jours de retard' },
      { categorie: 'Marge',      impact: 'CHF 8 000',  action: 'Vérifier chantier Rénovation', detail: 'Marge tombée sous 15%' },
      { categorie: 'Facturation', impact: 'CHF 5 000', action: 'Facturer situation intermédiaire', detail: 'Avancement 60% non facturé' },
    ],
    agentData: {
      TresoreriePredictor: { solde30: 34500 },
      ProjectionAnnuelle: { caProjecte: 480000, txAtteinte: 92 },
      OptimisationFacturation: { totalFacturable: 27000, opportunites: [{}, {}] },
      DSOAnalyse: { dsoMoyen: 28 },
      AnomaliesDonnees: { score: 88, nbAnomalies: 1 },
      RadarPrecoce: { risques: [{ score: 72, nom: 'Villa Dupont' }] },
    },
    agentsActifs: {}, agentsStatuts: {}, agentsLogs: {}, predictions: {}, patterns: {}, rapports: [],
    dernierRun: null, nbNonLues: 2, hasNouveauRapport: false,
    forcerExecution: vi.fn(), marquerLu: vi.fn(), marquerTousLus: vi.fn(), simulerRapport: vi.fn(),
    ...over,
  };
}

function renderIA(over = {}) {
  const agentState = makeAgentState(over.agentState || {});
  return {
    agentState,
    ...renderWithApp(<CentreIA />, {
      chantiers: [], devis: [], factures: [], clients: [], parametres: { employes: [] },
      agentState, ouvrirMenu: over.ouvrirMenu || vi.fn(), ...over.ctx,
    }),
  };
}

describe('HERO partagé — 3 onglets + ☰', () => {
  it('affiche les 3 onglets Agents IA / Claude AI / Audit dans le hero', () => {
    renderIA();
    const hero = within(screen.getByTestId('hero-ia'));
    expect(hero.getByRole('button', { name: /Agents IA/i })).toBeInTheDocument();
    expect(hero.getByRole('button', { name: /Claude AI/i })).toBeInTheDocument();
    expect(hero.getByRole('button', { name: /^Audit$/i })).toBeInTheDocument();
    // Titre par défaut = Agents IA
    expect(hero.getByRole('heading', { name: /Agents IA/i })).toBeInTheDocument();
  });

  it('le bouton ☰ du hero appelle ouvrirMenu', () => {
    const ouvrirMenu = vi.fn();
    renderIA({ ouvrirMenu });
    fireEvent.click(within(screen.getByTestId('hero-ia')).getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });
});

describe('BASCULE d\'onglet — contenu change', () => {
  it('cliquer « Audit » puis « Claude AI » change le titre du hero', () => {
    renderIA();
    const hero = () => within(screen.getByTestId('hero-ia'));
    // → Audit
    fireEvent.click(hero().getByRole('button', { name: /^Audit$/i }));
    expect(hero().getByRole('heading', { name: /^Audit$/i })).toBeInTheDocument();
    // Les 4 chiffres du hero disparaissent hors onglet Agents
    expect(screen.queryByTestId('hero-chiffres')).toBeNull();
    // → Claude AI
    fireEvent.click(hero().getByRole('button', { name: /Claude AI/i }));
    expect(hero().getByRole('heading', { name: /Claude AI/i })).toBeInTheDocument();
    // → retour Agents IA
    fireEvent.click(hero().getByRole('button', { name: /Agents IA/i }));
    expect(screen.getByTestId('hero-chiffres')).toBeInTheDocument();
  });
});

describe('ONGLET AGENTS — 4 chiffres du hero (vraies valeurs)', () => {
  it('affiche score, agents, alertes et mémoire d\'agentState', () => {
    renderIA();
    const chiffres = within(screen.getByTestId('hero-chiffres'));
    expect(chiffres.getByText('62/100')).toBeInTheDocument();        // scoreGlobal
    expect(chiffres.getByText(`${NB_AGENTS}/${NB_AGENTS}`)).toBeInTheDocument(); // agents actifs
    expect(chiffres.getByText('2')).toBeInTheDocument();              // alertes non lues
    expect(chiffres.getByText('2 agents')).toBeInTheDocument();       // mémoire (2 clés)
  });
});

describe('ONGLET AGENTS — priorités + indicateurs (vraies valeurs)', () => {
  it('affiche les 3 priorités avec leur action et impact', () => {
    renderIA();
    expect(screen.getByText('Relancer Villa Dupont')).toBeInTheDocument();
    expect(screen.getByText('Vérifier chantier Rénovation')).toBeInTheDocument();
    expect(screen.getByText('Facturer situation intermédiaire')).toBeInTheDocument();
    expect(screen.getByText(/IMPACT : CHF 12 000/)).toBeInTheDocument();
  });

  it('affiche les indicateurs dérivés d\'agentData', () => {
    renderIA();
    expect(screen.getByText('CHF 34\'500')).toBeInTheDocument();   // Trésorerie J+30
    expect(screen.getByText('28 jours')).toBeInTheDocument();      // DSO moyen
    expect(screen.getByText('88/100')).toBeInTheDocument();        // Qualité données
    expect(screen.getByText('72/100')).toBeInTheDocument();        // Risque max
  });
});

describe('FORCER EXÉCUTION — action inchangée', () => {
  it('le bouton du hero déclenche agentState.forcerExecution', () => {
    const forcerExecution = vi.fn();
    renderIA({ agentState: { forcerExecution } });
    fireEvent.click(within(screen.getByTestId('hero-ia')).getByRole('button', { name: /Forcer exécution/i }));
    expect(forcerExecution).toHaveBeenCalledOnce();
  });
});
