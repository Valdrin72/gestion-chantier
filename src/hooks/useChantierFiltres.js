import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';

export function useChantierFiltres() {
  const { chantiers, contexte } = useApp();
  const [filtre, setFiltre] = useState(contexte?.filtreStatut || 'Tous');

  const chantiersFiltres = useMemo(() => {
    let liste = filtre === 'Tous' ? chantiers : chantiers.filter(c => (c.statut || '').trim().toLowerCase() === filtre.trim().toLowerCase());
    if (contexte?.clientActif) liste = liste.filter(c => String(c.clientId) === String(contexte.clientActif));
    if (contexte?.employeActif) liste = liste.filter(c => c.equipe?.some(m => String(m.employeId) === String(contexte.employeActif)));
    return liste;
  }, [chantiers, filtre, contexte]);

  const joursParChantier = useMemo(() => {
    const map = {};
    chantiersFiltres.forEach(c => {
      const realises = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
      map[c.id] = c.nombreJours > 0 ? c.nombreJours - realises : null;
    });
    return map;
  }, [chantiersFiltres]);

  return { filtre, setFiltre, chantiersFiltres, joursParChantier };
}
