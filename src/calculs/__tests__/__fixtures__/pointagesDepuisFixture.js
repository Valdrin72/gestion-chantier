/**
 * Phase 7b bis — utilitaire de TEST partagé.
 *
 * Convertit une fixture chantier (avec chantier.journal[] écrit à la main) en
 * pointages[] EN UTILISANT LA VRAIE migrerJournalVersPointages — celle de
 * src/migration/ qui tourne en production (séquence App.js). Aucune conversion
 * réécrite à la main : zéro logic-mirror.
 *
 * POURQUOI : depuis Phase 5a, les moteurs lisent les pointages (source de vérité),
 * le journal est dérivé. Les fixtures historiques encodent les heures dans le
 * journal et passaient pointages=[] — convention périmée. Cet utilitaire alimente
 * les pointages dérivés pour recâbler l'ENTRÉE des tests, sans toucher aux
 * valeurs attendues (le contrat métier).
 */

import { migrerJournalVersPointages } from '../../../migration/migrerJournalVersPointages';

/**
 * Pointages dérivés d'un seul chantier-fixture.
 * @param {Object} chantier - fixture avec chantier.journal[]
 * @param {Object[]} employes
 * @returns {import('../../../types/pointage').Pointage[]}
 */
export function pointagesDepuisChantier(chantier, employes = []) {
  return migrerJournalVersPointages([chantier], employes);
}

/**
 * Pointages dérivés de plusieurs chantiers-fixtures (multi-chantier, F3).
 * @param {Object[]} chantiers
 * @param {Object[]} employes
 * @returns {import('../../../types/pointage').Pointage[]}
 */
export function pointagesDepuisChantiers(chantiers, employes = []) {
  return migrerJournalVersPointages(chantiers, employes);
}

/**
 * Fusionne deux tableaux de pointages en respectant l'unicité (date, employeId) :
 * un pointage existant reçoit les répartitions supplémentaires plutôt qu'un doublon.
 * Même logique que la complétude Phase 7a — source unique complète (base + majorations).
 * @param {import('../../../types/pointage').Pointage[]} a
 * @param {import('../../../types/pointage').Pointage[]} b
 * @returns {import('../../../types/pointage').Pointage[]}
 */
export function fusionnerPointages(a = [], b = []) {
  const cle = (date, empId) => `${date}_${parseInt(empId)}`;
  const resultat = a.map(p => ({ ...p, repartitions: [...(p.repartitions || [])] }));
  const index = new Map();
  resultat.forEach(p => index.set(cle(p.date, p.employeId), p));
  for (const np of b) {
    const k = cle(np.date, np.employeId);
    const existant = index.get(k);
    if (existant) {
      existant.repartitions.push(...(np.repartitions || []));
    } else {
      const clone = { ...np, repartitions: [...(np.repartitions || [])] };
      resultat.push(clone);
      index.set(k, clone);
    }
  }
  return resultat;
}
