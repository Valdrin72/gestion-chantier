/**
 * Fix C1 — upsertPointage ne doit JAMAIS écraser les heures d'un autre chantier.
 * Scénario métier : Paul pointé 4h sur chantier A le lundi, puis 4h sur chantier B le même
 * lundi (deux modales distinctes, chacune n'envoie que SA répartition). Avant le fix, la 2e
 * saisie écrasait la 1re → les 4h de A disparaissaient. Après : les 8h coexistent (4/4).
 *
 * Chemin RÉEL exercé : le vrai hook usePointages (pas de logic-mirror) + les vrais helpers
 * de coût (heuresEmployeChantier). Les deux widgets (ModalSaisieHeures, SaisieRapideDashboard)
 * appellent upsertPointage avec exactement cette forme : repartitions:[{chantierId, production, heures}].
 */
import { describe, it, expect } from 'vitest';
import { usePointages } from '../hooks/usePointages';
import { heuresEmployeChantier } from '../calculs/pointagesHelper';

function createStore(initial = []) {
  let state = [...initial];
  return { setState: u => { state = typeof u === 'function' ? u(state) : u; }, getState: () => state };
}
// Recrée le hook après chaque mutation (il capture `pointages` à la création).
function hookFor(store) {
  return usePointages({ pointages: store.getState(), setPointages: store.setState });
}

// Ce que les widgets envoient : UNE répartition, chantier courant, production.
const saisie = (chantierId, heures, date = '2025-10-06', employeId = 1) => ({
  date, employeId, repartitions: [{ chantierId, categorie: 'production', heures }], deplacement: null,
});

const pointageUnique = (store, date = '2025-10-06', empId = 1) =>
  store.getState().filter(p => p.date === date && String(p.employeId) === String(empId));

describe('Fix C1 — deux chantiers le même jour : aucune heure perdue', () => {
  it('4h chantier A puis 4h chantier B → 8h coexistent (4/4), coût MO des DEUX chantiers correct', () => {
    const store = createStore();
    hookFor(store).upsertPointage(saisie('A', 4), 'GE');   // modale chantier A
    hookFor(store).upsertPointage(saisie('B', 4), 'GE');   // modale chantier B, même jour/employé

    const pts = pointageUnique(store);
    // Unicité (date, employeId) préservée : UN seul pointage, DEUX répartitions.
    expect(pts.length).toBe(1);
    expect(pts[0].repartitions).toHaveLength(2);

    // Les deux chantiers voient bien leurs 4h (via le VRAI helper de coût).
    const all = store.getState();
    expect(heuresEmployeChantier(all, 1, 'A')).toBe(4);
    expect(heuresEmployeChantier(all, 1, 'B')).toBe(4);
    // Total employé sur le jour = 8h (rien de perdu).
    const totalJour = pts[0].repartitions.reduce((s, r) => s + r.heures, 0);
    expect(totalJour).toBe(8);
  });

  it('correction : re-saisie chantier A (4h→6h) met à jour A, ne touche pas B, sans doublon', () => {
    const store = createStore();
    hookFor(store).upsertPointage(saisie('A', 4), 'GE');
    hookFor(store).upsertPointage(saisie('B', 4), 'GE');
    hookFor(store).upsertPointage(saisie('A', 6), 'GE');   // correction sur A

    const pts = pointageUnique(store);
    expect(pts.length).toBe(1);
    // Toujours 2 répartitions (A, B) — pas de doublon de A.
    expect(pts[0].repartitions).toHaveLength(2);
    const all = store.getState();
    expect(heuresEmployeChantier(all, 1, 'A')).toBe(6);   // mis à jour
    expect(heuresEmployeChantier(all, 1, 'B')).toBe(4);   // intact
    // Un seul chantierId 'A' dans le tableau.
    expect(pts[0].repartitions.filter(r => String(r.chantierId) === 'A')).toHaveLength(1);
  });

  it('préserve aussi une catégorie atelier existante sur le même chantier', () => {
    const store = createStore();
    // Pointage initial : A production 4h + A atelier 2h (saisi via un flux qui envoie les deux)
    hookFor(store).upsertPointage({
      date: '2025-10-06', employeId: 1, deplacement: null,
      repartitions: [
        { chantierId: 'A', categorie: 'production', heures: 4 },
        { chantierId: 'A', categorie: 'atelier', heures: 2 },
      ],
    }, 'GE');
    // Correction production A → 5h (la modale n'envoie que production).
    hookFor(store).upsertPointage(saisie('A', 5), 'GE');

    const pts = pointageUnique(store);
    const rA = pts[0].repartitions.filter(r => String(r.chantierId) === 'A');
    // production mis à jour à 5, atelier 2 conservé.
    expect(rA.find(r => r.categorie === 'production').heures).toBe(5);
    expect(rA.find(r => r.categorie === 'atelier').heures).toBe(2);
    // heuresEmployeChantier inclut production+atelier = 7.
    expect(heuresEmployeChantier(store.getState(), 1, 'A')).toBe(7);
  });
});
