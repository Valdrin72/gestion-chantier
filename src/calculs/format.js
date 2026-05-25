export function fmtCHF(n, options = {}) {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const [entier, dec] = abs.toFixed(2).split('.');
  const milliers = entier.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const signe = n < 0 ? '-' : (options.signe && n > 0 ? '+' : '');
  return `${signe}CHF ${milliers}.${dec}`;
}

export function fmtPct(v, dec = 1) {
  return `${(v * 100).toFixed(dec)}%`;
}

export function fmtNombre(n, dec = 2) {
  const [entier, d] = n.toFixed(dec).split('.');
  const milliers = entier.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return d ? `${milliers}.${d}` : milliers;
}

export function fmtJ(j) {
  if (!isFinite(j) || j <= 0) return '0 j';
  if (j < 1) return `${Math.round(j * 8)} h`;
  if (j < 5) return `${j.toFixed(1)} j`;
  const sem = j / 5;
  if (sem < 4) return `${sem.toFixed(1)} sem`;
  return `${(sem / 4).toFixed(1)} mois`;
}

export function arrondi5cts(montant) {
  return Math.round(montant * 20) / 20;
}
