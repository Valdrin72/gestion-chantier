import React from 'react';
import { render } from '@testing-library/react';
import { AppProvider } from '../context/AppContext';

/**
 * Construit un contexte AppContext minimal valide pour les tests de composants.
 * Toutes les fonctions sont des vi.fn() remplaçables via ctxOverrides.
 */
function makeDefaultCtx(overrides = {}) {
  return {
    chantiers: [],
    setChantiers: vi.fn(),
    clients: [],
    setClients: vi.fn(),
    devis: [],
    setDevis: vi.fn(),
    factures: [],
    setFactures: vi.fn(),
    parametres: { employes: [] },
    setParametres: vi.fn(),
    pointages: [],
    setPointages: vi.fn(),
    paiementsData: [],
    setPaiementsData: vi.fn(),
    actionsLog: [],
    profil: null,
    logAction: vi.fn(),
    naviguer: vi.fn(),
    contexte: {},
    periodeGlobale: 'semaine',
    setPeriodeGlobale: vi.fn(),
    agentState: {},
    ouvrirSaisieHeures: vi.fn(),
    deconnecter: vi.fn(),
    afficherNotif: vi.fn(),
    confirmer: vi.fn(),
    ...overrides,
  };
}

/**
 * Rend un composant enveloppé dans AppProvider avec un contexte mocké configurable.
 *
 * Usage:
 *   const { ctx } = renderWithApp(<MonComposant />, { pointages: [...], setPointages: mockFn });
 *   ctx.setPointages → vi.fn() pour vérifier les appels
 */
export function renderWithApp(ui, ctxOverrides = {}) {
  const ctx = makeDefaultCtx(ctxOverrides);
  const result = render(<AppProvider value={ctx}>{ui}</AppProvider>);
  return { ...result, ctx };
}
