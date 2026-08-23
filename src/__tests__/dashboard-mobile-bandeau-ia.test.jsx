/**
 * Dashboard mobile — le bandeau « Intelligence IA » ne se fait plus rogner : flex-wrap.
 *
 * Bug : sur mobile (isMobile), le bandeau était une ligne flex SANS wrap ; avec plusieurs
 * pastilles (Score + crit. + att.) la ligne dépassait ~360px → bout droit coupé (overflow-x:hidden).
 * Fix cosmétique : flexWrap:'wrap' → les pastilles passent à la ligne, la flèche reste visible.
 *
 * Preuve RTL RÉELLE (vrai Dashboard, branche mobile forcée via window.innerWidth) :
 *   1. le bandeau contient TOUS ses éléments (libellé, Score, crit., att., flèche) ;
 *   2. son conteneur a bien flex-wrap (plus de ligne unique non-wrap qui rogne).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Dashboard from '../pages/Dashboard';

beforeAll(() => {
  // Forcer la vue mobile : useIsMobile lit window.innerWidth (<= 767) au montage.
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: true, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 };
const CH = { id: 'CH1', nom: 'Chantier', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 20, journal: [] };
const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 100000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];

function ctx(over = {}) {
  return {
    devis: DEVIS, clients: [{ id: 'cl1', nom: 'Client', entreprise: 'Client SA' }], chantiers: [CH], factures: [], pointages: [],
    parametres: { employes: [EMP], localites: [], parametres: CFG },
    setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(), setPeriodeGlobale: vi.fn(), ouvrirMenu: vi.fn(),
    // Score + 1 alerte CRITIQUE + 1 ATTENTION → 3 pastilles dans le bandeau.
    agentState: { scoreGlobal: 60, alertes: [
      { id: 'a1', niveau: 'CRITIQUE', message: 'Marge négative' },
      { id: 'a2', niveau: 'ATTENTION', message: 'Retard paiement' },
    ], priorites: [], briefingMatin: null },
    profil: { id: 'cyna', pages: ['dashboard'] }, periodeGlobale: 'mois', ...over,
  };
}

describe('Dashboard mobile — bandeau « Intelligence IA » wrap (plus de rognage)', () => {
  it('affiche tous les éléments (libellé, Score, crit., att., flèche) et le conteneur a flex-wrap', () => {
    renderWithApp(<Dashboard />, ctx());

    const label = screen.getByText('Intelligence IA');       // présent uniquement dans la branche mobile
    const bandeau = label.parentElement;                     // le conteneur flex du bandeau

    // 1. Tous les éléments présents (aucun rogné).
    expect(within(bandeau).getByText('Score 60/100')).toBeInTheDocument();
    expect(within(bandeau).getByText('1 crit.')).toBeInTheDocument();
    expect(within(bandeau).getByText('1 att.')).toBeInTheDocument();
    expect(within(bandeau).getByText('→')).toBeInTheDocument();

    // 2. Le conteneur enroule (flex-wrap) → les pastilles passent à la ligne au lieu d'être coupées.
    expect(bandeau.style.display).toBe('flex');
    expect(bandeau.style.flexWrap).toBe('wrap');
  });

  it('le bandeau reste cliquable (mène à l\'écran IA/agents)', () => {
    const naviguer = vi.fn();
    renderWithApp(<Dashboard />, ctx({ naviguer }));
    const bandeau = screen.getByText('Intelligence IA').parentElement;
    bandeau.click();
    expect(naviguer).toHaveBeenCalledWith('agents');
  });
});
