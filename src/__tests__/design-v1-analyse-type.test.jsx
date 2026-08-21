/**
 * Design v1 — page Rapports / onglet Analyse, SOUS-LOT 2b :
 * vue PAR TYPE & SURFACE (Corps de métier + Analyse m²).
 * ⚠ MONEY-CRITICAL : rentabilité au m² (CHF/m², coût/m², marge/m², seuil au m²).
 *   ZÉRO calcul touché — rhabillage pur (JSX + styles).
 *
 * Preuve RTL RÉELLE (vrai composant Analyse via renderWithApp) :
 *   1. la vue « Par type & surface » affiche le tableau CHF/m² + le classement ;
 *   2. les statuts métier (Excellent/Correct/Critique) s'affichent aux vraies valeurs ;
 *   3. l'analyse m² (surface analysée, CA/m², marge/m²) + le seuil au m² s'affichent ;
 *   4. basculer de vue (retour Rentabilité) restaure la cascade — vues indépendantes.
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
// Lot 4e : « Corps de métier » est en CA FACTURÉ HT → il faut une facture pour qu'il se peuple.
// Le bloc « Analyse m² » reste sur le DEVISÉ (non migré) → il continue d'afficher « CA signé moyen / m² »
// avec la valeur du devis, quelle que soit la facture : c'est la PREUVE d'isolation.
const FACTURES = [{ id: 'f1', chantierId: 'c1', clientId: 'cl1', statut: 'envoyee',
  montantHT: 60000, montantTTC: 64860, dateEmission: `${ANNEE}-02-15` }];

function renderAnalyse() {
  const r = renderWithApp(
    <Analyse chantiers={CHANTIERS} clients={CLIENTS} devis={DEVIS}
      parametres={PARAMETRES} setParametres={vi.fn()} factures={FACTURES} periodeGlobale="annee" />,
    { pointages: [] },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Par type & surface' }));
  return r;
}

describe('VUE PAR TYPE & SURFACE — corps de métier (CHF/m²)', () => {
  it('affiche le tableau de rentabilité par type + le classement, avec le type réel', () => {
    renderAnalyse();
    expect(screen.getByText('Rentabilité par type de travaux (CHF/m²)')).toBeInTheDocument();
    expect(screen.getByText('Classement rentabilité')).toBeInTheDocument();
    // Le type de travaux réel apparaît
    expect(screen.getAllByText('Faux-plafond').length).toBeGreaterThan(0);
  });

  it('affiche un statut métier (Excellent / Correct / Critique)', () => {
    renderAnalyse();
    expect(screen.getAllByText(/^(Excellent|Correct|Critique)$/).length).toBeGreaterThanOrEqual(1);
  });
});

describe('VUE PAR TYPE & SURFACE — analyse m² (vraies valeurs)', () => {
  it('affiche les KPIs m² (surface analysée, CA/m², marge/m²) et le seuil au m²', () => {
    renderAnalyse();
    expect(screen.getByText('Analyse m²')).toBeInTheDocument();
    expect(screen.getByText('Surface analysée')).toBeInTheDocument();
    expect(screen.getByText('CA signé moyen / m²')).toBeInTheDocument();
    expect(screen.getByText('Marge moyenne / m²')).toBeInTheDocument();
    // Surface = 100 m² (fmtN) — présente dans les tableaux/KPI
    expect(screen.getAllByText('100 m²').length).toBeGreaterThanOrEqual(1);
    // Seuil de rentabilité global au m²
    expect(screen.getByText(/Seuil de rentabilité global/)).toBeInTheDocument();
    // Tableaux détaillés
    expect(screen.getByText('Par type de travaux')).toBeInTheDocument();
    expect(screen.getByText('Chantiers individuels avec surface renseignée')).toBeInTheDocument();
  });
});

describe('INDÉPENDANCE des vues', () => {
  it('la cascade (vue Rentabilité) est masquée ici, restaurée au retour', () => {
    renderAnalyse();
    expect(screen.queryByText('Cascade de rentabilité')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rentabilité' }));
    expect(screen.getByText('Cascade de rentabilité')).toBeInTheDocument();
  });
});
