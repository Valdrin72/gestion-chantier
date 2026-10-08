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
 * La copie qu'on vient d'écrire est TOUJOURS protégée : elle compte comme la plus récente
 * (même si son id est ancien, ex. conflit réécrit pendant sa récupération) et la limite
 * s'applique aux AUTRES copies (REV-01).
 * @returns {boolean} true seulement si la copie de CE refus existe réellement après rétention.
 */
export function enregistrerCopieRejetee(id, contenu, { sansRetention = false } = {}) {
  const cleCopie = `${PREFIXE_COPIE_REJETEE}${id}`;
  const entree = { id, date: new Date().toISOString(), ...contenu };
  try {
    localStorage.setItem(cleCopie, JSON.stringify(entree));
  } catch {
    return false;
  }
  try {
    const horodatage = cle => parseInt(cle.slice(PREFIXE_COPIE_REJETEE.length), 10) || 0;
    if (!sansRetention) Object.keys(localStorage)
      .filter(cle => cle.startsWith(PREFIXE_COPIE_REJETEE) && cle !== cleCopie)
      .sort((a, b) => horodatage(b) - horodatage(a))
      .slice(NB_COPIES_REJETEES - 1)
      .forEach(cle => localStorage.removeItem(cle));
  } catch {}
  // Pendant un import, même la copie historique sans suffixe reste intacte.
  try {
    if (!sansRetention || localStorage.getItem('cyna_sauvegarde_rejetee') === null) localStorage.setItem('cyna_sauvegarde_rejetee', JSON.stringify(entree));
  } catch {}
  try { return localStorage.getItem(cleCopie) !== null; } catch { return false; }
}

export const PREFIXE_ECHEC = 'cyna_sauvegarde_en_echec_';

// Ces clés ne participent jamais à la rétention des copies rejetées.
export function lireCopieEchec(cle) {
  try { return JSON.parse(localStorage.getItem(cle)); } catch { return null; }
}
export function ecrireCopieEchec(cle, contenu) {
  const texte = JSON.stringify(contenu);
  try {
    localStorage.setItem(cle, texte);
    return localStorage.getItem(cle) === texte;
  } catch { return false; }
}
export function rangerCopieEchec(cle, source) {
  const copie = lireCopieEchec(cle);
  if (!copie) return true;
  const id = nouvelIdCopie();
  if (!enregistrerCopieRejetee(id, { ...copie, source }) || !localStorage.getItem(PREFIXE_COPIE_REJETEE + id)) return false;
  try { localStorage.removeItem(cle); return true; } catch { return false; }
}

export const PREFIXE_AVANT_IMPORT = 'cyna_sauvegarde_avant_import_';
export function ecrireCopieAvantImport(userId, instantane) {
  const cle = `${PREFIXE_AVANT_IMPORT}${userId}_${nouvelIdCopie()}`;
  try {
    const texte = JSON.stringify(instantane);
    localStorage.setItem(cle, texte);
    return { ok: localStorage.getItem(cle) === texte, cle };
  } catch (erreur) {
    const stockagePlein = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(erreur?.name) || [22, 1014].includes(erreur?.code);
    return { ok: false, cle, stockagePlein };
  }
}
export function listerCopies(stockage, userId) {
  const copies = [];
  for (let i = 0; i < stockage.length; i++) {
    const cle = stockage.key(i);
    const type = cle.startsWith(PREFIXE_ECHEC + userId + '_') ? 'échec' :
      cle.startsWith(PREFIXE_AVANT_IMPORT + userId + '_') ? 'avant import' :
      cle === 'cyna_sauvegarde_rejetee' || cle.startsWith(PREFIXE_COPIE_REJETEE) ? 'refus' : null;
    if (!type) continue;
    const texte = stockage.getItem(cle);
    let contenu = null;
    try { contenu = JSON.parse(texte); } catch {}
    const complete = contenu && ['chantiers','devis','factures','clients'].every(k => Array.isArray(contenu[k])) && contenu.parametres && typeof contenu.parametres === 'object' && !Array.isArray(contenu.parametres);
    const date = contenu?.date || contenu?.meta?.date;
    copies.push({ cle, type, texte, contenu, complete: !!complete, date: typeof date === 'string' ? date : 'date inconnue',
      comptes: Object.fromEntries(['chantiers','devis','factures','clients','pointages'].map(k => [k, Array.isArray(contenu?.[k]) ? contenu[k].length : 0])) });
  }
  return copies.sort((a,b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || a.cle.localeCompare(b.cle));
}
