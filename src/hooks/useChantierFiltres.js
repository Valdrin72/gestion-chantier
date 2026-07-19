import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { filtrerActifs, filtrerArchives } from '../utils/archiveHelpers';
import { joursReelsChantier } from '../calculs/pointagesHelper';

export function useChantierFiltres() {
  const { chantiers, contexte, pointages = [] } = useApp();
  const [filtre, setFiltre] = useState(contexte?.filtreStatut || 'Tous');

  // Liste de base après filtres statut + contexte (client/employé), AVANT séparation archive
  const base = useMemo(() => {
    let liste = filtre === 'Tous' ? chantiers : chantiers.filter(c => (c.statut || '').trim().toLowerCase() === filtre.trim().toLowerCase());
    if (contexte?.clientActif) liste = liste.filter(c => String(c.clientId) === String(contexte.clientActif));
    if (contexte?.employeActif) liste = liste.filter(c => c.equipe?.some(m => String(m.employeId) === String(contexte.employeActif)));
    return liste;
  }, [chantiers, filtre, contexte]);

  // Vue active : les archivés sont cachés (Phase 2)
  const chantiersFiltres = useMemo(() => filtrerActifs(base), [base]);

  // Vue archivés : respecte les filtres statut/contexte courants, mais archive===true
  const chantiersArchives = useMemo(() => filtrerArchives(base), [base]);

  const joursParChantier = useMemo(() => {
    const map = {};
    chantiersFiltres.forEach(c => {
      const realises = joursReelsChantier(pointages, c.id);
      map[c.id] = c.nombreJours > 0 ? c.nombreJours - realises : null;
    });
    return map;
  }, [chantiersFiltres, pointages]);

  return { filtre, setFiltre, chantiersFiltres, chantiersArchives, joursParChantier };
}
