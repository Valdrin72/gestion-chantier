// Copies de secours locales des modifications qui n'ont PAS été enregistrées (conflit de
// version, ou garde « modifié sur un autre appareil » d'un formulaire). Partagé par
// useSupabaseData et les formulaires Devis / Chantiers / Clients.
//
// Chaque refus a SA clé 'cyna_sauvegarde_rejetee_<horodatage>-<suffixe>' (jamais réécrite par un
// autre refus). La rétention se calcule sur les clés RÉELLEMENT présentes : on garde les
// NB_COPIES_REJETEES plus récentes. 'cyna_sauvegarde_rejetee' = copie du dernier refus, au mieux.

export const PREFIXE_COPIE_REJETEE = 'cyna_sauvegarde_rejetee_';
export const NB_COPIES_REJETEES = 5;

export function nouvelIdCopie() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Écrit (ou réécrit, pour le même id) une copie rejetée puis applique la rétention.
 * @returns {boolean} true seulement si la copie de CE refus a réellement été écrite.
 */
export function enregistrerCopieRejetee(id, contenu) {
  const entree = { id, date: new Date().toISOString(), ...contenu };
  try {
    localStorage.setItem(`${PREFIXE_COPIE_REJETEE}${id}`, JSON.stringify(entree));
  } catch {
    return false;
  }
  try {
    const horodatage = cle => parseInt(cle.slice(PREFIXE_COPIE_REJETEE.length), 10) || 0;
    Object.keys(localStorage)
      .filter(cle => cle.startsWith(PREFIXE_COPIE_REJETEE))
      .sort((a, b) => horodatage(b) - horodatage(a))
      .slice(NB_COPIES_REJETEES)
      .forEach(cle => localStorage.removeItem(cle));
  } catch {}
  try { localStorage.setItem('cyna_sauvegarde_rejetee', JSON.stringify(entree)); } catch {}
  return true;
}
