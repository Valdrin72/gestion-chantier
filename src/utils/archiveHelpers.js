/**
 * Phase 2 — UX d'archivage.
 *
 * Une entité référencée (qui ne peut pas être supprimée — voir referenceGuard.js)
 * peut être ARCHIVÉE : cachée des vues actives mais conservée et restaurable.
 * Le flag `archive: true` + `dateArchivage` matérialise cet état soft.
 *
 * Fonctions PURES — réutilisées par chaque entité (chantiers, clients, devis…).
 */

/**
 * Pose le flag d'archivage sur une entité (immutable).
 * @param {object} entity
 * @returns {object} copie avec archive:true + dateArchivage ISO
 */
export function archiver(entity) {
  return { ...entity, archive: true, dateArchivage: new Date().toISOString() };
}

/**
 * Retire le flag d'archivage (immutable).
 * @param {object} entity
 * @returns {object} copie avec archive:false + dateArchivage effacé
 */
export function restaurer(entity) {
  return { ...entity, archive: false, dateArchivage: undefined };
}

/**
 * True si l'entité est archivée.
 * @param {object} entity
 */
export function estArchive(entity) {
  return entity?.archive === true;
}

/**
 * Filtre une liste pour ne garder que les entités ACTIVES (non archivées).
 * @param {Array<object>} liste
 * @returns {Array<object>}
 */
export function filtrerActifs(liste) {
  return (liste || []).filter(e => e?.archive !== true);
}

/**
 * Filtre une liste pour ne garder que les entités ARCHIVÉES.
 * @param {Array<object>} liste
 * @returns {Array<object>}
 */
export function filtrerArchives(liste) {
  return (liste || []).filter(e => e?.archive === true);
}
