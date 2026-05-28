/**
 * Tests Phase 5a — cohérence saisie → pointage → régénération.
 *
 * Vérifie que les heures saisies via upsertPointage se retrouvent
 * correctement dans le journal régénéré, et que les suppressions
 * sont répercutées.
 */
import { describe, it, expect } from 'vitest';
import { usePointages } from '../../hooks/usePointages';
import { regenererJournalDepuisPointages } from '../../migration/regenererJournalDepuisPointages';
import { heuresEmploye, donneesInitiales } from '../../donnees';
import { migrerJournalVersPointages } from '../../migration/migrerJournalVersPointages';

function makeHook(initial = []) {
  let state = [...initial];
  const setState = (fn) => { state = typeof fn === 'function' ? fn(state) : fn; };
  const getState = () => state;
  const hook = () => usePointages({ pointages: state, setPointages: setState });
  return { hook, getState };
}

const CHANTIER = { id: 'CH1', nom: 'Test', canton: 'GE', journal: [] };

// ── Saisie → régénération ────────────────────────────────────────────────────

describe('saisie cohérence : upsertPointage → régénération → heuresEmploye', () => {
  it('production saisie → retrouvée dans le journal régénéré', () => {
    const { hook, getState } = makeHook();
    hook().upsertPointage({
      date: '2025-09-01', employeId: 1,
      repartitions: [{ categorie: 'production', heures: 8, chantierId: 'CH1' }],
      deplacement: null,
    }, 'GE');
    const journal = regenererJournalDepuisPointages(getState(), [CHANTIER])[0].journal;
    expect(heuresEmploye(journal, 1)).toBeCloseTo(8, 5);
  });

  it('atelier saisi → inclus dans le journal régénéré', () => {
    const { hook, getState } = makeHook();
    hook().upsertPointage({
      date: '2025-09-01', employeId: 2,
      repartitions: [{ categorie: 'atelier', heures: 6, chantierId: 'CH1' }],
      deplacement: null,
    }, 'GE');
    const journal = regenererJournalDepuisPointages(getState(), [CHANTIER])[0].journal;
    expect(heuresEmploye(journal, 2)).toBeCloseTo(6, 5);
  });

  it('deletePointage → retiré du journal régénéré', () => {
    const initial = [{
      id: 'ptg_del', date: '2025-09-01', employeId: 1,
      repartitions: [{ categorie: 'production', heures: 8, chantierId: 'CH1' }],
    }];
    const { hook, getState } = makeHook(initial);
    hook().deletePointage('ptg_del');
    const journal = regenererJournalDepuisPointages(getState(), [CHANTIER])[0].journal;
    expect(heuresEmploye(journal, 1)).toBe(0);
    expect(journal).toHaveLength(0);
  });

  it('upsert deux fois (même date+employé) → last-write-wins, 1 seul pointage', () => {
    const { hook, getState } = makeHook();
    hook().upsertPointage({
      date: '2025-09-01', employeId: 1,
      repartitions: [{ categorie: 'production', heures: 8, chantierId: 'CH1' }],
      deplacement: null,
    }, 'GE');
    // Recréer le hook avec l'état mis à jour
    const hook2 = usePointages({ pointages: getState(), setPointages: (fn) => {
      const next = typeof fn === 'function' ? fn(getState()) : fn;
      getState().splice(0, getState().length, ...next);
    }});
    hook2.upsertPointage({
      date: '2025-09-01', employeId: 1,
      repartitions: [{ categorie: 'production', heures: 6, chantierId: 'CH1' }],
      deplacement: null,
    }, 'GE');
    const final = getState().filter(p => p.date === '2025-09-01' && String(p.employeId) === '1');
    expect(final).toHaveLength(1);
    const journal = regenererJournalDepuisPointages(getState(), [CHANTIER])[0].journal;
    expect(heuresEmploye(journal, 1)).toBeCloseTo(6, 5);
  });

  it('déplacement seul → exclu du journal régénéré', () => {
    const { hook, getState } = makeHook();
    hook().upsertPointage({
      date: '2025-09-01', employeId: 1,
      repartitions: [{ categorie: 'deplacement', heures: 2, chantierId: 'CH1' }],
      deplacement: null,
    }, 'GE');
    const journal = regenererJournalDepuisPointages(getState(), [CHANTIER])[0].journal;
    expect(journal).toHaveLength(0);
  });
});

// ── Séquence mount : migration + régénération idempotente ───────────────────

describe('séquence mount : migration → régénération idempotente', () => {
  const { chantiers, employes } = donneesInitiales;
  const pointagesMigres = migrerJournalVersPointages(chantiers, employes);

  it('régénérer deux fois de suite produit le même journal (idempotent)', () => {
    const pass1 = regenererJournalDepuisPointages(pointagesMigres, chantiers);
    const pass2 = regenererJournalDepuisPointages(pointagesMigres, pass1);

    for (let i = 0; i < chantiers.length; i++) {
      const j1 = pass1[i].journal;
      const j2 = pass2[i].journal;
      expect(j2.length).toBe(j1.length);
      // Mêmes heures par employé
      const empIds = [...new Set(j1.flatMap(e => (e.employes || []).map(em => em.employeId)))];
      for (const empId of empIds) {
        expect(heuresEmploye(j2, empId)).toBeCloseTo(heuresEmploye(j1, empId), 5);
      }
    }
  });

  it('la séquence migration → régénération ne corrompt pas les données démo', () => {
    for (const chantier of chantiers) {
      const regene = regenererJournalDepuisPointages(pointagesMigres, [chantier])[0];
      const journalOrig = chantier.journal || [];
      const journalReg  = regene.journal || [];
      // Même nombre de dates
      const datesOrig  = new Set(journalOrig.map(e => e.date));
      const datesRegene = new Set(journalReg.map(e => e.date));
      expect(datesRegene.size).toBe(datesOrig.size);
    }
  });
});
