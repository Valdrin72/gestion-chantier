/**
 * Cohérence des périodes — LOT 1/7 : Rapports / Simulateur / Benchmark sont GLOBAUX par nature.
 * Décisions patron : (1) Rapports = vue annuelle → RETIRER le sélecteur de période trompeur du hero ;
 * (2) Simulateur → libellé « basé sur tout l'historique » ; (3) Benchmark → « tous les chantiers terminés ».
 * ⚠ ZÉRO chiffre changé : aucun calcul touché. Diff = retrait du sélecteur + 2 libellés.
 *
 * Preuve RTL RÉELLE (vrais composants via renderWithApp) :
 *   1. le hero RapportsPage ne contient AUCUN bouton Semaine/Mois/Année ;
 *   2. l'onglet Simulateur déclare son périmètre global ;
 *   3. l'onglet Benchmark déclare son périmètre global.
 * (Isolation : les autres pages gardent leur sélecteur — vérifié par la suite design-v1-finances/chantiers
 *  qui rend leurs heros avec sélecteur ; ici seul le hero Rapports perd le sien.)
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../../test-utils/renderWithApp.jsx';
import RapportsPage from '../RapportsPage.js';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })), auth: { getSession: vi.fn() } },
}));

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const ANNEE = new Date().getFullYear();
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' }];
const PARAMETRES = { employes: [{ id: 'e1', actif: true, tarifJour: 500 }], localites: [], typesTravaux: [],
  parametres: { tauxFraisGeneraux: 12, tauxChargesSociales: 25, tauxImpots: 15 } };
const DEVIS = [
  { id: 'dv1', montantHT: 60000, statut: 'Accepté', clientId: 'cl1' },
  { id: 'dv2', montantHT: 20000, statut: 'Accepté', clientId: 'cl1' },
];
const CHANTIERS = [
  { id: 'c1', nom: 'FP Un', statut: 'Terminé', clientId: 'cl1', devisId: 'dv1', dateDebut: `${ANNEE}-02-01`, nombreJours: 10, typesTravaux: ['Faux-plafond'], journal: [], equipe: [] },
  { id: 'c2', nom: 'Car Un', statut: 'Terminé', clientId: 'cl1', devisId: 'dv2', dateDebut: `${ANNEE}-03-01`, nombreJours: 5, materielReel: 18000, typesTravaux: ['Carrelage'], journal: [], equipe: [] },
];

function renderRapports() {
  return renderWithApp(
    <RapportsPage chantiers={CHANTIERS} clients={CLIENTS} devis={DEVIS} parametres={PARAMETRES}
      setParametres={() => {}} periodeGlobale="annee" naviguer={() => {}} factures={[]} />,
    { pointages: [] },
  );
}

describe('RAPPORTSPAGE — sélecteur de période retiré (vue globale annuelle)', () => {
  it('le hero se rend SANS bouton Semaine/Mois/Année', () => {
    renderRapports();
    expect(screen.getByTestId('hero-rapports')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Semaine$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Mois$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Année$/ })).toBeNull();
    // La ligne mono du hero ne montre plus de libellé période dynamique.
    expect(screen.getByText('· RAPPORTS / 12')).toBeInTheDocument();
  });
});

describe('SIMULATEUR / BENCHMARK — libellé de périmètre global', () => {
  it('Simulateur déclare « basé sur tout l\'historique »', () => {
    renderRapports();
    fireEvent.click(screen.getByRole('button', { name: /Simulateur/ }));
    expect(screen.getByText(/bas. sur tout l.historique/i)).toBeInTheDocument();
  });
  it('Benchmark déclare « tous les chantiers terminés · toutes périodes »', () => {
    renderRapports();
    fireEvent.click(screen.getByRole('button', { name: /Benchmark/ }));
    expect(screen.getByText(/Tous les chantiers termin.s · toutes p.riodes/i)).toBeInTheDocument();
  });
});
