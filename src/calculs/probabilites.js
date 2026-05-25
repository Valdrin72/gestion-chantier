export const TAUX_CONVERSION_PAR_SEGMENT = {
  prive: 0.42,
  architecte: 0.28,
  entreprise: 0.35,
};

export function decoteAge(ageJours) {
  if (ageJours <= 14) return 1.0;
  if (ageJours <= 30) return 0.9;
  if (ageJours <= 60) return 0.6;
  if (ageJours <= 90) return 0.3;
  return 0.1;
}

export function esperancePipeline(devis) {
  const detail = devis.map(d => {
    const tauxBase = TAUX_CONVERSION_PAR_SEGMENT[d.segment];
    const decote = decoteAge(d.ageJours);
    const probabilite = tauxBase * decote;
    return { id: d.id, brut: d.montantHT, espere: d.montantHT * probabilite, probabilite };
  });
  return { total: detail.reduce((s, d) => s + d.espere, 0), detail };
}

export function scoreClient(historique) {
  if (!historique.length) return { retardMoyen: 0, scoreSur100: 50, categorie: 'standard', acompteRecommande: 0.30 };
  const totalMt = historique.reduce((s, p) => s + p.montant, 0);
  const retardPond = historique.reduce((s, p) => s + Math.max(0, p.joursDeRetard) * p.montant, 0);
  const retardMoyen = totalMt > 0 ? retardPond / totalMt : 0;
  const scoreSur100 = Math.max(0, Math.min(100, 100 - retardMoyen * 2));
  let categorie, acompteRecommande;
  if (scoreSur100 >= 80)      { categorie = 'fiable';    acompteRecommande = 0.20; }
  else if (scoreSur100 >= 60) { categorie = 'standard';  acompteRecommande = 0.30; }
  else if (scoreSur100 >= 40) { categorie = 'lent';      acompteRecommande = 0.40; }
  else                        { categorie = 'risque';    acompteRecommande = 0.50; }
  return { retardMoyen, scoreSur100, categorie, acompteRecommande };
}

export function statistiquesDepassement(historique) {
  if (!historique.length) return { mu: 0, sigma: 0, n: 0 };
  const ecarts = historique.map(c => (c.reel - c.prevu) / c.prevu);
  const n = ecarts.length;
  const mu = ecarts.reduce((a, b) => a + b, 0) / n;
  const variance = ecarts.reduce((a, b) => a + (b - mu) ** 2, 0) / n;
  return { mu, sigma: Math.sqrt(variance), n };
}

export function provisionAleas(coutPrevu, mu, sigma) {
  return coutPrevu * (1 + Math.max(0, mu) + sigma);
}
