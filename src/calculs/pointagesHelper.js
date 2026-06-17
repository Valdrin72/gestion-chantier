/**
 * Phase 7a — Helpers de lecture directe des pointages (fondation du switchover).
 *
 * Ces fonctions reproduisent EXACTEMENT ce que les consommateurs calculent
 * aujourd'hui depuis `chantier.journal`, mais en lisant `pointages[]` directement
 * (la source de vérité). Elles sont la brique de base de la Phase 7c (bascule des
 * consommateurs un par un).
 *
 * INVARIANT (testé) : pour un chantier dont le journal est dérivé des pointages,
 *   joursReelsChantier(pointages, id)        === new Set(journal.map(e => e.date)).size
 *   heuresEmployeChantier(pointages, emp, id) === heuresEmploye(journal, emp)
 *   heuresJourChantier(pointages, id, date)   === heuresJour(journal, date)
 *   empIdsChantier(pointages, id)             === [...new Set(journal.flatMap(...))]
 *
 * Catégories incluses : 'production' + 'atelier' — STRICTEMENT identique au filtre de
 * regenererJournalDepuisPointages(). Déplacement, absences, formation → exclus du journal,
 * donc exclus ici.
 *
 * AUCUN consommateur n'utilise encore ces helpers (Phase 7a = fondation seule).
 */

import { CATEGORIES_AVEC_CHANTIER } from '../types/pointage';

// ['production', 'atelier'] — miroir de CATEGORIES_JOURNAL dans regenererJournalDepuisPointages.
const CATS_JOURNAL = CATEGORIES_AVEC_CHANTIER;

/** Une repartition compte-t-elle pour le journal de ce chantier ? (catégorie + heures > 0) */
const repartitionProductive = (r, cid) =>
  String(r.chantierId) === cid &&
  CATS_JOURNAL.includes(r.categorie) &&
  (parseFloat(r.heures) || 0) > 0;

/**
 * Nombre de jours uniques travaillés sur un chantier (catégories production + atelier).
 * Équivaut à `new Set((chantier.journal || []).map(e => e.date)).size`.
 *
 * @param {import('../types/pointage').Pointage[]} pointages
 * @param {string|number} chantierId
 * @returns {number}
 */
export function joursReelsChantier(pointages, chantierId) {
  const cid = String(chantierId);
  const dates = new Set();
  for (const p of (pointages || [])) {
    if (!p.date) continue;
    if ((p.repartitions || []).some(r => repartitionProductive(r, cid))) {
      dates.add(p.date);
    }
  }
  return dates.size;
}

/**
 * Total des heures d'un employé sur un chantier (catégories production + atelier).
 * Équivaut à `heuresEmploye(chantier.journal || [], empId)`.
 *
 * @param {import('../types/pointage').Pointage[]} pointages
 * @param {string|number} empId
 * @param {string|number} chantierId
 * @returns {number}
 */
export function heuresEmployeChantier(pointages, empId, chantierId) {
  const cid = String(chantierId);
  const eid = parseInt(empId);
  let heures = 0;
  for (const p of (pointages || [])) {
    if (parseInt(p.employeId) !== eid) continue;
    for (const r of (p.repartitions || [])) {
      if (repartitionProductive(r, cid)) heures += parseFloat(r.heures) || 0;
    }
  }
  return heures;
}

/**
 * Map { [employeId]: heures } pour une date donnée sur un chantier.
 * Équivaut à `heuresJour(chantier.journal || [], date)`.
 * Les clés sont des employeId entiers (coercition via parseInt), comme heuresJour.
 *
 * @param {import('../types/pointage').Pointage[]} pointages
 * @param {string|number} chantierId
 * @param {string} date
 * @returns {Object<number, number>}
 */
export function heuresJourChantier(pointages, chantierId, date) {
  const cid = String(chantierId);
  const result = {};
  for (const p of (pointages || [])) {
    if (p.date !== date) continue;
    for (const r of (p.repartitions || [])) {
      if (!repartitionProductive(r, cid)) continue;
      const eid = parseInt(p.employeId);
      result[eid] = (result[eid] || 0) + (parseFloat(r.heures) || 0);
    }
  }
  return result;
}

/**
 * IDs (entiers) des employés ayant travaillé sur un chantier (catégories production + atelier).
 * Équivaut à `[...new Set((chantier.journal || []).flatMap(e => (e.employes||[]).map(em => parseInt(em.employeId))).filter(Boolean))]`.
 *
 * @param {import('../types/pointage').Pointage[]} pointages
 * @param {string|number} chantierId
 * @returns {number[]}
 */
export function empIdsChantier(pointages, chantierId) {
  const cid = String(chantierId);
  const ids = new Set();
  for (const p of (pointages || [])) {
    if ((p.repartitions || []).some(r => repartitionProductive(r, cid))) {
      const eid = parseInt(p.employeId);
      if (eid) ids.add(eid);
    }
  }
  return [...ids];
}

/**
 * Index Map<chantierId(string), Pointage[]> — optimisation O(n) pour la Phase 7c
 * (évite le O(n²) si beaucoup de consommateurs filtrent les mêmes pointages).
 * Ne conserve que les pointages ayant au moins une repartition productive sur le chantier.
 *
 * @param {import('../types/pointage').Pointage[]} pointages
 * @returns {Map<string, import('../types/pointage').Pointage[]>}
 */
export function indexPointagesParChantier(pointages = []) {
  const index = new Map();
  for (const p of pointages) {
    const chantiersVus = new Set();
    for (const r of (p.repartitions || [])) {
      if (r.chantierId == null || !CATS_JOURNAL.includes(r.categorie)) continue;
      if ((parseFloat(r.heures) || 0) <= 0) continue;
      const key = String(r.chantierId);
      if (chantiersVus.has(key)) continue; // un pointage = au plus 1 entrée par chantier
      chantiersVus.add(key);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(p);
    }
  }
  return index;
}
