import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePointages } from '../../hooks/usePointages';

// Simule un état React minimal pour les tests
function createStore(initial = []) {
  let state = [...initial];
  const setState = (updater) => {
    state = typeof updater === 'function' ? updater(state) : updater;
  };
  const getState = () => state;
  return { setState, getState };
}

function makeHook(initial = []) {
  const store = createStore(initial);
  const hook = usePointages({ pointages: store.getState(), setPointages: store.setState });
  // Pour voir les modifications on recréé le hook après chaque mutation
  const refresh = () => usePointages({ pointages: store.getState(), setPointages: store.setState });
  return { hook, store, refresh };
}

const ptgBase = {
  date: '2025-10-01',
  employeId: 1,
  repartitions: [{ chantierId: '42', categorie: 'production', heures: 8 }],
  deplacement: null,
  majoration: null,
  saisi_par: 'test',
};

describe('usePointages — CRUD', () => {
  it('addPointage génère un id au format ptg_*', () => {
    const { hook, store, refresh } = makeHook();
    hook.addPointage(ptgBase);
    const h2 = refresh();
    expect(store.getState().length).toBe(1);
    expect(store.getState()[0].id).toMatch(/^ptg_/);
  });

  it('addPointage pose saisi_le et modifie_le', () => {
    const { hook, store } = makeHook();
    const before = new Date().toISOString();
    hook.addPointage(ptgBase);
    const p = store.getState()[0];
    expect(p.saisi_le >= before).toBe(true);
    expect(p.modifie_le >= before).toBe(true);
  });

  it('updatePointage met à jour modifie_le', async () => {
    const { hook, store } = makeHook();
    hook.addPointage(ptgBase);
    const id = store.getState()[0].id;
    const avant = store.getState()[0].modifie_le;

    await new Promise(r => setTimeout(r, 5));
    const h2 = usePointages({ pointages: store.getState(), setPointages: store.setState });
    h2.updatePointage(id, { saisi_par: 'updatedBy' });

    expect(store.getState()[0].modifie_le > avant).toBe(true);
  });

  it('updatePointage ne modifie pas saisi_le', async () => {
    const { hook, store } = makeHook();
    hook.addPointage(ptgBase);
    const id = store.getState()[0].id;
    const saisile = store.getState()[0].saisi_le;

    await new Promise(r => setTimeout(r, 5));
    const h2 = usePointages({ pointages: store.getState(), setPointages: store.setState });
    h2.updatePointage(id, { saisi_par: 'autre' });

    expect(store.getState()[0].saisi_le).toBe(saisile);
  });

  it('deletePointage retire l\'élément', () => {
    const { hook, store } = makeHook();
    hook.addPointage(ptgBase);
    const id = store.getState()[0].id;
    const h2 = usePointages({ pointages: store.getState(), setPointages: store.setState });
    h2.deletePointage(id);
    expect(store.getState().length).toBe(0);
  });

  it('getPointage retrouve par id', () => {
    const { hook, store } = makeHook();
    hook.addPointage(ptgBase);
    const id = store.getState()[0].id;
    const h2 = usePointages({ pointages: store.getState(), setPointages: store.setState });
    expect(h2.getPointage(id)).toBeDefined();
    expect(h2.getPointage('inexistant')).toBeUndefined();
  });

  it('getPointagesParDate filtre correctement', () => {
    const { hook, store } = makeHook();
    hook.addPointage({ ...ptgBase, date: '2025-10-01' });
    const h2 = usePointages({ pointages: store.getState(), setPointages: store.setState });
    h2.addPointage({ ...ptgBase, date: '2025-10-02', employeId: 2 });
    const h3 = usePointages({ pointages: store.getState(), setPointages: store.setState });
    expect(h3.getPointagesParDate('2025-10-01').length).toBe(1);
    expect(h3.getPointagesParDate('2025-10-03').length).toBe(0);
  });

  it('getPointagesParEmploye applique la coercion String', () => {
    const { hook, store } = makeHook();
    hook.addPointage({ ...ptgBase, employeId: 1 });
    const h2 = usePointages({ pointages: store.getState(), setPointages: store.setState });
    // Recherche avec string '1' doit trouver l'employé créé avec number 1
    expect(h2.getPointagesParEmploye('1').length).toBe(1);
    expect(h2.getPointagesParEmploye(1).length).toBe(1);
    expect(h2.getPointagesParEmploye(99).length).toBe(0);
  });

  it('getPointagesParChantier remonte les repartitions multi-chantier', () => {
    const ptgMulti = {
      ...ptgBase,
      repartitions: [
        { chantierId: '10', categorie: 'production', heures: 4 },
        { chantierId: '20', categorie: 'production', heures: 4 },
      ],
    };
    const { hook, store } = makeHook();
    hook.addPointage(ptgMulti);
    const h2 = usePointages({ pointages: store.getState(), setPointages: store.setState });
    expect(h2.getPointagesParChantier('10').length).toBe(1);
    expect(h2.getPointagesParChantier('20').length).toBe(1);
    expect(h2.getPointagesParChantier('99').length).toBe(0);
  });

  it('upsertPointage ajoute si absent', () => {
    const { hook, store } = makeHook();
    hook.upsertPointage(ptgBase);
    expect(store.getState().length).toBe(1);
  });

  it('upsertPointage FUSIONNE les répartitions si (date, employeId) existe déjà (C1 — n\'écrase plus)', () => {
    // Avant C1, ce test asseyait l'ÉCRASEMENT (le chantier 42 disparaissait). C'était le bug
    // de perte d'heures multi-chantier : upsert sur un 2e chantier le même jour effaçait le 1er.
    // Comportement correct : les répartitions de chantiers différents COEXISTENT (fusion).
    const { hook, store } = makeHook();
    hook.upsertPointage(ptgBase); // chantier 42, 8h
    const h2 = usePointages({ pointages: store.getState(), setPointages: store.setState });
    h2.upsertPointage({ ...ptgBase, repartitions: [{ chantierId: '99', categorie: 'production', heures: 6 }] });
    // UN seul pointage (date, employeId), mais DEUX répartitions : 42 conservé + 99 ajouté.
    expect(store.getState().length).toBe(1);
    const reps = store.getState()[0].repartitions;
    expect(reps).toHaveLength(2);
    expect(reps.find(r => r.chantierId === '42').heures).toBe(8);
    expect(reps.find(r => r.chantierId === '99').heures).toBe(6);
  });

  it('Deux pointages même jour employés différents coexistent', () => {
    const { hook, store } = makeHook();
    hook.addPointage({ ...ptgBase, employeId: 1 });
    const h2 = usePointages({ pointages: store.getState(), setPointages: store.setState });
    h2.addPointage({ ...ptgBase, employeId: 2 });
    expect(store.getState().length).toBe(2);
  });

  it('addPointage rejette une catégorie invalide', () => {
    const { hook, store } = makeHook();
    const result = hook.addPointage({
      ...ptgBase,
      repartitions: [{ chantierId: '1', categorie: 'INVALIDE', heures: 8 }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(store.getState().length).toBe(0);
  });
});
