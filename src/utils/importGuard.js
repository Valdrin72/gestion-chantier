/**
 * Gardes des imports/remplacements de masse (principe "Rien ne se détruit").
 * Fonctions PURES → testables directement, utilisées par ClientsPage (C4) et ParametresPage (C3).
 */
import { clientEstReferencé } from './referenceGuard';

/**
 * C4 — Remplacement de la liste clients qui NE SUPPRIME JAMAIS un client référencé
 * (ayant chantiers/devis/factures). Les clients référencés sont CONSERVÉS ; seuls les clients
 * vierges sont remplacés par les nouveaux.
 *
 * @param {Object[]} clientsActuels
 * @param {Object[]} nouveauxClients - déjà dotés d'ids par l'appelant
 * @param {{chantiers?:Object[], devis?:Object[], factures?:Object[]}} refs
 * @returns {{ resultat: Object[], conserves: number, remplaces: number, conservesClients: Object[] }}
 */
export function remplacerClientsAvecGarde(clientsActuels = [], nouveauxClients = [], refs = {}) {
  const conservesClients = (clientsActuels || []).filter(c => clientEstReferencé(c, refs) !== null);
  const remplaces = (clientsActuels || []).length - conservesClients.length;
  return {
    resultat: [...conservesClients, ...(nouveauxClients || [])],
    conserves: conservesClients.length,
    remplaces,
    conservesClients,
  };
}

/**
 * C3 — Décision de restauration des pointages selon le format du backup.
 * - backup SANS clé `pointages` (ancien format) → on CONSERVE les pointages actuels (jamais d'écrasement à []).
 * - backup AVEC `pointages` → remplacement autorisé (l'appelant doit confirmer de façon typée avant).
 *
 * @param {Object} backup - contenu JSON importé
 * @param {Object[]} pointagesActuels
 * @returns {{ ancienFormat: boolean, ecrase: boolean, pointages: Object[] }}
 */
export function pointagesApresRestauration(backup, pointagesActuels = []) {
  const hasPointages = Array.isArray(backup?.pointages);
  return hasPointages
    ? { ancienFormat: false, ecrase: true,  pointages: backup.pointages }
    : { ancienFormat: true,  ecrase: false, pointages: pointagesActuels }; // conserve l'existant
}

/** Total des heures productives dans un tableau de pointages (pour l'avertissement AVANT écrasement). */
export function totalHeuresPointages(pointages = []) {
  return (pointages || []).reduce((s, p) =>
    s + (p.repartitions || []).reduce((t, r) => t + (parseFloat(r.heures) || 0), 0), 0);
}
