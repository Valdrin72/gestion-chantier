// Source unique de vérité pour les statuts chantier dans toute l'application.
// Importer depuis ici — ne pas redéfinir inline dans les composants.

export const STATUTS_ACTIFS   = ['En cours', 'Planifié'];
export const STATUTS_CLOS     = ['Terminé', 'Facturé', 'Clôturé'];
export const STATUTS_ATTENTION = ['Suspendu'];
export const TOUS_STATUTS     = [...STATUTS_ACTIFS, 'Suspendu', ...STATUTS_CLOS];
