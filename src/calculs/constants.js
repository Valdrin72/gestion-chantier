export const CYNA_PARAMS = {
  TVA: 0.081,
  COEFF_ACHAT_MAT: 1.20,
  HEURES_PROD_AN: 1700,
  CHARGES_SOCIALES: 0.16,
  DSO_CIBLE: 45,
  MARGE_CIBLE: 0.25,
  TAUX_FG: 0.12, // aligné sur donnees.js défaut (tauxFraisGeneraux = 12%)

  TRESORERIE_SEUIL_ALERTE: 20_000,     // défaut du seuil d'alerte trésorerie (configurable dans Paramètres)
  TRESORERIE_FRAICHEUR_JOURS: 14,      // au-delà, le solde bancaire saisi est jugé périmé
};

// Tarifs journaliers déjà tout compris (charges sociales incluses) → pas de majoration.
export const COEF_MO_DEFAUT = 1.0;
