import { useState, useMemo } from 'react';
import { joursOuvrableRestants } from '../donnees';
import { useApp } from '../context/AppContext';

export function useChantierFiltres() {
  const { chantiers, contexte } = useApp();
  const [filtre, setFiltre] = useState(contexte?.filtreStatut || 'Tous');

  const chantiersFiltres = useMemo(() => {
    let liste = filtre === 'Tous' ? chantiers : chantiers.filter(c => c.statut === filtre);
    if (contexte?.clientActif) liste = liste.filter(c => c.clientId === contexte.clientActif);
    if (contexte?.employeActif) liste = liste.filter(c => c.equipe?.some(m => parseInt(m.employeId) === contexte.employeActif));
    return liste;
  }, [chantiers, filtre, contexte]);

  const joursParChantier = useMemo(() => {
    const map = {};
    chantiersFiltres.forEach(c => { map[c.id] = joursOuvrableRestants(c.dateDebut, c.nombreJours, c.inclusSamedi); });
    return map;
  }, [chantiersFiltres]);

  return { filtre, setFiltre, chantiersFiltres, joursParChantier };
}
