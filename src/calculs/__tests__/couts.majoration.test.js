/**
 * Tests d'intégration : majorations CCT intégrées dans les 2 moteurs de coûts.
 * Vérifie :
 * - coutMajorations > 0 sur un samedi
 * - coutMajorations = 0 sur un lundi ouvrable
 * - Invariant : les 2 moteurs produisent le même coutMajorations
 */
import { describe, it, expect } from 'vitest';
import { calculerCoutsChantier, calculerEtatChantier } from '../../donnees';

// ── Fixtures de base ──────────────────────────────────────────────────────────

const EMP = {
  id: '1',
  nom: 'Test',
  tarifJour: 400,       // 400 CHF/jour → 50 CHF/h
  tarifDejaCharge: true,
};

const CHANTIER_GE = {
  id: 'CH_TEST',
  nom: 'Test GE',
  canton: 'GE',
  statut: 'en cours',
  avancement: 50,
  equipe: [{ employeId: '1', role: 'ouvrier', joursPlannifies: 10 }],
  devisId: null,
};

function makePointage(date, heures = 8, categorie = 'production') {
  return {
    id: `ptg_${date}`,
    date,
    employeId: '1',
    repartitions: [{ categorie, heures, chantierId: 'CH_TEST' }],
    majoration: null,
  };
}

// ── Lundi ouvrable — aucune majoration ───────────────────────────────────────

describe('coutMajorations — lundi ouvrable', () => {
  const ptgs = [makePointage('2025-09-01', 8)]; // lundi
  it('coutMajorations = 0', () => {
    const r = calculerCoutsChantier(CHANTIER_GE, [EMP], [], {}, [], ptgs);
    expect(r.coutMajorations).toBe(0);
  });
  it('coutMOSansMajoration = 8h × 50CHF/h = 400', () => {
    const r = calculerCoutsChantier(CHANTIER_GE, [EMP], [], {}, [], ptgs);
    expect(r.coutMOSansMajoration).toBe(400);
  });
});

// ── Samedi — majoration 1.25 ─────────────────────────────────────────────────

describe('coutMajorations — samedi 1.25', () => {
  // Samedi 6 sept 2025
  const ptgsSam = [makePointage('2025-09-06', 8)];

  it('heuresMajorees = 8', () => {
    const r = calculerCoutsChantier(CHANTIER_GE, [EMP], [], {}, [], ptgsSam);
    expect(r.heuresMajorees).toBe(8);
  });
  it('coutMajorations = 8h × 50 × (1.25-1) = 100', () => {
    const r = calculerCoutsChantier(CHANTIER_GE, [EMP], [], {}, [], ptgsSam);
    expect(r.coutMajorations).toBeCloseTo(100, 1);
  });
  it('heuresMajorees > 0', () => {
    const r = calculerCoutsChantier(CHANTIER_GE, [EMP], [], {}, [], ptgsSam);
    expect(r.heuresMajorees).toBeGreaterThan(0);
  });
});

// ── Invariant 2 moteurs ───────────────────────────────────────────────────────

describe('invariant 2 moteurs — coutMajorations identique', () => {
  const ptgs = [makePointage('2025-09-06', 8)]; // samedi

  it('coutMajorations identique entre calculerCoutsChantier et calculerEtatChantier', () => {
    const r1 = calculerCoutsChantier(CHANTIER_GE, [EMP], [], {}, [], ptgs);
    const r2 = calculerEtatChantier(CHANTIER_GE, [EMP], [], null, ptgs);
    expect(r1.coutMajorations).toBeCloseTo(r2.coutMajorations, 1);
  });

  it('coutMOSansMajoration identique', () => {
    const ptgsLundi = [makePointage('2025-09-01', 8)];
    const r1 = calculerCoutsChantier(CHANTIER_GE, [EMP], [], {}, [], ptgsLundi);
    const r2 = calculerEtatChantier(CHANTIER_GE, [EMP], [], null, ptgsLundi);
    expect(r1.coutMOSansMajoration).toBeCloseTo(r2.coutMOSansMajoration, 1);
  });
});

// ── Backward compat — sans pointages ─────────────────────────────────────────

describe('backward compat — appel sans pointages', () => {
  it('calculerCoutsChantier sans pointages : coutMajorations = 0', () => {
    const r = calculerCoutsChantier(CHANTIER_GE, [EMP]);
    expect(r.coutMajorations).toBe(0);
    expect(r.heuresMajorees).toBe(0);
  });
  it('calculerEtatChantier sans pointages : coutMajorations = 0', () => {
    const r = calculerEtatChantier(CHANTIER_GE, [EMP]);
    expect(r.coutMajorations).toBe(0);
  });
});
