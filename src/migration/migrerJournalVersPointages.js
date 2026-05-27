/**
 * Migration Phase 3 : convertit chantier.journal[] vers le nouveau modèle Pointage[].
 *
 * Règles :
 * - 1 Pointage par (date, employeId) — multi-chantier → plusieurs repartitions
 * - Toutes les heures migrées ont la catégorie 'production'
 * - chantier.journal est conservé intact (supprimé en Phase 8)
 * - Migration idempotente via parametres.migrationJournalV2Done
 *
 * Edge cases couverts :
 * 1. chantier.journal absent ou undefined → skip
 * 2. entry.employes absent ou vide → skip
 * 3. heuresTravaillees NaN / null / 0 → skip
 * 4. employeId absent ou 0 → skip
 * 5. employeId inconnu dans employes[] → migré + console.warn
 * 6. Doublon (date + employeId + chantierId) → heures sommées
 * 7. Même (date + employeId) sur deux chantiers → 1 Pointage, 2 repartitions (F3)
 * 8. entry.date absente → skip
 */

/**
 * @param {Object[]} chantiers - tableau de chantiers avec chantier.journal[]
 * @param {Object[]} employes  - liste des employés de parametres.employes
 * @returns {import('../types/pointage').Pointage[]}
 */
export function migrerJournalVersPointages(chantiers, employes = []) {
  const now = new Date().toISOString();
  const empIds = new Set(employes.map(e => String(e.id)));

  // Accumulateur : clé `YYYY-MM-DD_empId` → { date, employeId, repartitions: { chantierId → heures } }
  const acc = {};

  for (const chantier of chantiers) {
    // Edge case 1 — journal absent
    const journal = chantier.journal;
    if (!journal || !Array.isArray(journal)) continue;

    const chantierId = String(chantier.id);

    for (const entry of journal) {
      // Edge case 8 — date absente
      const date = entry.date;
      if (!date) continue;

      // Edge case 2 — employes absent ou vide
      const lignesEmployes = entry.employes;
      if (!lignesEmployes || !Array.isArray(lignesEmployes) || lignesEmployes.length === 0) continue;

      for (const ej of lignesEmployes) {
        // Edge case 4 — employeId absent ou falsy
        const employeId = parseInt(ej.employeId);
        if (!employeId) continue;

        // Edge case 3 — heures invalides ou nulles
        const heures = parseFloat(ej.heuresTravaillees) || 0;
        if (heures <= 0) continue;

        // Edge case 5 — employeId inconnu dans la liste (migrer quand même)
        if (!empIds.has(String(employeId))) {
          console.warn(`[migration Phase 3] Employé #${employeId} non trouvé dans employes[] — migré quand même`);
        }

        const key = `${date}_${employeId}`;
        if (!acc[key]) acc[key] = { date, employeId, repartitions: {} };

        // Edge case 6 — doublon (même date + employeId + chantierId) → sommer les heures
        acc[key].repartitions[chantierId] = (acc[key].repartitions[chantierId] || 0) + heures;
      }
    }
  }

  // Transformer l'accumulateur en pointages
  // Edge case 7 est géré naturellement : même key = même Pointage, plusieurs repartitions
  return Object.values(acc).map(({ date, employeId, repartitions }) => ({
    id: `ptg_mig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date,
    employeId,
    repartitions: Object.entries(repartitions).map(([chantierId, heures]) => ({
      chantierId,
      categorie: 'production',
      heures,
    })),
    deplacement: null,
    majoration: null,
    saisi_par: 'migration_phase3',
    saisi_le: now,
    modifie_le: now,
  }));
}
