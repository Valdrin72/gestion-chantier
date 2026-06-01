/**
 * Rien ne se détruit — tout ce qui a un historique ne peut être supprimé.
 *
 * Ces fonctions détectent si une entité est référencée par des données historiques
 * (pointages, factures, chantiers liés…). Elles retournent null si l'entité est
 * "vierge" (suppression autorisée) ou un message d'erreur lisible si elle est
 * référencée (suppression bloquée).
 */

/**
 * Un chantier peut être supprimé seulement s'il n'a aucun pointage et aucune facture.
 */
export function chantierEstReferencé(chantier, { factures = [], pointages = [] } = {}) {
  const id = String(chantier.id);
  const aFactures = factures.some(f => String(f.chantierId) === id);
  const aPointages = pointages.some(p =>
    (p.repartitions || []).some(r => String(r.chantierId) === id)
  );
  if (aFactures || aPointages) {
    return 'Ce chantier a des heures pointées et/ou des factures — il ne peut pas être supprimé. Passe-le en Terminé ou Annulé pour conserver l\'historique.';
  }
  return null;
}

/**
 * Un client peut être supprimé seulement s'il n'a aucun chantier, devis ou facture.
 */
export function clientEstReferencé(client, { chantiers = [], devis = [], factures = [] } = {}) {
  const id = String(client.id);
  const chantiersLies = chantiers.filter(ch => String(ch.clientId) === id);
  const devisLies = devis.filter(dv => String(dv.clientId) === id);
  const idsCh = new Set(chantiersLies.map(ch => String(ch.id)));
  const idsDevis = new Set(devisLies.map(dv => String(dv.id)));
  const aFactures = factures.some(f =>
    idsCh.has(String(f.chantierId)) || idsDevis.has(String(f.devisId))
  );
  if (chantiersLies.length > 0 || devisLies.length > 0 || aFactures) {
    return 'Ce client a des chantiers, devis ou factures — il ne peut pas être supprimé, son historique doit être conservé.';
  }
  return null;
}

/**
 * Un devis peut être supprimé seulement s'il n'a aucun chantier lié et aucune facture.
 */
export function devisEstReferencé(devis, { chantiers = [], factures = [] } = {}) {
  const id = String(devis.id);
  const chantiersLies = chantiers.filter(ch => String(ch.devisId) === id);
  const facturesLiees = factures.filter(f =>
    String(f.devisId) === id ||
    chantiersLies.some(ch => String(ch.id) === String(f.chantierId))
  );
  if (chantiersLies.length > 0 || facturesLiees.length > 0) {
    const parties = [];
    if (chantiersLies.length > 0) parties.push(`${chantiersLies.length} chantier(s) lié(s)`);
    if (facturesLiees.length > 0) parties.push(`${facturesLiees.length} facture(s) liée(s)`);
    return `Ce devis ne peut pas être supprimé — il est référencé par ${parties.join(' et ')}. Conserve-le pour garder l'historique.`;
  }
  return null;
}

/**
 * Un employé peut être supprimé (ou désactivé) seulement s'il n'a aucun pointage.
 * En pratique : ne jamais supprimer — marquer `actif: false`.
 */
export function employeEstReferencé(employe, { pointages = [] } = {}) {
  const id = String(employe.id);
  const aPointages = pointages.some(p =>
    (p.repartitions || []).some(r => String(r.employeId) === id) ||
    String(p.employeId) === id
  );
  if (aPointages) {
    return 'Cet employé a des heures pointées — il ne peut pas être supprimé. Désactive-le pour le masquer de la saisie.';
  }
  return null;
}
