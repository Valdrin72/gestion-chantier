/**
 * Design v1 — page Calculs, LOT 2 : modernisation des briques partagées
 * (Card/CardHeader/Field/Grid/Stat) + onglets Marge/Marque, CHR, Seuil rentabilité.
 * ⚠ MONEY-CRITICAL : calculateurs de marge/coefficient, coût horaire, seuil de rentabilité.
 *   ZÉRO calcul touché — rhabillage pur (JSX + styles).
 *
 * Preuve RTL RÉELLE (vrai CalculsPage via renderWithApp) :
 *   1. onglet Marge : taux marque/marge + coefficient de vente + PV recommandé (vraies valeurs) ;
 *      saisir un coût recalcule ;
 *   2. onglet CHR : coût total + CHR + coût journalier (vraies valeurs) ;
 *   3. onglet Seuil : seuil de rentabilité + position (vraies valeurs) ;
 *   4. non-régression : Pricing (lot 1) reste correct ; un onglet non-encore-habillé
 *      (Trésorerie) se rend sans planter.
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

describe('ONGLET MARGE / MARQUE — vraies valeurs + recalcul', () => {
  it('affiche marque/marge observées et le coefficient de vente', () => {
    renderCalculs();
    goTo('Marge / Marque');
    expect(screen.getByText('Marge vs Marque')).toBeInTheDocument();
    // Coût 100 / PV 140 → marque = 40/140 = 28.6% ; marge = 40/100 = 40.0%
    expect(screen.getByText('28.6%')).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();
    // Marque cible 28% → coefficient k = 1/(1-0.28) = 1.3889
    expect(screen.getByText('1.3889')).toBeInTheDocument();
  });

  it('modifier le coût recalcule la marge observée', () => {
    renderCalculs();
    goTo('Marge / Marque');
    expect(screen.getByText('40.0%')).toBeInTheDocument();
    // 1er spinbutton = Coût → 70 : marge = (140-70)/70 = 100.0%
    const spins = screen.getAllByRole('spinbutton');
    fireEvent.change(spins[0], { target: { value: '70' } });
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });
});

describe('ONGLET CHR — coût horaire (vraies valeurs)', () => {
  it('affiche coût total annuel, CHR et coût journalier', () => {
    renderCalculs();
    goTo('CHR');
    expect(screen.getByText('Coût Horaire Réel (CHR)')).toBeInTheDocument();
    expect(screen.getByText('CHR (par heure productive)')).toBeInTheDocument();
    expect(screen.getByText('Coût journalier (8 h)')).toBeInTheDocument();
    // Salaire 84000 : brut13 = 91000, charges 16% = 14560, +indirects 3000 → total 108560
    expect(screen.getByText("CHF 108'560.00")).toBeInTheDocument();
  });
});

describe('ONGLET SEUIL — seuil de rentabilité (vraies valeurs)', () => {
  it('affiche le seuil et la position vs seuil', () => {
    renderCalculs();
    goTo('Seuil rentabilité');
    expect(screen.getByText('Seuil de rentabilité')).toBeInTheDocument();
    // Fixe 600000 / MB 28% = 2'142'857.14
    expect(screen.getByText("CHF 2'142'857.14")).toBeInTheDocument();
    expect(screen.getByText('Position vs seuil')).toBeInTheDocument();
  });
});

describe('NON-RÉGRESSION — Pricing (lot 1) + onglet non-habillé', () => {
  it('l\'onglet Pricing reste correct après modernisation des briques', () => {
    renderCalculs();
    // Pricing est l'onglet par défaut
    expect(screen.getByText('Pricing de devis')).toBeInTheDocument();
    expect(screen.getByText("CHF 44'325.00")).toBeInTheDocument();
  });

  it('l\'onglet Trésorerie (non-habillé, lot 3) se rend sans planter', () => {
    renderCalculs();
    goTo('Trésorerie');
    expect(screen.getByText(/Trésorerie — DSO, BFR/)).toBeInTheDocument();
    // DSO 180000/120000×30 = 45 jours
    expect(screen.getByText('45 jours')).toBeInTheDocument();
  });
});
