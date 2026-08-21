/**
 * Design v1 — page Rapports / onglet Analyse, SOUS-LOT 2d : vue CLIENTS
 * (Dérive devis + Top clients + classement). DERNIER sous-lot de l'onglet Analyse.
 * ⚠ MONEY-CRITICAL : dérive devis (devisé vs réel), marges par client, classement.
 *   ZÉRO calcul touché — rhabillage pur (JSX + styles).
 *
 * Preuve RTL RÉELLE (vrai composant Analyse via renderWithApp) :
 *   1. Dérive devis : intro + 4 indicateurs + type de travaux avec badge Sur/Sous-estimé ;
 *   2. Top clients : podium + statut de rentabilité ; classement complet en tableau ;
 *   3. valeurs réelles (CA client, marge %) affichées ;
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
const DEVIS = [{ id: 'dv1', montantHT: 60000, statut: 'Accepté', clientId: 'cl1', joursPrevu: 10 }];
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA', prenom: 'Jean' }];
// Chantier avec jours réels (journal) pour alimenter la dérive devis.
const CHANTIERS = [{
  id: 'c1', nom: 'Chantier Un', numero: 'CH-1', statut: 'Terminé', clientId: 'cl1', devisId: 'dv1',
  dateDebut: `${ANNEE}-02-01`, nombreJours: 10, surface: 100, typesTravaux: ['Faux-plafond'],
  journal: [{ date: `${ANNEE}-02-02`, employes: [{ heuresTravaillees: 8 }] }], equipe: [],
}];
// Lot 4e : « Top clients » est en CA FACTURÉ HT → il faut une facture (60'000). Le bloc « Dérive du
// devisé » reste sur le devisé (non migré) → ses indicateurs s'affichent quelle que soit la facture.
const FACTURES = [{ id: 'f1', chantierId: 'c1', clientId: 'cl1', statut: 'envoyee',
  montantHT: 60000, montantTTC: 64860, dateEmission: `${ANNEE}-02-15` }];

function renderClients() {
  const r = renderWithApp(
    <Analyse chantiers={CHANTIERS} clients={CLIENTS} devis={DEVIS}
      parametres={PARAMETRES} setParametres={vi.fn()} factures={FACTURES} periodeGlobale="annee" />,
    { pointages: [] },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clients' }));
  return r;
}

describe('DÉRIVE DEVIS — intro + indicateurs + types', () => {
  it('affiche l\'intro et les 4 indicateurs de dérive', () => {
    renderClients();
    expect(screen.getByText(/Sur quels types de travaux sous-estimes-tu/)).toBeInTheDocument();
    expect(screen.getByText('Types analysés')).toBeInTheDocument();
    expect(screen.getByText('Sous-estimés')).toBeInTheDocument();
    expect(screen.getByText('Plus grande dérive')).toBeInTheDocument();
    expect(screen.getByText('Perte de marge moy.')).toBeInTheDocument();
  });

  it('affiche un type de travaux avec ses métriques de dérive', () => {
    renderClients();
    expect(screen.getAllByText('Faux-plafond').length).toBeGreaterThan(0);
    expect(screen.getByText('Dérive durée')).toBeInTheDocument();
    expect(screen.getByText('Marge devisée')).toBeInTheDocument();
    expect(screen.getByText('Marge réelle')).toBeInTheDocument();
  });
});

describe('TOP CLIENTS — podium + classement (vraies valeurs)', () => {
  it('affiche le podium et le tableau de classement avec le client réel', () => {
    renderClients();
    expect(screen.getByText('Top clients par CA facturé')).toBeInTheDocument();
    expect(screen.getByText('1er')).toBeInTheDocument();
    // Le client réel (cl.nom) + son CA facturé (60 000)
    expect(screen.getAllByText('Dupont').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CHF 60'000/).length).toBeGreaterThan(0);
    // KPI clients (dont l'ex-violet « Marge moy. »)
    expect(screen.getByText('Marge moy.')).toBeInTheDocument();
    expect(screen.getByText('Meilleur CA facturé')).toBeInTheDocument();
  });
});

describe('INDÉPENDANCE des vues', () => {
  it('la cascade (vue Rentabilité) n\'est pas affichée dans Clients', () => {
    renderClients();
    expect(screen.queryByText('Cascade de rentabilité')).toBeNull();
  });
});
