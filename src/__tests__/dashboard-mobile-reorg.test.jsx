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

  it('bloc 2 (4 chiffres) : 1 colonne pleine largeur (plus 2×2)', () => {
    renderMobile();
    expect(screen.getByTestId('kpi-strip').style.gridTemplateColumns).toBe('1fr');
  });

  it('bloc 6 (Tréso/Alertes/Avancement/Coûts) : 1 colonne pleine largeur (plus 2×2)', () => {
    renderMobile();
    const grid6 = screen.getByText('Tréso. 30j').parentElement.parentElement; // label → carte → grille
    expect(grid6.style.display).toBe('grid');
    expect(grid6.style.gridTemplateColumns).toBe('1fr');
  });

  it('tous les blocs sont toujours présents (aucun disparu) + libellés inchangés', () => {
    renderMobile();
    // Bloc 1 (bleu), bloc 2 (les 4 chiffres, libellés inchangés), bloc 4 (IA), bloc 5 (chantiers), bloc 6 (mini-cartes).
    expect(screen.getByText(/Bonjour/)).toBeInTheDocument();
    ['CA SIGNÉ', 'MARGE MOY.', 'ENCAISSÉ', 'ON ME DOIT'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument());
    expect(screen.getByText('Intelligence IA')).toBeInTheDocument();
    expect(screen.getByText('Mes chantiers')).toBeInTheDocument();
    ['Tréso. 30j', 'Avancement', 'Coûts réels'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument());
  });
});
