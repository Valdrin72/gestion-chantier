import { describe, it, expect } from 'vitest';
import { regressionLineaire, detecterAnomalies, indiceConcentration } from './stats.js';

describe('regressionLineaire', () => {
  it('reconstitue y = 2x + 3 exactement', () => {
    const r = regressionLineaire([
      { x: 0, y: 3 }, { x: 1, y: 5 }, { x: 2, y: 7 }, { x: 3, y: 9 },
    ]);
    expect(r.pente).toBeCloseTo(2, 10);
    expect(r.ordonneeOrigine).toBeCloseTo(3, 10);
    expect(r.predire(10)).toBeCloseTo(23, 10);
  });

  it('régression sur données bruitées proche du vrai modèle (y ≈ 1.5x + 1)', () => {
    const r = regressionLineaire([
      { x: 1, y: 2.4 }, { x: 2, y: 4.1 }, { x: 3, y: 5.6 },
      { x: 4, y: 7.0 }, { x: 5, y: 8.4 },
    ]);
    expect(r.pente).toBeCloseTo(1.5, 1);
  });

  it('refuse moins de 2 points', () => {
    expect(() => regressionLineaire([{ x: 1, y: 1 }])).toThrow();
    expect(() => regressionLineaire([])).toThrow();
  });

  it('refuse les points alignés verticalement', () => {
    expect(() => regressionLineaire([
      { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 },
    ])).toThrow();
  });
});

describe('detecterAnomalies', () => {
  it("série constante → pas d'anomalie, z-score = 0", () => {
    const r = detecterAnomalies([10, 10, 10, 10, 10]);
    expect(r.every(p => !p.suspect && !p.anomalie)).toBe(true);
    expect(r.every(p => p.zScore === 0)).toBe(true);
  });

  it('z-score correct : μ = 3, σ ≈ 1.414 pour [1..5]', () => {
    const r = detecterAnomalies([1, 2, 3, 4, 5]);
    expect(r[0].zScore).toBeCloseTo(-1.414, 2);
    expect(r[4].zScore).toBeCloseTo(1.414, 2);
  });

  it('outlier marqué comme suspect (|z| > seuilZ)', () => {
    const r = detecterAnomalies([10, 10, 10, 10, 10, 10, 100], 2);
    expect(r[6].suspect).toBe(true);
  });

  it('outlier extrême marqué comme anomalie (|z| > 3)', () => {
    const r = detecterAnomalies([1, 1, 1, 1, 1, 1, 1, 1, 1, 100]);
    expect(r[9].anomalie).toBe(true);
  });

  it('liste vide → []', () => {
    expect(detecterAnomalies([])).toEqual([]);
  });
});

describe('indiceConcentration (HHI)', () => {
  it('monopole pur → HHI = 10 000', () => {
    expect(indiceConcentration([100_000]).hhi).toBe(10_000);
  });

  it('10 clients égaux → HHI = 1 000, niveau faible', () => {
    const r = indiceConcentration(new Array(10).fill(50_000));
    expect(r.hhi).toBeCloseTo(1000, 0);
    expect(r.niveau).toBe('faible');
  });

  it('concentration élevée → niveau élévé', () => {
    expect(indiceConcentration([50, 30, 10, 5, 5]).niveau).toBe('eleve');
  });

  it('liste vide → hhi 0, niveau faible', () => {
    expect(indiceConcentration([])).toEqual({ hhi: 0, niveau: 'faible' });
  });

  it('total nul → hhi 0', () => {
    expect(indiceConcentration([0, 0, 0]).hhi).toBe(0);
  });
});
