/**
 * Aide au devis — LOT A. Panneau « prix conseillé au m² » (source A fiable, historique CYNA).
 * ⚠ L'outil CONSEILLE seulement : il n'écrit JAMAIS le prix ni les totaux.
 *
 * Preuve RTL RÉELLE :
 *   1. le panneau affiche le conseillé / la fourchette / la marge de négo (≥ 3 chantiers facturés) ;
 *   2. garde-fou : type avec < 3 chantiers → « données insuffisantes », aucun chiffre ;
 *   3. aucun type sélectionné → invite à en choisir un ;
 *   4. INTÉGRATION DevisPage : sélectionner un type NE MODIFIE PAS le montant HT tapé (lecture seule).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import AideDevisPanel from '../components/devis/AideDevisPanel';
import DevisPage from '../pages/DevisPage';

vi.mock('../AssistantDevisIA', () => ({ default: () => null }));
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

// 5 chantiers « Faux-plafonds » facturés, surface 100 m² → prix HT/m² = [65,78,92,108,130] (médiane 92).
const CH = (id, materielReel) => ({ id, nom: `CH${id}`, statut: 'terminé', typesTravaux: ['Faux-plafonds'], surface: 100, materielReel, canton: 'GE', journal: [], equipe: [] });
const F  = (id, chantierId, montantHT) => ({ id, chantierId, statut: 'payee', montantHT, montantTTC: Math.round(montantHT * 1.081) });
const CHANTIERS = [CH('c1', 6000), CH('c2', 6000), CH('c3', 6000), CH('c4', 6000), CH('c5', 6000)];
const FACTURES = [F('f1', 'c1', 6500), F('f2', 'c2', 7800), F('f3', 'c3', 9200), F('f4', 'c4', 10800), F('f5', 'c5', 13000)];
const PARAMS = { employes: [], localites: [], parametres: { coefficientMainOeuvre: 1 }, typesTravaux: [{ id: 1, nom: 'Faux-plafonds' }, { id: 2, nom: 'Cloisons' }] };

function renderPanel(types, surface = 250, over = {}) {
  return renderWithApp(
    <AideDevisPanel typesSelectionnes={types} surface={surface} />,
    { chantiers: CHANTIERS, factures: FACTURES, devis: [], parametres: PARAMS, pointages: [], ...over },
  );
}

describe('Panneau — conseil fiable + garde-fou + bandeau', () => {
  it('affiche le conseillé (92), la fourchette et le plancher (75) — et le bandeau « ne remplit jamais le prix »', () => {
    renderPanel(['Faux-plafonds']);
    expect(screen.getByTestId('aide-devis-panel')).toBeInTheDocument();
    expect(screen.getByText(/ne remplit jamais le prix/i)).toBeInTheDocument();
    expect(screen.getByTestId('aide-conseille-Faux-plafonds').textContent).toMatch(/92/);
    expect(screen.getByTestId('aide-plancher-Faux-plafonds').textContent).toMatch(/75/);
    // Fourchette Q1/Q3 visibles (78 et 108) + marge de négo.
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('108')).toBeInTheDocument();
    expect(screen.getByText(/Marge de négociation/i)).toBeInTheDocument();
  });

  it('GARDE-FOU : un type avec < 3 chantiers → « données insuffisantes », aucun chiffre', () => {
    renderPanel(['Faux-plafonds'], 250, { chantiers: CHANTIERS.slice(0, 2), factures: FACTURES.slice(0, 2) });
    expect(within(screen.getByTestId('aide-type-Faux-plafonds')).getByText(/insuffisantes/i)).toBeInTheDocument();
    expect(screen.queryByTestId('aide-conseille-Faux-plafonds')).toBeNull();
  });

  it('aucun type sélectionné → invite à en choisir un', () => {
    renderPanel([]);
    expect(screen.getByText(/Coche un ou plusieurs/i)).toBeInTheDocument();
    expect(screen.queryByTestId('aide-conseille-Faux-plafonds')).toBeNull();
  });
});

describe('INTÉGRATION DevisPage — le panneau ne modifie JAMAIS le prix', () => {
  const CLIENT = { id: 1, prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA' };
  function renderDevis() {
    return renderWithApp(<DevisPage />, {
      clients: [CLIENT], devis: [], chantiers: CHANTIERS, factures: FACTURES,
      parametres: PARAMS, periodeGlobale: 'annee',
      setDevis: vi.fn(), setChantiers: vi.fn(), setFactures: vi.fn(),
      confirmer: vi.fn().mockResolvedValue(true), afficherNotif: vi.fn(),
      naviguer: vi.fn(), ouvrirMenu: vi.fn(), setPeriodeGlobale: vi.fn(),
    });
  }

  it('taper un montant HT puis choisir un type de travaux laisse le montant INCHANGÉ', () => {
    renderDevis();
    // Ouvre le formulaire « Nouveau devis ».
    fireEvent.click(within(screen.getByTestId('hero-devis')).getByRole('button', { name: /Nouveau devis/i }));
    // Le panneau d'aide est présent dans le formulaire.
    expect(screen.getByTestId('aide-devis-panel')).toBeInTheDocument();
    // Champ « Montant signé HT » (placeholder unique) — le seul qui formate en apostrophes.
    const cible = screen.getByPlaceholderText(/45.?000/);
    fireEvent.change(cible, { target: { value: '50000' } });
    expect(cible.value).toMatch(/50/); // affiché « 50'000 »
    const avant = cible.value;
    // Sélectionne le type « Faux-plafonds » (bouton chip) → le panneau se met à jour…
    fireEvent.click(screen.getByRole('button', { name: 'Faux-plafonds' }));
    // …mais le montant HT tapé n'a PAS bougé.
    expect(cible.value).toBe(avant);
    // Et le panneau affiche bien le conseil (type désormais sélectionné).
    expect(screen.getByTestId('aide-conseille-Faux-plafonds').textContent).toMatch(/92/);
  });
});
