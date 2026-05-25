import { describe, it, expect } from 'vitest';
import { calculerCHR, totalCoutsDirects, fraisGenerauxAlloues } from './couts.js';
import { EMPLOYE_CHEF_EQUIPE } from './__fixtures__/cyna.js';

describe('calculerCHR', () => {
  it('calcule le CHR complet pour un chef équipe CYNA', () => {
    const r = calculerCHR(EMPLOYE_CHEF_EQUIPE);
    // 84 000 + 7 000 (13e) = 91 000 brut
    // 91 000 × 16% charges = 14 560
    // + 3 000 indirects = 108 560 total
    expect(r.coutTotalAnnuel).toBeCloseTo(108_560, 0);
    expect(r.coutHoraireReel).toBeCloseTo(108_560 / 1700, 2);
    expect(r.coutJournalier).toBeCloseTo((108_560 / 1700) * 8, 2);
    expect(r.detail.treizieme).toBe(7_000);
    expect(r.detail.chargesSociales).toBeCloseTo(14_560, 0);
    expect(r.detail.indirects).toBe(3_000);
  });

  it('utilise les défauts CYNA (16% charges, 1700h, 0 indirects)', () => {
    const r = calculerCHR({ salaireBrutAnnuel: 60_000 });
    expect(r.detail.indirects).toBe(0);
    expect(r.detail.heuresProductives).toBe(1_700);
  });

  it('respecte un taux de charges personnalisé', () => {
    const r = calculerCHR({ salaireBrutAnnuel: 60_000, tauxChargesSociales: 0.20 });
    // (60 000 + 5 000) × 1.20 = 78 000
    expect(r.coutTotalAnnuel).toBeCloseTo(78_000, 0);
  });

  it('CHR augmente proportionnellement aux coûts indirects', () => {
    const sans = calculerCHR({ salaireBrutAnnuel: 60_000 });
    const avec = calculerCHR({ salaireBrutAnnuel: 60_000, coutsIndirectsAnnuels: 5_000 });
    expect(avec.coutTotalAnnuel - sans.coutTotalAnnuel).toBeCloseTo(5_000, 0);
  });

  it('vérité dérangeante CYNA : coût chef équipe dépasse le TJF 450', () => {
    const r = calculerCHR(EMPLOYE_CHEF_EQUIPE);
    expect(r.coutJournalier).toBeGreaterThan(450);
  });
});

describe('totalCoutsDirects', () => {
  it('somme tous les composants', () => {
    expect(totalCoutsDirects({
      mainOeuvre: 5_000, materiaux: 30_000,
      sousTraitance: 2_000, locations: 500, deplacements: 300,
    })).toBe(37_800);
  });

  it('traite les composants absents comme zéro', () => {
    expect(totalCoutsDirects({ mainOeuvre: 5_000, materiaux: 10_000 })).toBe(15_000);
  });

  it('vide → 0', () => {
    expect(totalCoutsDirects({})).toBe(0);
  });
});

describe('fraisGenerauxAlloues', () => {
  it('calcule au prorata des heures', () => {
    expect(fraisGenerauxAlloues(200, 1000, 100_000)).toBe(20_000);
  });

  it('retourne 0 si dénominateur nul', () => {
    expect(fraisGenerauxAlloues(100, 0, 50_000)).toBe(0);
  });
});
