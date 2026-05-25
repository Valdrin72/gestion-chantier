import { describe, it, expect } from 'vitest';
import {
  tauxMarque, tauxMarge, marqueDepuisMarge, margeDepuisMarque,
  coeffVente, pvDepuisMarque, seuilRentabilite, margeBrutePonderee,
} from './marges.js';

describe('tauxMarque vs tauxMarge — la distinction critique', () => {
  it('coût 100, vente 130 → marge 30% sur coût, marque 23.1% sur vente', () => {
    expect(tauxMarge(130, 100)).toBeCloseTo(0.30, 3);
    expect(tauxMarque(130, 100)).toBeCloseTo(0.2308, 3);
  });

  it('coût 100, vente 142.86 → marque 30%, marge 42.86%', () => {
    expect(tauxMarque(142.86, 100)).toBeCloseTo(0.30, 3);
    expect(tauxMarge(142.86, 100)).toBeCloseTo(0.4286, 3);
  });

  it('marque < marge toujours (même profit, base différente)', () => {
    expect(tauxMarque(150, 100)).toBeLessThan(tauxMarge(150, 100));
  });

  it('tauxMarque = 0 si prix de vente nul', () => {
    expect(tauxMarque(0, 100)).toBe(0);
  });

  it('tauxMarge = 0 si coût nul', () => {
    expect(tauxMarge(100, 0)).toBe(0);
  });
});

describe('conversions marque ↔ marge (bijection)', () => {
  it.each([0.10, 0.20, 0.25, 0.28, 0.30, 0.40])(
    'aller-retour pour marque = %s',
    (marque) => {
      const marge = margeDepuisMarque(marque);
      expect(marqueDepuisMarge(marge)).toBeCloseTo(marque, 6);
    }
  );

  it('margeDepuisMarque(30%) ≈ 42.86%', () => {
    expect(margeDepuisMarque(0.30)).toBeCloseTo(0.4286, 3);
  });

  it('marqueDepuisMarge(30%) ≈ 23.08%', () => {
    expect(marqueDepuisMarge(0.30)).toBeCloseTo(0.2308, 3);
  });

  it('refuse une marque ≥ 100%', () => {
    expect(() => margeDepuisMarque(1)).toThrow();
    expect(() => margeDepuisMarque(1.5)).toThrow();
  });
});

describe('coeffVente', () => {
  it.each([
    [0.20, 1.250], [0.25, 1.333], [0.28, 1.389],
    [0.30, 1.429], [0.35, 1.538], [0.40, 1.667],
  ])('k pour marque %s ≈ %s', (marque, kAttendu) => {
    expect(coeffVente(marque)).toBeCloseTo(kAttendu, 3);
  });

  it('refuse une marque ≥ 100%', () => {
    expect(() => coeffVente(1)).toThrow();
  });
});

describe('pvDepuisMarque', () => {
  it('le prix obtenu donne exactement la marque cible', () => {
    const cout = 100;
    const marqueCible = 0.28;
    const pv = pvDepuisMarque(cout, marqueCible);
    expect(tauxMarque(pv, cout)).toBeCloseTo(marqueCible, 6);
  });
});

describe('seuilRentabilite', () => {
  it('FG 600 000 / taux MB 28% ≈ 2 142 857', () => {
    expect(seuilRentabilite(600_000, 0.28)).toBeCloseTo(2_142_857, 0);
  });

  it('retourne Infinity si taux MB nul ou négatif', () => {
    expect(seuilRentabilite(100_000, 0)).toBe(Infinity);
    expect(seuilRentabilite(100_000, -0.1)).toBe(Infinity);
  });
});

describe('margeBrutePonderee', () => {
  it('pondère par CA — pas moyenne arithmétique', () => {
    const chantiers = [
      { ca: 100_000, mb: 30_000 },  // 30% MB
      { ca: 10_000,  mb: 5_000 },   // 50% MB
    ];
    // Moyenne arithmétique des taux = 40% → FAUX
    // Pondéré : 35 000 / 110 000 ≈ 31.8%
    expect(margeBrutePonderee(chantiers)).toBeCloseTo(0.3182, 4);
  });

  it('liste vide → 0', () => {
    expect(margeBrutePonderee([])).toBe(0);
  });

  it('CA nul → 0', () => {
    expect(margeBrutePonderee([{ ca: 0, mb: 0 }])).toBe(0);
  });
});
