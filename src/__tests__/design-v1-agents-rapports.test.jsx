/**
 * Design v1 — onglet Agents IA, LOT 2 : sous-onglet RAPPORTS (dé-violeté).
 * ⚠ ZÉRO logique métier touchée : résumé exécutif, score, briefing « lundi matin »
 *   (score de vigilance, KPIs/tendances, actions prioritaires, risques, anticipations),
 *   historique hebdomadaire. Diff = JSX + styles. Plus aucune couleur violette dans Agents.js.
 *
 * Preuve RTL RÉELLE (vrai composant Agents via renderWithApp) :
 *   1. Rapports : résumé exécutif (score + action prioritaire aux vraies valeurs) ;
 *   2. Briefing lundi matin : « Lancer l'analyse » → score de vigilance + action prioritaire ;
 *   3. Historique hebdo : carte « Semaine du… » aux vraies valeurs ;
 *   4. anti-violet : aucun hex/rgba violet dans le rendu du sous-onglet Rapports.
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

const VIOLETS = ['#8b5cf6', '#7c3aed', '#a855f7', '#6366f1', '#4f46e5',
  '#f3e8ff', '#ddd6fe', '139,92,246', '139, 92, 246'];

// Rapport IA en langage naturel — résumé exécutif.
const RAPPORT_NATUREL = {
  date: '10 août 2026',
  scoreEntreprise: 72,
  paras: ['Analyse un — activité soutenue.', 'Analyse deux — trésorerie saine.'],
  actionPrincipale: { icone: '⚡', action: 'Signer le devis Dupont', detail: 'CHF 80k en attente' },
};

// Briefing « lundi matin » retourné par simulerRapport().
const SIM = {
  scoreSemaine: 60, dateLundi: 'lundi 17 août', joursRestants: 3, nbRapportsHistoriques: 2,
  heuresSaisies: 120, projectionHeures: 160, tendanceHeures: 5, moyenneHeures: 150,
  caFacture: 45000, projectionCA: 60000, tendanceCA: -3, moyenneCA: 50000,
  nbActifs: 4, nbEnRetard: 1,
  actionsAvantLundi: [{ priorite: 'URGENT', icone: '🔴', action: 'Relancer le client Meyrin', detail: 'Facture > 30 jours' }],
  risques: [{ niveau: 'CRITIQUE', score: 82, chantier: 'Chantier Carouge', facteurs: ['marge faible', 'retard'] }],
  erreursAEviter: [{ message: 'Sous-estimation faux-plafond', conseil: 'Ajouter 10% de marge' }],
  anticipations: [{ icone: '📈', valeur: '+2 chantiers', label: 'Charge', detail: 'Semaine chargée', couleur: '#1E5FAF' }],
};

// Historique hebdomadaire RapportAuto.
const RAPPORTS = [{
  id: 'r1', semaine: 'Semaine du 4 août', nouveau: true, timestamp: 1723200000000,
  heuresSaisies: 120, caFacture: 45000, nbActifs: 3, nbEnRetard: 1, chantierRetard: ['Chantier Y'],
}];

const AGENTSTATE = {
  agentsActifs: {}, agentsStatuts: {}, agentsLogs: {},
  alertes: [], predictions: {}, patterns: {},
  rapports: RAPPORTS, memoire: {},
  agentData: { RapportNaturel: RAPPORT_NATUREL }, scoreGlobal: 72, priorites: [],
  marquerLu: vi.fn(), marquerTousLus: vi.fn(), forcerExecution: vi.fn(),
  simulerRapport: vi.fn(() => SIM),
};

function renderAgents() {
  return renderWithApp(<Agents {...AGENTSTATE} />, {});
}
const allerRapports = () => fireEvent.click(screen.getByRole('button', { name: /^Rapports$/ }));

describe('SOUS-ONGLET RAPPORTS — résumé exécutif (dé-violeté)', () => {
  it('affiche le résumé exécutif, le score et l\'action prioritaire aux vraies valeurs', () => {
    renderAgents();
    allerRapports();
    expect(screen.getByText('Résumé exécutif')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();               // scoreEntreprise
    expect(screen.getByText(/Action prioritaire recommandée/)).toBeInTheDocument();
    expect(screen.getByText(/Signer le devis Dupont/)).toBeInTheDocument();
  });
});

describe('SOUS-ONGLET RAPPORTS — briefing lundi matin', () => {
  it('« Lancer l\'analyse » affiche le score de vigilance et une action prioritaire', async () => {
    renderAgents();
    allerRapports();
    expect(screen.getByText(/Briefing intelligent — Lundi matin/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Lancer l'analyse/ }));
    // setTimeout 600 ms dans le composant → on attend le rendu du briefing.
    expect(await screen.findByText('Vigilance requise')).toBeInTheDocument();
    expect(screen.getByText('Relancer le client Meyrin')).toBeInTheDocument();
    expect(screen.getByText('Chantier Carouge')).toBeInTheDocument();
  });
});

describe('SOUS-ONGLET RAPPORTS — historique hebdomadaire', () => {
  it('affiche la carte « Semaine du… » aux vraies valeurs', () => {
    renderAgents();
    allerRapports();
    expect(screen.getByText('Semaine du 4 août')).toBeInTheDocument();
    expect(screen.getByText('Nouveau')).toBeInTheDocument();
    expect(screen.getAllByText('120h').length).toBeGreaterThanOrEqual(1);
  });
});

describe('SOUS-ONGLET RAPPORTS — aucune couleur violette', () => {
  it('le rendu (résumé + briefing + historique) ne contient aucun violet', async () => {
    const { container } = renderAgents();
    allerRapports();
    fireEvent.click(screen.getByRole('button', { name: /Lancer l'analyse/ }));
    await screen.findByText('Vigilance requise');            // fait rendre l'encart note-de-bas ex-rgba-violet
    const html = container.innerHTML.toLowerCase();
    VIOLETS.forEach(v => expect(html).not.toContain(v.toLowerCase()));
  });
});
