export function tauxMarque(pv, cout) {
  return pv > 0 ? (pv - cout) / pv : 0;
}

export function tauxMarge(pv, cout) {
  return cout > 0 ? (pv - cout) / cout : 0;
}

export function marqueDepuisMarge(tauxMargeCout) {
  return tauxMargeCout / (1 + tauxMargeCout);
}

export function margeDepuisMarque(tauxMarqueVente) {
  if (tauxMarqueVente >= 1) throw new Error('Marque ≥ 100% impossible');
  return tauxMarqueVente / (1 - tauxMarqueVente);
}

export function coeffVente(marque) {
  if (marque >= 1) throw new Error('Marque ≥ 100% impossible');
  return 1 / (1 - marque);
}

export function pvDepuisMarque(cout, marque) {
  const k = coeffVente(marque);
  return cout * k;
}

export function seuilRentabilite(fixe, tauxMB) {
  return tauxMB > 0 ? fixe / tauxMB : Infinity;
}

export function margeBrutePonderee(chantiers) {
  const sumCA = chantiers.reduce((s, c) => s + c.ca, 0);
  const sumMB = chantiers.reduce((s, c) => s + c.mb, 0);
  return sumCA === 0 ? 0 : sumMB / sumCA;
}
