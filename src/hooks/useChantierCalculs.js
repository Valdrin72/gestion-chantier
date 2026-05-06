import { useMemo } from 'react';
import { calculerEtatChantier, calculerCoutsChantier } from '../donnees';
import { useApp } from '../context/AppContext';

export function useChantierCalculs(selected) {
  const { parametres, devis = [] } = useApp();

  const etat = useMemo(() => {
    if (!selected) return null;
    return calculerEtatChantier(selected, parametres.employes, devis);
  }, [selected, parametres.employes, devis]);

  const couts = useMemo(() => {
    if (!selected) return null;
    return calculerCoutsChantier(selected, parametres.employes, parametres.localites, parametres.parametres, devis);
  }, [selected, parametres.employes, parametres.localites, parametres.parametres, devis]);

  return { etat, couts };
}
