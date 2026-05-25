export function dureeTache(quantite, productiviteEquipeParJour) {
  if (productiviteEquipeParJour <= 0) throw new Error('Productivité doit être positive');
  return quantite / productiviteEquipeParJour;
}

export function productiviteAjustee(baseline, coefficients) {
  return baseline * coefficients.reduce((a, b) => a * b, 1);
}

export function capaciteEquipeJour(nbPersonnes, heuresJour = 8, coeffEfficacite = 0.85) {
  return nbPersonnes * heuresJour * coeffEfficacite;
}

export function calculerCheminCritique(taches) {
  const map = new Map();
  taches.forEach(t => map.set(t.id, { ...t, ES: 0, EF: 0, LS: 0, LF: 0, marge: 0, critique: false }));

  for (const t of taches) {
    const c = map.get(t.id);
    c.ES = t.predecesseurs.length === 0 ? 0 : Math.max(...t.predecesseurs.map(p => map.get(p).EF));
    c.EF = c.ES + t.duree;
  }

  const projectEnd = Math.max(...Array.from(map.values()).map(t => t.EF));

  for (const t of [...taches].reverse()) {
    const c = map.get(t.id);
    const successeurs = taches.filter(s => s.predecesseurs.includes(t.id));
    c.LF = successeurs.length === 0 ? projectEnd : Math.min(...successeurs.map(s => map.get(s.id).LS));
    c.LS = c.LF - t.duree;
    c.marge = c.LS - c.ES;
    c.critique = Math.abs(c.marge) < 0.001;
  }

  return taches.map(t => map.get(t.id));
}
