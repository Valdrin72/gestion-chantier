import React from 'react';
import Factures from '../Factures';
import { useApp } from '../context/AppContext';

export default function FacturesPage() {
  const {
    factures, setFactures, clients, chantiers, devis,
    paiementsData, setPaiementsData, naviguer, profil, periodeGlobale,
  } = useApp();

  return (
    <Factures
      factures={factures}
      onSave={setFactures}
      clients={clients}
      chantiers={chantiers}
      devis={devis}
      paiementsData={paiementsData}
      setPaiementsData={setPaiementsData}
      naviguer={naviguer}
      profil={profil}
      periodeGlobale={periodeGlobale}
    />
  );
}
