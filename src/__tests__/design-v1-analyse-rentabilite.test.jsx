/**
 * Design v1 — page Rapports / onglet Analyse, SOUS-LOT 2a :
 * barre des 4 sous-onglets + vue RENTABILITÉ.
 * ⚠ MONEY-CRITICAL : cascade CA→marge nette, seuil, prévu/réel, coût horaire, masse
 *   salariale. ZÉRO calcul touché — rhabillage pur (JSX + styles).
 *
 * Preuve RTL RÉELLE (vrai composant Analyse via renderWithApp) :
 *   1. la barre des 4 sous-onglets s'affiche et bascule ;
 *   2. la vue Rentabilité affiche la cascade (CA total → MARGE NETTE) aux vraies valeurs ;
 *   3. le seuil de rentabilité + le tableau prévu vs réel s'affichent ;
 *   4. basculer de vue masque la cascade (les autres vues gardent leur rendu).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
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
const DEVIS = [{ id: 'dv1', montantHT: 60000, statut: 'Accepté', clientId: 'cl1' }];
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' }];
const CHANTIERS = [{
  id: 'c1', nom: 'Chantier Un', statut: 'En cours', clientId: 'cl1', devisId: 'dv1',
  dateDebut: `${ANNEE}-02-01`, nombreJours: 10, journal: [], equipe: [],
}];
// Lot 4d : la cascade est désormais en CA FACTURÉ HT → il faut une facture pour qu'elle affiche une
// valeur. On facture 60'000 HT → CA facturé = 60'000 (même chiffre qu'avant, mais base facturé).
const FACTURES = [{ id: 'f1', chantierId: 'c1', clientId: 'cl1', statut: 'envoyee',
  montantHT: 60000, montantTTC: 64860, dateEmission: `${ANNEE}-02-15` }];

function renderAnalyse(over = {}) {
  return renderWithApp(
    <Analyse chantiers={over.chantiers || CHANTIERS} clients={CLIENTS} devis={DEVIS}
      parametres={PARAMETRES} setParametres={vi.fn()} factures={over.factures || FACTURES} periodeGlobale="annee" />,
    { pointages: [], ...over.ctx },
  );
}

describe('BARRE des 4 sous-onglets + bascule', () => {
  it('affiche les 4 sous-onglets ; Rentabilité par défaut', () => {
    renderAnalyse();
    ['Rentabilité', 'Par type & surface', 'Tendances & objectifs', 'Clients'].forEach(l =>
      expect(screen.getByRole('button', { name: l })).toBeInTheDocument());
    // Vue Rentabilité active par défaut
    expect(screen.getByText('Cascade de rentabilité')).toBeInTheDocument();
  });

  it('basculer vers « Par type & surface » masque la cascade (autre vue conservée)', () => {
    renderAnalyse();
    expect(screen.getByText('Cascade de rentabilité')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Par type & surface' }));
    expect(screen.queryByText('Cascade de rentabilité')).toBeNull();
    // La vue Par type & surface est bien rendue (section Corps de métier)
    expect(screen.getByText('Corps de métier')).toBeInTheDocument();
  });
});

describe('VUE RENTABILITÉ — cascade + seuil + prévu/réel (vraies valeurs)', () => {
  it('la cascade affiche le CA total et la marge nette', () => {
    renderAnalyse();
    // Lignes de la cascade
    expect(screen.getByText("Chiffre d'affaires facturé")).toBeInTheDocument();
    expect(screen.getByText('= MARGE NETTE')).toBeInTheDocument();
    // CA facturé = facture 60 000 HT → "CHF 60'000" (fmtN, apostrophe suisse)
    expect(screen.getAllByText(/CHF 60'000/).length).toBeGreaterThan(0);
  });

  it('affiche le seuil de rentabilité et le tableau prévu vs réel', () => {
    renderAnalyse();
    expect(screen.getAllByText('Seuil de rentabilité').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('CA facturé actuel')).toBeInTheDocument();
    expect(screen.getByText('Écart au seuil')).toBeInTheDocument();
    expect(screen.getByText('Comparaison Devisé vs Réel par chantier')).toBeInTheDocument();
    // Le chantier apparaît dans le tableau prévu/réel
    expect(screen.getAllByText('Chantier Un').length).toBeGreaterThan(0);
  });

  it('affiche la masse salariale (Coût total RH + % du CA signé, ex-violet)', () => {
    renderAnalyse();
    fireEvent.click(screen.getByRole('button', { name: 'Rentabilité' })); // rester sur la vue
    expect(screen.getByText('Masse salariale totale')).toBeInTheDocument();
    expect(screen.getByText('Coût total RH')).toBeInTheDocument();
    expect(screen.getByText('% du CA facturé')).toBeInTheDocument();
  });
});
