/**
 * CYNA — Module PÉRIODE unifié (Semaine / Mois / Année).
 *
 * SOCLE de cohérence temporelle (lot 0 de la refonte période). Fonctions PURES,
 * déterministes : la date de référence `ref` est TOUJOURS injectable (défaut new Date()).
 *
 * Décisions métier verrouillées (patron) :
 * - Bornes en chaînes isoDate LOCALES 'YYYY-MM-DD', comparaison lexicographique, INCLUSIF
 *   des deux côtés → élimine d'un coup les bugs de fuseau UTC et d'inclusif/exclusif.
 * - Semaine = lundi → DIMANCHE (7 jours, dimanche INCLUS). Label cohérent (jusqu'au dimanche).
 * - CA facturé = Σ montantTTC des factures à leur dateEmission (net, un seul mois, PAS de prorata ;
 *   exclut brouillon + annulée). CA signé devis = Σ (montantHT + avenants + régie) des devis
 *   ACCEPTÉS à leur date. Ce sont DEUX indicateurs distincts (base TTC vs HT, collections différentes).
 * - Coûts : la main d'œuvre vient des pointages DATÉS → part exacte par période (aucun prorata
 *   inventé). Les coûts forfaitaires NON datés (matériel, sous-traitance, imprévus, autres) sont
 *   répartis LINÉAIREMENT sur la durée calendaire réelle du chantier ; si le chantier n'a pas de
 *   dateDebut, ils sont rattachés au mois de sa 1ʳᵉ facture.
 *
 * ⚠ Périmètre lot 0 : ce module AJOUTE le socle. Il ne migre AUCUN écran. Les 4 anciennes
 *   fonctions de donnees.js restent la source de vérité et sont re-exportées ici pour la
 *   compatibilité (les pages basculeront leur import lot par lot ensuite).
 *
 * ⚠ Limite documentée (décision différée) : coutChantierDansPeriode n'inclut PAS encore les
 *   MAJORATIONS CCT (samedi/dimanche/férié/>45h). Les majorations hebdomadaires (>45h) exigent la
 *   semaine ISO complète tous chantiers ; les intégrer proprement à une tranche de période est un
 *   lot ultérieur. Le coût rendu ici = MO de base (exacte, datée) + forfaitaire (prorata).
 *
 * ⚠ Bug PRÉ-EXISTANT hérité (hors périmètre lot 0) : le prorata forfaitaire s'appuie sur
 *   calculerDateFinOuvrables (donnees.js) qui sérialise sa date de fin en UTC (toISOString) — sur une
 *   fenêtre chantier enjambant le passage à l'heure d'été, la date de fin peut reculer d'un jour selon
 *   le fuseau du runtime (navigateur vs CI). À corriger dans donnees.js (→ _isoLocal) via un micro-lot
 *   dédié + audit-btp AVANT qu'un écran n'adopte coutForfaitaireDansPeriode. Sans impact tant que
 *   ce module n'est câblé nulle part (lot 0 ne migre aucune page).
 */

import { COEF_MO_DEFAUT } from './constants';
import { CATEGORIES_AVEC_CHANTIER } from '../types/pointage';
import { calculerDateFinOuvrables, sommeAvenants, sommeHeuresRegie, TVA_DEFAUT } from '../donnees';

// Re-export des 4 fonctions historiques (compat lot 0 — source physique = donnees.js, sens unique, aucun cycle).
export { getIntervallesPeriode, getPeriodeLabel, chantiersInPeriode, facturesInPeriode } from '../donnees';

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const _pad = (n) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD' en heure LOCALE (jamais toISOString/UTC). */
export const isoLocal = (d) => `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;

/** Écart en jours calendaires entre deux 'YYYY-MM-DD' (midi local → robuste DST). null si invalide. */
const _joursEntre = (aStr, bStr) => {
  if (!aStr || !bStr) return null;
  const a = new Date(`${String(aStr).slice(0, 10)}T12:00:00`);
  const b = new Date(`${String(bStr).slice(0, 10)}T12:00:00`);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
};

/**
 * Bornes de la période courante, en chaînes isoDate LOCALES inclusives.
 * @param {'semaine'|'mois'|'annee'} periode
 * @param {Date} [ref=new Date()] date de référence (injectable pour les tests)
 * @returns {{debutStr: string, finStr: string}}
 */
export const bornesPeriode = (periode, ref = new Date()) => {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  if (periode === 'semaine') {
    const jour = ref.getDay(); // 0=dim, 1=lun, ...
    const versLundi = jour === 0 ? -6 : 1 - jour;
    const lundi = new Date(y, m, ref.getDate() + versLundi);
    const dimanche = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 6);
    return { debutStr: isoLocal(lundi), finStr: isoLocal(dimanche) };
  }
  if (periode === 'mois') {
    return { debutStr: isoLocal(new Date(y, m, 1)), finStr: isoLocal(new Date(y, m + 1, 0)) };
  }
  // 'annee' (et fallback pour toute valeur inconnue — contrat conservé)
  return { debutStr: isoLocal(new Date(y, 0, 1)), finStr: isoLocal(new Date(y, 11, 31)) };
};

/**
 * Vrai si dateStr tombe dans la période. Comparaison de chaînes 'YYYY-MM-DD' (inclusif des 2 côtés).
 * @param {string} dateStr  ex. '2026-08-19' (une éventuelle partie heure est ignorée)
 */
export const estDansPeriode = (dateStr, periode, ref = new Date()) => {
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  const { debutStr, finStr } = bornesPeriode(periode, ref);
  return d >= debutStr && d <= finStr;
};

/** Libellé humain cohérent avec les bornes (semaine jusqu'au dimanche). Déterministe (pas d'ICU). */
export const periodeLabel = (periode, ref = new Date()) => {
  const { debutStr, finStr } = bornesPeriode(periode, ref);
  const jm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  if (periode === 'semaine') return `Semaine du ${jm(debutStr)} au ${jm(finStr)}`;
  if (periode === 'mois') {
    const [yy, mm] = debutStr.split('-');
    return `${MOIS_FR[parseInt(mm, 10) - 1]} ${yy}`;
  }
  return `Année ${debutStr.slice(0, 4)}`;
};

// ── CA facturé (dateEmission, base TTC) ───────────────────────────────────────

// Statuts STOCKÉS exclus du CA facturé : un brouillon n'est pas émis, une annulée ne compte pas.
const _factureComptable = (f) => !['brouillon', 'annulee'].includes((f?.statut || '').trim().toLowerCase());

/**
 * CA facturé de la période = Σ montantTTC des factures dont dateEmission ∈ période.
 * Exclut brouillon + annulée. Base TTC (convention codebase). AUCUN prorata (facture = 1 mois).
 */
export const caFactureDansPeriode = (factures = [], periode, ref = new Date()) =>
  (factures || [])
    .filter((f) => _factureComptable(f) && estDansPeriode(f.dateEmission || f.creeLe, periode, ref))
    .reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);

/**
 * Montant PAYÉ (encaissé) des factures dont dateEmission ∈ période = Σ min(montantPaye, montantTTC).
 * Base TTC (on encaisse du TTC). Plafonné au TTC (jamais encaissé > facturé). Rattaché à la période
 * d'ÉMISSION de la facture (cohérent avec caFactureDansPeriode → le taux d'encaissement d'une période
 * = payé/facturé sur les MÊMES factures). Exclut brouillon + annulée.
 */
export const caPayeDansPeriode = (factures = [], periode, ref = new Date()) =>
  (factures || [])
    .filter((f) => _factureComptable(f) && estDansPeriode(f.dateEmission || f.creeLe, periode, ref))
    .reduce((s, f) => s + Math.min(parseFloat(f.montantPaye) || 0, parseFloat(f.montantTTC) || 0), 0);

/** CA facturé de la période pour UN chantier donné. */
export const caFactureParChantier = (factures = [], chantierId, periode, ref = new Date()) =>
  (factures || [])
    .filter((f) => _factureComptable(f)
      && String(f.chantierId) === String(chantierId)
      && estDansPeriode(f.dateEmission || f.creeLe, periode, ref))
    .reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);

// ── CA facturé base HT (pages de MARGE : marge = CA − coûts doit comparer HT à HT) ────────────
// Le montantHT est stocké sur la facture ; à défaut on le reconstitue depuis le TTC (÷ 1.081, TVA BTP).
const _factureHT = (f) => {
  const ht = parseFloat(f?.montantHT);
  if (!isNaN(ht)) return ht;
  const ttc = parseFloat(f?.montantTTC);
  return isNaN(ttc) ? 0 : ttc / (1 + TVA_DEFAUT / 100); // fallback : dé-TVA au taux BTP standard
};

/** CA facturé HT de la période = Σ montantHT des factures comptables dont dateEmission ∈ période. */
export const caFactureHTDansPeriode = (factures = [], periode, ref = new Date()) =>
  (factures || [])
    .filter((f) => _factureComptable(f) && estDansPeriode(f.dateEmission || f.creeLe, periode, ref))
    .reduce((s, f) => s + _factureHT(f), 0);

/** CA facturé HT de la période pour UN chantier donné. */
export const caFactureHTParChantier = (factures = [], chantierId, periode, ref = new Date()) =>
  (factures || [])
    .filter((f) => _factureComptable(f)
      && String(f.chantierId) === String(chantierId)
      && estDansPeriode(f.dateEmission || f.creeLe, periode, ref))
    .reduce((s, f) => s + _factureHT(f), 0);

// ── CA signé devis (date de signature, base HT) — DISTINCT du CA facturé ──────

/**
 * CA signé de la période = Σ (montantHT + avenants + régie) des devis ACCEPTÉS dont la date ∈ période.
 * Indicateur DISTINCT du CA facturé : collection devis[], base HT, statut 'accepté', champ `date`.
 */
export const caSigneDevisDansPeriode = (devis = [], periode, ref = new Date()) =>
  (devis || [])
    .filter((d) => (d?.statut || '').trim().toLowerCase() === 'accepté'
      && estDansPeriode(d.date || d.dateEmission, periode, ref))
    .reduce((s, d) => s
      + (parseFloat(d.montantHT ?? d.prixPropose) || 0)
      + sommeAvenants(d)
      + sommeHeuresRegie(d), 0);

// ── Heures / activité (pointages datés → filtrage exact) ─────────────────────

/**
 * Heures productives (catégories production + atelier) tombant dans la période.
 * @param {Array} pointages
 * @param {string|number|null} [chantierId=null] restreint à un chantier ; null = tous chantiers.
 */
export const heuresDansPeriode = (pointages = [], periode, ref = new Date(), chantierId = null) => {
  let total = 0;
  for (const p of (pointages || [])) {
    if (!estDansPeriode(p?.date, periode, ref)) continue;
    for (const r of (p.repartitions || [])) {
      if (r?.chantierId == null || !CATEGORIES_AVEC_CHANTIER.includes(r.categorie)) continue;
      if (chantierId != null && String(r.chantierId) !== String(chantierId)) continue;
      total += parseFloat(r.heures) || 0;
    }
  }
  return total;
};

// ── Coûts ────────────────────────────────────────────────────────────────────

const _num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
/** Tarif jour employeur : si déjà chargé, tel quel ; sinon × coefficient. (miroir 1-ligne de donnees.js) */
const _tarifJour = (emp, coefficient) => {
  const t = parseFloat(emp?.tarifJour) || 0;
  return emp?.tarifDejaCharge ? t : t * coefficient;
};

/**
 * Coût MAIN D'ŒUVRE d'un chantier tombant EXACTEMENT dans la période (via pointages datés).
 * (heures productives / 8) × tarif jour employeur, sommé sur les pointages de la période.
 * ⚠ N'inclut PAS les majorations CCT (voir en-tête du module).
 */
export const coutMODansPeriode = (chantier, employes = [], cfg = {}, pointages = [], periode, ref = new Date()) => {
  const coefficient = parseFloat(cfg?.coefficientMainOeuvre) || COEF_MO_DEFAUT;
  const cid = String(chantier?.id);
  let cout = 0;
  for (const p of (pointages || [])) {
    if (!estDansPeriode(p?.date, periode, ref)) continue;
    const emp = (employes || []).find((e) => parseInt(e.id) === parseInt(p.employeId));
    for (const r of (p.repartitions || [])) {
      if (String(r?.chantierId) !== cid || !CATEGORIES_AVEC_CHANTIER.includes(r.categorie)) continue;
      const heures = parseFloat(r.heures) || 0;
      cout += (heures / 8) * _tarifJour(emp, coefficient);
    }
  }
  return cout;
};

/**
 * Somme des coûts forfaitaires RÉELS non datés d'un chantier (matériel, sous-traitance, imprévus, autres).
 * Fallback champ-neuf → champ-legacy STRICTEMENT comme le vrai moteur (donnees.js:558) : on PARSE
 * chaque champ d'abord (`_num(a) ?? _num(b)`), sinon un champ neuf vidé ('') masquerait le legacy.
 */
const _forfaitReel = (chantier) => {
  const materiel = _num(chantier?.materielReel) ?? _num(chantier?.coutMaterielReel) ?? 0;
  const sousTraitance = _num(chantier?.sousTraitanceReelle) ?? _num(chantier?.coutSousTraitanceReel) ?? 0;
  const imprevus = (chantier?.imprevus || []).reduce((s, i) => s + (parseFloat(i?.montant) || 0), 0);
  const autres = _num(chantier?.autresCoutsReels) ?? _num(chantier?.autresCoutsReel) ?? 0;
  return materiel + sousTraitance + imprevus + autres; // pas de clamp ≥0 : un avoir est légitime
};

/**
 * Part des coûts FORFAITAIRES non datés d'un chantier tombant dans la période. Cascade d'ancrage :
 *  1. dateDebut + durée calculable → PRORATA linéaire sur la durée calendaire réelle (Σ parts sur une
 *     partition du calendrier = 100 % du forfait — invariant d'emboîtement) ;
 *  2. dateDebut MAIS durée incalculable (nombreJours manquant/0/invalide) → forfait ancré au mois de
 *     dateDebut (jamais évaporé) ;
 *  3. pas de dateDebut → forfait rattaché au mois de la 1ʳᵉ facture comptable ;
 *  4. aucun ancrage possible (ni dateDebut ni facture) → 0 sur toute période. ⚠ Cas non datable :
 *     le coût existe dans le total de vie du chantier (calculerCoutsChantier) mais ne peut être
 *     imputé à un mois. Repérable via forfaitNonDatable() — décision produit ouverte.
 */
export const coutForfaitaireDansPeriode = (chantier, factures = [], periode, ref = new Date()) => {
  const forfait = _forfaitReel(chantier);
  if (forfait === 0) return 0;

  if (chantier?.dateDebut) {
    const finChantier = calculerDateFinOuvrables(chantier.dateDebut, chantier.nombreJours, chantier.inclusSamedi, chantier.canton ?? 'GE');
    if (finChantier) {
      // Cas 1 : prorata linéaire sur la durée calendaire réelle.
      const spanStart = String(chantier.dateDebut).slice(0, 10);
      const spanEnd = String(finChantier).slice(0, 10);
      const spanJours = (_joursEntre(spanStart, spanEnd) || 0) + 1; // inclusif du 1er jour
      if (spanJours <= 0) return 0;
      const { debutStr, finStr } = bornesPeriode(periode, ref);
      const ovStart = spanStart > debutStr ? spanStart : debutStr;
      const ovEnd = spanEnd < finStr ? spanEnd : finStr;
      if (ovStart > ovEnd) return 0;
      const ovJours = (_joursEntre(ovStart, ovEnd) || 0) + 1;
      return forfait * (ovJours / spanJours);
    }
    // Cas 2 : dateDebut présent mais durée incalculable → ancrage au mois de dateDebut (jamais 0 partout).
    return estDansPeriode(chantier.dateDebut, periode, ref) ? forfait : 0;
  }

  // Cas 3 : pas de dateDebut → rattachement au mois de la 1ʳᵉ facture comptable du chantier.
  const premiere = _premiereFactureDate(chantier, factures);
  if (premiere && estDansPeriode(premiere, periode, ref)) return forfait;
  return 0; // Cas 4 : non datable (voir forfaitNonDatable).
};

/** Date de la 1ʳᵉ facture comptable (dateEmission/creeLe) d'un chantier, ou null. */
const _premiereFactureDate = (chantier, factures = []) => {
  const dates = (factures || [])
    .filter((f) => _factureComptable(f) && String(f.chantierId) === String(chantier?.id) && (f.dateEmission || f.creeLe))
    .map((f) => String(f.dateEmission || f.creeLe).slice(0, 10))
    .sort();
  return dates[0] || null;
};

/**
 * Montant forfaitaire d'un chantier qui NE PEUT être imputé à aucune période (ni dateDebut exploitable,
 * ni facture). > 0 signale un coût réel « sans date » qu'un écran doit surfacer plutôt que masquer.
 */
export const forfaitNonDatable = (chantier, factures = []) => {
  const forfait = _forfaitReel(chantier);
  if (forfait === 0) return 0;
  if (chantier?.dateDebut) return 0; // ancré (prorata ou mois de dateDebut)
  if (_premiereFactureDate(chantier, factures)) return 0; // ancré à la 1ʳᵉ facture
  return forfait;
};

/**
 * Coût total d'un chantier tombant dans la période = MO datée (exacte) + forfaitaire (prorata).
 * ⚠ Hors majorations CCT (voir en-tête). Le déplacement est exclu (imputé aux frais généraux, comme
 *   dans calculerCoutsChantier).
 */
export const coutChantierDansPeriode = (chantier, employes = [], cfg = {}, pointages = [], factures = [], periode, ref = new Date()) =>
  coutMODansPeriode(chantier, employes, cfg, pointages, periode, ref)
  + coutForfaitaireDansPeriode(chantier, factures, periode, ref);

/** Vrai si le chantier n'a pas de date de début planifiée (à signaler par un badge « sans date » côté écran). */
export const chantierSansDate = (chantier) => !chantier?.dateDebut;

// ── Indicateurs de MARGE par chantier / période (helper partagé des pages chantier — lot 4) ───

/**
 * Indicateurs de rentabilité d'UN chantier pour la période courante. Base de calcul money-critical
 * des pages de marge (4a Marges pilote, réutilisable par 4b/4c/4d) :
 *  - `caHT`     : CA FACTURÉ HT de la période (Σ montantHT des factures comptables, dateEmission ∈ période).
 *                 PAS le CA devisé, PAS le TTC — la marge oppose du HT (vente) à du HT (coûts).
 *  - `couts`    : coût réel de la période (MO datée exacte + forfaitaire au prorata), via coutChantierDansPeriode.
 *  - `marge`    : caHT − couts, ou null si aucune facture (pas de marge % sur une base nulle → évite -100 %).
 *  - `margePct` : marge / caHT × 100, ou null si caHT = 0.
 *  - `aFacturer`: coûts engagés NON couverts par une facture = max(0, couts − caHT). Surface le travail
 *                 réalisé mais pas encore facturé (ex. chantier avec coûts mais sans facture → CA 0 + à-facturer),
 *                 au lieu d'afficher une marge trompeuse de −100 %.
 *  - `actif`    : le chantier a une facture OU des coûts sur la période (a-t-il sa place dans le tableau).
 */
export const indicateursMargeChantier = (chantier, employes = [], cfg = {}, pointages = [], factures = [], periode, ref = new Date()) => {
  const caHT = caFactureHTParChantier(factures, chantier?.id, periode, ref);
  const couts = coutChantierDansPeriode(chantier, employes, cfg, pointages, factures, periode, ref);
  const marge = caHT > 0 ? caHT - couts : null;
  const margePct = caHT > 0 ? ((caHT - couts) / caHT) * 100 : null;
  return {
    caHT,
    couts,
    marge,
    margePct,
    aFacturer: Math.max(0, couts - caHT),
    actif: caHT > 0 || couts > 0,
  };
};
