/**
 * Tests multi-canton pour la majoration par répartition (Option A — Phase 5b-calc).
 *
 * Vérifie que chaque chantier reçoit la majoration correcte SELON SON PROPRE CANTON,
 * pour les cas où GE et VD ont des fériés différents.
 *
 * Fixtures :
 * - EMP : tarif 400 CHF/jour → tarifH = 50 CHF/h
 * - CH_GE : canton GE
 * - CH_VD : canton VD
 * - JEUNE_GE_2026 : 2026-09-10 (jeudi) — férié GE uniquement
 * - BERCHTOLDSTAG_2026 : 2026-01-02 (vendredi) — férié VD uniquement
 * - SAMEDI : 2025-09-06 — majoration weekend, canton-indépendant
 */
import { describe, it, expect } from 'vitest';
import { calculerCoutsChantier, calculerEtatChantier } from '../../donnees';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMP = {
  id: '1',
  nom: 'Test',
  tarifJour: 400,        // 50 CHF/h
  tarifDejaCharge: true,
};

const CH_GE = {
  id: 'CH_GE',
  nom: 'Chantier Genève',
  canton: 'GE',
  statut: 'en cours',
  avancement: 50,
  equipe: [{ employeId: '1', role: 'ouvrier', joursPlannifies: 10 }],
  devisId: null,
};

const CH_VD = {
  id: 'CH_VD',
  nom: 'Chantier Vaud',
  canton: 'VD',
  statut: 'en cours',
  avancement: 50,
  equipe: [{ employeId: '1', role: 'ouvrier', joursPlannifies: 10 }],
  devisId: null,
};

// Jeûne genevois 2026 = jeudi 10 septembre (1er jeudi après 1er dimanche de sept)
// Férié en GE, ouvrable en VD.
const JEUNE_GE_2026 = '2026-09-10';

// Berchtoldstag = 2 janvier — férié en VD, ouvrable en GE.
const BERCHTOLDSTAG_2026 = '2026-01-02';

// Samedi canonique — majoration weekend, canton-indépendant.
const SAMEDI = '2025-09-06';

// ── Test A — Jeûne genevois : GE majoté ×1.50, VD non majoté ─────────────────

describe('Test A — Jeûne genevois (férié GE, ouvré VD) : majoration par canton', () => {
  // Pointage unique : même employé travaille sur GE (5h) + VD (3h) le même jour
  const ptg = {
    id: 'ptg_jeune_ge',
    date: JEUNE_GE_2026,
    employeId: '1',
    majoration: null,
    deplacement: null,
    repartitions: [
      { categorie: 'production', heures: 5, chantierId: 'CH_GE' },
      { categorie: 'production', heures: 3, chantierId: 'CH_VD' },
    ],
  };
  const allPtgs = [ptg];

  it('CH_GE : coutMajorations = 5h × 50 CHF/h × (1.50 − 1.0) = 125 CHF', () => {
    const r = calculerCoutsChantier(CH_GE, [EMP], [], {}, [], allPtgs);
    expect(r.coutMajorations).toBeCloseTo(125, 1);
  });

  it('CH_GE : heuresMajorees = 5', () => {
    const r = calculerCoutsChantier(CH_GE, [EMP], [], {}, [], allPtgs);
    expect(r.heuresMajorees).toBe(5);
  });

  it('CH_VD : coutMajorations = 0 (Jeûne genevois non férié en VD)', () => {
    const r = calculerCoutsChantier(CH_VD, [EMP], [], {}, [], allPtgs);
    expect(r.coutMajorations).toBe(0);
  });

  it('CH_VD : heuresMajorees = 0', () => {
    const r = calculerCoutsChantier(CH_VD, [EMP], [], {}, [], allPtgs);
    expect(r.heuresMajorees).toBe(0);
  });
});

// ── Test B — Berchtoldstag : VD majoté ×1.50, GE non majoté ─────────────────

describe('Test B — Berchtoldstag (férié VD, ouvré GE) : majoration par canton', () => {
  const ptg = {
    id: 'ptg_berch',
    date: BERCHTOLDSTAG_2026,
    employeId: '1',
    majoration: null,
    deplacement: null,
    repartitions: [
      { categorie: 'production', heures: 6, chantierId: 'CH_VD' },
      { categorie: 'production', heures: 2, chantierId: 'CH_GE' },
    ],
  };
  const allPtgs = [ptg];

  it('CH_VD : coutMajorations = 6h × 50 CHF/h × (1.50 − 1.0) = 150 CHF', () => {
    const r = calculerCoutsChantier(CH_VD, [EMP], [], {}, [], allPtgs);
    expect(r.coutMajorations).toBeCloseTo(150, 1);
  });

  it('CH_VD : heuresMajorees = 6', () => {
    const r = calculerCoutsChantier(CH_VD, [EMP], [], {}, [], allPtgs);
    expect(r.heuresMajorees).toBe(6);
  });

  it('CH_GE : coutMajorations = 0 (Berchtoldstag non férié en GE)', () => {
    const r = calculerCoutsChantier(CH_GE, [EMP], [], {}, [], allPtgs);
    expect(r.coutMajorations).toBe(0);
  });

  it('CH_GE : heuresMajorees = 0', () => {
    const r = calculerCoutsChantier(CH_GE, [EMP], [], {}, [], allPtgs);
    expect(r.heuresMajorees).toBe(0);
  });
});

// ── Test C — Samedi : les deux cantons ×1.25 (weekend canton-indépendant) ─────

describe('Test C — Samedi multi-canton : GE et VD tous les deux ×1.25', () => {
  const ptg = {
    id: 'ptg_sam_multi',
    date: SAMEDI,
    employeId: '1',
    majoration: null,
    deplacement: null,
    repartitions: [
      { categorie: 'production', heures: 4, chantierId: 'CH_GE' },
      { categorie: 'production', heures: 4, chantierId: 'CH_VD' },
    ],
  };
  const allPtgs = [ptg];

  it('CH_GE : coutMajorations = 4h × 50 × (1.25 − 1.0) = 50 CHF', () => {
    const r = calculerCoutsChantier(CH_GE, [EMP], [], {}, [], allPtgs);
    expect(r.coutMajorations).toBeCloseTo(50, 1);
  });

  it('CH_GE : heuresMajorees = 4', () => {
    const r = calculerCoutsChantier(CH_GE, [EMP], [], {}, [], allPtgs);
    expect(r.heuresMajorees).toBe(4);
  });

  it('CH_VD : coutMajorations = 4h × 50 × (1.25 − 1.0) = 50 CHF (identique à GE)', () => {
    const r = calculerCoutsChantier(CH_VD, [EMP], [], {}, [], allPtgs);
    expect(r.coutMajorations).toBeCloseTo(50, 1);
  });

  it('CH_VD : heuresMajorees = 4', () => {
    const r = calculerCoutsChantier(CH_VD, [EMP], [], {}, [], allPtgs);
    expect(r.heuresMajorees).toBe(4);
  });
});

// ── Test D — Invariant 2 moteurs sur pointage multi-canton ───────────────────

describe('Test D — invariant : calculerCoutsChantier = calculerEtatChantier (multi-canton)', () => {
  const ptg = {
    id: 'ptg_jeune_inv',
    date: JEUNE_GE_2026,
    employeId: '1',
    majoration: null,
    deplacement: null,
    repartitions: [
      { categorie: 'production', heures: 5, chantierId: 'CH_GE' },
      { categorie: 'production', heures: 3, chantierId: 'CH_VD' },
    ],
  };
  const allPtgs = [ptg];

  it('CH_GE : coutMajorations identique entre les 2 moteurs', () => {
    const r1 = calculerCoutsChantier(CH_GE, [EMP], [], {}, [], allPtgs);
    const r2 = calculerEtatChantier(CH_GE, [EMP], [], null, allPtgs);
    expect(r1.coutMajorations).toBeCloseTo(r2.coutMajorations, 1);
  });

  it('CH_VD : coutMajorations = 0 dans les 2 moteurs', () => {
    const r1 = calculerCoutsChantier(CH_VD, [EMP], [], {}, [], allPtgs);
    const r2 = calculerEtatChantier(CH_VD, [EMP], [], null, allPtgs);
    expect(r1.coutMajorations).toBe(0);
    expect(r2.coutMajorations).toBe(0);
  });
});
