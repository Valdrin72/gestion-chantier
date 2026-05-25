export function regressionLineaire(points) {
  const n = points.length;
  if (n < 2) throw new Error('Au moins 2 points requis');
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX ** 2;
  if (denom === 0) throw new Error('Régression impossible (points alignés verticalement)');
  const pente = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const ordonneeOrigine = (sumY - pente * sumX) / n;
  return { pente, ordonneeOrigine, predire: (x) => pente * x + ordonneeOrigine };
}

export function detecterAnomalies(valeurs, seuilZ = 2) {
  const n = valeurs.length;
  if (n === 0) return [];
  const mu = valeurs.reduce((a, b) => a + b, 0) / n;
  const sigma = Math.sqrt(valeurs.reduce((a, b) => a + (b - mu) ** 2, 0) / n);
  return valeurs.map(v => {
    const zScore = sigma === 0 ? 0 : (v - mu) / sigma;
    return { valeur: v, zScore, suspect: Math.abs(zScore) > seuilZ, anomalie: Math.abs(zScore) > 3 };
  });
}

export function indiceConcentration(caParClient) {
  const total = caParClient.reduce((a, b) => a + b, 0);
  if (total === 0) return { hhi: 0, niveau: 'faible' };
  const hhi = caParClient.reduce((s, ca) => s + Math.pow(ca / total, 2), 0) * 10000;
  const niveau = hhi < 1500 ? 'faible' : hhi < 2500 ? 'modere' : 'eleve';
  return { hhi, niveau };
}
