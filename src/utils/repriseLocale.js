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
