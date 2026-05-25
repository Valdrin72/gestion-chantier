import { describe, it, expect } from 'vitest';
import { dureeTache, productiviteAjustee, capaciteEquipeJour, calculerCheminCritique } from './planning.js';

describe('dureeTache', () => {
  it('300 m² à 70 m²/j ≈ 4.29 jours', () => {
    expect(dureeTache(300, 70)).toBeCloseTo(4.286, 2);
  });

  it('quantité zéro → durée zéro', () => {
    expect(dureeTache(0, 70)).toBe(0);
  });

  it('refuse productivité nulle ou négative', () => {
    expect(() => dureeTache(100, 0)).toThrow();
    expect(() => dureeTache(100, -1)).toThrow();
  });
});

describe('productiviteAjustee', () => {
  it('sans coefficient → baseline inchangée', () => {
    expect(productiviteAjustee(70, [])).toBe(70);
  });

  it('un coefficient 0.7 → 49', () => {
    expect(productiviteAjustee(70, [0.7])).toBeCloseTo(49, 5);
  });

  it('coefficients multiplicatifs : 70 × 0.7 × 0.5 = 24.5', () => {
    expect(productiviteAjustee(70, [0.7, 0.5])).toBeCloseTo(24.5, 5);
  });

  it('coefficient > 1 augmente la productivité', () => {
    expect(productiviteAjustee(70, [1.15])).toBeCloseTo(80.5, 1);
  });
});

describe('capaciteEquipeJour', () => {
  it('3 personnes × 8h × 0.85 = 20.4 h productives', () => {
    expect(capaciteEquipeJour(3)).toBeCloseTo(20.4, 2);
  });

  it('équipe vide → 0', () => {
    expect(capaciteEquipeJour(0)).toBe(0);
  });

  it('coefficient 100% → théorique pur', () => {
    expect(capaciteEquipeJour(2, 8, 1)).toBe(16);
  });
});

describe('calculerCheminCritique', () => {
  it('3 tâches en série → toutes critiques', () => {
    const taches = [
      { id: 'A', nom: 'A', duree: 2, predecesseurs: [] },
      { id: 'B', nom: 'B', duree: 3, predecesseurs: ['A'] },
      { id: 'C', nom: 'C', duree: 1, predecesseurs: ['B'] },
    ];
    const r = calculerCheminCritique(taches);
    expect(r[0]).toMatchObject({ ES: 0, EF: 2, critique: true });
    expect(r[1]).toMatchObject({ ES: 2, EF: 5, critique: true });
    expect(r[2]).toMatchObject({ ES: 5, EF: 6, critique: true });
    expect(r.every(t => t.marge === 0)).toBe(true);
  });

  it('graphe parallèle : chemin critique = branche la plus longue', () => {
    const taches = [
      { id: 'A', nom: 'A', duree: 1, predecesseurs: [] },
      { id: 'B', nom: 'B', duree: 5, predecesseurs: ['A'] }, // critique
      { id: 'C', nom: 'C', duree: 2, predecesseurs: ['A'] }, // marge = 3
      { id: 'D', nom: 'D', duree: 1, predecesseurs: ['B', 'C'] },
    ];
    const r = calculerCheminCritique(taches);
    const get = (id) => r.find(t => t.id === id);
    expect(get('B').critique).toBe(true);
    expect(get('C').critique).toBe(false);
    expect(get('C').marge).toBe(3);
    expect(get('D').EF).toBe(7);
  });

  it('tâche sans prédécesseur démarre à ES = 0', () => {
    const r = calculerCheminCritique([{ id: 'X', nom: 'X', duree: 4, predecesseurs: [] }]);
    expect(r[0].ES).toBe(0);
    expect(r[0].EF).toBe(4);
  });
});
