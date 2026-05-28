import { describe, it, expect } from 'vitest';
import { calculerMajorationDate, calculerPartSemaine, facteurEffectif } from '../majorations';

// ── calculerMajorationDate ────────────────────────────────────────────────────

describe('calculerMajorationDate', () => {
  it('lundi ouvrable → null', () => {
    expect(calculerMajorationDate('2025-09-01', 'GE')).toBeNull();
  });
  it('samedi → 1.25', () => {
    const r = calculerMajorationDate('2025-09-06', 'GE');
    expect(r).not.toBeNull();
    expect(r.facteur).toBe(1.25);
    expect(r.type).toBe('samedi');
  });
  it('dimanche → 1.50', () => {
    const r = calculerMajorationDate('2025-09-07', 'GE');
    expect(r).not.toBeNull();
    expect(r.facteur).toBe(1.50);
    expect(r.type).toBe('dimanche');
  });
  it('Noël GE (ferie) → 1.50', () => {
    const r = calculerMajorationDate('2025-12-25', 'GE');
    expect(r).not.toBeNull();
    expect(r.facteur).toBe(1.50);
    expect(r.type).toBe('ferie');
  });
  it('Berchtoldstag VD (01-02) → 1.50 pour VD', () => {
    const r = calculerMajorationDate('2026-01-02', 'VD');
    expect(r).not.toBeNull();
    expect(r.facteur).toBe(1.50);
  });
  it('Berchtoldstag GE (01-02) → null (pas férié GE)', () => {
    expect(calculerMajorationDate('2026-01-02', 'GE')).toBeNull();
  });
  it('Restauration genevoise 12-31 GE → 1.50', () => {
    expect(calculerMajorationDate('2025-12-31', 'GE')?.facteur).toBe(1.50);
  });
  it('12-31 VD → null (pas férié VD)', () => {
    expect(calculerMajorationDate('2025-12-31', 'VD')).toBeNull();
  });
  it('défaut canton = GE', () => {
    expect(calculerMajorationDate('2025-12-31')).not.toBeNull();
  });
});

// ── calculerPartSemaine ───────────────────────────────────────────────────────

function makePointage(date, employeId, heuresProd, categorie = 'production') {
  return {
    id: `ptg_${date}_${employeId}`,
    date,
    employeId: String(employeId),
    repartitions: [{ categorie, heures: heuresProd, chantierId: 'CH1' }],
    majoration: null,
  };
}

describe('calculerPartSemaine', () => {
  it('semaine < 45h → null', () => {
    const pts = [
      makePointage('2025-09-01', 1, 8),
      makePointage('2025-09-02', 1, 8),
      makePointage('2025-09-03', 1, 8),
    ];
    expect(calculerPartSemaine('2025-09-03', 1, pts)).toBeNull();
  });

  it('semaine = 45h exactement → null', () => {
    const pts = Array.from({ length: 5 }, (_, i) =>
      makePointage(`2025-09-0${i+1}`, 1, 9)
    );
    expect(calculerPartSemaine('2025-09-05', 1, pts)).toBeNull();
  });

  it('semaine 46h : 1h majorée sur le dernier jour', () => {
    const pts = [
      makePointage('2025-09-01', 1, 9),
      makePointage('2025-09-02', 1, 9),
      makePointage('2025-09-03', 1, 9),
      makePointage('2025-09-04', 1, 9),
      makePointage('2025-09-05', 1, 10),
    ];
    const r = calculerPartSemaine('2025-09-05', 1, pts);
    expect(r).not.toBeNull();
    expect(r.heuresMaj).toBe(1);
    expect(r.heuresNormales).toBe(9);
    expect(r.facteurMaj).toBe(1.25);
  });

  it('pointage absent pour ce jour → null', () => {
    const pts = [makePointage('2025-09-01', 1, 50)];
    expect(calculerPartSemaine('2025-09-02', 1, pts)).toBeNull();
  });

  it('n\'isole que les heures de l\'employé demandé', () => {
    const pts = [
      makePointage('2025-09-01', 1, 9),
      makePointage('2025-09-01', 2, 50), // autre employé
    ];
    expect(calculerPartSemaine('2025-09-01', 1, pts)).toBeNull();
  });
});

// ── facteurEffectif ───────────────────────────────────────────────────────────

describe('facteurEffectif', () => {
  it('aucune majoration → 1.0', () => {
    expect(facteurEffectif(null, null)).toBe(1.0);
  });
  it('date 1.25, semaine null → 1.25', () => {
    expect(facteurEffectif({ facteur: 1.25 }, null)).toBe(1.25);
  });
  it('date null, semaine 1.25 → 1.25', () => {
    expect(facteurEffectif(null, { facteurMaj: 1.25 })).toBe(1.25);
  });
  it('date 1.50, semaine 1.25 → 1.50 (max, pas cumul)', () => {
    expect(facteurEffectif({ facteur: 1.50 }, { facteurMaj: 1.25 })).toBe(1.50);
  });
  it('date 1.25, semaine 1.25 → 1.25', () => {
    expect(facteurEffectif({ facteur: 1.25 }, { facteurMaj: 1.25 })).toBe(1.25);
  });
});
