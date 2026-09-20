/**
 * Finances / Factures MOBILE — soin. Preuve RTL RÉELLE (vrais composants) :
 *  • mobile : doublon « FINANCES / 03 » supprimé (fil d'Ariane = « FINANCES ») ;
 *    KPI du hero BLANCS, sauf l'alerte « EN RETARD · À CE JOUR » en rouge quand > 0 ;
 *    cartes de liste (Trésorerie) BLANCHES ; recherche + 2 filtres (Factures) à 46px ;
 *  • desktop : « FINANCES / 03 » présent (inchangé).
 * Échoue si on réintroduit « FINANCES / 03 » en mobile, si un KPI non-alerte
 * repasse en couleur, ou si les cartes de liste perdent leur fond blanc mobile.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Finances from '../pages/FinancesPage';
import Factures from '../Factures';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const CLIENTS = [{ id: 'c1', nom: 'Dupont', entreprise: 'Dupont SA' }];
const CHANTIERS = [{ id: 'ch1', nom: 'Rénovation façade', clientId: 'c1' }];
// Une facture échue et impayée → enRetard > 0 (déclenche l'alerte) + apparaît dans « Factures à encaisser ».
const FACTURE_RETARD = {
  id: 'f1', numero: 'F-2020-001', clientId: 'c1', chantierId: 'ch1',
  statut: 'envoyee', montantHT: 920, montantTTC: 1000, montantPaye: 0,
  dateEmission: '2020-01-01', dateEcheance: '2020-02-01',
};

function renderFinances() {
  return renderWithApp(
    <Finances factures={[FACTURE_RETARD]} onSave={vi.fn()} clients={CLIENTS} chantiers={CHANTIERS}
      devis={[]} parametres={{ employes: [] }} periodeGlobale="mois" pointages={[]} />,
    { pointages: [], periodeGlobale: 'mois', setPeriodeGlobale: vi.fn(), ouvrirMenu: vi.fn() },
  );
}

describe('Finances mobile — soin (375px)', () => {
  it('doublon « FINANCES / 03 » supprimé (fil d\'Ariane = « FINANCES »)', () => {
    setLargeur(375);
    renderFinances();
    expect(screen.getByRole('heading', { name: 'Finances' })).toBeInTheDocument();
    expect(screen.queryByText(/FINANCES\s*\/\s*03/)).toBeNull();
    // Le fil d'Ariane mobile affiche bien « FINANCES » seul.
    expect(screen.getAllByText('FINANCES').length).toBeGreaterThan(0);
  });

  it('KPI blancs sauf l\'alerte EN RETARD (une seule couleur d\'alerte)', () => {
    setLargeur(375);
    renderFinances();
    const factureTtc = screen.getByTestId('hero-kpi-facturé-ttc').children[1];
    expect(factureTtc.style.color).toBe('rgb(255, 255, 255)');   // blanc
    const enRetard = screen.getByTestId('hero-kpi-en-retard-·-à-ce-jour').children[1];
    expect(enRetard.style.color).toBe('rgb(255, 122, 107)');     // #FF7A6B (alerte active)
  });

  it('carte de liste « Factures à encaisser » BLANCHE en mobile', () => {
    setLargeur(375);
    renderFinances();
    const entete = screen.getByText(/Factures à encaisser/);
    const carte = entete.parentElement;
    expect(carte.style.background).toBe('rgb(255, 255, 255)');
  });
});

describe('Finances desktop — non-régression (1200px)', () => {
  it('« FINANCES / 03 » présent (inchangé)', () => {
    setLargeur(1200);
    renderFinances();
    expect(screen.getAllByText(/FINANCES\s*\/\s*03/).length).toBeGreaterThan(0);
  });

  it('cartes de liste NON blanches en desktop (surface-glass conservée)', () => {
    setLargeur(1200);
    renderFinances();
    const carte = screen.getByText(/Factures à encaisser/).parentElement;
    // jsdom ne matérialise pas var(--surface-glass) dans .style.background (→ ''),
    // ce qui suffit à prouver l'absence du fond blanc mobile (#fff → rgb(255,255,255)).
    expect(carte.style.background).not.toBe('rgb(255, 255, 255)');
  });
});

describe('Factures mobile — recherche + 2 filtres à 46px (375px)', () => {
  const renderFactures = () => renderWithApp(
    <Factures factures={[]} onSave={vi.fn()} clients={CLIENTS} chantiers={CHANTIERS}
      devis={[]} parametres={{ employes: [] }} periodeGlobale="mois" hideHeader />,
    { pointages: [] },
  );

  it('recherche pleine largeur à 46px', () => {
    setLargeur(375);
    renderFactures();
    const input = screen.getByPlaceholderText(/Rechercher/);
    expect(input.style.height).toBe('46px');
    expect(input.style.width).toBe('100%');
  });

  it('les 2 filtres (statut, type) sont à 46px et de largeur égale (flex:1)', () => {
    setLargeur(375);
    renderFactures();
    const selects = document.querySelectorAll('select');
    // Les deux premiers <select> de la barre = statut + type.
    const [statut, type] = selects;
    expect(statut.style.height).toBe('46px');
    expect(type.style.height).toBe('46px');
    expect(statut.style.flex).toBe('1');
    expect(type.style.flex).toBe('1');
  });
});
