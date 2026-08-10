/**
 * Design v1 — page CALCULS, LOT 1 : coquille hero + 8 onglets + onglet Pricing devis.
 * ⚠ MONEY-CRITICAL : la page calcule en direct PV HT, marges, TVA 8.1%, coût total, TTC.
 *   ZÉRO calcul touché — rhabillage pur (JSX + styles). Les 7 autres onglets gardent leur
 *   rendu (helpers partagés Card/Stat/Field non modifiés).
 *
 * Preuve RTL RÉELLE (vrai CalculsPage via renderWithApp) :
 *   1. le hero affiche les 8 onglets ; ☰ appelle ouvrirMenu ;
 *   2. bascule d'onglet : la ligne mono contextuelle change, le contenu Pricing disparaît ;
 *   3. onglet Pricing : poste + PV HT/Marge + 4 résultats + marge brute globale aux vraies valeurs ;
 *   4. saisir une valeur recalcule (coût total) ; « Ajouter un poste » ajoute un poste.
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

const TABS = ['Pricing devis', 'Marge / Marque', 'CHR', 'Durée chantier',
  'Pilotage EVM', 'Trésorerie', 'Seuil rentabilité', 'Score client'];

function renderCalculs(over = {}) {
  return renderWithApp(<CalculsPage />, { ouvrirMenu: over.ouvrirMenu || vi.fn(), ...over.ctx });
}

describe('HERO — 8 onglets + ☰', () => {
  it('affiche les 8 onglets calculateurs et le titre « Calculs métier »', () => {
    renderCalculs();
    const hero = within(screen.getByTestId('hero-calculs'));
    TABS.forEach(label => {
      expect(hero.getByRole('button', { name: new RegExp(label.replace('/', '\\/')) })).toBeInTheDocument();
    });
    expect(hero.getByRole('heading', { name: /Calculs métier/ })).toBeInTheDocument();
  });

  it('le bouton ☰ du hero appelle ouvrirMenu', () => {
    const ouvrirMenu = vi.fn();
    renderCalculs({ ouvrirMenu });
    fireEvent.click(within(screen.getByTestId('hero-calculs')).getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });
});

describe('BASCULE d\'onglet — ligne mono + contenu', () => {
  it('cliquer « Marge / Marque » change la ligne mono et masque le contenu Pricing', () => {
    renderCalculs();
    expect(screen.getByText(/DÉCOMPOSITION PAR POSTE/)).toBeInTheDocument();
    expect(screen.getByText('Pricing de devis')).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('hero-calculs')).getByRole('button', { name: /Marge \/ Marque/ }));
    expect(screen.getByText(/MARGE · MARQUE/)).toBeInTheDocument();
    expect(screen.queryByText('Pricing de devis')).toBeNull();
  });
});

describe('ONGLET PRICING — poste + résultats (vraies valeurs)', () => {
  it('affiche le poste par défaut, PV HT / Marge et les 4 résultats', () => {
    renderCalculs();
    expect(screen.getByDisplayValue('Faux-plancher technique h=200mm')).toBeInTheDocument();
    expect(screen.getByText(/PV HT/)).toBeInTheDocument();
    // Coût total = 300×110×1.20 + 300×0.35×45 = 44'325.00 (valeur exacte, stable)
    expect(screen.getByText("CHF 44'325.00")).toBeInTheDocument();
    // Les 4 cartes de résultats + la marge brute globale
    ['Coût total', 'Total HT', 'TVA 8.1%', 'Total TTC', 'Marge brute globale'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument());
  });

  it('modifier la quantité recalcule le coût total (calcul inchangé)', () => {
    renderCalculs();
    expect(screen.getByText("CHF 44'325.00")).toBeInTheDocument();
    // 1er spinbutton = Quantité → 600 : coût total = 600×110×1.20 + 600×0.35×45 = 88'650.00
    const spins = screen.getAllByRole('spinbutton');
    fireEvent.change(spins[0], { target: { value: '600' } });
    expect(screen.getByText("CHF 88'650.00")).toBeInTheDocument();
    expect(screen.queryByText("CHF 44'325.00")).toBeNull();
  });

  it('« Ajouter un poste » ajoute un second poste', () => {
    renderCalculs();
    expect(screen.getByText('Poste 1')).toBeInTheDocument();
    expect(screen.queryByText('Poste 2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un poste/ }));
    expect(screen.getByText('Poste 2')).toBeInTheDocument();
  });
});
