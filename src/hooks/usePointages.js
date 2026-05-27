import { CATEGORIES_POINTAGE, CATEGORIES_AVEC_CHANTIER, CATEGORIES_SANS_CHANTIER } from '../types/pointage';

/**
 * Génère un identifiant unique pour un pointage.
 * @returns {string}
 */
function genererIdPointage() {
  return `ptg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Valide minimalement une repartition avant écriture.
 * Retourne un message d'erreur ou null.
 * @param {import('../types/pointage').Repartition} r
 * @returns {string|null}
 */
function erreurRepartition(r) {
  if (!CATEGORIES_POINTAGE.includes(r.categorie)) {
    return `Catégorie invalide : "${r.categorie}"`;
  }
  if (typeof r.heures !== 'number' || r.heures <= 0) {
    return `Heures invalides : ${r.heures}`;
  }
  if (CATEGORIES_AVEC_CHANTIER.includes(r.categorie) && !r.chantierId) {
    return `chantierId requis pour la catégorie "${r.categorie}"`;
  }
  if (CATEGORIES_SANS_CHANTIER.includes(r.categorie) && r.chantierId != null) {
    return `chantierId doit être null pour la catégorie "${r.categorie}"`;
  }
  return null;
}

/**
 * Hook de gestion des pointages.
 * Consomme pointages + setPointages depuis useSupabaseData (blob Supabase).
 *
 * @param {{ pointages: import('../types/pointage').Pointage[], setPointages: Function }} param
 */
export function usePointages({ pointages, setPointages }) {

  // ── Lecture ──────────────────────────────────────────────────────────────

  /**
   * Retourne un pointage par son id.
   * @param {string} id
   * @returns {import('../types/pointage').Pointage|undefined}
   */
  const getPointage = (id) => pointages.find(p => p.id === id);

  /**
   * Retourne tous les pointages pour une date donnée (YYYY-MM-DD).
   * @param {string} date
   * @returns {import('../types/pointage').Pointage[]}
   */
  const getPointagesParDate = (date) => pointages.filter(p => p.date === date);

  /**
   * Retourne tous les pointages d'un employé.
   * Coercion String pour éviter les bugs de comparaison int vs string (CLAUDE.md).
   * @param {number|string} employeId
   * @returns {import('../types/pointage').Pointage[]}
   */
  const getPointagesParEmploye = (employeId) =>
    pointages.filter(p => String(p.employeId) === String(employeId));

  /**
   * Retourne tous les pointages qui contiennent au moins une repartition sur ce chantier.
   * @param {string|number} chantierId
   * @returns {import('../types/pointage').Pointage[]}
   */
  const getPointagesParChantier = (chantierId) =>
    pointages.filter(p =>
      p.repartitions.some(r => String(r.chantierId) === String(chantierId))
    );

  // ── Écriture ─────────────────────────────────────────────────────────────

  /**
   * Ajoute un nouveau pointage. Génère id, saisi_le et modifie_le automatiquement.
   * @param {Omit<import('../types/pointage').Pointage, 'id'|'saisi_le'|'modifie_le'>} pointage
   * @returns {{ ok: boolean, error?: string }}
   */
  const addPointage = (pointage) => {
    for (const r of (pointage.repartitions || [])) {
      const err = erreurRepartition(r);
      if (err) return { ok: false, error: err };
    }
    const now = new Date().toISOString();
    const nouveau = {
      ...pointage,
      id: genererIdPointage(),
      saisi_le: now,
      modifie_le: now,
    };
    setPointages(prev => [...prev, nouveau]);
    return { ok: true };
  };

  /**
   * Met à jour les champs d'un pointage existant. Met à jour modifie_le.
   * @param {string} id
   * @param {Partial<import('../types/pointage').Pointage>} changes
   * @returns {{ ok: boolean, error?: string }}
   */
  const updatePointage = (id, changes) => {
    if (changes.repartitions) {
      for (const r of changes.repartitions) {
        const err = erreurRepartition(r);
        if (err) return { ok: false, error: err };
      }
    }
    const modifie_le = new Date().toISOString();
    setPointages(prev => prev.map(p =>
      p.id === id ? { ...p, ...changes, modifie_le } : p
    ));
    return { ok: true };
  };

  /**
   * Supprime un pointage par son id.
   * @param {string} id
   */
  const deletePointage = (id) => {
    setPointages(prev => prev.filter(p => p.id !== id));
  };

  /**
   * Ajoute ou met à jour selon l'unicité (date, employeId).
   * Last-write-wins via modifie_le (Phase 3 — Phase 5 ajoutera verrouillage optimiste).
   * @param {Omit<import('../types/pointage').Pointage, 'id'|'saisi_le'|'modifie_le'>} pointage
   * @returns {{ ok: boolean, error?: string }}
   */
  const upsertPointage = (pointage) => {
    const existing = pointages.find(p =>
      p.date === pointage.date && String(p.employeId) === String(pointage.employeId)
    );
    if (existing) {
      return updatePointage(existing.id, {
        repartitions: pointage.repartitions,
        deplacement: pointage.deplacement ?? existing.deplacement,
        saisi_par: pointage.saisi_par ?? existing.saisi_par,
      });
    }
    return addPointage(pointage);
  };

  return {
    getPointage,
    getPointagesParDate,
    getPointagesParEmploye,
    getPointagesParChantier,
    addPointage,
    updatePointage,
    deletePointage,
    upsertPointage,
  };
}
