/**
 * Aide au devis — LOT B. Source B « Repère marché » (estimation IA, « à vérifier »).
 * ⚠ Chargée À LA DEMANDE (bouton), séparée de l'historique fiable, kill-switch respecté.
 *   Le panneau CONSEILLE toujours — n'écrit JAMAIS le prix. useClaudeAI est MOCKÉ (zéro réseau).
 *
 * Preuve RTL RÉELLE :
 *   1. bouton → appel IA → résultat affiché avec l'avertissement « estimation à vérifier » ;
 *   2. état loading pendant l'appel ; état erreur si l'IA renvoie null ;
 *   3. IA désactivée (Paramètres → Confidentialité) → pas de bouton, message clair ;
 *   4. séparation stricte : le repère marché est un bloc DISTINCT de l'historique (pas de fusion) ;
 *   5. INTÉGRATION DevisPage : cliquer « Estimer le marché » NE MODIFIE PAS le montant HT tapé.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import AideDevisPanel from '../components/devis/AideDevisPanel';
import DevisPage from '../pages/DevisPage';

const mockAppeler = vi.fn();
vi.mock('../hooks/useClaudeAI', () => ({ useClaudeAI: () => ({ appeler: mockAppeler, loading: false, error: null }) }));
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
beforeEach(() => mockAppeler.mockReset());

// Historique : 5 « Faux-plafonds » facturés (pour que la source A s'affiche à côté).
const CH = (id) => ({ id, nom: `CH${id}`, statut: 'terminé', typesTravaux: ['Faux-plafonds'], surface: 100, materielReel: 6000, canton: 'GE', journal: [], equipe: [] });
const F  = (id, chantierId, montantHT) => ({ id, chantierId, statut: 'payee', montantHT, montantTTC: Math.round(montantHT * 1.081) });
const CHANTIERS = [CH('c1'), CH('c2'), CH('c3'), CH('c4'), CH('c5')];
const FACTURES = [F('f1', 'c1', 6500), F('f2', 'c2', 7800), F('f3', 'c3', 9200), F('f4', 'c4', 10800), F('f5', 'c5', 13000)];
const PARAMS = (iaActivee = true) => ({ employes: [], localites: [], parametres: { coefficientMainOeuvre: 1, iaActivee }, typesTravaux: [{ id: 1, nom: 'Faux-plafonds' }] });

function renderPanel(over = {}) {
  return renderWithApp(
    <AideDevisPanel typesSelectionnes={['Faux-plafonds']} surface={250} />,
    { chantiers: CHANTIERS, factures: FACTURES, devis: [], parametres: PARAMS(), pointages: [], ...over },
  );
}

describe('Repère marché — appel à la demande, résultat + avertissement', () => {
  it('le bouton déclenche l\'appel IA (anonymisé) et affiche le résultat + l\'avertissement « à vérifier »', async () => {
    mockAppeler.mockResolvedValue('Faux-plafonds : ≈ 80–120 CHF/m². Estimation à vérifier localement.');
    renderPanel();
    fireEvent.click(screen.getByTestId('aide-marche-bouton'));
    // Payload anonymisé : type + canton, aucune donnée nominative.
    expect(mockAppeler).toHaveBeenCalledWith('conseil_prix_marche', { types: ['Faux-plafonds'], canton: 'Genève' });
    const res = await screen.findByTestId('aide-marche-resultat');
    expect(within(res).getByText(/80–120 CHF\/m²/)).toBeInTheDocument();
    expect(within(res).getByText(/non vérifiée.*jamais un prix ferme/i)).toBeInTheDocument();
  });

  it('affiche l\'état « en cours » pendant l\'appel', async () => {
    // Résolution différée (macrotâche) → « loading » visible à l'assertion synchrone, puis settle proprement.
    mockAppeler.mockImplementation(() => new Promise(r => setTimeout(() => r('Faux-plafonds : ≈ 80–120 CHF/m².'), 20)));
    renderPanel();
    fireEvent.click(screen.getByTestId('aide-marche-bouton'));
    expect(screen.getByTestId('aide-marche-loading')).toBeInTheDocument();
    expect(await screen.findByTestId('aide-marche-resultat')).toBeInTheDocument();
  });

  it('IA indisponible (retour null) → message d\'erreur + bouton Réessayer', async () => {
    mockAppeler.mockResolvedValue(null);
    renderPanel();
    fireEvent.click(screen.getByTestId('aide-marche-bouton'));
    expect(await screen.findByTestId('aide-marche-erreur')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réessayer/i })).toBeInTheDocument();
  });
});

describe('Kill-switch + séparation stricte des sources', () => {
  it('IA désactivée (Paramètres → Confidentialité) → aucun bouton, message clair', () => {
    renderPanel({ parametres: PARAMS(false) });
    expect(screen.queryByTestId('aide-marche-bouton')).toBeNull();
    expect(within(screen.getByTestId('aide-marche')).getByText(/Assistant IA désactivé/i)).toBeInTheDocument();
    expect(mockAppeler).not.toHaveBeenCalled();
  });

  it('le repère marché est un bloc DISTINCT de l\'historique (aucune fusion A+B)', async () => {
    mockAppeler.mockResolvedValue('Faux-plafonds : ≈ 80–120 CHF/m².');
    renderPanel();
    // Source A (fiable) et source B (marché) sont deux conteneurs séparés.
    const marche = screen.getByTestId('aide-marche');
    const histo = screen.getByTestId('aide-type-Faux-plafonds');
    expect(marche).toBeInTheDocument();
    expect(histo).toBeInTheDocument();
    expect(marche.contains(histo)).toBe(false); // pas imbriqués → pas fondus
    fireEvent.click(screen.getByTestId('aide-marche-bouton'));
    await screen.findByTestId('aide-marche-resultat');
    // Le chiffre marché (80–120) n'apparaît PAS dans le bloc historique.
    expect(within(histo).queryByText(/80–120/)).toBeNull();
  });
});

describe('INTÉGRATION DevisPage — le repère marché ne modifie pas le prix', () => {
  const CLIENT = { id: 1, prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA' };
  it('estimer le marché laisse le montant HT tapé INCHANGÉ', async () => {
    mockAppeler.mockResolvedValue('Faux-plafonds : ≈ 80–120 CHF/m².');
    renderWithApp(<DevisPage />, {
      clients: [CLIENT], devis: [], chantiers: CHANTIERS, factures: FACTURES,
      parametres: PARAMS(), periodeGlobale: 'annee',
      setDevis: vi.fn(), setChantiers: vi.fn(), setFactures: vi.fn(),
      confirmer: vi.fn().mockResolvedValue(true), afficherNotif: vi.fn(),
      naviguer: vi.fn(), ouvrirMenu: vi.fn(), setPeriodeGlobale: vi.fn(),
    });
    fireEvent.click(within(screen.getByTestId('hero-devis')).getByRole('button', { name: /Nouveau devis/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Faux-plafonds' })); // sélectionne le type
    const cible = screen.getByPlaceholderText(/45.?000/);
    fireEvent.change(cible, { target: { value: '50000' } });
    const avant = cible.value;
    // Estime le marché…
    fireEvent.click(screen.getByTestId('aide-marche-bouton'));
    await screen.findByTestId('aide-marche-resultat');
    // …le montant HT n'a pas bougé.
    expect(cible.value).toBe(avant);
  });
});
