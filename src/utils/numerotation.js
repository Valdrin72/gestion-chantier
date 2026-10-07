const PREFIXES = { factures: 'F', devis: 'DEV', chantiers: 'CH' };
const valide = n => Number.isInteger(n) && n >= 0 && n <= 999999;
export function lireNumero(numero) {
 const m = typeof numero === 'string' && numero.trim().match(/^(F|DEV|CH)-(\d{4})-(\d{1,6})$/);
 return m ? { serie: `${m[1]}-${m[2]}`, seq: Number(m[3]) } : null;
}
export const lireCompteur = (compteurs, serie) => valide(compteurs?.[serie]) ? compteurs[serie] : 0;
export const texteNumero = e => e?.numero == null ? '' : String(e.numero).trim();
export function compteursDepuisListes(listes = {}) {
 const compteurs = {};
 for (const type of Object.keys(PREFIXES)) for (const e of listes[type] || []) {
  const n = lireNumero(texteNumero(e));
  if (n && n.serie.startsWith(`${PREFIXES[type]}-`)) compteurs[n.serie] = Math.max(compteurs[n.serie] || 0, n.seq);
 }
 return compteurs;
}
export function fusionnerCompteurs(...objets) {
 const premier = objets[0] || {};
 const resultat = {};
 for (const obj of objets) for (const [serie, n] of Object.entries(obj || {})) {
  if (/^(F|DEV|CH)-\d{4}$/.test(serie) && valide(n)) resultat[serie] = Math.max(lireCompteur(resultat, serie), lireCompteur(obj, serie));
 }
 return Object.keys(premier).length === Object.keys(resultat).length && Object.keys(resultat).every(k => premier[k] === resultat[k]) ? premier : resultat;
}
export function numeroSuivant(type, listes = {}, compteurs = {}, date = new Date()) {
 const serie = `${PREFIXES[type]}-${date.getFullYear()}`;
 const max = Math.max(lireCompteur(compteurs, serie), lireCompteur(compteursDepuisListes({[type]:listes[type]}), serie));
 return max >= 999999 ? null : `${serie}-${String(max + 1).padStart(3, '0')}`;
}
export function numeroDisponible(type, numero, listes = {}, compteurs = {}, idElement, options = {}) {
 const texte = texteNumero({ numero });
 if (!texte || (listes[type] || []).some(e => e && String(e.id) !== String(idElement) && texteNumero(e) === texte)) return false;
 const n = lireNumero(texte);
 const propre = idElement != null && (listes[type] || []).some(e => e && String(e.id) === String(idElement) && texteNumero(e) === texte);
 return propre || !n || options.ignorerCompteur || (n.serie.startsWith(`${PREFIXES[type]}-`) && n.seq > lireCompteur(compteurs, n.serie));
}
export function attribuerNumero(type, element, listes = {}, compteurs = {}, date = new Date(), options = {}) {
 if (options.ignorerCompteur && !texteNumero(element) && type !== 'factures') return { element, change: null };
 const n = lireNumero(texteNumero(element));
 const bonneSerie = options.ignorerCompteur || !n || texteNumero(element) === numeroSuivant(type, listes, compteurs, date);
 if (bonneSerie && numeroDisponible(type, element.numero, listes, compteurs, element.id, options)) return { element, change: null };
 const nouveau = numeroSuivant(type, listes, compteurs, date);
 if (!nouveau) return { erreur: `Plus aucun numéro disponible pour la série ${PREFIXES[type]}-${date.getFullYear()}` };
 return { element: {...element, numero:nouveau}, change:{ancien:texteNumero(element), nouveau, raison:raisonChangement(type, element, listes, compteurs, date)} };
}
// Pourquoi le numéro a été remplacé : 'vide' (champ vidé), 'pris' (porté par un autre élément, ou déjà
// attribué dans la série en cours — numéro inférieur ou égal au dernier attribué), 'invalide' sinon
// (autre préfixe, autre année, hors séquence). Seul 'pris' justifie « était déjà utilisé ».
function raisonChangement(type, element, listes, compteurs, date) {
 const texte = texteNumero(element);
 if (!texte) return 'vide';
 if ((listes[type] || []).some(e => e && String(e.id) !== String(element.id) && texteNumero(e) === texte)) return 'pris';
 const n = lireNumero(texte), serie = `${PREFIXES[type]}-${date.getFullYear()}`;
 const dernier = Math.max(lireCompteur(compteurs, serie), lireCompteur(compteursDepuisListes({ [type]: listes[type] }), serie));
 return n && n.serie === serie && n.seq <= dernier ? 'pris' : 'invalide';
}
export function avecCompteurs(prev, next) {
 const compteurs = fusionnerCompteurs(prev.parametres?.compteursNumeros, next.parametres?.compteursNumeros, compteursDepuisListes(prev), compteursDepuisListes(next));
 if (compteurs === next.parametres?.compteursNumeros || (!next.parametres?.compteursNumeros && !Object.keys(compteurs).length)) return next;
 return {...next, parametres:{...next.parametres, compteursNumeros:compteurs}};
}
export function messageNumero(change, nom) {
 if (!change) return undefined;
 if (change.raison === 'vide' || !change.ancien) return `Numéro attribué automatiquement : ${nom} a reçu ${change.nouveau}`;
 if (change.raison === 'pris') return `${change.ancien} était déjà utilisé : ${nom} a reçu ${change.nouveau}`;
 return `Numéro invalide : ${nom} a reçu ${change.nouveau}`;
}
