/**
 * Devis MOBILE — soin lot A (liste + en-tête). Preuve RTL RÉELLE (vrai composant Devis) :
 *  • mobile : doublon « DEVIS / 04 » supprimé (fil d'Ariane = « DEVIS ») ;
 *    les 4 KPI du hero en BLANC (aucune couleur d'alerte) ;
 *    barre d'outils = 3 actions ≥44px (période + CSV + Nouveau devis) ;
 *    filtres sur une ligne collante qui défile (overflowX auto, pas de wrap), cibles 44px ;
 *  • desktop : « DEVIS / 04 » présent + KPI colorés (inchangé).
 * Échoue si on réintroduit « DEVIS / 04 » en mobile, si un KPI repasse en couleur,
 * ou si la barre de filtres perd son défilement horizontal.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';

// Mocks (side-effects absents de jsdom / env) — mêmes que src/pages/__tests__/DevisPage.test.jsx
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) },
}));
vi.mock('../ExportPDF', () => ({ exportDevis: vi.fn(), exportFicheChantier: vi.fn(), exportFacture: vi.fn() }));
vi.mock('../utils/exportCSV', () => ({ exportCSV: vi.fn() }));

import Devis from '../pages/DevisPage';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const CLIENTS = [{ id: 'c1', nom: 'Dupont', prenom: 'Marc', entreprise: 'Dupont SA' }];
// Un devis existe → le bouton CSV s'affiche (même condition qu'en prod : devis.length > 0).
const DEVIS = [{ id: 'd1', numero: 'DEV-2026-001', clientId: 'c1', date: '2026-03-01', statut: 'brouillon', montantHT: '45000' }];

const renderDevis = () => renderWithApp(<Devis />, {
  devis: DEVIS, clients: CLIENTS, chantiers: [], factures: [],
  parametres: { employes: [], typesTravaux: [] }, periodeGlobale: 'mois',
  setPeriodeGlobale: vi.fn(), naviguer: vi.fn(), ouvrirMenu: vi.fn(),
});

describe('Devis mobile — soin lot A (375px)', () => {
  it('doublon « DEVIS / 04 » supprimé (fil d\'Ariane = « DEVIS »)', () => {
    setLargeur(375);
    renderDevis();
    expect(screen.getByRole('heading', { name: 'Devis' })).toBeInTheDocument();
    expect(screen.queryByText(/DEVIS\s*\/\s*04/)).toBeNull();
    expect(screen.getAllByText('DEVIS').length).toBeGreaterThan(0);
  });

  it('les 4 KPI du hero sont blancs (aucune couleur d\'alerte)', () => {
    setLargeur(375);
    renderDevis();
    const grid = screen.getByTestId('hero-chiffres');
    const valeurs = [...grid.children].map(tile => tile.children[1]);
    expect(valeurs).toHaveLength(4);
    valeurs.forEach(v => expect(v.style.color).toBe('rgb(255, 255, 255)'));
  });

  it('barre d\'outils : 3 actions ≥44px (période + CSV + Nouveau devis)', () => {
    setLargeur(375);
    renderDevis();
    const periode = screen.getByLabelText('Période');
    const csv = screen.getByLabelText('Exporter CSV');
    const nouveau = screen.getByText(/Nouveau devis/).closest('button');
    expect(periode.style.minHeight).toBe('44px');
    expect(csv.style.minHeight).toBe('44px');
    expect(csv.style.width).toBe('44px');
    expect(nouveau.style.minHeight).toBe('44px');
  });

  it('filtres sur une ligne collante qui défile (overflowX auto, cibles 44px)', () => {
    setLargeur(375);
    renderDevis();
    const refuse = screen.getByText('refusé');
    expect(refuse.style.minHeight).toBe('44px');
    expect(refuse.style.flexShrink).toBe('0');
    const barre = refuse.parentElement;
    expect(barre.style.overflowX).toBe('auto');
    expect(barre.style.position).toBe('sticky');
  });
});

describe('Devis desktop — non-régression (1200px)', () => {
  it('« DEVIS / 04 » présent (inchangé)', () => {
    setLargeur(1200);
    renderDevis();
    expect(screen.getAllByText(/DEVIS\s*\/\s*04/).length).toBeGreaterThan(0);
  });

  it('KPI colorés en desktop (CA signé vert, pas blanc)', () => {
    setLargeur(1200);
    renderDevis();
    const caSigne = screen.getByTestId('hero-kpi-ca-signé').children[1];
    expect(caSigne.style.color).toBe('rgb(74, 222, 128)'); // #4ADE80
  });

  it('filtres NON collants en desktop (flex-wrap conservé)', () => {
    setLargeur(1200);
    renderDevis();
    const barre = screen.getByText('refusé').parentElement;
    expect(barre.style.position).not.toBe('sticky');
    expect(barre.style.flexWrap).toBe('wrap');
  });
});
