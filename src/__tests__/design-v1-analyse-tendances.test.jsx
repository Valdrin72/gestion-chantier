/**
 * Design v1 — page Rapports / onglet Analyse, SOUS-LOT 2c-1 :
 * vue TENDANCES & OBJECTIFS — Projections + Objectifs (Analyse.js) + Rapport hebdo (Rapport.js).
 * ⚠ MONEY-CRITICAL : projections CA, scénarios de marge nette, objectifs annuels, rapport
 *   hebdo (montants). ZÉRO calcul touché — rhabillage pur (JSX + styles).
 *   Le bloc Statistiques.js reste intact (sous-lot 2c-2).
 *
 * Preuve RTL RÉELLE (vrai composant Analyse via renderWithApp) :
 *   1. Projections : CA annuel + scénarios pessimiste/réaliste/optimiste aux vraies valeurs ;
 *   2. Objectifs : saisie + barres de progression + rentabilité par chantier (vue d'ensemble) ;
 *   3. Rapport hebdo : en-tête + chantiers en cours + paiements de la semaine ;
 *   4. indépendance : la cascade (vue Rentabilité) n'est pas affichée ici.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
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
  employes: [], localites: [], typesTravaux: [{ nom: 'Faux-plafond' }],
  parametres: { tauxTVA: 8.1, tauxFraisGeneraux: 12, tauxChargesSociales: 25, tauxImpots: 15 },
};
const DEVIS = [{ id: 'dv1', montantHT: 60000, statut: 'Accepté', clientId: 'cl1' }];
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' }];
const CHANTIERS = [{
  id: 'c1', nom: 'Chantier Un', statut: 'En cours', clientId: 'cl1', devisId: 'dv1',
  dateDebut: `${ANNEE}-02-01`, nombreJours: 10, surface: 100, typesTravaux: ['Faux-plafond'],
  journal: [], equipe: [],
}];

// Lot 4d : projections/objectifs sont en CA FACTURÉ HT (annuel). Une facture 60'000 HT alimente les valeurs.
const FACTURES = [{ id: 'f1', chantierId: 'c1', clientId: 'cl1', statut: 'envoyee',
  montantHT: 60000, montantTTC: 64860, dateEmission: `${ANNEE}-02-15` }];

function renderTendances() {
  const r = renderWithApp(
    <Analyse chantiers={CHANTIERS} clients={CLIENTS} devis={DEVIS}
      parametres={PARAMETRES} setParametres={vi.fn()} factures={FACTURES} periodeGlobale="annee" />,
    { pointages: [] },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Tendances & objectifs' }));
  return r;
}

describe('PROJECTIONS — CA annuel + scénarios de marge', () => {
  it('affiche la projection annuelle et les 3 scénarios', () => {
    renderTendances();
    expect(screen.getByText(new RegExp(`Projections CA facturé — Année ${ANNEE}`))).toBeInTheDocument();
    expect(screen.getByText('Projection annuelle')).toBeInTheDocument();
    expect(screen.getByText('Projection marge nette annuelle')).toBeInTheDocument();
    expect(screen.getByText(/Pessimiste/)).toBeInTheDocument();
    expect(screen.getByText('Réaliste')).toBeInTheDocument();
    expect(screen.getByText(/Optimiste/)).toBeInTheDocument();
  });
});

describe('OBJECTIFS — saisie + progression + rentabilité vue d\'ensemble', () => {
  it('affiche la saisie, les barres de progression et la vue d\'ensemble', () => {
    renderTendances();
    expect(screen.getByText('Définir les objectifs annuels')).toBeInTheDocument();
    // Barres de progression (au moins une)
    expect(screen.getAllByText(/de l'objectif atteint/).length).toBeGreaterThanOrEqual(1);
    // Vue d'ensemble rentabilité par chantier + statuts
    expect(screen.getByText("Rentabilité par chantier — Vue d'ensemble")).toBeInTheDocument();
    expect(screen.getByText('Rentable')).toBeInTheDocument();
  });
});

describe('RAPPORT HEBDO — en-tête + tableaux', () => {
  it('affiche le rapport hebdomadaire, les chantiers en cours et les paiements', () => {
    renderTendances();
    expect(screen.getByText('Rapport Hebdomadaire')).toBeInTheDocument();
    expect(screen.getByText('Chantiers en cours')).toBeInTheDocument();
    expect(screen.getByText('Paiements de la semaine')).toBeInTheDocument();
    // Le chantier En cours du contexte apparaît dans le tableau
    expect(screen.getAllByText('Chantier Un').length).toBeGreaterThan(0);
  });
});

describe('INDÉPENDANCE des vues', () => {
  it('la cascade (vue Rentabilité) n\'est pas affichée dans Tendances & objectifs', () => {
    renderTendances();
    expect(screen.queryByText('Cascade de rentabilité')).toBeNull();
  });
});
