import { describe, it, expect } from 'vitest';
import { pricingPoste, calculerDevisGlobal } from './pricing.js';
import { tauxMarque, coeffVente, pvDepuisMarque } from './marges.js';
import { calculerEVM } from './evm.js';

describe('Invariants métier CYNA', () => {
  it('TVA suisse : HT × 1.081 = TTC pour tout montant', () => {
    [100, 1_234.56, 99_999.99, 0.01, 1_000_000].forEach(ht => {
      expect(ht * 1.081).toBeCloseTo(ht + ht * 0.081, 2);
      expect((ht * 1.081) / 1.081).toBeCloseTo(ht, 2);
    });
  });

  it('cohérence marque/coefficient : k × C = PV où marque(PV, C) = cible', () => {
    [0.10, 0.20, 0.25, 0.28, 0.30, 0.40].forEach(m => {
      const cout = 10_000;
      const pv = pvDepuisMarque(cout, m);
      expect(tauxMarque(pv, cout)).toBeCloseTo(m, 6);
      expect(pv / cout).toBeCloseTo(coeffVente(m), 6);
    });
  });

  it('somme des PV postes = total HT du devis', () => {
    const postes = Array.from({ length: 4 }, (_, i) => pricingPoste({
      designation: `P${i}`, unite: 'm²',
      quantite: 100 + i * 20, coutMatUnit: 50 + i * 5,
      tempsH: 0.25, coutHMO: 45,
    }));
    const devis = calculerDevisGlobal(postes);
    const somme = postes.reduce((s, p) => s + p.pvHT, 0);
    expect(devis.totalHT).toBeCloseTo(somme, 2);
  });

  it('EVM : EV / AC = CPI toujours', () => {
    [
      { budgetTotal: 50_000, pourcentTempsEcoule: 50, pourcentTravauxRealises: 40, coutsEngages: 24_000 },
      { budgetTotal: 100_000, pourcentTempsEcoule: 30, pourcentTravauxRealises: 35, coutsEngages: 30_000 },
    ].forEach(c => {
      const r = calculerEVM(c);
      expect(r.CPI).toBeCloseTo(r.EV / r.AC, 6);
    });
  });

  it('EAC ≥ AC toujours (le coût final ≥ ce déjà dépensé)', () => {
    [
      { budgetTotal: 50_000, pourcentTempsEcoule: 50, pourcentTravauxRealises: 40, coutsEngages: 24_000 },
      { budgetTotal: 100_000, pourcentTempsEcoule: 90, pourcentTravauxRealises: 95, coutsEngages: 92_000 },
    ].forEach(c => {
      expect(calculerEVM(c).EAC).toBeGreaterThanOrEqual(c.coutsEngages);
    });
  });
});
