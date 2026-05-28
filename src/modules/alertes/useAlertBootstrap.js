import { useEffect, useRef } from 'react';
import { bootstrapAlertSystem } from './bootstrap.js';
import { adapterContexteAlertes } from './contextAdapter.js';

export function useAlertBootstrap({ chantiers, devis, factures, clients, parametres, pointages }) {
  const systemRef = useRef(null);
  const dataRef = useRef({ chantiers, devis, factures, clients, parametres, pointages });

  // Mise à jour des données sans recréer le système
  useEffect(() => {
    dataRef.current = { chantiers, devis, factures, clients, parametres, pointages };
  }, [chantiers, devis, factures, clients, parametres, pointages]);

  useEffect(() => {
    const contextProvider = () => adapterContexteAlertes(dataRef.current);
    systemRef.current = bootstrapAlertSystem(contextProvider, 5 * 60 * 1000);
    return () => systemRef.current?.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return systemRef;
}
