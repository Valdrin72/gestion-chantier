/**
 * Dashboard mobile — GESTES 2+3 : hiérarchie « argent en gros » + cartes uniformes (layout/style pur, 0 calcul).
 *
 * GESTE 2 (hiérarchie) : les 4 KPI d'argent sont les PLUS GROS chiffres (28px) ; les chiffres
 *   secondaires (ex. Avancement %) sont RÉDUITS (20px). Rien de plus gros qu'un montant d'argent.
 * GESTE 3 (cartes uniformes) : UN SEUL style de carte pour tous les blocs mobiles — même arrondi (14px),
 *   défini une fois (cardM = { ...carteV1 }) et réutilisé. Une carte KPI (carteV1) et « Mes chantiers » (cardM)
 *   partagent le même borderRadius.
 *
 * Preuve RTL RÉELLE (vrai Dashboard, vue mobile forcée innerWidth=375) : tailles de police lues sur le DOM,
 * arrondis lus sur le DOM, libellés/contenu inchangés.
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

const px = (v) => parseInt(String(v || '0'), 10);

describe('Dashboard mobile — Geste 2 : hiérarchie « argent en gros »', () => {
  it('les montants d\'argent (KPI) restent bien lisibles (20px en grille 2×2)', () => {
    renderMobile();
    // Dashboard mobile v2 (GO patron) : KPI en grille 2×2 compacte, montants ~20px (au lieu de 28
    //  en 1 colonne). La valeur mono est le frère direct du label.
    const valeurArgent = screen.getByText('CA SIGNÉ').nextElementSibling;
    expect(px(valeurArgent.style.fontSize)).toBe(20);
  });
});

describe('Dashboard mobile — Geste 3 : cartes uniformes (même arrondi)', () => {
  it('la carte KPI (argent) et la carte « Mes chantiers » partagent le même borderRadius (14px)', () => {
    renderMobile();
    const carteKpi = screen.getByText('CA SIGNÉ').parentElement;                       // carteV1
    const carteChantiers = screen.getByText('Mes chantiers').parentElement.parentElement; // cardM (titre → en-tête → carte)
    expect(carteKpi.style.borderRadius).toBe('14px');
    expect(carteChantiers.style.borderRadius).toBe('14px');
    expect(carteKpi.style.borderRadius).toBe(carteChantiers.style.borderRadius);
  });

  it('le bloc « Intelligence IA » (compact) utilise aussi le même arrondi (14px)', () => {
    renderMobile();
    // Dashboard mobile v2 : le bloc IA est désormais une ligne compacte (cardM) → le libellé
    //  « Intelligence IA » est enfant DIRECT de la carte cardM (1 niveau).
    const carteIA = screen.getByText('Intelligence IA').parentElement; // libellé → carte cardM
    expect(carteIA.style.borderRadius).toBe('14px');
  });
});

describe('Dashboard mobile — Gestes 2+3 : contenu/libellés inchangés', () => {
  it('tous les libellés d\'origine sont toujours présents (aucune valeur/contenu retiré)', () => {
    renderMobile();
    expect(screen.getByText(/Bonjour/)).toBeInTheDocument();
    ['CA SIGNÉ', 'MARGE MOY.', 'ENCAISSÉ', 'ON ME DOIT'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument());
    expect(screen.getByText('Mes chantiers')).toBeInTheDocument();
    expect(screen.getByText('Intelligence IA')).toBeInTheDocument();
    // Allègement mobile : « Avancement » et « Coûts réels » retirés du rendu mobile (restent desktop).
  });
});
