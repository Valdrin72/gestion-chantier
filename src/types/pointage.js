/**
 * Catégories d'activité autorisées pour un pointage.
 * @type {string[]}
 */
export const CATEGORIES_POINTAGE = [
  'production',       // travail effectif sur chantier — facturable
  'atelier',          // préparation en dépôt/atelier — non facturable
  'deplacement',      // trajet aller-retour — hors des heures travaillées (F1)
  'absence_cp',       // congés payés
  'absence_maladie',  // maladie (IJM)
  'absence_at',       // accident de travail
  'intemperie',       // chantier bloqué météo
  'formation',        // formation interne ou externe
];

/** Catégories qui requièrent un chantierId non-null */
export const CATEGORIES_AVEC_CHANTIER = ['production', 'atelier'];

/** Catégories qui requièrent chantierId === null */
export const CATEGORIES_SANS_CHANTIER = [
  'deplacement',
  'absence_cp',
  'absence_maladie',
  'absence_at',
  'intemperie',
  'formation',
];

/**
 * @typedef {Object} Repartition
 * @property {string|null} chantierId - null pour absences/formation/déplacement
 * @property {string}      categorie  - valeur de CATEGORIES_POINTAGE
 * @property {number}      heures     - nombre d'heures (float > 0)
 */

/**
 * @typedef {Object} Deplacement
 * @property {number} duree_h       - durée trajet en heures (> 0, hors heures travaillées)
 * @property {number} indemnite_chf - indemnité CHF (0 en Phase 3, calculé en Phase 4)
 */

/**
 * @typedef {Object} Majoration
 * @property {string} type                 - 'heures_sup' | 'dimanche' | 'ferie'
 * @property {number} taux                 - ex: 1.25, 1.50
 * @property {number} heures               - heures soumises à majoration
 * @property {number} cout_supplementaire  - CHF supplémentaires (calculé en Phase 4)
 */

/**
 * @typedef {Object} Pointage
 * @property {string}           id           - identifiant unique : `ptg_${Date.now()}_${random}`
 * @property {string}           date         - ISO YYYY-MM-DD
 * @property {number}           employeId    - FK vers parametres.employes[].id
 * @property {Repartition[]}    repartitions - 1..N activités pour cette journée
 * @property {Deplacement|null} deplacement  - null Phase 3 (F1 : hors heures travaillées)
 * @property {Majoration[]|null} majoration  - null Phase 3, calculé en Phase 4
 * @property {string}           saisi_par    - 'migration_phase3' | userId
 * @property {string}           saisi_le     - ISO timestamp (création)
 * @property {string}           modifie_le   - ISO timestamp (dernière modification)
 */

/**
 * Valide un pointage selon les 6 invariants.
 * @param {Pointage} p
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePointage(p) {
  const errors = [];

  // Invariant 1 — au moins une repartition
  if (!p.repartitions || p.repartitions.length === 0) {
    errors.push('repartitions: au moins 1 repartition requise');
  }

  if (p.repartitions) {
    for (const r of p.repartitions) {
      // Invariant 2 — heures positives
      if (typeof r.heures !== 'number' || r.heures <= 0) {
        errors.push(`repartition[${r.categorie}]: heures doit être > 0`);
      }

      // Invariant 4 — catégorie valide
      if (!CATEGORIES_POINTAGE.includes(r.categorie)) {
        errors.push(`repartition: catégorie inconnue "${r.categorie}"`);
      }

      // Invariant 5 — cohérence chantierId ↔ catégorie
      if (CATEGORIES_AVEC_CHANTIER.includes(r.categorie) && !r.chantierId) {
        errors.push(`repartition[${r.categorie}]: chantierId requis pour cette catégorie`);
      }
      if (CATEGORIES_SANS_CHANTIER.includes(r.categorie) && r.chantierId != null) {
        errors.push(`repartition[${r.categorie}]: chantierId doit être null pour cette catégorie`);
      }
    }

    // Invariant 3 — somme heures ≤ 16
    const totalHeures = p.repartitions.reduce((s, r) => s + (r.heures || 0), 0);
    if (totalHeures > 16) {
      errors.push(`repartitions: total heures ${totalHeures} dépasse le maximum de 16`);
    }
  }

  // Invariant 6 — déplacement cohérent
  if (p.deplacement !== null && p.deplacement !== undefined) {
    if (typeof p.deplacement.duree_h !== 'number' || p.deplacement.duree_h <= 0) {
      errors.push('deplacement: duree_h doit être > 0');
    }
  }

  return { valid: errors.length === 0, errors };
}
