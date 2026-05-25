import { CYNA_PARAMS } from './constants.js';

export function calculerCHR({ salaireBrutAnnuel, tauxChargesSociales, coutsIndirectsAnnuels, heuresProductivesAn }) {
  const treizieme = salaireBrutAnnuel / 12;
  const brut13 = salaireBrutAnnuel + treizieme;
  const tauxCharges = tauxChargesSociales ?? CYNA_PARAMS.CHARGES_SOCIALES;
  const chargesSociales = brut13 * tauxCharges;
  const indirects = coutsIndirectsAnnuels ?? 0;
  const heuresProd = heuresProductivesAn ?? CYNA_PARAMS.HEURES_PROD_AN;
  const coutTotalAnnuel = brut13 + chargesSociales + indirects;
  const coutHoraireReel = heuresProd > 0 ? coutTotalAnnuel / heuresProd : 0;
  return {
    coutTotalAnnuel,
    coutHoraireReel,
    coutJournalier: coutHoraireReel * 8,
    detail: { treizieme, chargesSociales, indirects, heuresProductives: heuresProd },
  };
}

export function totalCoutsDirects(c) {
  return (c.mainOeuvre ?? 0) + (c.materiaux ?? 0) + (c.sousTraitance ?? 0) +
         (c.locations ?? 0) + (c.deplacements ?? 0);
}

export function fraisGenerauxAlloues(heuresChantier, heuresTotalesPeriode, fraisGenerauxPeriode) {
  if (heuresTotalesPeriode === 0) return 0;
  return (heuresChantier / heuresTotalesPeriode) * fraisGenerauxPeriode;
}
