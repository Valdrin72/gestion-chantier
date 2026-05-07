// ============================================================
// CYNA — PERMISSIONS v2
// Structure : pages autorisées + actions granulaires par profil
// ============================================================

export const PERMISSIONS = {
  direction: {
    pages: ['dashboard', 'chantiers', 'devis', 'factures', 'clients', 'employes', 'planning', 'statistiques', 'paiements', 'parametres', 'rapport', 'analyse', 'importpdf', 'metrage', 'photos'],
    actions: {
      voirFinances:       true,
      modifierPrix:       true,
      supprimerDonnees:   true,
      validerDevis:       true,
      emettreFactures:    true,
      voirSalaires:       true,
      gererParametres:    true,
      voirClients:        true,
      gererEmployes:      true,
      voirStatistiques:   true,
      voirRapport:        true,
      gererPaiements:     true,
    },
  },

  conducteur: {
    pages: ['dashboard', 'chantiers', 'employes', 'planning', 'importpdf', 'metrage', 'photos'],
    actions: {
      voirFinances:       false,
      modifierPrix:       false,
      supprimerDonnees:   false,
      validerDevis:       false,
      emettreFactures:    false,
      voirSalaires:       false,
      gererParametres:    false,
      voirClients:        false,
      gererEmployes:      true,
      voirStatistiques:   false,
      voirRapport:        false,
      gererPaiements:     false,
    },
  },

  administratif: {
    pages: ['dashboard', 'clients', 'devis', 'factures', 'paiements', 'statistiques', 'rapport', 'analyse'],
    actions: {
      voirFinances:       true,
      modifierPrix:       true,
      supprimerDonnees:   false,
      validerDevis:       true,
      emettreFactures:    true,
      voirSalaires:       false,
      gererParametres:    false,
      voirClients:        true,
      gererEmployes:      false,
      voirStatistiques:   true,
      voirRapport:        true,
      gererPaiements:     true,
    },
  },

  chef_equipe: {
    pages: ['dashboard', 'chantiers', 'planning'],
    actions: {
      voirFinances:       false,
      modifierPrix:       false,
      supprimerDonnees:   false,
      validerDevis:       false,
      emettreFactures:    false,
      voirSalaires:       false,
      gererParametres:    false,
      voirClients:        false,
      gererEmployes:      false,
      voirStatistiques:   false,
      voirRapport:        false,
      gererPaiements:     false,
    },
  },
};

/**
 * Vérifie si un profil peut accéder à une page donnée.
 * @param {string} profilId - ex: 'direction'
 * @param {string} page - ex: 'factures'
 * @returns {boolean}
 */
export function peutAcceder(profilId, page) {
  const perms = PERMISSIONS[profilId];
  if (!perms) return false;
  return perms.pages.includes(page);
}

/**
 * Vérifie si un profil peut effectuer une action donnée.
 * @param {string} profilId - ex: 'administratif'
 * @param {string} action - ex: 'emettreFactures'
 * @returns {boolean}
 */
export function peutFaire(profilId, action) {
  const perms = PERMISSIONS[profilId];
  if (!perms) return false;
  return perms.actions[action] === true;
}

/**
 * Retourne la liste des pages autorisées pour un profil.
 * @param {string} profilId
 * @returns {string[]}
 */
export function getPagesAutorisees(profilId) {
  return PERMISSIONS[profilId]?.pages ?? [];
}
