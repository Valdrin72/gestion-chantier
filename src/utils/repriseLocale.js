import { verifierValeurServeur } from './importControle';
export const CLES_REPRISE = {
  objectifs: 'cyna_objectifs',
  evenementsCalendrier: 'cyna_cal_events',
  memoireIA: 'cyna_ia_memoire',
};
export function empreinte(texte) {
  if (texte === null) return 'absente';
  let hash = 2166136261;
  for (let i = 0; i < texte.length; i++) hash = Math.imul(hash ^ texte.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function canonique(valeur) {
  if (Array.isArray(valeur)) return '[' + valeur.map(canonique).join(',') + ']';
  if (valeur && typeof valeur === 'object') return '{' + Object.keys(valeur).sort().map(k => JSON.stringify(k) + ':' + canonique(valeur[k])).join(',') + '}';
  return JSON.stringify(valeur);
}
export function lireValeurLocale(cle, texteBrut) {
  const capture = { texteBrut, empreinte: empreinte(texteBrut), presente: texteBrut !== null };
  if (!capture.presente) return capture;
  try {
    const valeur = cle === 'memoireIA' ? texteBrut : JSON.parse(texteBrut);
    const valide = verifierValeurServeur(cle, valeur).length === 0;
    return { ...capture, valeur, illisible: !valide };
  } catch { return { ...capture, illisible: true }; }
}
export function planifierReprise(serveur, local) {
  return Object.fromEntries(Object.keys(CLES_REPRISE).map(cle => {
    const capture = local[cle] || lireValeurLocale(cle, null);
    const action = capture.illisible ? 'copie-brute' : !capture.presente ? 'rien' : serveur[cle] === undefined
      ? 'proposer' : canonique(serveur[cle]) === canonique(capture.valeur) ? 'rien' : 'copie';
    return [cle, { ...capture, action }];
  }));
}
export function lireMarqueur(userId) {
  try { const v = JSON.parse(localStorage.getItem('cyna_reprise_serveur_' + userId) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  catch { return {}; }
}
export function marquerReprise(userId, cle, capture) {
  try {
    const marqueur = { ...lireMarqueur(userId), [cle]: capture.empreinte };
    const texte = JSON.stringify(marqueur);
    localStorage.setItem('cyna_reprise_serveur_' + userId, texte);
    return localStorage.getItem('cyna_reprise_serveur_' + userId) === texte;
  } catch { return false; }
}
export function copierReprise(userId, cle, capture) {
  try {
    const id = window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const nom = 'cyna_sauvegarde_reprise_' + userId + '_' + id;
    const texte = JSON.stringify({ source: 'reprise-locale', date: new Date().toISOString(),
      cle, texteBrut: capture.texteBrut, ...(capture.illisible ? {} : { [cle]: capture.valeur }) });
    localStorage.setItem(nom, texte);
    return localStorage.getItem(nom) === texte;
  } catch { return false; }
}

// Lot 2b — une copie « reprise locale » lisible et valide peut être restaurée, pour sa seule clé.
export const LIBELLES_REPRISE = { objectifs: 'les objectifs', evenementsCalendrier: 'le calendrier', memoireIA: "la mémoire de l'Assistant IA" };
export function donneeRestaurable(contenu) {
  if (!contenu || typeof contenu !== 'object' || contenu.source !== 'reprise-locale') return null;
  const cle = contenu.cle;
  if (!Object.prototype.hasOwnProperty.call(CLES_REPRISE, cle) || !Object.prototype.hasOwnProperty.call(contenu, cle)) return null;
  const valeur = contenu[cle];
  return verifierValeurServeur(cle, valeur).length === 0 ? { cle, valeur } : null;
}
export function resumerDonnee(cle, valeur) {
  if (valeur === undefined) return 'aucune';
  if (cle === 'objectifs') return valeur === null ? 'aucun objectif' : `CA annuel ${valeur.caAnnuel ?? '—'}, marge ${valeur.margeCible ?? '—'} %, ${valeur.nbChantiers ?? '—'} chantiers`;
  if (cle === 'evenementsCalendrier') return `${valeur.length} événement(s)`;
  return `${String(valeur).length} caractères`;
}
// Revue Codex PR #209 — une copie déjà écrite pour ce texte exact n'est pas recréée (ex. marqueur en échec au clic précédent).
export function copieRepriseExiste(userId, cle, texteBrut) {
  try {
    const prefixe = 'cyna_sauvegarde_reprise_' + userId + '_';
    return Object.keys(localStorage).some(nom => {
      if (!nom.startsWith(prefixe)) return false;
      try { const c = JSON.parse(localStorage.getItem(nom)); return c?.source === 'reprise-locale' && c.cle === cle && c.texteBrut === texteBrut; }
      catch { return false; }
    });
  } catch { return false; }
}
