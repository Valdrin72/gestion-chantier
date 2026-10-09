import { chantierEstReferencé, clientEstReferencé, devisEstReferencé } from './referenceGuard';
export const TYPES_CORBEILLE = ['devis', 'clients', 'chantiers'];
export const estSupprime = x => !!x?.supprime_le;
export const visibles = (liste = []) => liste.filter(x => !estSupprime(x));
export const corbeille = (liste = []) => liste.filter(estSupprime);
export function mettreALaCorbeille(x, par, maintenant = new Date()) {
 return { ...x, supprime_le: new Date(maintenant).toISOString(), supprime_par: par };
}
export function restaurerDeLaCorbeille(x) {
 const { supprime_le, supprime_par, ...reste } = x;
 return reste;
}
export function appliquerSurVisibles(prev, updater, idsSupprimes = []) {
 const actifs = visibles(prev);
 const next = typeof updater === 'function' ? updater(actifs) : updater;
 if (next === actifs) return prev;
 const morts = new Set(idsSupprimes.map(String));
 const poubelle = corbeille(prev);
 const ids = new Set(poubelle.map(x => String(x.id)));
 const resultat = next.filter(x => !morts.has(String(x.id)) && (estSupprime(x) || !ids.has(String(x.id))));
 const entrants = new Set(resultat.map(x => String(x.id)));
 return [...resultat, ...poubelle.filter(x => !entrants.has(String(x.id)))];
}
export function referenceCorbeille(type, element, listes) {
 const reste = { ...listes, [type]: (listes[type] || []).filter(x => String(x.id) !== String(element.id)) };
 return { chantiers: chantierEstReferencé, clients: clientEstReferencé, devis: devisEstReferencé }[type](element, reste);
}
export function aPurger(listes, maintenant = new Date(), jours = 30) {
 return TYPES_CORBEILLE.flatMap(type => corbeille(listes[type]).filter(element =>
  new Date(maintenant) - new Date(element.supprime_le) > jours * 86400000 && !referenceCorbeille(type, element, listes)
 ).map(element => ({ type, element })));
}
export function referentsALaCorbeille(type, element, listes) {
 const refs = [];
 const ajouter = (t, id) => {
  const x = (listes[t] || []).find(x => String(x.id) === String(id) && estSupprime(x));
  if (x && !refs.some(r => r.type === t && String(r.element.id) === String(x.id))) refs.push({ type: t, element: x });
 };
 if (type === 'chantiers') {
  ajouter('devis', element.devisId);
  const devis = (listes.devis || []).find(x => String(x.id) === String(element.devisId));
  if (devis) ajouter('clients', devis.clientId);
 }
 if (type === 'devis' || type === 'chantiers') ajouter('clients', element.clientId);
 return refs;
}
export function fusionnerIdsSupprimes(a = {}, b = {}) {
 return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map(type => {
  const ids = new Map([...(a[type] || []), ...(b[type] || [])].map(id => [String(id), id]));
  return [type, [...ids.values()]];
 }));
}
export function retirerDefinitivement(prev, candidats, modeOrg = false) {
 if (!candidats.length) return prev;
 const next = { ...prev, parametres: { ...prev.parametres, idsSupprimes: fusionnerIdsSupprimes(prev.parametres.idsSupprimes) } };
 for (const { type, element } of candidats) {
  next[type] = next[type].filter(x => String(x.id) !== String(element.id));
  next.parametres.idsSupprimes = fusionnerIdsSupprimes(next.parametres.idsSupprimes, { [type]: [element.id] });
 }
 if (modeOrg && ['chantiers', 'devis', 'clients', 'factures', 'pointages'].every(t => !next[t]?.length)) return prev;
 return next;
}
export function donneesImportees(prev, data) {
 const ids = fusionnerIdsSupprimes(prev.parametres.idsSupprimes, data.parametres.idsSupprimes);
 for (const type of TYPES_CORBEILLE) {
  const presents = new Set((data[type] || []).map(x => String(x.id)));
  if (ids[type]) ids[type] = ids[type].filter(id => !presents.has(String(id)));
 }
 return { ...prev, ...data, parametres: { ...data.parametres, idsSupprimes: ids } };
}
