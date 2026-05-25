export const EMPLOYE_CHEF_EQUIPE = {
  salaireBrutAnnuel: 84_000,
  tauxChargesSociales: 0.16,
  coutsIndirectsAnnuels: 3_000,
  heuresProductivesAn: 1_700,
};

export const EMPLOYE_OUVRIER_QUALIFIE = {
  salaireBrutAnnuel: 72_000,
  tauxChargesSociales: 0.16,
  coutsIndirectsAnnuels: 2_000,
  heuresProductivesAn: 1_700,
};

export const POSTE_FAUX_PLANCHER_PICTET = {
  designation: 'Faux-plancher technique h=200mm',
  unite: 'm²',
  quantite: 300,
  coutMatUnit: 110,
  tempsH: 0.35,
  coutHMO: 45,
  coeffMat: 1.20,
  marqueMatPct: 22,
  marqueMOPct: 5,
};

export const EVM_CHANTIER_DERIVE = {
  budgetTotal: 50_000,
  pourcentTempsEcoule: 50,
  pourcentTravauxRealises: 40,
  coutsEngages: 24_000,
};

export const EVM_CHANTIER_SAIN = {
  budgetTotal: 52_180,
  pourcentTempsEcoule: 70,
  pourcentTravauxRealises: 75,
  coutsEngages: 28_400,
};

export const HISTORIQUE_CLIENT_PICTET = [
  { montant: 12_000, joursDeRetard: 5 },
  { montant: 8_500,  joursDeRetard: 0 },
  { montant: 25_000, joursDeRetard: 3 },
  { montant: 15_000, joursDeRetard: 0 },
];

export const HISTORIQUE_CLIENT_RISQUE = [
  { montant: 20_000, joursDeRetard: 60 },
  { montant: 15_000, joursDeRetard: 45 },
  { montant: 30_000, joursDeRetard: 90 },
];

export const PIPELINE_DEVIS = [
  { id: 'D-001', montantHT: 50_000, segment: 'prive',      ageJours: 10 },
  { id: 'D-002', montantHT: 80_000, segment: 'architecte', ageJours: 25 },
  { id: 'D-003', montantHT: 30_000, segment: 'entreprise', ageJours: 70 },
];
