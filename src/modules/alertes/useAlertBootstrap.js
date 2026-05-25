import { useEffect, useRef } from 'react';
import { bootstrapAlertSystem } from './bootstrap.js';
import { adapterContexteAlertes } from './contextAdapter.js';

export function useAlertBootstrap({ chantiers, devis, factures, clients, parametres }) {
  const systemRef = useRef(null);
  const dataRef = useRef({ chantiers, devis, factures, clients, parametres });

  // Mise à jour des données sans recréer le système
  useEffect(() => {
    dataRef.current = { chantiers, devis, factures, clients, parametres };
  }, [chantiers, devis, factures, clients, parametres]);

  useEffect(() => {
    const contextProvider = () => adapterContexteAlertes(dataRef.current);
    systemRef.current = bootstrapAlertSystem(contextProvider, 5 * 60 * 1000);
    return () => systemRef.current?.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return systemRef;
}
