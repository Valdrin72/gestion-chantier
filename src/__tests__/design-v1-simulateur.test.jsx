/**
 * Design v1 — page Rapports / onglet Simulateur (SimulateurCroissance.js).
 * ⚠ MONEY-CRITICAL : projection d'embauche (CA additionnel, marge nette, break-even,
 *   coût chargé). ZÉRO calcul touché — rhabillage pur (JSX + styles).
 *
 * Preuve RTL RÉELLE (vrai composant SimulateurCroissance via renderWithApp) :
 *   1. la base actuelle affiche ses 5 cartes aux vraies valeurs ;
 *   2. les 4 curseurs se règlent ; bouger un curseur recalcule le résultat ;
 *   3. le verdict (rentable/à surveiller) + les 4 indicateurs + le détail du calcul s'affichent.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import SimulateurCroissance from '../SimulateurCroissance';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const ANNEE = new Date().getFullYear();
const PARAMETRES = {
  employes: [{ id: 'e1', nom: 'A', actif: true, tarifJour: 500 }],
  localites: [], typesTravaux: [],
  parametres: { tauxFraisGeneraux: 12, tauxChargesSociales: 25, tauxImpots: 15 },
};
const DEVIS = [{ id: 'dv1', montantHT: 60000, statut: 'Accepté', clientId: 'cl1' }];
const CHANTIERS = [{
  id: 'c1', nom: 'Chantier Un', statut: 'Terminé', clientId: 'cl1', devisId: 'dv1',
  dateDebut: `${ANNEE}-02-01`, nombreJours: 10, journal: [], equipe: [],
}];

function renderSimu() {
  return renderWithApp(
    <SimulateurCroissance chantiers={CHANTIERS} devis={DEVIS} factures={[]} parametres={PARAMETRES} />,
    { pointages: [] },
  );
}

describe('BASE ACTUELLE — 5 cartes (vraies valeurs)', () => {
  it('affiche les 5 indicateurs de base', () => {
    renderSimu();
    // Le libellé porte désormais le périmètre global explicite (« · basé sur tout l'historique »).
    expect(screen.getByText(/Base actuelle \(données réelles\)/)).toBeInTheDocument();
    expect(screen.getByText('Employés actifs')).toBeInTheDocument();
    expect(screen.getByText('CA annuel')).toBeInTheDocument();
    expect(screen.getByText('Marge nette moy.')).toBeInTheDocument();
    expect(screen.getByText('Tarif jour moyen')).toBeInTheDocument();
    expect(screen.getByText("Taux d'utilisation")).toBeInTheDocument();
    // Tarif jour moyen = 500 (employé actif) → "CHF 500"
    expect(screen.getByText('CHF 500')).toBeInTheDocument();
  });
});

describe('PARAMÈTRES — 4 curseurs + recalcul', () => {
  it('affiche les 4 curseurs et bouger le nombre d\'embauches recalcule le résultat', () => {
    renderSimu();
    expect(screen.getByText("Nombre d'embauches")).toBeInTheDocument();
    expect(screen.getByText('Tarif jour (coût chargé)')).toBeInTheDocument();
    expect(screen.getByText("Taux d'utilisation cible")).toBeInTheDocument();
    expect(screen.getByText('Frais généraux')).toBeInTheDocument();

    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(4);

    // Le détail « CA additionnel brut » reflète le calcul courant.
    const avant = screen.getByText('CA additionnel brut').closest('div').textContent;
    // Bouger le nombre d'embauches (1er curseur) → 3 employés → CA additionnel change.
    fireEvent.change(sliders[0], { target: { value: '3' } });
    const apres = screen.getByText('CA additionnel brut').closest('div').textContent;
    expect(apres).not.toBe(avant);
  });
});

describe('RÉSULTAT — verdict + indicateurs + détail', () => {
  it('affiche le verdict, les 4 indicateurs et le détail du calcul', () => {
    renderSimu();
    // Verdict (rentable ou à surveiller)
    expect(screen.getByText(/Opération rentable|Rentabilité à surveiller/)).toBeInTheDocument();
    expect(screen.getByText('Marge nette après frais généraux')).toBeInTheDocument();
    // 4 indicateurs de simulation
    expect(screen.getByText('CA additionnel')).toBeInTheDocument();
    expect(screen.getByText('Marge nette générée')).toBeInTheDocument();
    expect(screen.getByText('Break-even')).toBeInTheDocument();
    expect(screen.getByText('CA total entreprise')).toBeInTheDocument();
    // Détail du calcul
    expect(screen.getByText('Détail du calcul')).toBeInTheDocument();
    expect(screen.getByText('CA additionnel brut')).toBeInTheDocument();
    expect(screen.getByText('Marge nette projetée')).toBeInTheDocument();
  });
});
