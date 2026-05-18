// ============================================================
// CYNA — PERMISSIONS
// Deux entités : CYNA et CYNATECH — accès total identique.
// Point d'entrée unique, pas de rôles restreints.
// ============================================================

const ACCES_TOTAL = {
  pages: [
    'dashboard', 'chantiers', 'clients', 'employes', 'devis', 'heures',
    'finances', 'planning', 'rapport', 'agents', 'parametres',
    'factures', 'statistiques', 'paiements', 'analyse', 'importpdf', 'metrage', 'photos',
  ],
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
};

export const PERMISSIONS = {
  cyna:     ACCES_TOTAL,
  cynatech: ACCES_TOTAL,
};

export function peutAcceder(profilId, page) {
  return PERMISSIONS[profilId]?.pages.includes(page) ?? true;
}

export function peutFaire(profilId, action) {
  return PERMISSIONS[profilId]?.actions[action] ?? true;
}

export function getPagesAutorisees(profilId) {
  return PERMISSIONS[profilId]?.pages ?? ACCES_TOTAL.pages;
}
