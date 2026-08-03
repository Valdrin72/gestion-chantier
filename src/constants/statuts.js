// Source unique de vérité pour les statuts chantier dans toute l'application.
// Importer depuis ici — ne pas redéfinir inline dans les composants.
//
// Règle C8 (Plan directeur) — les trois états du cycle de vie :
//   1. « En cours »          — les travaux avancent.
//   2. « Attente paiement »  — travaux terminés, facturé, mais pas tout encaissé.
//   3. « Terminé »           — tout est PAYÉ : le chantier est vraiment bouclé.
// Un chantier n'est fini que quand l'argent est rentré.

export const STATUT_ATTENTE_PAIEMENT = 'Attente paiement';

export const STATUTS_ACTIFS   = ['En cours', 'Planifié'];
// Clos = travaux finis (l'attente de paiement est un état CLOS côté production :
// plus de pointages attendus, exclu du pipeline « à démarrer »).
export const STATUTS_CLOS     = [STATUT_ATTENTE_PAIEMENT, 'Terminé', 'Facturé', 'Clôturé'];
export const STATUTS_ATTENTION = ['Suspendu'];
export const TOUS_STATUTS     = [...STATUTS_ACTIFS, 'Suspendu', ...STATUTS_CLOS];

/** true si le chantier est « travaux terminés — en attente de paiement » (C8 état 2). */
export const estEnAttentePaiement = (c) =>
  (c?.statut || '').trim().toLowerCase() === 'attente paiement';
