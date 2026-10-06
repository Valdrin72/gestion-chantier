import { enregistrerCopieRejetee, nouvelIdCopie } from './copiesRejetees';

// Trier les clés des objets ; l'ordre des listes reste significatif.
function stable(valeur) {
  if (Array.isArray(valeur)) return valeur.map(stable);
  if (valeur && typeof valeur === 'object') {
    return Object.fromEntries(Object.keys(valeur).sort().map(cle => [cle, stable(valeur[cle])]));
  }
  return valeur;
}

// Copie figée de l'enregistrement stocké au moment où l'édition s'ouvre.
export function copieOrigine(enregistrement) {
  return enregistrement ? JSON.parse(JSON.stringify(enregistrement)) : null;
}

export function aEteModifieAilleurs(origine, actuel) {
  return !actuel || JSON.stringify(stable(origine)) !== JSON.stringify(stable(actuel));
}

// Garde refusée : le brouillon du formulaire est aussi copié dans les copies de secours
// (comme un conflit de sauvegarde). Renvoie la fin du message à afficher.
export function conserverBrouillonRefuse(liste, brouillon) {
  const ok = enregistrerCopieRejetee(nouvelIdCopie(), { source: 'garde-edition', [liste]: [brouillon] });
  return ok
    ? ' Une copie de vos modifications est conservée sur cet appareil.'
    : " La copie locale de vos modifications n'a pas pu être conservée (stockage de l'appareil plein).";
}

// Contrairement à la garde historique, une absence inchangée est acceptée.
export function aChangeDepuis(origine, actuel) {
  if (!origine && !actuel) return false;
  if (!origine || !actuel) return true;
  return aEteModifieAilleurs(origine, actuel);
}
