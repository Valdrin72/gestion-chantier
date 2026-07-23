/**
 * Pseudonymisation des données avant tout envoi à un service IA externe, et
 * ré-identification des réponses avant affichage. CYNA SÀRL — confidentialité.
 *
 * Principe : aucun nom identifiant (chantier, client, employé, adresse, ville)
 * ne quitte l'application. Les montants, %, dates, heures, types de travaux
 * partent tels quels — un chiffre seul ne trahit personne.
 *
 * La table de correspondance est construite EN MÉMOIRE à chaque appel, jamais
 * persistée. Les pseudonymes sont STABLES (ordre déterministe par id) pour que
 * la mémoire stockée pseudonymisée reste ré-identifiable d'une session à l'autre.
 */

// Échappe une chaîne pour usage littéral dans une RegExp.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Frontières « token » Unicode : le nom doit être isolé (pas au milieu d'un mot/nombre).
// Évite qu'un client « SA » ou une ville « Meyrin » ne mutile « Meyrinoise »/« passage ».
const tokenRegex = (motif) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${esc(motif)}(?![\\p{L}\\p{N}])`, 'giu');

// A, B, … Z, AA, AB … pour les pseudonymes clients (respecte l'exemple « Client A »).
const lettre = (i) => {
  let s = '';
  i += 1;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
};

const parId = (a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
const nonVide = (v) => (v ?? '').toString().trim();

/**
 * Construit la correspondance nom réel ⇄ pseudonyme depuis les entités connues.
 * @returns {{ sortants: {reel:string,pseudo:string}[], versReel: Record<string,string>, pseudos: string[] }}
 *   - sortants : couples (nom réel → pseudo), triés du plus long au plus court (remplacement sûr)
 *   - versReel : pseudo → nom réel canonique (ré-identification)
 *   - pseudos  : liste des pseudos, triés du plus long au plus court
 */
export function construireCorrespondance({ chantiers = [], clients = [], employes = [] } = {}) {
  const sortants = [];
  const versReel = {};
  const vus = new Set(); // noms réels déjà mappés (insensible casse)

  const ajouter = (reel, pseudo, canon) => {
    const r = nonVide(reel);
    if (r.length < 3) return; // trop court → trop générique, on n'y touche pas
    const k = r.toLowerCase();
    if (vus.has(k)) return;
    vus.add(k);
    sortants.push({ reel: r, pseudo });
    if (!(pseudo in versReel)) versReel[pseudo] = nonVide(canon) || pseudo;
  };

  [...chantiers].sort(parId).forEach((c, i) => {
    const p = `Chantier ${i + 1}`;
    ajouter(c.nom, p, c.nom);
    ajouter(c.adresse, `${p} (adresse)`, c.adresse);
  });

  [...clients].sort(parId).forEach((c, i) => {
    const p = `Client ${lettre(i)}`;
    const canon = nonVide(c.entreprise) || nonVide([c.prenom, c.nom].filter(Boolean).join(' ')) || nonVide(c.nom);
    ajouter(c.entreprise, p, canon);
    ajouter([c.prenom, c.nom].filter(Boolean).join(' '), p, canon);
    ajouter(c.nom, p, canon);
    ajouter(c.adresse, `${p} (adresse)`, c.adresse);
  });

  [...employes].sort(parId).forEach((e, i) => {
    ajouter(e.nom, `Employé ${i + 1}`, e.nom);
  });

  // Villes en dernier (moins spécifiques). Dédupliquées par nom.
  let nv = 0;
  [...clients, ...chantiers].forEach((x) => {
    const v = nonVide(x.ville);
    if (v && !vus.has(v.toLowerCase())) { nv += 1; ajouter(x.ville, `Localité ${nv}`, x.ville); }
  });

  sortants.sort((a, b) => b.reel.length - a.reel.length);
  const pseudos = Object.keys(versReel).sort((a, b) => b.length - a.length);
  return { sortants, versReel, pseudos };
}

/** Remplace, dans une chaîne, tous les noms réels connus par leur pseudonyme. */
export function pseudonymiserTexte(texte, corr) {
  if (typeof texte !== 'string' || !texte) return texte;
  let out = texte;
  for (const { reel, pseudo } of corr.sortants) out = out.replace(tokenRegex(reel), pseudo);
  return out;
}

/** Pseudonymise récursivement toute valeur JSON (chaînes uniquement ; nombres/dates intacts). */
export function pseudonymiser(valeur, corr) {
  if (typeof valeur === 'string') return pseudonymiserTexte(valeur, corr);
  if (Array.isArray(valeur)) return valeur.map((v) => pseudonymiser(v, corr));
  if (valeur && typeof valeur === 'object') {
    const o = {};
    for (const k of Object.keys(valeur)) o[k] = pseudonymiser(valeur[k], corr);
    return o;
  }
  return valeur; // nombre, booléen, null, undefined → inchangé
}

/** Remplace, dans un texte de réponse, les pseudonymes par les vrais noms (affichage). */
export function reidentifier(texte, corr) {
  if (typeof texte !== 'string' || !texte) return texte;
  let out = texte;
  for (const pseudo of corr.pseudos) out = out.replace(tokenRegex(pseudo), corr.versReel[pseudo]);
  return out;
}
