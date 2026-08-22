import { describe, it, expect } from 'vitest';
import { calculerEVM } from './evm.js';

// NOTE (ménage code mort) : les invariants pricing/marges ont été retirés avec les
// modules dormants src/calculs/pricing.js + marges.js (0 conso prod). La couverture
// EVM (evm.js, VIVANT — utilisé par modules/alertes + CalculsPage) est conservée.

describe('Invariants métier CYNA', () => {
  it('TVA suisse : HT × 1.081 = TTC pour tout montant', () => {
    [100, 1_234.56, 99_999.99, 0.01, 1_000_000].forEach(ht => {
      expect(ht * 1.081).toBeCloseTo(ht + ht * 0.081, 2);
      expect((ht * 1.081) / 1.081).toBeCloseTo(ht, 2);
    });
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
