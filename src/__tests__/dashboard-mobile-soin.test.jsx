/**
 * Dashboard MOBILE — soin (topbar rétractable + 2 suppressions + chevauchement KPI).
 * Preuve RTL RÉELLE (vrai Dashboard rendu) :
 *  • mobile : fil d'Ariane « ACCUEIL / 00 » ET « TABLEAU DE BORD · DIRECTION » SUPPRIMÉS,
 *    topbar mobile présente, chevauchement KPI conservé (marge négative) ;
 *  • desktop : fil d'Ariane + sous-titre CONSERVÉS, pas de topbar mobile (PC inchangé).
 * Ces tests échouent si on réintroduit le fil d'Ariane mobile ou si on casse le chevauchement.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Dashboard from '../pages/Dashboard';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const _d = new Date();
const TODAY = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 };
const CH = { id: 'CH1', nom: 'Chantier Test', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 20, dateDebut: TODAY, journal: [] };
const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 100000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];
const POINTAGES = [{ id: 'p1', date: TODAY, employeId: 1, repartitions: [{ chantierId: 'CH1', categorie: 'production', heures: 8 }], deplacement: null, majoration: null }];
function ctx(over = {}) {
  return {
    devis: DEVIS, clients: [{ id: 'cl1', nom: 'Client', entreprise: 'Client SA' }], chantiers: [CH], factures: [], pointages: POINTAGES,
    parametres: { employes: [EMP], localites: [], parametres: CFG },
    setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(), setPeriodeGlobale: vi.fn(), ouvrirMenu: vi.fn(),
    agentState: { scoreGlobal: 60, alertes: [], priorites: [], briefingMatin: null },
    profil: { id: 'cyna', pages: ['dashboard'] }, periodeGlobale: 'mois', ...over,
  };
}

describe('Dashboard mobile — soin (375px)', () => {
  it('supprime le fil d\'Ariane « ACCUEIL / 00 » et « TABLEAU DE BORD · DIRECTION »', () => {
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx());
    expect(screen.getByText(/Bonjour/)).toBeInTheDocument();          // le hero est bien là
    expect(screen.queryByText(/ACCUEIL\s*\/\s*00/)).toBeNull();        // fil d'Ariane supprimé (mobile)
    expect(screen.queryByText(/TABLEAU DE BORD · DIRECTION/)).toBeNull(); // sous-titre supprimé (mobile)
  });

  it('affiche la topbar mobile et conserve le chevauchement des KPI (marge négative)', () => {
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx());
    expect(screen.getByTestId('topbar-mobile')).toBeInTheDocument();
    // chevauchement = la bande KPI remonte sur le hero (marge du haut négative)
    const mt = screen.getByTestId('kpi-strip').style.marginTop;
    expect(mt.startsWith('-')).toBe(true);
  });
});

describe('Dashboard desktop — non-régression (1200px, inchangé)', () => {
  it('conserve le fil d\'Ariane + sous-titre et n\'a pas de topbar mobile', () => {
    setLargeur(1200);
    renderWithApp(<Dashboard />, ctx());
    expect(screen.getByText(/ACCUEIL\s*\/\s*00/)).toBeInTheDocument();
    expect(screen.getByText(/TABLEAU DE BORD · DIRECTION/)).toBeInTheDocument();
    expect(screen.queryByTestId('topbar-mobile')).toBeNull();
  });
});
