import { describe, it, expect } from 'vitest';
import { calculerEVM } from './evm.js';
import { EVM_CHANTIER_DERIVE, EVM_CHANTIER_SAIN } from './__fixtures__/cyna.js';

describe('calculerEVM — chantier qui dérive', () => {
  const r = calculerEVM(EVM_CHANTIER_DERIVE);

  it('PV = % temps × budget = 25 000', () => {
    expect(r.PV).toBe(25_000);
  });

  it('EV = % travaux × budget = 20 000', () => {
    expect(r.EV).toBe(20_000);
  });

  it('AC = coûts engagés = 24 000', () => {
    expect(r.AC).toBe(24_000);
  });

  it('CV = EV - AC = -4 000', () => {
    expect(r.CV).toBe(-4_000);
  });

  it('SV = EV - PV = -5 000', () => {
    expect(r.SV).toBe(-5_000);
  });

  it('CPI ≈ 0.833', () => {
    expect(r.CPI).toBeCloseTo(0.833, 2);
  });

  it('SPI ≈ 0.8', () => {
    expect(r.SPI).toBeCloseTo(0.8, 2);
  });

  it('EAC ≈ 60 000 (budget / CPI)', () => {
    expect(r.EAC).toBeCloseTo(50_000 / (20_000 / 24_000), 0);
  });

  it('ETC = EAC - AC', () => {
    expect(r.ETC).toBeCloseTo(r.EAC - r.AC, 2);
  });

  it('statut CRITIQUE (CPI < 0.9 et SPI < 0.85)', () => {
    expect(r.statut).toBe('CRITIQUE');
  });
});

describe('calculerEVM — chantier sain', () => {
  const r = calculerEVM(EVM_CHANTIER_SAIN);

  it('CPI > 1 : sous budget', () => {
    expect(r.CPI).toBeGreaterThan(1);
  });

  it('SPI > 1 : en avance', () => {
    expect(r.SPI).toBeGreaterThan(1);
  });

  it('EAC < budget : économie projetée', () => {
    expect(r.EAC).toBeLessThan(EVM_CHANTIER_SAIN.budgetTotal);
  });

  it('statut OK', () => {
    expect(r.statut).toBe('OK');
  });
});

describe('calculerEVM — edge cases', () => {
  it('AC = 0 → CPI = 1 (évite division par zéro)', () => {
    const r = calculerEVM({ budgetTotal: 50_000, pourcentTempsEcoule: 0, pourcentTravauxRealises: 0, coutsEngages: 0 });
    expect(r.CPI).toBe(1);
    expect(r.SPI).toBe(1);
  });

  it('CPI 0.95 → statut VIGILANCE', () => {
    // EV = 47 500, AC = 50 000 → CPI = 0.95
    const r = calculerEVM({
      budgetTotal: 100_000, pourcentTempsEcoule: 50,
      pourcentTravauxRealises: 47.5, coutsEngages: 50_000,
    });
    expect(r.CPI).toBeCloseTo(0.95, 2);
    expect(r.statut).toBe('VIGILANCE');
  });

  it('EAC ≥ AC toujours', () => {
    [EVM_CHANTIER_DERIVE, EVM_CHANTIER_SAIN].forEach(c => {
      expect(calculerEVM(c).EAC).toBeGreaterThanOrEqual(c.coutsEngages);
    });
  });

  it('diagnostic toujours présent et non-vide', () => {
    expect(calculerEVM(EVM_CHANTIER_SAIN).diagnostic).toBeTruthy();
    expect(calculerEVM(EVM_CHANTIER_DERIVE).diagnostic).toBeTruthy();
  });
});
