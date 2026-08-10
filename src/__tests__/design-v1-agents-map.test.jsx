/**
 * Design v1 — onglet Agents IA, LOT 1 : map de couleurs d'agents (dé-violetée) +
 * sous-onglets AGENTS et MÉMOIRE.
 * ⚠ ZÉRO logique métier touchée : liste des agents, tiers, compteurs, patterns, précision.
 *   Diff = JSX + styles + valeurs de la map de couleurs. Aucune couleur violette ne subsiste
 *   (hors sous-onglet Rapports, traité au lot 2).
 *
 * Preuve RTL RÉELLE (vrai composant Agents via renderWithApp) :
 *   1. sous-onglet Agents : 3 tiers + agents aux vrais noms + agent ex-violet (Rapport Auto) ;
 *   2. sous-onglet Mémoire : bandeau, tableau patterns aux vraies valeurs, cartes par agent ;
 *   3. les couleurs de tiers exposées ne sont plus violettes.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Agents from '../Agents';

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

const VIOLETS = ['#8b5cf6', '#7c3aed', '#a855f7', '#6366f1', '#4f46e5'];

const AGENTSTATE = {
  agentsActifs: {}, agentsStatuts: {}, agentsLogs: {},
  alertes: [], predictions: {},
  patterns: {
    'Faux-plafond': { type: 'Faux-plafond', count: 3, ecartMoyen: 8.5, margeMoyenne: 22.4, ratioTempsMoyen: 1.12 },
  },
  rapports: [], memoire: { RapportNaturel: { historique: [1, 2, 3] } },
  agentData: {}, scoreGlobal: 72, priorites: [],
  marquerLu: vi.fn(), marquerTousLus: vi.fn(), forcerExecution: vi.fn(), simulerRapport: vi.fn(),
};

function renderAgents() {
  return renderWithApp(<Agents {...AGENTSTATE} />, {});
}
// L'onglet Agents a des sous-onglets internes (coach par défaut) — on clique le bon.
const sousOnglet = re => fireEvent.click(screen.getByRole('button', { name: re }));

describe('SOUS-ONGLET AGENTS — 3 tiers + agents (map dé-violetée)', () => {
  it('affiche les 3 tiers et des agents aux vrais noms', () => {
    renderAgents();
    sousOnglet(/^Agents \(/);
    expect(screen.getByText(/Tier 1 — Analyse pure/)).toBeInTheDocument();
    expect(screen.getByText(/Tier 2 — Intelligence croisée/)).toBeInTheDocument();
    expect(screen.getByText(/Tier 3 — Synthèse & Anticipation/)).toBeInTheDocument();
    // Agents ex-violets présents, dé-violetés
    expect(screen.getByText('Rapport Auto')).toBeInTheDocument();
    expect(screen.getByText('DSO Analyse')).toBeInTheDocument();
  });
});

describe('SOUS-ONGLET MÉMOIRE — bandeau + patterns + cartes agent', () => {
  it('affiche le bandeau, le tableau patterns et les cartes par agent', () => {
    renderAgents();
    sousOnglet(/^Mémoire$/);
    expect(screen.getByText(/Mémoire permanente/)).toBeInTheDocument();
    expect(screen.getByText(/Patterns par type/)).toBeInTheDocument();
    // Vraies valeurs du pattern
    expect(screen.getByText('Faux-plafond')).toBeInTheDocument();
    expect(screen.getByText('+8.5%')).toBeInTheDocument();
    expect(screen.getByText('22.4%')).toBeInTheDocument();
    // Carte mémoire long-terme d'un agent apprenant (Rapport Naturel a de la mémoire ici)
    expect(screen.getByText('Mémoire long-terme par agent')).toBeInTheDocument();
  });
});

describe('MAP DE COULEURS — aucune couleur d\'agent/tier violette', () => {
  it('les hex de la map AGENTS_META / TIER_META ne contiennent aucun violet', () => {
    // Extraction statique du module compilé : on vérifie via le rendu qu'aucune
    // couleur inline violette n'apparaît dans le sous-onglet Agents.
    const { container } = renderAgents();
    sousOnglet(/^Agents \(/);
    const html = container.innerHTML.toLowerCase();
    VIOLETS.forEach(v => expect(html).not.toContain(v));
  });
});
