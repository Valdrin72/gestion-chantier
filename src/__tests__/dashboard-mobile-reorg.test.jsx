/**
 * Dashboard mobile — réorganisation layout (branche isMobile) : ordre + déserrage des 2 grilles 2×2.
 *
 * Changements (cosmétique/layout pur, 0 calcul) :
 *   • ordre : bandeau bleu (hero) → 4 chiffres d'argent (KPI strip) → reste (déjà le cas, vérifié) ;
 *   • les 2 grilles 2 colonnes passent en 1 colonne pleine largeur :
 *       - bloc 2 : KpiStripV1 compact (gridTemplateColumns '1fr') ;
 *       - bloc 6 : grille Tréso/Alertes/Avancement/Coûts ('1fr').
 *
 * Preuve RTL RÉELLE (vrai Dashboard, vue mobile forcée via innerWidth) : ordre DOM, 1 colonne,
 * tous les blocs toujours présents, libellés inchangés.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
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

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 };
const CH = { id: 'CH1', nom: 'Chantier Test', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 20, journal: [] };
const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 100000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];

function renderMobile() {
  return renderWithApp(<Dashboard />, {
    devis: DEVIS, clients: [{ id: 'cl1', nom: 'Client', entreprise: 'Client SA' }], chantiers: [CH], factures: [], pointages: [],
    parametres: { employes: [EMP], localites: [], parametres: CFG },
    setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(), setPeriodeGlobale: vi.fn(), ouvrirMenu: vi.fn(),
    agentState: { scoreGlobal: 60, alertes: [{ id: 'a1', niveau: 'ATTENTION', message: 'Retard paiement' }], priorites: [], briefingMatin: null },
    profil: { id: 'cyna', pages: ['dashboard'] }, periodeGlobale: 'mois',
  });
}

const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

describe('Dashboard mobile — ordre + grilles déserrées (1 colonne)', () => {
  it('ordre : bandeau bleu (hero) → 4 chiffres d\'argent (KPI) → Mes chantiers', () => {
    renderMobile();
    const hero = screen.getByTestId('hero-direction');
    const kpi = screen.getByTestId('kpi-strip');
    const chantiers = screen.getByText('Mes chantiers');
    expect(hero.compareDocumentPosition(kpi) & FOLLOWING).toBeTruthy();       // KPI après le bandeau bleu
    expect(kpi.compareDocumentPosition(chantiers) & FOLLOWING).toBeTruthy();  // le reste après les chiffres
  });

  it('bloc 2 (4 chiffres) : grille 2×2 compacte (Dashboard mobile v2)', () => {
    renderMobile();
    // v2 (GO patron) : les 4 KPI repassent en grille 2 colonnes compacte (au lieu d'1 colonne).
    expect(screen.getByTestId('kpi-strip').style.gridTemplateColumns).toBe('repeat(2, 1fr)');
  });

  // (Le test « bloc mini-cartes Avancement/Coûts : 1 colonne » a été RETIRÉ : ces mini-cartes
  //  ne sont plus rendues sur mobile depuis l'allègement mobile — GO patron.)

  it('tous les blocs conservés sont présents (aucun disparu) + libellés inchangés', () => {
    renderMobile();
    // Bloc 1 (bleu), bloc 2 (les 4 chiffres, libellés inchangés), bloc IA, chantiers.
    expect(screen.getByText(/Bonjour/)).toBeInTheDocument();
    ['CA SIGNÉ', 'MARGE MOY.', 'ENCAISSÉ', 'ON ME DOIT'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument());
    expect(screen.getByText('Intelligence IA')).toBeInTheDocument();
    expect(screen.getByText('Mes chantiers')).toBeInTheDocument();
    // Allègement mobile : « Avancement » et « Coûts réels » retirés du rendu mobile (restent desktop).
  });
});
