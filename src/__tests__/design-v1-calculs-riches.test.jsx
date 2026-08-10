/**
 * Design v1 — page Calculs, LOT 3/3 : onglets riches Durée / EVM / Trésorerie / Score client.
 * ⚠ MONEY-CRITICAL : coefficients de durée, indices EVM (CPI/SPI/EAC), trésorerie (DSO/BFR/
 *   intérêts), score client. ZÉRO calcul touché — rhabillage pur (JSX + styles).
 *
 * Preuve RTL RÉELLE (vrai CalculsPage via renderWithApp) :
 *   1. Durée : durée totale + toggle coefficient recalcule la productivité ajustée ;
 *   2. EVM : CPI/SPI + bandeau de statut (CRITIQUE avec les valeurs par défaut) ;
 *   3. Trésorerie : DSO + BFR aux vraies valeurs ;
 *   4. Score client : score + catégorie ; ajouter un paiement ajoute une ligne.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import CalculsPage from '../pages/CalculsPage';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

function renderCalculs() {
  return renderWithApp(<CalculsPage />, { ouvrirMenu: vi.fn() });
}
const goTo = label => fireEvent.click(within(screen.getByTestId('hero-calculs')).getByRole('button', { name: new RegExp(label.replace('/', '\\/')) }));

describe('ONGLET DURÉE — toggle coefficient recalcule', () => {
  it('affiche la durée totale et un toggle recalcule la productivité ajustée', () => {
    renderCalculs();
    goTo('Durée chantier');
    expect(screen.getAllByText('Durée chantier').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Durée totale')).toBeInTheDocument();
    // Productivité baseline 70, aucun coeff → 70.0 u/j
    expect(screen.getByText('70.0 u/j')).toBeInTheDocument();
    // Activer « Grande hauteur > 4 m » (×0.70) → 70×0.70 = 49.0 u/j
    fireEvent.click(screen.getByRole('button', { name: /Grande hauteur > 4 m/ }));
    expect(screen.getByText('49.0 u/j')).toBeInTheDocument();
  });
});

describe('ONGLET EVM — indices + bandeau de statut', () => {
  it('affiche CPI/SPI et le bandeau CRITIQUE (valeurs par défaut)', () => {
    renderCalculs();
    goTo('Pilotage EVM');
    expect(screen.getByText(/EVM — Pilotage chantier/)).toBeInTheDocument();
    // budget 50k, temps 50%, travaux 40%, AC 24k → PV 25k, EV 20k
    // CPI = 20k/24k = 0.83 ; SPI = 20k/25k = 0.80 → CPI<0.9 ⇒ CRITIQUE
    expect(screen.getByText('0.83')).toBeInTheDocument();
    expect(screen.getByText('0.80')).toBeInTheDocument();
    expect(screen.getByText('CRITIQUE')).toBeInTheDocument();
  });
});

describe('ONGLET TRÉSORERIE — DSO + BFR', () => {
  it('affiche le DSO et le BFR aux vraies valeurs', () => {
    renderCalculs();
    goTo('Trésorerie');
    // DSO = 180000/120000×30 = 45 jours
    expect(screen.getByText('45 jours')).toBeInTheDocument();
    // BFR = 180000 + 15000 + 50000 − 60000 − 30000 = 155000
    expect(screen.getByText("CHF 155'000.00")).toBeInTheDocument();
  });
});

describe('ONGLET SCORE CLIENT — score + ajout de ligne', () => {
  it('affiche le score et la catégorie ; ajouter un paiement ajoute une ligne', () => {
    renderCalculs();
    goTo('Score client');
    expect(screen.getAllByText('Score client').length).toBeGreaterThanOrEqual(1);
    // 4 paiements par défaut → score 83/100, catégorie Fiable
    expect(screen.getByText('83 / 100')).toBeInTheDocument();
    expect(screen.getByText('Fiable')).toBeInTheDocument();
    // 4 lignes × 2 champs = 8 spinbuttons ; ajouter → 10
    expect(screen.getAllByRole('spinbutton')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un paiement/ }));
    expect(screen.getAllByRole('spinbutton')).toHaveLength(10);
  });
});
