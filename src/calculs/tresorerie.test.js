import { describe, it, expect } from 'vitest';
import {
  calculerDSO, calculerDPO, calculerBFR,
  interetsMoratoires, delaiHypothequeLegale, projectionSolde,
} from './tresorerie.js';

describe('calculerDSO', () => {
  it('créances 180k, CA 120k sur 30j = 45 jours', () => {
    expect(calculerDSO(180_000, 120_000, 30)).toBe(45);
  });

  it('retourne 0 si CA nul', () => {
    expect(calculerDSO(100_000, 0, 30)).toBe(0);
  });

  it('DSO 30j < cible 45j → sain', () => {
    expect(calculerDSO(100_000, 100_000, 30)).toBe(30);
  });
});

describe('calculerDPO', () => {
  it('mêmes calculs que DSO mais sur dettes/achats', () => {
    expect(calculerDPO(60_000, 60_000, 30)).toBe(30);
  });

  it('retourne 0 si achats nuls', () => {
    expect(calculerDPO(10_000, 0, 30)).toBe(0);
  });
});

describe('calculerBFR', () => {
  it('formule : créances + stocks + TEC - dettes - acomptes', () => {
    expect(calculerBFR({
      creancesClients: 180_000, stocks: 15_000, travauxEnCours: 50_000,
      dettesFournisseurs: 60_000, acomptesRecus: 30_000,
    })).toBe(155_000);
  });

  it('BFR négatif possible si acomptes > besoins', () => {
    expect(calculerBFR({
      creancesClients: 10_000, stocks: 5_000, travauxEnCours: 0,
      dettesFournisseurs: 10_000, acomptesRecus: 30_000,
    })).toBe(-25_000);
  });
});

describe('interetsMoratoires', () => {
  it('50 000 × 5% × 30j / 360 ≈ 208.33 CHF', () => {
    expect(interetsMoratoires(50_000, 30)).toBeCloseTo(208.33, 2);
  });

  it('zéro jours de retard → zéro intérêts', () => {
    expect(interetsMoratoires(100_000, 0)).toBe(0);
  });

  it('taux personnalisé', () => {
    expect(interetsMoratoires(10_000, 60, 0.10)).toBeCloseTo(166.67, 2);
  });

  it('convention 360 jours commerciale', () => {
    // 1 an complet à 5% sur 1 000 CHF avec /360 = 50.69
    expect(interetsMoratoires(1000, 365)).toBeCloseTo(50.69, 2);
  });
});

describe('delaiHypothequeLegale', () => {
  it('ajoute exactement 4 mois à la date de dernier travail', () => {
    const dernierTravail = new Date('2026-01-15');
    const r = delaiHypothequeLegale(dernierTravail);
    expect(r.dateLimite.getMonth()).toBe(4); // mai (0-indexed)
    expect(r.dateLimite.getDate()).toBe(15);
    expect(r.dateLimite.getFullYear()).toBe(2026);
  });

  it('jours restants positifs si délai pas écoulé', () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 30);
    expect(delaiHypothequeLegale(recent).joursRestants).toBeGreaterThan(0);
  });

  it('jours restants négatifs si délai dépassé', () => {
    const vieux = new Date();
    vieux.setMonth(vieux.getMonth() - 6);
    expect(delaiHypothequeLegale(vieux).joursRestants).toBeLessThan(0);
  });
});

describe('projectionSolde', () => {
  it('solde initial sans mouvement reste constant', () => {
    const r = projectionSolde(100_000, [], 10);
    expect(r).toHaveLength(11);
    expect(r.every(p => p.solde === 100_000)).toBe(true);
  });

  it('décaissement réduit le solde dès le jour J', () => {
    const demain = new Date();
    demain.setHours(0, 0, 0, 0);
    demain.setDate(demain.getDate() + 1);
    const r = projectionSolde(20_000, [
      { date: demain, montant: -5_000, probabilite: 1, description: 'Loyer' },
    ], 3);
    expect(r[1].solde).toBe(15_000);
    expect(r[3].solde).toBe(15_000);
  });

  it('encaissement applique la probabilité', () => {
    const dans3j = new Date();
    dans3j.setHours(0, 0, 0, 0);
    dans3j.setDate(dans3j.getDate() + 3);
    const r = projectionSolde(50_000, [
      { date: dans3j, montant: 10_000, probabilite: 0.8, description: 'Client' },
    ], 5);
    expect(r[3].solde).toBeCloseTo(58_000, 2);
  });
});
