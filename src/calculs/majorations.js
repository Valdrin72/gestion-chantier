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
import { CATEGORIES_AVEC_CHANTIER } from '../types/pointage';

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

/**
 * SOURCE UNIQUE du calcul de surcharge de majoration CCT pour UN pointage sur UN chantier.
 * Extrait de _surcoutMajorations (donnees.js) — réutilisé à l'identique par le moteur vie-entière
 * ET par coutMajorationsDansPeriode (periode.js), pour ne jamais dupliquer la logique de taux/split.
 *
 * Règles (inchangées) : heures sup = >45h/semaine ISO/employé, attribuées chronologiquement et
 * réparties au prorata entre chantiers du jour, ×1.25 ; samedi ×1.25, dim/férié ×1.5 ; en cas de
 * cumul, le facteur le plus élevé (MAX), pas de cumul multiplicatif.
 *
 * ⚠ `allPointages` DOIT être l'ensemble COMPLET des pointages (le split >45h lit la semaine ISO
 *   entière, tous chantiers/jours) — même quand on ne somme qu'une tranche de période côté appelant.
 *
 * @returns {{ heuresCeChantier:number, coutBase:number, surcharge:number, heuresMajorees:number, effFactor:number }}
 */
export function surchargeMajorationPointage(p, chantierId, tarifH, allPointages, canton = 'GE') {
  const cid = String(chantierId);
  const heuresCeChantier = (p?.repartitions || [])
    .filter(r => String(r.chantierId) === cid && CATEGORIES_AVEC_CHANTIER.includes(r.categorie))
    .reduce((s, r) => s + (parseFloat(r.heures) || 0), 0);

  if (heuresCeChantier <= 0) {
    return { heuresCeChantier: 0, coutBase: 0, surcharge: 0, heuresMajorees: 0, effFactor: 1 };
  }

  // Facteur DATE (samedi/dimanche/férié) — s'applique à toutes les heures du jour.
  const dateFactor = calculerMajorationDate(p.date, canton)?.facteur ?? 1.0;
  // Split heures sup du JOUR (tous chantiers) via l'attribution chronologique hebdo (lit allPointages).
  const majSem = calculerPartSemaine(p.date, p.employeId, allPointages);
  const heuresJourTotal = majSem ? (majSem.heuresNormales + majSem.heuresMaj) : heuresCeChantier;
  const heuresSupJour = majSem ? majSem.heuresMaj : 0;
  // PRORATA : la part d'heures sup du jour portée par CE chantier.
  const chantierSup = heuresJourTotal > 0 ? heuresSupJour * (heuresCeChantier / heuresJourTotal) : 0;
  const chantierNormal = heuresCeChantier - chantierSup;

  // Facteur des heures sup = MAX(date, 1.25) — pas de cumul.
  const overtimeFactor = Math.max(dateFactor, 1.25);
  const majNormal = chantierNormal * tarifH * (dateFactor - 1.0);       // portion normale : facteur date
  const majSup    = chantierSup    * tarifH * (overtimeFactor - 1.0);   // portion sup : max(date, 1.25)

  const coutBase = heuresCeChantier * tarifH;
  const surcharge = majNormal + majSup;
  // Heures majorées : normales seulement si jour majoré (samedi/dim/férié) + toutes les heures sup.
  const heuresMajorees = (dateFactor > 1.0 ? chantierNormal : 0) + chantierSup;
  const effFactor = coutBase > 0 ? (coutBase + surcharge) / coutBase : 1;

  return { heuresCeChantier, coutBase, surcharge, heuresMajorees, effFactor };
}
