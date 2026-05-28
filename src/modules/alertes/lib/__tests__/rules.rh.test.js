import { describe, it, expect } from 'vitest';
import { HEURES_SUP_ELEVEES } from '../rules/rh.js';
import { adapterContexteAlertes } from '../../contextAdapter.js';

function baseCtx(overrides = {}) {
  return {
    now: new Date('2026-05-15'),
    chantiers: [], devis: [], factures: [],
    employes: [
      { id: 'e1', prenom: 'Jean', nom: 'Dupont', poste: 'ouvrier', tarifJour: 350 },
      { id: 'e2', prenom: 'Paul', nom: 'Martin', poste: 'chef', tarifJour: 450 },
    ],
    pointages: [],
    clients: [], photos: [], pvs: [], audit: [],
    treso: { solde_actuel: 0, encaissements_prevus_30j: 0, decaissements_prevus_30j: 0, solde_projete_30j: 0, dso_actuel: 0 },
    ...overrides,
  };
}

function ptg(date, empId, heures, heures_sup) {
  return { date, employe_id: String(empId), heures, heures_sup };
}

// ── Tests HEURES_SUP_ELEVEES ────────────────────────────────────────────────

describe('HEURES_SUP_ELEVEES — règle RH', () => {
  it('ne déclenche pas si aucun pointage', () => {
    expect(HEURES_SUP_ELEVEES.evaluate(baseCtx())).toHaveLength(0);
  });

  it('ne déclenche pas si heures ≤ 8h/jour (0 sup)', () => {
    const pointages = Array.from({ length: 20 }, (_, i) =>
      ptg(`2026-05-${String(i + 1).padStart(2, '0')}`, 'e1', 8, 0)
    );
    expect(HEURES_SUP_ELEVEES.evaluate(baseCtx({ pointages }))).toHaveLength(0);
  });

  it('ne déclenche pas si cumul sup ≤ 25h', () => {
    // 12 jours × 2h sup = 24h — sous le seuil
    const pointages = Array.from({ length: 12 }, (_, i) =>
      ptg(`2026-05-${String(i + 1).padStart(2, '0')}`, 'e1', 10, 2)
    );
    expect(HEURES_SUP_ELEVEES.evaluate(baseCtx({ pointages }))).toHaveLength(0);
  });

  it('déclenche si cumul sup > 25h', () => {
    // 13 jours × 2h sup = 26h — dépasse le seuil
    const pointages = Array.from({ length: 13 }, (_, i) =>
      ptg(`2026-05-${String(i + 1).padStart(2, '0')}`, 'e1', 10, 2)
    );
    const alerts = HEURES_SUP_ELEVEES.evaluate(baseCtx({ pointages }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].data.totalSup).toBe(26);
    expect(alerts[0].contextRef.id).toBe('e1');
  });

  it('ignore les pointages du mois précédent', () => {
    const pointages = Array.from({ length: 20 }, (_, i) =>
      ptg(`2026-04-${String(i + 1).padStart(2, '0')}`, 'e1', 10, 2)
    );
    expect(HEURES_SUP_ELEVEES.evaluate(baseCtx({ pointages }))).toHaveLength(0);
  });

  it('ne déclenche pas si employé absent de ctx.employes', () => {
    const pointages = Array.from({ length: 13 }, (_, i) =>
      ptg(`2026-05-${String(i + 1).padStart(2, '0')}`, 'e-inconnu', 10, 2)
    );
    expect(HEURES_SUP_ELEVEES.evaluate(baseCtx({ pointages }))).toHaveLength(0);
  });

  it('déclenche séparément pour deux employés dépassant 25h', () => {
    const pointages = [
      ...Array.from({ length: 13 }, (_, i) => ptg(`2026-05-${String(i + 1).padStart(2, '0')}`, 'e1', 10, 2)),
      ...Array.from({ length: 14 }, (_, i) => ptg(`2026-05-${String(i + 1).padStart(2, '0')}`, 'e2', 10, 2)),
    ];
    const alerts = HEURES_SUP_ELEVEES.evaluate(baseCtx({ pointages }));
    expect(alerts).toHaveLength(2);
  });
});

// ── Tests adapterContexteAlertes — calcul heures_sup depuis pointages[] ────

function makePointage(id, date, employeId, repartitions) {
  return { id, date, employeId, repartitions };
}

describe('adapterContexteAlertes — heures_sup par employé/jour', () => {
  it('cas de base : 8h prod sur un chantier → 0 sup', () => {
    const rawPointages = [
      makePointage('p1', '2026-05-10', 'e1', [{ chantierId: 'c1', categorie: 'production', heures: 8 }]),
    ];
    const ctx = adapterContexteAlertes({ pointages: rawPointages });
    expect(ctx.pointages).toHaveLength(1);
    expect(ctx.pointages[0].heures_sup).toBe(0);
    expect(ctx.pointages[0].heures).toBe(8);
  });

  it('10h prod sur un chantier → 2h sup', () => {
    const rawPointages = [
      makePointage('p1', '2026-05-10', 'e1', [{ chantierId: 'c1', categorie: 'production', heures: 10 }]),
    ];
    const ctx = adapterContexteAlertes({ pointages: rawPointages });
    expect(ctx.pointages[0].heures_sup).toBe(2);
  });

  it('CAS DU BUG — 8h chantier A + 4h chantier B (2 repartitions) → 4h sup détectées', () => {
    const rawPointages = [
      makePointage('p1', '2026-05-10', 'e1', [
        { chantierId: 'c1', categorie: 'production', heures: 8 },
        { chantierId: 'c2', categorie: 'production', heures: 4 },
      ]),
    ];
    const ctx = adapterContexteAlertes({ pointages: rawPointages });
    // Un seul pointage (1 entrée) avec heures=12, heures_sup=4
    expect(ctx.pointages).toHaveLength(1);
    expect(ctx.pointages[0].heures).toBe(12);
    expect(ctx.pointages[0].heures_sup).toBe(4);
  });

  it('catégorie absence exclue du calcul heures', () => {
    const rawPointages = [
      makePointage('p1', '2026-05-10', 'e1', [
        { chantierId: null, categorie: 'absence_maladie', heures: 8 },
      ]),
    ];
    const ctx = adapterContexteAlertes({ pointages: rawPointages });
    // heures prod = 0 → filtré
    expect(ctx.pointages).toHaveLength(0);
  });

  it('catégorie deplacement exclue du calcul heures', () => {
    const rawPointages = [
      makePointage('p1', '2026-05-10', 'e1', [
        { chantierId: 'c1', categorie: 'deplacement', heures: 2 },
        { chantierId: 'c1', categorie: 'production', heures: 7 },
      ]),
    ];
    const ctx = adapterContexteAlertes({ pointages: rawPointages });
    expect(ctx.pointages).toHaveLength(1);
    expect(ctx.pointages[0].heures).toBe(7);   // déplacement exclu
    expect(ctx.pointages[0].heures_sup).toBe(0);
  });

  it('employe_id est stringifié', () => {
    const rawPointages = [
      makePointage('p1', '2026-05-10', 42, [{ chantierId: 'c1', categorie: 'production', heures: 8 }]),
    ];
    const ctx = adapterContexteAlertes({ pointages: rawPointages });
    expect(ctx.pointages[0].employe_id).toBe('42');
  });
});
