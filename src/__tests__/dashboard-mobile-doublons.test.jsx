/**
 * Dashboard mobile — GESTE 1/3 : suppression des doublons (layout, 0 calcul).
 *
 * DOUBLON 1 (trésorerie) : "Tréso. 30j" (prévision) retiré des mini-cartes ; "ENCAISSÉ" (réel) reste en haut.
 * DOUBLON 2 (alertes ×3) : bandeau "Intelligence IA" séparé + mini-carte "Alertes IA" retirés, fusionnés
 *   dans UN seul bloc « Alertes » : score de santé EN HAUT + liste des alertes chantiers (ou « Tout OK ») EN DESSOUS.
 *
 * Preuve RTL RÉELLE (vrai Dashboard, vue mobile forcée innerWidth=375).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Dashboard from '../pages/Dashboard';

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: true, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const CFG = { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 };

// Chantiers vides → aucune alerte chantier (calculerAlertes = []) : cas « Tout OK » déterministe.
function renderMobile(over = {}) {
  return renderWithApp(<Dashboard />, {
    devis: [], clients: [], chantiers: [], factures: [], pointages: [],
    parametres: { employes: [], localites: [], parametres: CFG },
    setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(), setPeriodeGlobale: vi.fn(), ouvrirMenu: vi.fn(),
    agentState: { scoreGlobal: 60, alertes: [], priorites: [], briefingMatin: null },
    profil: { id: 'cyna', pages: ['dashboard'] }, periodeGlobale: 'mois', ...over,
  });
}

const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

describe('Dashboard mobile — Geste 1 : doublons retirés', () => {
  it('DOUBLON 1 : « Tréso. 30j » retiré des mini-cartes ; « ENCAISSÉ » reste en haut', () => {
    renderMobile();
    expect(screen.queryByText('Tréso. 30j')).toBeNull();     // prévision retirée
    expect(screen.getByText('ENCAISSÉ')).toBeInTheDocument(); // encaissé réel (KPI haut) conservé
  });

  it('DOUBLON 2 : un SEUL bloc alertes — « Alertes IA » (mini-carte) et le bandeau séparé ont disparu', () => {
    renderMobile();
    expect(screen.queryByText('Alertes IA')).toBeNull();               // mini-carte retirée
    // « Intelligence IA » n'apparaît plus qu'UNE fois (l'en-tête du bloc fusionné), plus le bandeau séparé.
    expect(screen.getAllByText('Intelligence IA')).toHaveLength(1);
  });

  it('le bloc fusionné : score de santé EN HAUT, contenu (Tout OK / liste) EN DESSOUS', () => {
    renderMobile();
    const header = screen.getByText('Intelligence IA');
    const score = screen.getByText('Score 60/100');
    const toutOk = screen.getByText(/Tout OK — aucune alerte chantier/);
    // Score dans l'en-tête, « Tout OK » en dessous → ordre vertical correct.
    expect(header.compareDocumentPosition(score) & FOLLOWING).toBeTruthy();
    expect(score.compareDocumentPosition(toutOk) & FOLLOWING).toBeTruthy();
  });

  it('l\'en-tête du bloc alertes reste cliquable → écran IA/agents', () => {
    const naviguer = vi.fn();
    renderMobile({ naviguer });
    screen.getByText('Intelligence IA').parentElement.click();
    expect(naviguer).toHaveBeenCalledWith('agents');
  });

  it('les blocs conservés sont toujours là (hero, KPI argent, Mes chantiers)', () => {
    renderMobile();
    expect(screen.getByText(/Bonjour/)).toBeInTheDocument();
    ['CA SIGNÉ', 'MARGE MOY.', 'ENCAISSÉ', 'ON ME DOIT'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument());
    expect(screen.getByText('Mes chantiers')).toBeInTheDocument();
    // Allègement mobile (GO patron) : les mini-cartes « Avancement » et « Coûts réels »
    // ont été RETIRÉES du rendu mobile (restent en desktop) → ne plus les asserter ici.
  });
});
