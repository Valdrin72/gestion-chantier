// Trier les clés des objets ; l'ordre des listes reste significatif.
function stable(valeur) {
  if (Array.isArray(valeur)) return valeur.map(stable);
  if (valeur && typeof valeur === 'object') {
    return Object.fromEntries(Object.keys(valeur).sort().map(cle => [cle, stable(valeur[cle])]));
  }
  return valeur;
}

export function aEteModifieAilleurs(origine, actuel) {
  return !actuel || JSON.stringify(stable(origine)) !== JSON.stringify(stable(actuel));
}
