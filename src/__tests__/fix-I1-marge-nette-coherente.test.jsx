/**
 * Fix I1 — clé de frais généraux erronée sur Statistiques.
 * Avant : Statistiques lisait `fraisGeneraux` (clé inexistante) → marge nette TOUJOURS à 12% en dur,
 * divergeant du Dashboard/ChantierDetail (qui lisent `tauxFraisGeneraux` via le moteur) dès que
 * les FG configurés ≠ 12%. Le même chantier affichait deux marges nettes différentes.
 *
 * Chemin RÉEL : le vrai composant Statistiques rendu avec des FG réglés à 15%, comparé au
 * margeNettePct du VRAI moteur calculerCoutsChantier (source du Dashboard/ChantierDetail).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';
import { calculerCoutsChantier } from '../donnees';
import Statistiques from '../Statistiques';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
// Pas de dateDebut + 'en cours' → toujours inclus dans la période (chantiersInPeriode).
const CHANTIER = {
  id: 'CH1', nom: 'Chantier Preuve', statut: 'en cours', nombreJours: 100,
  devisId: 'd1', clientId: 'cl1',
  journal: Array.from({ length: 5 }, (_, i) => ({
    date: `2026-03-0${i + 2}`, employes: [{ employeId: 1, heuresTravaillees: 8 }],
  })),
};
const DEVIS = { id: 'd1', numero: 'D-1', montantHT: 100_000, statut: 'Accepté', clientId: 'cl1' };
const POINTAGES = migrerJournalVersPointages([CHANTIER], [EMP]);

function render(fgPct) {
  const params = { employes: [EMP], localites: [], typesTravaux: [], zones: [], parametres: { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: fgPct } };
  // Oracle = ce que le Dashboard/ChantierDetail affichent (via le moteur), avec la MÊME config FG.
  const oracle = calculerCoutsChantier(CHANTIER, [EMP], [], params.parametres, [DEVIS], POINTAGES).margeNettePct;
  renderWithApp(
    <Statistiques chantiers={[CHANTIER]} clients={[{ id: 'cl1', nom: 'Client' }]} devis={[DEVIS]} parametres={params} periodeGlobale="annee" />,
    { chantiers: [CHANTIER], devis: [DEVIS], parametres: params, pointages: POINTAGES }
  );
  return oracle;
}

describe('Fix I1 — Statistiques et le moteur donnent la MÊME marge nette', () => {
  it('FG réglés à 15% → Statistiques affiche la marge nette du moteur (≈83%), pas 12% en dur', () => {
    const oracle = render(15);          // 5j×400=2000 de coûts, CA 100k, FG 15%
    // moteur : (100000 − 2000 − 100000×0.15) / 100000 = 83.0 %
    expect(oracle).toBeCloseTo(83, 1);
    // Statistiques affiche la MÊME valeur (bloc MARGE NETTE = `${margeNettePct}%`).
    expect(screen.getByText(`${oracle}%`)).toBeTruthy();
    // 🔴 MORDANT : avec l'ancienne clé (12% en dur), Statistiques aurait affiché 86% ≠ 83%.
    expect(screen.queryByText('86%')).toBeNull();
  });
});
