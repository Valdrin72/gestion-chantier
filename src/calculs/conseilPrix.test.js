/**
 * Aide au devis — LOT A. Conseil de prix au m² (source A « fiable » : historique CYNA).
 * Fonctions PURES et LECTURE SEULE. On prouve : quartiles corrects, plancher = coût/m² ÷ 0,8
 * (marge minimale 20 %), garde-fou < 3 chantiers → aucun chiffre.
 */
import { describe, it, expect } from 'vitest';
import { quantile, mediane, conseilPrixM2ParType, MARGE_MIN_NEGO } from './conseilPrix';

describe('quantile / mediane (interpolation type-7)', () => {
  const A = [10, 20, 30, 40, 50];
  it('Q1 / médiane / Q3 sur un jeu connu', () => {
    expect(quantile(A, 0.25)).toBe(20);
    expect(quantile(A, 0.5)).toBe(30);
    expect(mediane(A)).toBe(30);
    expect(quantile(A, 0.75)).toBe(40);
  });
  it('bornes et cas vides', () => {
    expect(quantile(A, 0)).toBe(10);
    expect(quantile(A, 1)).toBe(50);
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([42], 0.25)).toBe(42);
  });
  it('interpole entre deux points (jeu pair)', () => {
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25); // (20+30)/2
  });
});

// ── Jeu de test : 5 chantiers « Faux-plafonds » facturés, surface 100 m² chacun ──
// Prix facturé HT/m² = [65, 78, 92, 108, 130] → médiane 92, Q1 78, Q3 108.
// materielReel 6000, surface 100 → coût/m² = 60 → plancher = 60 / (1 − 0,20) = 75.
const CH = (id, montantHT, materielReel) => ({
  id, nom: `CH${id}`, statut: 'terminé', typesTravaux: ['Faux-plafonds'],
  surface: 100, materielReel, canton: 'GE', journal: [], equipe: [],
});
const F = (id, chantierId, montantHT) => ({ id, chantierId, statut: 'payee', montantHT, montantTTC: Math.round(montantHT * 1.081) });
const CHANTIERS = [
  CH('c1', 6500, 6000), CH('c2', 7800, 6000), CH('c3', 9200, 6000), CH('c4', 10800, 6000), CH('c5', 13000, 6000),
];
const FACTURES = [
  F('f1', 'c1', 6500), F('f2', 'c2', 7800), F('f3', 'c3', 9200), F('f4', 'c4', 10800), F('f5', 'c5', 13000),
];
const PARAMS = { employes: [], localites: [], parametres: { coefficientMainOeuvre: 1 } };

describe('conseilPrixM2ParType — historique fiable', () => {
  it('conseillé = médiane 92, bas = Q1 78, haut = Q3 108 (CA facturé HT ÷ surface)', () => {
    const r = conseilPrixM2ParType({ chantiers: CHANTIERS, factures: FACTURES, devis: [], parametres: PARAMS, pointages: [], type: 'Faux-plafonds' });
    expect(r.suffisant).toBe(true);
    expect(r.nbChantiers).toBe(5);
    expect(Math.round(r.conseille)).toBe(92);
    expect(Math.round(r.bas)).toBe(78);
    expect(Math.round(r.haut)).toBe(108);
  });

  it('plancher = coût/m² médian ÷ (1 − 20 %) — marge minimale 20 %', () => {
    const r = conseilPrixM2ParType({ chantiers: CHANTIERS, factures: FACTURES, devis: [], parametres: PARAMS, pointages: [], type: 'Faux-plafonds' });
    expect(MARGE_MIN_NEGO).toBe(0.20);
    expect(r.coutM2Median).toBeGreaterThan(0);
    expect(r.plancher).toBeCloseTo(r.coutM2Median / (1 - 0.20), 6);
    // materielReel 6000 / 100 m² = 60 → plancher 75
    expect(Math.round(r.coutM2Median)).toBe(60);
    expect(Math.round(r.plancher)).toBe(75);
  });

  it('GARDE-FOU : < 3 chantiers facturés → suffisant=false, AUCUN chiffre', () => {
    const r = conseilPrixM2ParType({ chantiers: CHANTIERS.slice(0, 2), factures: FACTURES.slice(0, 2), devis: [], parametres: PARAMS, pointages: [], type: 'Faux-plafonds' });
    expect(r.suffisant).toBe(false);
    expect(r.nbChantiers).toBe(2);
    expect(r.conseille).toBeUndefined();
    expect(r.plancher).toBeUndefined();
  });

  it('ignore les chantiers sans surface, sans facture, ou d\'un autre type', () => {
    const pollue = [
      ...CHANTIERS,
      CH('cSansSurf', 5000, 6000), // surface écrasée ci-dessous
      { id: 'cAutre', typesTravaux: ['Cloisons'], surface: 100, materielReel: 6000, journal: [] },
      { id: 'cSansFac', typesTravaux: ['Faux-plafonds'], surface: 100, materielReel: 6000, journal: [] },
    ];
    pollue.find(c => c.id === 'cSansSurf').surface = 0;
    const facts = [...FACTURES, F('fx', 'cSansSurf', 5000)]; // facture mais surface 0 → exclu
    const r = conseilPrixM2ParType({ chantiers: pollue, factures: facts, devis: [], parametres: PARAMS, pointages: [], type: 'Faux-plafonds' });
    expect(r.nbChantiers).toBe(5); // seuls les 5 valides comptent
    expect(Math.round(r.conseille)).toBe(92);
  });

  it('type absent / vide → suffisant=false, ne jette pas', () => {
    expect(conseilPrixM2ParType({ chantiers: CHANTIERS, factures: FACTURES, type: 'Inexistant' }).suffisant).toBe(false);
    expect(conseilPrixM2ParType({ chantiers: CHANTIERS, factures: FACTURES, type: '' }).suffisant).toBe(false);
  });
});
