import { useEffect, useReducer, useRef } from 'react';

// L'updater ne publie aucun message. Le rendu demandé après sa mise en file
// permet de lire son résultat, même si React le diffère ou le rejoue.
export default function useActionConfirmee(afficherNotif) {
  const resultats = useRef(new Set());
  const [, rendre] = useReducer(n => n + 1, 0);
  useEffect(() => {
    for (const resultat of resultats.current) {
      if (!resultat.execute) continue;
      resultats.current.delete(resultat);
      if (resultat.message) {
        if (resultat.erreur) afficherNotif?.(resultat.message, 'error');
        else afficherNotif?.(resultat.message);
      }
      if (!resultat.erreur) resultat.apres?.();
    }
  });
  return (setter, transformer, message, apres) => {
    const resultat = { execute: false, message, apres };
    resultats.current.add(resultat);
    setter((prev, ...contexte) => {
      const decision = transformer(prev, ...contexte);
      resultat.execute = true;
      resultat.erreur = decision.erreur;
      resultat.message = decision.erreur || decision.message || message;
      return decision.erreur ? prev : decision.valeur;
    });
    rendre();
  };
}
