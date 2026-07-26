/**
 * Lot 2d-1 — la marge affichée dans Finances = celle de l'Accueil (source unique).
 * Accueil ET Finances appellent le MÊME helper margePortefeuille → même chiffre.
 * MORDANT : le test échoue si Finances (ou l'Accueil) recalcule autrement.
 */
import { describe, it, expect } from 'vitest';
import { margePortefeuille, margeMoyennePonderee, calculerCoutsChantier } from '../donnees';

const EMP = [{ id: 1, nom: 'A', tarifJour: 400, tarifDejaCharge: true }];
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
const LOC = [];
const DEVIS = [
  { id: 'dA', montantHT: 100000, statut: 'accepté' }, // gros chantier
  { id: 'dB', montantHT: 5000,   statut: 'accepté' }, // petit chantier
];
const CH_A = { id: 'A', statut: 'en cours', nombreJours: 100, devisId: 'dA' };
const CH_B = { id: 'B', statut: 'en cours', nombreJours: 100, devisId: 'dB', materielReel: 8000 }; // à perte
const POINTAGES = [
  { id: 'pA', date: '2025-06-02', employeId: 1, repartitions: [{ chantierId: 'A', categorie: 'production', heures: 8 }] },
  { id: 'pB', date: '2025-06-03', employeId: 1, repartitions: [{ chantierId: 'B', categorie: 'production', heures: 8 }] },
];
const CHANTIERS = [CH_A, CH_B];

describe('margePortefeuille — source unique Accueil = Finances', () => {
  it('MORDANT : Finances affiche EXACTEMENT le chiffre de référence (même formule, mêmes moteurs)', () => {
    // Recette de référence (celle de l'Accueil) via les VRAIES fonctions publiques :
    const coutsList = CHANTIERS
      .filter(c => c.archive !== true)
      .map(c => calculerCoutsChantier(c, EMP, LOC, CFG, DEVIS, POINTAGES))
      .filter(r => r && r.montantTotal > 0 && r.totalCoutsReel > 0 && !r.donneesIncompletes);
    const reference = margeMoyennePonderee(coutsList);

    // Ce que Finances (et l'Accueil) affichent réellement :
    const finances = margePortefeuille(CHANTIERS, EMP, LOC, CFG, DEVIS, POINTAGES).pct;

    expect(finances).toBe(reference);            // même chiffre, à l'unité près
    expect(Math.round(finances)).toBe(92);       // pondérée : le gros chantier domine
  });

  it('MORDANT pondération : le petit chantier à perte ne fait PAS chuter la moyenne (≠ moyenne simple)', () => {
    const pct = margePortefeuille(CHANTIERS, EMP, LOC, CFG, DEVIS, POINTAGES).pct;
    // Moyenne SIMPLE des % aurait donné ≈ (99.6 − 68) / 2 ≈ 16 % → la pondérée est bien plus haute.
    expect(Math.round(pct)).toBeGreaterThan(80);
    expect(Math.round(pct)).not.toBe(16);
  });

  it('compte les chantiers par tranche (sain / limite / danger) sur la même source', () => {
    const m = margePortefeuille(CHANTIERS, EMP, LOC, CFG, DEVIS, POINTAGES);
    expect(m.nbAnalyses).toBe(2);
    expect(m.nbVert).toBe(1);    // le gros chantier ≥ 20 %
    expect(m.nbDanger).toBe(1);  // le petit à perte < 15 %
    expect(m.nbLimite).toBe(0);
  });

  it('CAS LIMITE : aucun chantier exploitable → pct null (pas de NaN), compteurs à 0', () => {
    const vide = margePortefeuille([], EMP, LOC, CFG, DEVIS, POINTAGES);
    expect(vide.pct).toBeNull();
    expect(Number.isNaN(vide.pct)).toBe(false);
    expect(vide.nbAnalyses).toBe(0);
    expect(vide.nbVert + vide.nbLimite + vide.nbDanger).toBe(0);

    // Chantiers présents mais sans coûts saisis → également null, jamais NaN.
    const sansCouts = margePortefeuille([{ id: 'X', statut: 'en cours', devisId: 'dA', nombreJours: 10 }], EMP, LOC, CFG, DEVIS, []);
    expect(sansCouts.pct).toBeNull();
  });
});
