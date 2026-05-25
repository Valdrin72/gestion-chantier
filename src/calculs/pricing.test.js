import { describe, it, expect } from 'vitest';
import { pricingPoste, calculerDevisGlobal } from './pricing.js';
import { POSTE_FAUX_PLANCHER_PICTET } from './__fixtures__/cyna.js';
import { CYNA_PARAMS } from './constants.js';

describe('pricingPoste', () => {
  it('exemple Pictet 300 m² — décomposition cohérente', () => {
    const r = pricingPoste(POSTE_FAUX_PLANCHER_PICTET);
    // Matériaux : 300 × 110 × 1.20 = 39 600
    expect(r.coutMat).toBeCloseTo(39_600, 0);
    // MO : 300 × 0.35 × 45 = 4 725
    expect(r.coutMO).toBeCloseTo(4_725, 0);
    expect(r.coutTotal).toBeCloseTo(44_325, 0);
    // Vente mat : 39 600 / (1 - 0.22) ≈ 50 769
    expect(r.pvMat).toBeCloseTo(50_769, 0);
    // Vente MO : 4 725 / (1 - 0.05) ≈ 4 974
    expect(r.pvMO).toBeCloseTo(4_974, 0);
    expect(r.pvHT).toBeCloseTo(55_743, 0);
    expect(r.margeBrute).toBeCloseTo(0.205, 2);
  });

  it('utilise les défauts CYNA si coefficients omis', () => {
    const r = pricingPoste({
      designation: 'Test', unite: 'm²', quantite: 100,
      coutMatUnit: 50, tempsH: 0.2, coutHMO: 45,
    });
    expect(r.coutMat).toBeCloseTo(100 * 50 * CYNA_PARAMS.COEFF_ACHAT_MAT, 0);
  });

  it('marge brute = marque cible quand composant unique (MO seule)', () => {
    const r = pricingPoste({
      designation: 'MO pure', unite: 'h', quantite: 10,
      coutMatUnit: 0, tempsH: 1, coutHMO: 45,
      coeffMat: 1, marqueMatPct: 0, marqueMOPct: 30,
    });
    expect(r.margeBrute).toBeCloseTo(0.30, 3);
  });
});

describe('calculerDevisGlobal', () => {
  it('somme correctement plusieurs postes', () => {
    const poste = pricingPoste(POSTE_FAUX_PLANCHER_PICTET);
    const devis = calculerDevisGlobal([poste, poste]);
    expect(devis.totalHT).toBeCloseTo(poste.pvHT * 2, 0);
    expect(devis.coutTotal).toBeCloseTo(poste.coutTotal * 2, 0);
  });

  it('invariant : HT + TVA = TTC', () => {
    const devis = calculerDevisGlobal([pricingPoste(POSTE_FAUX_PLANCHER_PICTET)]);
    expect(devis.totalHT + devis.tva).toBeCloseTo(devis.totalTTC, 2);
  });

  it('TVA = 8.1% du HT (taux standard CYNA)', () => {
    const devis = calculerDevisGlobal([pricingPoste(POSTE_FAUX_PLANCHER_PICTET)]);
    expect(devis.tva / devis.totalHT).toBeCloseTo(0.081, 4);
  });

  it('accepte un taux TVA personnalisé', () => {
    const devis = calculerDevisGlobal([pricingPoste(POSTE_FAUX_PLANCHER_PICTET)], 0.026);
    expect(devis.tva / devis.totalHT).toBeCloseTo(0.026, 4);
  });

  it('devis vide → tous totaux à zéro', () => {
    const devis = calculerDevisGlobal([]);
    expect(devis.totalHT).toBe(0);
    expect(devis.totalTTC).toBe(0);
    expect(devis.margeBrute).toBe(0);
  });

  it('margeBrute = totalHT - coutTotal', () => {
    const devis = calculerDevisGlobal([pricingPoste(POSTE_FAUX_PLANCHER_PICTET)]);
    expect(devis.margeBrute).toBeCloseTo(devis.totalHT - devis.coutTotal, 2);
  });
});
