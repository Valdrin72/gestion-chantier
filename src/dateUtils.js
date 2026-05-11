// ============================================================
// CYNA — Date utilities (safe parsing, no Invalid Date)
// Toutes les fonctions retournent null si la date est invalide
// ============================================================

export function parseDateSafe(s) {
  if (!s || typeof s !== 'string') return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function joursEntre(dateStr1, dateStr2) {
  const d1 = parseDateSafe(dateStr1);
  const d2 = parseDateSafe(dateStr2);
  if (!d1 || !d2) return null;
  return Math.floor((d2.getTime() - d1.getTime()) / 86400000);
}

export function joursDepuisAujourd(dateStr) {
  const d = parseDateSafe(dateStr);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
