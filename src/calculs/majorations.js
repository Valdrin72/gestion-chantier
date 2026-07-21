/**
 * Calcul des majorations CCT Second Œuvre Romand — CYNA SÀRL.
 *
 * Deux niveaux :
 * - Date-based (samedi/dimanche/férié) : stocké dans Pointage.majoration[]
 * - Semaine-based (>45h ISO)           : calculé à READ TIME — jamais stocké
 *
 * En cas de cumul, le facteur le plus élevé est retenu (pas de cumul multiplicatif).
 */

import { estFerie } from './feries';

// ── Helpers semaine ISO ───────────────────────────────────────────────────────

/**
 * Retourne le lundi de la semaine ISO contenant dateStr.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string} 'YYYY-MM-DD'
 */
function getLundiSemaine(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const jourSemaine = d.getDay(); // 0=dim, 1=lun, ..., 6=sam
  const decalage = jourSemaine === 0 ? -6 : 1 - jourSemaine;
  d.setDate(d.getDate() + decalage);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

/**
 * Retourne le dimanche de la semaine ISO contenant dateStr.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string} 'YYYY-MM-DD'
 */
function getDimancheSemaine(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const jourSemaine = d.getDay();
  const decalage = jourSemaine === 0 ? 0 : 7 - jourSemaine;
  d.setDate(d.getDate() + decalage);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

// ── Majoration date-based ─────────────────────────────────────────────────────

/**
 * Calcule la majoration applicable à une date selon le canton.
 * Samedi → 1.25 | Dimanche → 1.50 | Férié → 1.50 | Ouvrable → null
 * Si dimanche ET férié → 1.50 (facteur max, pas de cumul).
 *
 * @param {string} dateStr   - 'YYYY-MM-DD'
 * @param {'GE'|'VD'} canton - défaut 'GE'
 * @returns {{ type: string, facteur: number } | null}
 */
export function calculerMajorationDate(dateStr, canton = 'GE') {
  const d = new Date(dateStr + 'T12:00:00');
  const jour = d.getDay(); // 0=dim, 1=lun, ..., 6=sam

  const ferie = estFerie(dateStr, canton);
  if (ferie)    return { type: 'ferie',    facteur: 1.50 };
  if (jour === 0) return { type: 'dimanche', facteur: 1.50 };
  if (jour === 6) return { type: 'samedi',   facteur: 1.25 };
  return null;
}

// ── Majoration semaine-based ──────────────────────────────────────────────────

/**
 * Calcule la fraction d'heures du pointage courant qui tombe au-delà de 45h/semaine.
 * Calculée à READ TIME — ne jamais stocker sur le Pointage.
 * Ne dépend pas du canton (seuil CCT uniforme romand).
 *
 * @param {string} dateStr                                       - 'YYYY-MM-DD'
 * @param {number|string} employeId
 * @param {import('../types/pointage').Pointage[]} allPointages
 * @returns {{ heuresNormales: number, heuresMaj: number, facteurMaj: number } | null}
 */
export function calculerPartSemaine(dateStr, employeId, allPointages) {
  const lundiISO    = getLundiSemaine(dateStr);
  const dimancheISO = getDimancheSemaine(dateStr);
  const prod = (p) => (p.repartitions || [])
    .filter(r => ['production', 'atelier'].includes(r.categorie))
    .reduce((s, r) => s + (parseFloat(r.heures) || 0), 0);

  // Tous les pointages de cet employé sur la semaine ISO (lun–dim)
  const ptgsSemaine = allPointages.filter(p =>
    String(p.employeId) === String(employeId) &&
    p.date >= lundiISO && p.date <= dimancheISO
  );
  const heuresProductivesSemaine = ptgsSemaine.reduce((s, p) => s + prod(p), 0);

  const SEUIL_SUP = 45;
  if (heuresProductivesSemaine <= SEUIL_SUP) return null; // ≤45h → aucune heure sup

  // ── Attribution CHRONOLOGIQUE (bug corrigé) ────────────────────────────────
  // Les heures sup sont celles qui viennent APRÈS les 45h cumulées de la semaine :
  // on somme les jours STRICTEMENT antérieurs, puis on ne majore de CE jour que la
  // portion qui franchit le seuil. Ainsi le dépassement n'est compté qu'UNE fois sur
  // la semaine (avant : min(jour, sup) était appliqué à CHAQUE jour → 5h comptées 5×).
  const cumAvant = ptgsSemaine.filter(p => p.date < dateStr).reduce((s, p) => s + prod(p), 0);
  const ptgCourant = ptgsSemaine.find(p => p.date === dateStr);
  const heuresCeJour = ptgCourant ? prod(ptgCourant) : 0;
  if (heuresCeJour <= 0) return null;

  const supAvant = Math.max(0, cumAvant - SEUIL_SUP);
  const supApres = Math.max(0, cumAvant + heuresCeJour - SEUIL_SUP);
  const heuresMajCeJour = supApres - supAvant; // heures de CE jour au-delà du cumul 45h

  return {
    heuresNormales: heuresCeJour - heuresMajCeJour,
    heuresMaj:      heuresMajCeJour,
    facteurMaj:     1.25,
  };
}

/**
 * Facteur effectif pour un pointage en tenant compte des deux niveaux.
 * Retient le plus élevé (pas de cumul multiplicatif).
 *
 * @param {{ facteur: number }|null} majDate   - résultat de calculerMajorationDate
 * @param {{ facteurMaj: number }|null} majSem - résultat de calculerPartSemaine
 * @returns {number} facteur à appliquer (1.0 si aucune majoration)
 */
export function facteurEffectif(majDate, majSem) {
  const fd = majDate?.facteur  ?? 1.0;
  const fs = majSem?.facteurMaj ?? 1.0;
  return Math.max(fd, fs);
}
