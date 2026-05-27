import { describe, it, expect, vi } from 'vitest';
import { migrerJournalVersPointages } from '../../migration/migrerJournalVersPointages';
import { donneesInitiales } from '../../donnees';

const employes = donneesInitiales.employes || [];
const chantiers = donneesInitiales.chantiers || [];

describe('migrerJournalVersPointages — tests de migration', () => {
  it('produit des pointages non vides sur les données démo', () => {
    const result = migrerJournalVersPointages(chantiers, employes);
    expect(result.length).toBeGreaterThan(0);
  });

  it('chaque pointage possède tous les champs requis', () => {
    const result = migrerJournalVersPointages(chantiers, employes);
    for (const p of result) {
      expect(p.id).toMatch(/^ptg_mig_/);
      expect(typeof p.date).toBe('string');
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof p.employeId).toBe('number');
      expect(Array.isArray(p.repartitions)).toBe(true);
      expect(p.repartitions.length).toBeGreaterThan(0);
      expect(p.deplacement).toBeNull();
      expect(p.majoration).toBeNull();
      expect(p.saisi_par).toBe('migration_phase3');
      expect(typeof p.saisi_le).toBe('string');
      expect(typeof p.modifie_le).toBe('string');
    }
  });

  it('toutes les catégories migrées sont "production"', () => {
    const result = migrerJournalVersPointages(chantiers, employes);
    for (const p of result) {
      for (const r of p.repartitions) {
        expect(r.categorie).toBe('production');
      }
    }
  });

  it('un chantier avec journal=[] produit 0 pointage pour ce chantier', () => {
    const chantiersTest = [
      { id: '999', journal: [] },
    ];
    const result = migrerJournalVersPointages(chantiersTest, []);
    expect(result.length).toBe(0);
  });

  it('idempotence : migrer deux fois produit des résultats structurellement identiques (hors id/timestamps)', () => {
    const r1 = migrerJournalVersPointages(chantiers, employes);
    const r2 = migrerJournalVersPointages(chantiers, employes);
    // Même nombre de pointages
    expect(r1.length).toBe(r2.length);
    // Même (date, employeId, repartitions) — sans tenir compte des ids générés aléatoirement
    const normalise = (arr) => arr
      .map(p => ({ date: p.date, employeId: p.employeId, repartitions: p.repartitions }))
      .sort((a, b) => `${a.date}_${a.employeId}`.localeCompare(`${b.date}_${b.employeId}`));
    expect(normalise(r1)).toEqual(normalise(r2));
  });

  it('edge case : heures = 0 ne génère pas de pointage', () => {
    const chantiersTest = [
      {
        id: '1',
        journal: [{ date: '2025-01-01', employes: [{ employeId: 1, heuresTravaillees: 0 }] }],
      },
    ];
    const result = migrerJournalVersPointages(chantiersTest, [{ id: 1 }]);
    expect(result.length).toBe(0);
  });

  it('edge case : employeId inconnu → migré quand même + console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const chantiersTest = [
      {
        id: '1',
        journal: [{ date: '2025-01-01', employes: [{ employeId: 9999, heuresTravaillees: 8 }] }],
      },
    ];
    const result = migrerJournalVersPointages(chantiersTest, [{ id: 1 }]);
    expect(result.length).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('edge case : doublon (date + employeId + chantierId) → heures sommées', () => {
    const chantiersTest = [
      {
        id: '1',
        journal: [
          { date: '2025-01-01', employes: [{ employeId: 1, heuresTravaillees: 4 }] },
          { date: '2025-01-01', employes: [{ employeId: 1, heuresTravaillees: 3 }] },
        ],
      },
    ];
    const result = migrerJournalVersPointages(chantiersTest, [{ id: 1 }]);
    expect(result.length).toBe(1);
    expect(result[0].repartitions[0].heures).toBe(7);
  });

  it('multi-chantier même jour → 1 Pointage avec 2 repartitions', () => {
    const chantiersTest = [
      { id: '10', journal: [{ date: '2025-01-15', employes: [{ employeId: 1, heuresTravaillees: 4 }] }] },
      { id: '20', journal: [{ date: '2025-01-15', employes: [{ employeId: 1, heuresTravaillees: 4 }] }] },
    ];
    const result = migrerJournalVersPointages(chantiersTest, [{ id: 1 }]);
    expect(result.length).toBe(1);
    expect(result[0].repartitions.length).toBe(2);
  });

  it('total pointages démo ≥ 400 (sanity check volume)', () => {
    const result = migrerJournalVersPointages(chantiers, employes);
    expect(result.length).toBeGreaterThanOrEqual(400);
  });
});
