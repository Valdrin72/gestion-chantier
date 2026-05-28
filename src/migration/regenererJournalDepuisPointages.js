/**
 * Phase 5a — Pattern "journal dérivé" (strangler fig).
 *
 * Régénère chantier.journal[] depuis pointages[] pour maintenir la rétro-compat
 * avec tous les consommateurs qui lisent encore chantier.journal (agents IA, exports,
 * rapports — Phases 6, 7, 8).
 *
 * Règles métier :
 * - Inclus : catégories 'production' et 'atelier' uniquement
 * - Exclus : 'deplacement', 'absence', 'formation', 'chantier_autre'
 * - F3 multi-chantier : chaque journal ne voit que les heures de SA repartition
 * - Granularité : 1 entrée journal par date, agrégeant tous les employés ce jour-là
 * - heuresTravaillees stocké en number (pas string) — cohérent avec heuresEmploye()
 * - Journal trié par date ASC (cohérent avec l'ancien format)
 */

const CATEGORIES_JOURNAL = ['production', 'atelier'];

/**
 * @param {import('../types/pointage').Pointage[]} pointages - tous les pointages de l'app
 * @param {Object[]} chantiers - chantiers actuels
 * @returns {Object[]} chantiers avec journal[] reconstruit
 */
export function regenererJournalDepuisPointages(pointages, chantiers) {
  return chantiers.map(chantier => {
    const chantierId = String(chantier.id);

    // Map<date, Map<employeId, heures>>
    const parDate = new Map();

    for (const p of pointages) {
      for (const r of p.repartitions) {
        if (
          String(r.chantierId) === chantierId &&
          CATEGORIES_JOURNAL.includes(r.categorie)
        ) {
          const heures = parseFloat(r.heures) || 0;
          if (heures <= 0) continue;

          if (!parDate.has(p.date)) parDate.set(p.date, new Map());
          const parEmp = parDate.get(p.date);
          const empId  = parseInt(p.employeId) || p.employeId;
          parEmp.set(empId, (parEmp.get(empId) || 0) + heures);
        }
      }
    }

    if (parDate.size === 0) {
      return { ...chantier, journal: [] };
    }

    const journal = Array.from(parDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, empMap]) => ({
        date,
        employes: Array.from(empMap.entries()).map(([employeId, heuresTravaillees]) => ({
          employeId,
          heuresTravaillees,
        })),
      }));

    return { ...chantier, journal };
  });
}
