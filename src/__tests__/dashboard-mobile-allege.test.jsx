/**
 * Dashboard MOBILE allégé — ne garder que l'essentiel terrain (4 blocs).
 *
 * Retirés du rendu MOBILE (restent INTACTS côté desktop) : « Rendez-vous du directeur »
 * (DirecteurBloc), mini-cartes « Avancement » + « Coûts réels », barre « IA Insights ».
 * Conservés (ordre) : hero bleu → 4 chiffres → Alertes fusionné → Mes chantiers.
 *
 * Preuve RTL RÉELLE (vrai Dashboard) : vue mobile (innerWidth=375) ET vue desktop
 * (innerWidth=1200) via le même matchMedia dérivé de innerWidth.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Dashboard from '../pages/Dashboard';

beforeAll(() => {
  // matchMedia dérivé de innerWidth → cohérent avec useIsMobile (<=767) dans les 2 vues.
  window.matchMedia = (query) => ({
    matches: window.innerWidth <= 767, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false,
  });
});

function setLargeur(px) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });
}

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 };
const CH = { id: 'CH1', nom: 'Chantier Test', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 20, journal: [] };
const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 100000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];

function ctx() {
  return {
    devis: DEVIS, clients: [{ id: 'cl1', nom: 'Client', entreprise: 'Client SA' }], chantiers: [CH], factures: [], pointages: [],
    parametres: { employes: [EMP], localites: [], parametres: CFG },
    setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(), setPeriodeGlobale: vi.fn(), ouvrirMenu: vi.fn(),
    agentState: { scoreGlobal: 60, alertes: [{ id: 'a1', niveau: 'ATTENTION', message: 'Retard paiement' }], priorites: [], briefingMatin: null },
    profil: { id: 'cyna', pages: ['dashboard'] }, periodeGlobale: 'mois',
  };
}

const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

describe('Dashboard mobile allégé — 4 blocs essentiels', () => {
  it('les 4 blocs conservés sont présents (hero, 4 chiffres, Alertes, Mes chantiers)', () => {
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx());
    expect(screen.getByText(/Bonjour/)).toBeInTheDocument();
    ['CA SIGNÉ', 'MARGE MOY.', 'ENCAISSÉ', 'ON ME DOIT'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument());
    expect(screen.getByText('Intelligence IA')).toBeInTheDocument();
    expect(screen.getByText('Mes chantiers')).toBeInTheDocument();
  });

  it('les 3 blocs retirés ne sont PLUS rendus en mobile', () => {
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx());
    // DirecteurBloc (« Rendez-vous du directeur ») — marqueur rendu inconditionnellement
    expect(screen.queryByText(/Heures pointées aujourd'hui/)).toBeNull();
    // Mini-cartes Avancement / Coûts réels
    expect(screen.queryByText('Avancement')).toBeNull();
    expect(screen.queryByText('Coûts réels')).toBeNull();
    // Barre IA Insights
    expect(screen.queryByText('IA Insights')).toBeNull();
  });

  it('ordre v2 : Mes chantiers AVANT le bloc Intelligence IA (compact, en dernier)', () => {
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx());
    // Dashboard mobile v2 (GO patron) : Mes chantiers (5) précède désormais le bloc IA compact (6).
    const chantiers = screen.getByText('Mes chantiers');
    const ia = screen.getByText('Intelligence IA');
    expect(chantiers.compareDocumentPosition(ia) & FOLLOWING).toBeTruthy();
  });

  it('libellés des blocs conservés inchangés (4 chiffres)', () => {
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx());
    ['CA SIGNÉ', 'MARGE MOY.', 'ENCAISSÉ', 'ON ME DOIT'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument());
  });
});

describe('Dashboard DESKTOP — non-régression : les blocs retirés du mobile restent présents', () => {
  it('desktop garde DirecteurBloc, Avancement global et Répartition des coûts', () => {
    setLargeur(1200);
    renderWithApp(<Dashboard />, ctx());
    // DirecteurBloc toujours rendu en desktop — marqueur INDÉPENDANT DE L'HEURE : sa barre
    // d'onglets Matin/Soir/Hebdo est rendue quelle que soit l'heure (l'ancien marqueur
    // « Heures pointées aujourd'hui » ne s'affiche qu'avant 14h → fragile/flaky).
    expect(screen.getByText('Hebdo')).toBeInTheDocument();
    // Blocs Avancement + Coûts (libellés desktop) toujours là
    expect(screen.getByText('Avancement global')).toBeInTheDocument();
    expect(screen.getByText('Répartition des coûts')).toBeInTheDocument();
  });
});
