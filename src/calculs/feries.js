/**
 * Calendrier des jours fériés — Genève (GE) et Vaud (VD).
 * CCT Second Œuvre Romand — CYNA SÀRL.
 *
 * GE : 10 jours (5 fixes + 5 mobiles).
 * VD : 10 jours (5 fixes + 5 mobiles).
 * Saint-Étienne (12-26) exclu des deux cantons.
 */

// ── Cache par (canton, annee) ─────────────────────────────────────────────────
const _cacheGE = new Map();
const _cacheVD = new Map();

// ── Utilitaires internes ──────────────────────────────────────────────────────

function _toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function _addJours(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

// ── Algorithme de Pâques (Meeus-Jones-Butcher) ───────────────────────────────

/**
 * Retourne le dimanche de Pâques pour une année donnée.
 * @param {number} annee
 * @returns {Date}
 */
export function paques(annee) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);  // 3=mars, 4=avril
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(annee, mois - 1, jour);
}

// ── Helpers jours mobiles ─────────────────────────────────────────────────────

/**
 * Jeûne genevois : jeudi qui suit le 1er dimanche de septembre.
 * Loi sur les jours fériés GE — règle officielle.
 */
function _jeuneGenevois(annee) {
  // 1er dimanche de septembre
  const sept1 = new Date(annee, 8, 1); // mois 8 = septembre (0-indexé)
  const jourSept1 = sept1.getDay();    // 0=dim, 1=lun, ...
  const decalagePremierDim = jourSept1 === 0 ? 0 : 7 - jourSept1;
  const premierDimanche = _addJours(sept1, decalagePremierDim);
  // Jeudi qui suit = +4 jours
  return _addJours(premierDimanche, 4);
}

/**
 * Lundi du Jeûne fédéral vaudois : 3e lundi de septembre.
 */
function _jeuneFederalVD(annee) {
  const sept1 = new Date(annee, 8, 1);
  const jourSept1 = sept1.getDay(); // 0=dim, 1=lun, ...
  // Nombre de jours jusqu'au 1er lundi
  const decalagePremierLundi = jourSept1 === 1 ? 0 : jourSept1 === 0 ? 1 : 8 - jourSept1;
  const premierLundi = _addJours(sept1, decalagePremierLundi);
  // 3e lundi = premier lundi + 14 jours
  return _addJours(premierLundi, 14);
}

// ── Calendriers ───────────────────────────────────────────────────────────────

/**
 * Jours fériés genevois pour une année donnée.
 * @param {number} annee
 * @returns {Set<string>} dates ISO 'YYYY-MM-DD'
 */
export function feriesGeneve(annee) {
  if (_cacheGE.has(annee)) return _cacheGE.get(annee);

  const p = paques(annee);
  const feries = new Set([
    // Fixes
    `${annee}-01-01`,  // Nouvel An
    `${annee}-05-01`,  // Fête du Travail
    `${annee}-08-01`,  // Fête nationale
    `${annee}-12-25`,  // Noël
    `${annee}-12-31`,  // Restauration genevoise
    // Mobiles depuis Pâques
    _toISO(_addJours(p, -2)),  // Vendredi Saint
    _toISO(_addJours(p,  1)),  // Lundi de Pâques
    _toISO(_addJours(p, 39)),  // Ascension
    _toISO(_addJours(p, 50)),  // Lundi de Pentecôte
    // Jeûne genevois
    _toISO(_jeuneGenevois(annee)),
  ]);

  _cacheGE.set(annee, feries);
  return feries;
}

/**
 * Jours fériés vaudois pour une année donnée.
 * @param {number} annee
 * @returns {Set<string>} dates ISO 'YYYY-MM-DD'
 */
export function feriesVaud(annee) {
  if (_cacheVD.has(annee)) return _cacheVD.get(annee);

  const p = paques(annee);
  const feries = new Set([
    // Fixes
    `${annee}-01-01`,  // Nouvel An
    `${annee}-01-02`,  // Berchtoldstag
    `${annee}-05-01`,  // Fête du Travail
    `${annee}-08-01`,  // Fête nationale
    `${annee}-12-25`,  // Noël
    // Mobiles depuis Pâques
    _toISO(_addJours(p, -2)),  // Vendredi Saint
    _toISO(_addJours(p,  1)),  // Lundi de Pâques
    _toISO(_addJours(p, 39)),  // Ascension
    _toISO(_addJours(p, 50)),  // Lundi de Pentecôte
    // Lundi du Jeûne fédéral
    _toISO(_jeuneFederalVD(annee)),
  ]);

  _cacheVD.set(annee, feries);
  return feries;
}

/**
 * Retourne true si la date est un jour férié dans le canton donné.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {'GE'|'VD'} canton - défaut 'GE'
 * @returns {boolean}
 */
export function estFerie(dateStr, canton = 'GE') {
  const annee = parseInt(dateStr.slice(0, 4));
  const feries = canton === 'VD' ? feriesVaud(annee) : feriesGeneve(annee);
  return feries.has(dateStr);
}
