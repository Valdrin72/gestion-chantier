/**
 * Design v1 — page Rapports / Analyse / vue Rentabilité : FINITION du bloc « Marges par
 * chantier » (Marges.js — les 4 cartes gradient passent en cartes v1 sobres).
 * ⚠ MONEY-CRITICAL : CA signé, coûts réels, marge totale/moyenne, marges par chantier.
 *   ZÉRO calcul touché — rhabillage pur (JSX + styles).
 *
 * Preuve RTL RÉELLE (vrai composant Marges via renderWithApp) :
 *   1. les 4 indicateurs s'affichent aux VRAIES valeurs (CA 80'000, coûts 49'000,
 *      marge 31'000, moyenne 38.8%) + badge « 1 critique » ;
 *   2. la légende des seuils s'affiche ;
 *   3. le tableau par chantier affiche les marges (50% / 5%) et la ligne TOTAL.
 */
import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Analyse from '../Analyse';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const ANNEE = new Date().getFullYear();
const PARAMETRES = {
  employes: [], localites: [], typesTravaux: [],
  parametres: { tauxTVA: 8.1, tauxFraisGeneraux: 12, tauxChargesSociales: 25, tauxImpots: 15 },
};
const DEVIS = [
  { id: 'dv1', montantHT: 60000, statut: 'Accepté', clientId: 'cl1' },
  { id: 'dv2', montantHT: 20000, statut: 'Accepté', clientId: 'cl1' },
];
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' }];
// Rentable (marge 50%) + Critique (marge 5%) → badge « 1 critique » + les 2 états au tableau.
const CHANTIERS = [
  { id: 'c1', nom: 'Chantier Sain', statut: 'En cours', clientId: 'cl1', devisId: 'dv1',
    dateDebut: `${ANNEE}-02-01`, nombreJours: 10, materielReel: 30000, journal: [], equipe: [] },
  { id: 'c2', nom: 'Chantier Serré', statut: 'En cours', clientId: 'cl1', devisId: 'dv2',
    dateDebut: `${ANNEE}-03-01`, nombreJours: 5, materielReel: 19000, journal: [], equipe: [] },
];

// Rendu via le VRAI chemin : Analyse → vue Rentabilité (défaut) → sous-section Marges.
function renderMarges() {
  return renderWithApp(
    <Analyse chantiers={CHANTIERS} clients={CLIENTS} devis={DEVIS}
      parametres={PARAMETRES} setParametres={() => {}} factures={[]} periodeGlobale="annee" />,
    { pointages: [] },
  );
}

describe('4 INDICATEURS — vraies valeurs + badge critique', () => {
  it('affiche CA signé, coûts réels, marge totale et marge moyenne', () => {
    renderMarges();
    expect(screen.getByText('CA SIGNÉ TOTAL')).toBeInTheDocument();
    // « COÛTS RÉELS » existe aussi en en-tête du tableau → au moins 2 occurrences
    expect(screen.getAllByText('COÛTS RÉELS').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('MARGE TOTALE')).toBeInTheDocument();
    expect(screen.getByText('MARGE MOYENNE')).toBeInTheDocument();
    // Valeurs réelles : 60k+20k=80'000 · 30k+19k=49'000 · 31'000 · 31/80=38.8%
    expect(screen.getAllByText("CHF 80'000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CHF 49'000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CHF 31'000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('38.8%').length).toBeGreaterThanOrEqual(1);
    // Badge critique (1 chantier < 15%)
    expect(screen.getByText('1 critique')).toBeInTheDocument();
  });
});

describe('LÉGENDE des seuils', () => {
  it('affiche les 4 niveaux', () => {
    renderMarges();
    expect(screen.getByText('Rentable ≥ 20%')).toBeInTheDocument();
    expect(screen.getByText('Correct 15–20%')).toBeInTheDocument();
    expect(screen.getByText('Critique < 15%')).toBeInTheDocument();
    expect(screen.getByText('Données manquantes')).toBeInTheDocument();
  });
});

describe('TABLEAU — marges par chantier + ligne TOTAL', () => {
  it('affiche les chantiers, leurs marges (50% / 5%) et le TOTAL', () => {
    renderMarges();
    expect(screen.getAllByText('Chantier Sain').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Chantier Serré').length).toBeGreaterThan(0);
    // Marges par chantier (badge statutMarge)
    expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('5%').length).toBeGreaterThanOrEqual(1);
    // Ligne TOTAL
    expect(screen.getByText('TOTAL (2 chantiers)')).toBeInTheDocument();
  });

  it('reste rendu au sein de la vue Rentabilité v1 (cascade présente à côté)', () => {
    renderMarges();
    // Cohérence : le bloc Marges cohabite avec la cascade (déjà v1) dans la même vue
    expect(screen.getByText('Cascade de rentabilité')).toBeInTheDocument();
    expect(screen.getByText('Marges par chantier')).toBeInTheDocument();
  });
});
