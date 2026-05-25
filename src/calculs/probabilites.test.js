import { describe, it, expect } from 'vitest';
import {
  decoteAge, esperancePipeline, scoreClient,
  statistiquesDepassement, provisionAleas,
  TAUX_CONVERSION_PAR_SEGMENT,
} from './probabilites.js';
import { HISTORIQUE_CLIENT_PICTET, HISTORIQUE_CLIENT_RISQUE, PIPELINE_DEVIS } from './__fixtures__/cyna.js';

describe('decoteAge', () => {
  it.each([
    [0, 1.0], [7, 1.0], [14, 1.0],
    [20, 0.9], [30, 0.9],
    [40, 0.6], [60, 0.6],
    [75, 0.3], [90, 0.3],
    [100, 0.1], [365, 0.1],
  ])('âge %s jours → décote %s', (age, attendu) => {
    expect(decoteAge(age)).toBe(attendu);
  });
});

describe('esperancePipeline', () => {
  it('somme les espérances par devis', () => {
    const r = esperancePipeline(PIPELINE_DEVIS);
    // D-001 : 50k × 0.42 × 1.0 = 21 000
    // D-002 : 80k × 0.28 × 0.9 = 20 160
    // D-003 : 30k × 0.35 × 0.3 =  3 150
    expect(r.total).toBeCloseTo(21_000 + 20_160 + 3_150, 0);
  });

  it('vide → total 0', () => {
    expect(esperancePipeline([]).total).toBe(0);
  });

  it('détail individuel cohérent avec taux de segment', () => {
    const r = esperancePipeline([{ id: 'X', montantHT: 100_000, segment: 'prive', ageJours: 0 }]);
    expect(r.detail[0].probabilite).toBeCloseTo(TAUX_CONVERSION_PAR_SEGMENT.prive, 4);
    expect(r.detail[0].espere).toBeCloseTo(100_000 * TAUX_CONVERSION_PAR_SEGMENT.prive, 0);
  });
});

describe('scoreClient', () => {
  it('client fiable Pictet → score > 80, catégorie fiable, acompte 20%', () => {
    const r = scoreClient(HISTORIQUE_CLIENT_PICTET);
    expect(r.categorie).toBe('fiable');
    expect(r.scoreSur100).toBeGreaterThan(80);
    expect(r.acompteRecommande).toBe(0.20);
  });

  it('client à risque → score < 40, acompte 50%', () => {
    const r = scoreClient(HISTORIQUE_CLIENT_RISQUE);
    expect(r.categorie).toBe('risque');
    expect(r.scoreSur100).toBeLessThan(40);
    expect(r.acompteRecommande).toBe(0.50);
  });

  it('historique vide → standard, 30%', () => {
    const r = scoreClient([]);
    expect(r.categorie).toBe('standard');
    expect(r.acompteRecommande).toBe(0.30);
    expect(r.retardMoyen).toBe(0);
  });

  it('retard moyen pondéré par montant, pas moyenne simple', () => {
    const r = scoreClient([
      { montant: 1_000, joursDeRetard: 60 },   // petit montant, gros retard
      { montant: 100_000, joursDeRetard: 0 },   // gros montant, pas de retard
    ]);
    expect(r.retardMoyen).toBeLessThan(2);
  });

  it('paiements en avance (jours négatifs) comptent comme 0', () => {
    const r = scoreClient([{ montant: 10_000, joursDeRetard: -5 }]);
    expect(r.retardMoyen).toBe(0);
    expect(r.scoreSur100).toBe(100);
  });
});

describe('statistiquesDepassement', () => {
  it('aucun dépassement → μ = 0, σ = 0', () => {
    const r = statistiquesDepassement([
      { prevu: 100, reel: 100 }, { prevu: 200, reel: 200 },
    ]);
    expect(r.mu).toBe(0);
    expect(r.sigma).toBe(0);
  });

  it('dépassement systématique de 10% → μ ≈ 0.1', () => {
    const r = statistiquesDepassement([
      { prevu: 100, reel: 110 }, { prevu: 200, reel: 220 }, { prevu: 300, reel: 330 },
    ]);
    expect(r.mu).toBeCloseTo(0.10, 4);
    expect(r.sigma).toBeCloseTo(0, 4);
  });

  it('historique vide → tous zéros', () => {
    expect(statistiquesDepassement([])).toEqual({ mu: 0, sigma: 0, n: 0 });
  });
});

describe('provisionAleas', () => {
  it('formule : coût × (1 + max(0, μ) + σ)', () => {
    expect(provisionAleas(100_000, 0.05, 0.10)).toBeCloseTo(115_000, 0);
  });

  it('ignore un μ négatif (principe de prudence)', () => {
    expect(provisionAleas(100_000, -0.05, 0.10)).toBeCloseTo(110_000, 0);
  });

  it('coût sans aléas reste coût', () => {
    expect(provisionAleas(50_000, 0, 0)).toBe(50_000);
  });
});
