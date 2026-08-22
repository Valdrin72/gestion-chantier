/**
 * Aide au devis — LOT C+D. Réorganisation de la page Devis (4 demandes patron).
 *
 * Preuve RTL RÉELLE (vrai DevisPage rendu via renderWithApp, useClaudeAI mocké — zéro réseau) :
 *   1. L'ancien « Assistant Devis IA » n'est PLUS rendu (plus de bouton « Appliquer » qui remplit le prix).
 *   2. Le panneau AideDevisPanel est rendu avec son nouveau design (en-tête + toggle Réduire).
 *   3. Ordre DOM : les blocs AVENANTS et HEURES EN RÉGIE sont AVANT le panneau d'aide (estimation).
 *   4. Le panneau ne modifie JAMAIS le montant HT : interagir avec lui laisse le prix tapé inchangé.
 *   5. Avenants + Heures en régie fonctionnent toujours (le CA total du tableau reste correct).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import DevisPage from '../pages/DevisPage';

const mockAppeler = vi.fn();
vi.mock('../hooks/useClaudeAI', () => ({ useClaudeAI: () => ({ appeler: mockAppeler, loading: false, error: null }) }));
vi.mock('../ExportPDF', () => ({ exportDevis: vi.fn() }));
vi.mock('../utils/exportCSV', () => ({ exportCSV: vi.fn() }));
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

// 5 « Faux-plafonds » facturés (surface 100) → la source A du panneau s'affiche.
const CH = (id) => ({ id, nom: `CH${id}`, statut: 'terminé', typesTravaux: ['Faux-plafonds'], surface: 100, materielReel: 6000, canton: 'GE', journal: [], equipe: [] });
const F  = (id, chantierId, montantHT) => ({ id, chantierId, statut: 'payee', montantHT, montantTTC: Math.round(montantHT * 1.081) });
const CHANTIERS = [CH('c1'), CH('c2'), CH('c3'), CH('c4'), CH('c5')];
const FACTURES = [F('f1', 'c1', 6500), F('f2', 'c2', 7800), F('f3', 'c3', 9200), F('f4', 'c4', 10800), F('f5', 'c5', 13000)];
const PARAMS = { employes: [], localites: [], parametres: { coefficientMainOeuvre: 1, iaActivee: true }, typesTravaux: [{ id: 1, nom: 'Faux-plafonds' }] };
const CLIENT = { id: 1, prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA' };

function renderDevis(over = {}) {
  return renderWithApp(<DevisPage />, {
    clients: [CLIENT], devis: [], chantiers: CHANTIERS, factures: FACTURES,
    parametres: PARAMS, periodeGlobale: 'annee',
    setDevis: vi.fn(), setChantiers: vi.fn(), setFactures: vi.fn(),
    confirmer: vi.fn().mockResolvedValue(true), afficherNotif: vi.fn(),
    naviguer: vi.fn(), ouvrirMenu: vi.fn(), setPeriodeGlobale: vi.fn(), ...over,
  });
}

function ouvrirFormulaire() {
  fireEvent.click(within(screen.getByTestId('hero-devis')).getByRole('button', { name: /Nouveau devis/i }));
}

describe('LOT C+D — l\'ancien Assistant Devis IA est supprimé', () => {
  it('aucun « Assistant Devis IA » ni bouton « Appliquer » (qui remplissait le prix) dans le formulaire', () => {
    renderDevis();
    ouvrirFormulaire();
    // L'ancien composant n'est plus rendu (ni son testid, ni son titre, ni ses boutons Appliquer).
    expect(screen.queryByTestId('assistant-devis-ia')).toBeNull();
    expect(screen.queryByText('Assistant Devis IA')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Appliquer$/i })).toBeNull();
  });
});

describe('LOT C+D — le panneau AideDevisPanel est rendu avec le nouveau design', () => {
  it('affiche l\'en-tête soigné (titre + toggle Réduire) et le bandeau garde-fou', () => {
    renderDevis();
    ouvrirFormulaire();
    const panel = within(screen.getByTestId('aide-devis-panel'));
    expect(panel.getByText(/Aide au devis — prix conseillé au m²/i)).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /Réduire/i })).toBeInTheDocument();
    expect(panel.getByText(/ne remplit jamais le prix/i)).toBeInTheDocument();
  });

  it('le toggle Réduire / Développer masque puis réaffiche le corps du panneau', () => {
    renderDevis();
    ouvrirFormulaire();
    const panelEl = screen.getByTestId('aide-devis-panel');
    expect(within(panelEl).getByText(/ne remplit jamais le prix/i)).toBeInTheDocument();
    fireEvent.click(within(panelEl).getByRole('button', { name: /Réduire/i }));
    expect(within(panelEl).queryByText(/ne remplit jamais le prix/i)).toBeNull();
    fireEvent.click(within(panelEl).getByRole('button', { name: /Développer/i }));
    expect(within(panelEl).getByText(/ne remplit jamais le prix/i)).toBeInTheDocument();
  });
});

describe('LOT C+D — ordre DOM : Avenants + Régie AVANT l\'estimation', () => {
  it('le panneau d\'aide apparaît APRÈS les blocs Avenants et Heures en régie', () => {
    renderDevis();
    ouvrirFormulaire();
    const panel = screen.getByTestId('aide-devis-panel');
    // Ancres textuelles des deux blocs qui doivent précéder l'estimation.
    const avenants = screen.getByText(/Avenants \(travaux supplémentaires\)/i);
    const regie = screen.getByText(/Heures en régie/i);
    // compareDocumentPosition : FOLLOWING (4) => le second argument suit le premier dans le DOM.
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(avenants.compareDocumentPosition(panel) & FOLLOWING).toBeTruthy(); // panel après avenants
    expect(regie.compareDocumentPosition(panel) & FOLLOWING).toBeTruthy();    // panel après régie
  });
});

describe('LOT C+D — le panneau ne modifie JAMAIS le montant HT', () => {
  it('estimer le marché (IA) laisse le montant HT tapé inchangé', async () => {
    mockAppeler.mockResolvedValue('Faux-plafonds : ≈ 80–120 CHF/m². Estimation à vérifier.');
    renderDevis();
    ouvrirFormulaire();
    fireEvent.click(screen.getByRole('button', { name: 'Faux-plafonds' })); // sélectionne le type
    const cible = screen.getByPlaceholderText(/45.?000/);
    fireEvent.change(cible, { target: { value: '50000' } });
    const avant = cible.value;
    // Interagit avec la Source B du panneau…
    fireEvent.click(screen.getByTestId('aide-marche-bouton'));
    await screen.findByTestId('aide-marche-resultat');
    // …le montant HT n'a pas bougé.
    expect(cible.value).toBe(avant);
    // Et le conseil source A reste bien affiché (lecture seule, pas d'écriture).
    expect(screen.getByTestId('aide-conseille-Faux-plafonds').textContent).toMatch(/92/);
  });
});

describe('LOT C+D — Avenants + Régie restent fonctionnels (calcul CA intact)', () => {
  it('un devis avec avenant + régie affiche le bon CA total dans le tableau', () => {
    // Devis existant : 40'000 HT + avenant 5'000 + régie 10h×150 = 1'500 → CA total 46'500.
    const DEVIS = [{
      id: 'd1', numero: 'DEV-2026-001', clientId: 1, date: '2026-03-10', statut: 'accepté',
      montantHT: 40000, typesTravaux: ['Faux-plafonds'],
      avenants: [{ id: 'a1', description: 'Extension', montant: 5000 }],
      heuresRegie: [{ id: 'r1', description: 'Imprévu', heures: 10, tarifHeure: 150 }],
    }];
    renderDevis({ devis: DEVIS });
    // CA total = 40000 + 5000 + 1500 = 46'500 (apparaît au tableau ET dans le hero CA signé → getAllByText).
    expect(screen.getAllByText(/46[\s'’]?500/).length).toBeGreaterThan(0);
    // Ventilation propre au tableau (preuve que le calcul avenants/régie est intact).
    expect(screen.getByText(/dont CHF 5[\s'’]?000 avenants/i)).toBeInTheDocument();
    expect(screen.getByText(/dont CHF 1[\s'’]?500 régie/i)).toBeInTheDocument();
  });
});
