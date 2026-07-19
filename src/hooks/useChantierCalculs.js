import { useMemo } from 'react';
import { calculerEtatChantier, calculerCoutsChantier } from '../donnees';
import { useApp } from '../context/AppContext';

export function useChantierCalculs(selected) {
  const { parametres, devis = [], pointages = [] } = useApp();

  const etat = useMemo(() => {
    if (!selected) return null;
    return calculerEtatChantier(selected, parametres.employes, devis, parametres?.parametres || parametres, pointages);
  }, [selected, devis, parametres, pointages]);

  const couts = useMemo(() => {
    if (!selected) return null;
    return calculerCoutsChantier(selected, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
  }, [selected, parametres.employes, parametres.localites, parametres.parametres, devis, pointages]);

  return { etat, couts };
}
