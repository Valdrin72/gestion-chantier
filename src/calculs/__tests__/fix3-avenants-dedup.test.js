/**
 * Fix #3 — Guard anti double-comptage des avenants dans calculerCAForfait.
 *
 * Règle : si devis.avenants est non vide → source unique (chantier.avenants ignoré).
 *         si devis.avenants est vide     → fallback sur chantier.avenants (legacy pur).
 *         Jamais les deux additionnés.
 */
import { describe, it, expect } from 'vitest';
import { calculerCAForfait } from '../../donnees';

const BASE = 50000;

const CHANTIER = { id: 'c1', devisId: 'd1' };

// ── Cas 1 : les deux côtés peuplés → seul devis.avenants compte ─────────────
describe('Fix #3-A — double peuplement : seul devis.avenants compte', () => {
  it('devis.avenants [5000] + chantier.avenants [5000] → CA = base + 5000 (pas 10000)', () => {
    const devis = [{ id: 'd1', montantHT: BASE, avenants: [{ montant: 5000 }], heuresRegie: [] }];
    const chantier = { ...CHANTIER, avenants: [{ montant: 5000 }] };
    expect(calculerCAForfait(chantier, devis)).toBe(55000);
  });

  it('devis.avenants [3000,2000] + chantier.avenants [8000] → CA = base + 5000 (pas 13000)', () => {
    const devis = [{ id: 'd1', montantHT: BASE, avenants: [{ montant: 3000 }, { montant: 2000 }], heuresRegie: [] }];
    const chantier = { ...CHANTIER, avenants: [{ montant: 8000 }] };
    expect(calculerCAForfait(chantier, devis)).toBe(55000);
  });

  it('delta entre double et simple = 0 (preuve anti doublon)', () => {
    const devis = [{ id: 'd1', montantHT: BASE, avenants: [{ montant: 5000 }], heuresRegie: [] }];
    const chantierDouble = { ...CHANTIER, avenants: [{ montant: 5000 }] };
    const chantierVide   = { ...CHANTIER, avenants: [] };
    expect(calculerCAForfait(chantierDouble, devis)).toBe(calculerCAForfait(chantierVide, devis));
  });
});

// ── Cas 2 : seul devis.avenants peuplé ──────────────────────────────────────
describe('Fix #3-B — devis.avenants peuplé, chantier.avenants vide', () => {
  it('CA = base + avenants devis', () => {
    const devis = [{ id: 'd1', montantHT: BASE, avenants: [{ montant: 7000 }], heuresRegie: [] }];
    const chantier = { ...CHANTIER, avenants: [] };
    expect(calculerCAForfait(chantier, devis)).toBe(57000);
  });
});

// ── Cas 3 : fallback legacy — seul chantier.avenants peuplé ─────────────────
describe('Fix #3-C — fallback legacy : devis.avenants vide, chantier.avenants compte', () => {
  it('CA = base + avenants chantier', () => {
    const devis = [{ id: 'd1', montantHT: BASE, avenants: [], heuresRegie: [] }];
    const chantier = { ...CHANTIER, avenants: [{ montant: 3000 }] };
    expect(calculerCAForfait(chantier, devis)).toBe(53000);
  });

  it('chantier.avenants scalaire (très ancien format) → compté', () => {
    const devis = [{ id: 'd1', montantHT: BASE, avenants: [], heuresRegie: [] }];
    const chantier = { ...CHANTIER, avenants: 4500 }; // format number
    expect(calculerCAForfait(chantier, devis)).toBe(54500);
  });
});

// ── Cas 4 : aucun avenant ────────────────────────────────────────────────────
describe('Fix #3-D — aucun avenant → CA = base', () => {
  it('les deux vides → CA = montantHT', () => {
    const devis = [{ id: 'd1', montantHT: BASE, avenants: [], heuresRegie: [] }];
    const chantier = { ...CHANTIER, avenants: [] };
    expect(calculerCAForfait(chantier, devis)).toBe(BASE);
  });

  it('devis.avenants absent → CA = montantHT', () => {
    const devis = [{ id: 'd1', montantHT: BASE, heuresRegie: [] }];
    const chantier = { ...CHANTIER };
    expect(calculerCAForfait(chantier, devis)).toBe(BASE);
  });
});

// ── Cas 5 : heuresRegie indépendant — non affecté par le guard ───────────────
describe('Fix #3-E — heuresRegie non affecté par le guard', () => {
  it('devis.avenants + heuresRegie → les deux comptés', () => {
    const devis = [{
      id: 'd1', montantHT: BASE,
      avenants: [{ montant: 5000 }],
      heuresRegie: [{ heures: 10, tarifHeure: 100 }],
    }];
    const chantier = { ...CHANTIER, avenants: [] };
    // 50000 + 5000 avenants + 1000 régie = 56000
    expect(calculerCAForfait(chantier, devis)).toBe(56000);
  });

  it('legacy chantier.avenants + heuresRegie → les deux comptés', () => {
    const devis = [{
      id: 'd1', montantHT: BASE,
      avenants: [],
      heuresRegie: [{ heures: 5, tarifHeure: 200 }],
    }];
    const chantier = { ...CHANTIER, avenants: [{ montant: 3000 }] };
    // 50000 + 3000 legacy + 1000 régie = 54000
    expect(calculerCAForfait(chantier, devis)).toBe(54000);
  });
});
