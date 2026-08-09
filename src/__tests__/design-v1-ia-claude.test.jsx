/**
 * Design v1 — page IA, LOT 3 : onglet CLAUDE AI (contenu habillé v1).
 * ⚠ L'onglet déclenche de vrais traitements IA (analyses, prédictions, emails, comparaison,
 *   PDF) protégés par kill-switch + consentement + anonymisation. ZÉRO logique touchée :
 *   rhabillage pur. L'appel IA est mocké À LA FRONTIÈRE du hook useClaudeAI — tout le
 *   chemin réel (gardes, construction des données, handlers) est exercé.
 *
 * Preuve RTL RÉELLE (vrai CentreIA via renderWithApp, vrai composant ClaudeIAPanel) :
 *   1. l'onglet Claude AI affiche le menu des 9 actions + « N insights mémorisés » dans le hero ;
 *   2. sélectionner une action affiche son panneau (Analyser un chantier, Comparer devis) ;
 *   3. l'horizon de prévision se change (J+30 → J+60) ;
 *   4. le bouton d'action déclenche son traitement (appeler('anticiper', …) — inchangé) ;
 *   5. kill-switch : IA désactivée → écran « Assistant IA désactivé » (garde inchangée) ;
 *   6. consentement : sans confirmation → écran de consentement ; accepter → setParametres.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import CentreIA from '../pages/CentreIA';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })), auth: { getSession: vi.fn() } },
}));

// Mock à la frontière du hook — capture les appels IA sans toucher au réseau.
const { mockAppeler } = vi.hoisted(() => ({ mockAppeler: vi.fn().mockResolvedValue('') }));
vi.mock('../hooks/useClaudeAI', () => ({
  useClaudeAI: () => ({ appeler: mockAppeler, loading: false, error: null }),
}));

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

beforeEach(() => {
  mockAppeler.mockClear();
  localStorage.removeItem('cyna_ia_memoire');
  localStorage.removeItem('cyna_chat_history');
});

const PARAMS_CONSENTI = { parametres: { iaConsentement: true }, employes: [], localites: [], typesTravaux: [] };
const CHANTIER = { id: 1, nom: 'Villa Test', statut: 'En cours', avancement: 40 };

function renderClaude(over = {}) {
  const res = renderWithApp(<CentreIA />, {
    chantiers: over.chantiers || [CHANTIER], devis: [], factures: [], clients: [],
    parametres: over.parametres || PARAMS_CONSENTI,
    agentState: { alertes: [] }, ouvrirMenu: vi.fn(), pointages: [],
    setParametres: over.setParametres || vi.fn(), ...over.ctx,
  });
  fireEvent.click(within(screen.getByTestId('hero-ia')).getByRole('button', { name: /Claude AI/i }));
  return res;
}

const LABELS_ACTIONS = ['Anticiper', 'Analyser un chantier', 'Suggestion de devis',
  'Expliquer les alertes', 'Analyse globale', 'Chat libre', 'Générer email',
  'Comparer devis', 'Analyser PDF'];

describe('MENU des actions + insights dans le hero', () => {
  it('affiche les 9 actions du menu latéral et le titre hero « Claude AI »', () => {
    renderClaude();
    const menu = within(screen.getByTestId('ia-menu'));
    LABELS_ACTIONS.forEach(label => {
      expect(menu.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    });
    expect(within(screen.getByTestId('hero-ia')).getByRole('heading', { name: /Claude AI/i })).toBeInTheDocument();
    // Pas de rangée de chiffres pour cet onglet (contrairement à Agents/Audit) — voulu
    expect(screen.queryByTestId('hero-chiffres')).toBeNull();
  });

  it('« N insights mémorisés » remonte en info discrète dans le hero (vraie mémoire)', () => {
    localStorage.setItem('cyna_ia_memoire', '[01.08.2026] Marge cible 22%\n[02.08.2026] DSO à surveiller');
    renderClaude();
    expect(screen.getByTestId('hero-ia').textContent).toMatch(/2 INSIGHTS MÉMORISÉS/);
    // Le menu latéral affiche le même compteur (source unique compteurInsights)
    expect(within(screen.getByTestId('ia-menu')).getByText(/2 insights mémorisés/i)).toBeInTheDocument();
  });
});

describe('SÉLECTION d\'une action — le panneau change', () => {
  it('cliquer « Analyser un chantier » puis « Comparer devis » affiche leurs panneaux', () => {
    renderClaude();
    const menu = within(screen.getByTestId('ia-menu'));
    // → Analyser un chantier
    fireEvent.click(menu.getByRole('button', { name: /Analyser un chantier/ }));
    const panneau = () => within(screen.getByTestId('ia-panneau'));
    expect(panneau().getByRole('heading', { name: 'Analyser un chantier' })).toBeInTheDocument();
    expect(panneau().getByText('— Choisir un chantier —')).toBeInTheDocument();
    // → Comparer devis
    fireEvent.click(menu.getByRole('button', { name: /Comparer devis/ }));
    expect(panneau().getByText('Devis 1')).toBeInTheDocument();
    expect(panneau().getByText('Devis 2')).toBeInTheDocument();
  });
});

describe('HORIZON de prévision — pastilles J+30/60/90', () => {
  it('changer l\'horizon met à jour le bouton d\'action (J+30 → J+60)', () => {
    renderClaude();
    const panneau = within(screen.getByTestId('ia-panneau'));
    expect(panneau.getByRole('button', { name: /Anticiper à J\+30/ })).toBeInTheDocument();
    fireEvent.click(panneau.getByRole('button', { name: /^J\+60$/ }));
    expect(panneau.getByRole('button', { name: /Anticiper à J\+60/ })).toBeInTheDocument();
  });
});

describe('BOUTON d\'action — déclenche le traitement IA (inchangé)', () => {
  it('« Anticiper à J+30 » appelle appeler(\'anticiper\', {horizon: 30, …})', () => {
    renderClaude();
    fireEvent.click(within(screen.getByTestId('ia-panneau')).getByRole('button', { name: /Anticiper à J\+30/ }));
    expect(mockAppeler).toHaveBeenCalledTimes(1);
    const [action, payload] = mockAppeler.mock.calls[0];
    expect(action).toBe('anticiper');
    expect(payload.horizon).toBe(30);
    expect(payload.chantiers).toHaveLength(1); // le vrai chantier du contexte
  });
});

describe('KILL-SWITCH + CONSENTEMENT — gardes inchangées', () => {
  it('IA désactivée → écran « Assistant IA désactivé », aucun menu', () => {
    renderClaude({ parametres: { parametres: { iaActivee: false }, employes: [] } });
    expect(screen.getByText('Assistant IA désactivé')).toBeInTheDocument();
    expect(screen.queryByTestId('ia-menu')).toBeNull();
  });

  it('sans consentement → écran de consentement ; accepter appelle setParametres', () => {
    const setParametres = vi.fn();
    renderClaude({ parametres: { parametres: {}, employes: [] }, setParametres });
    expect(screen.getByText('Avant d\'utiliser l\'Assistant IA')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /J'ai compris — activer les analyses/ }));
    expect(setParametres).toHaveBeenCalledOnce();
    expect(setParametres.mock.calls[0][0].parametres.iaConsentement).toBe(true);
  });
});
