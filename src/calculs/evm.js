export function calculerEVM({ budgetTotal, pourcentTempsEcoule, pourcentTravauxRealises, coutsEngages }) {
  const PV = (pourcentTempsEcoule / 100) * budgetTotal;
  const EV = (pourcentTravauxRealises / 100) * budgetTotal;
  const AC = coutsEngages;
  const CV = EV - AC;
  const SV = EV - PV;
  const CPI = AC > 0 ? EV / AC : 1;
  const SPI = PV > 0 ? EV / PV : 1;
  const EAC = CPI > 0 ? budgetTotal / CPI : Infinity;
  const ETC = EAC - AC;

  let statut = 'OK';
  if (CPI < 0.9 || SPI < 0.85) statut = 'CRITIQUE';
  else if (CPI < 1 || SPI < 1) statut = 'VIGILANCE';

  const diagnostic =
    statut === 'OK' ? 'Chantier conforme aux prévisions' :
    statut === 'VIGILANCE' ? 'Dérive légère — identifier la cause' :
    `Action requise — dépassement projeté de ${(EAC - budgetTotal).toFixed(0)} CHF`;

  return { PV, EV, AC, CV, SV, CPI, SPI, EAC, ETC, statut, diagnostic };
}
