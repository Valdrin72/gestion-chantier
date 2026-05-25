import { describe, it, expect } from 'vitest';
import { fmtCHF, fmtPct, fmtNombre, fmtJ, arrondi5cts } from './format.js';

describe('fmtCHF', () => {
  it('formate un montant simple avec apostrophe milliers', () => {
    expect(fmtCHF(1234.5)).toBe("CHF 1'234.50");
  });

  it('formate un grand nombre avec plusieurs séparateurs', () => {
    expect(fmtCHF(1234567.89)).toBe("CHF 1'234'567.89");
  });

  it('arrondit à 2 décimales', () => {
    expect(fmtCHF(99.999)).toBe("CHF 100.00");
    expect(fmtCHF(99.994)).toBe("CHF 99.99");
  });

  it('gère zéro', () => {
    expect(fmtCHF(0)).toBe("CHF 0.00");
  });

  it('gère les négatifs', () => {
    expect(fmtCHF(-1234.5)).toBe("-CHF 1'234.50");
  });

  it('option signe affiche + sur les positifs', () => {
    expect(fmtCHF(1234.5, { signe: true })).toBe("+CHF 1'234.50");
    expect(fmtCHF(-100, { signe: true })).toBe("-CHF 100.00");
    expect(fmtCHF(0, { signe: true })).toBe("CHF 0.00");
  });

  it('retourne — pour valeur non-finie', () => {
    expect(fmtCHF(Infinity)).toBe('—');
    expect(fmtCHF(NaN)).toBe('—');
  });
});

describe('fmtPct', () => {
  it('formate avec 1 décimale par défaut', () => {
    expect(fmtPct(0.283)).toBe("28.3%");
  });

  it('respecte le nombre de décimales demandé', () => {
    expect(fmtPct(0.28333, 2)).toBe("28.33%");
    expect(fmtPct(0.28333, 0)).toBe("28%");
  });

  it('gère les valeurs négatives', () => {
    expect(fmtPct(-0.15)).toBe("-15.0%");
  });
});

describe('fmtNombre', () => {
  it('utilise les apostrophes milliers', () => {
    expect(fmtNombre(1234567.5)).toBe("1'234'567.50");
  });

  it('respecte les décimales', () => {
    expect(fmtNombre(123.456, 0)).toBe("123");
    expect(fmtNombre(123.456, 3)).toBe("123.456");
  });
});

describe('fmtJ', () => {
  it('affiche heures sous 1 jour', () => {
    expect(fmtJ(0.5)).toBe("4 h");
  });

  it('affiche jours entre 1 et 5', () => {
    expect(fmtJ(3.2)).toBe("3.2 j");
  });

  it('affiche semaines au-delà de 5 jours', () => {
    expect(fmtJ(10)).toBe("2.0 sem");
  });

  it('affiche mois au-delà de 4 semaines', () => {
    expect(fmtJ(40)).toBe("2.0 mois");
  });

  it('retourne 0 j pour valeur nulle ou négative', () => {
    expect(fmtJ(0)).toBe("0 j");
    expect(fmtJ(-1)).toBe("0 j");
  });
});

describe('arrondi5cts', () => {
  it.each([
    [12.32, 12.30],
    [12.33, 12.35],
    [12.37, 12.35],
    [12.38, 12.40],
    [12.30, 12.30],
    [12.35, 12.35],
    [0, 0],
  ])('arrondit %s → %s', (input, expected) => {
    expect(arrondi5cts(input)).toBe(expected);
  });

  it('arrondit aussi les négatifs', () => {
    expect(arrondi5cts(-12.33)).toBeCloseTo(-12.35, 10);
  });
});
