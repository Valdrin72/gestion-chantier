// ════════════════════════════════════════════════════════════════════════════
// AIDE AU DEVIS — CONSEIL DE PRIX AU m² (source A « fiable » : historique CYNA)
// ════════════════════════════════════════════════════════════════════════════
// LECTURE SEULE. Ces fonctions ne CONSEILLENT qu'un prix — elles n'écrivent JAMAIS
// dans un devis, un total ou l'état d'un chantier. Le m² n'est PAS un socle de calcul
// du CA/marge (il vient des factures) : ici il ne sert qu'à un ratio d'aide au chiffrage.
import { calculerCoutsChantier } from '../donnees';

// Décision patron : le plancher de négociation garde une marge minimale de 20 %.
export const MARGE_MIN_NEGO = 0.20;

// ── Quantiles (interpolation linéaire « type-7 », la convention usuelle) ──────
export function quantile(sortedAsc, q) {
  if (!sortedAsc || sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedAsc[base + 1];
  return next === undefined ? sortedAsc[base] : sortedAsc[base] + rest * (next - sortedAsc[base]);
}
export const mediane = (sortedAsc) => quantile(sortedAsc, 0.5);

// CA facturé HT TOTAL (vie entière) d'un chantier — exclut brouillon/annulée, fallback TTC ÷ 1.081.
// (Convention identique à periode.js ; ici on veut le total historique, pas une tranche de période.)
const _htComptableTotal = (factures, chantierId) => (factures || [])
  .filter(f => String(f.chantierId) === String(chantierId)
    && !['brouillon', 'annulee'].includes((f.statut || '').trim().toLowerCase()))
  .reduce((s, f) => {
    const h = parseFloat(f.montantHT);
    return s + (Number.isNaN(h) ? (parseFloat(f.montantTTC) || 0) / 1.081 : h);
  }, 0);

/**
 * Conseil de prix au m² pour UN type de travaux, à partir de l'HISTORIQUE CYNA (source fiable).
 *
 * Base : chantiers de ce type, RÉELLEMENT FACTURÉS (au moins une facture comptable), avec surface > 0
 *   → distribution de (CA facturé HT ÷ surface).
 *   • conseille = médiane   • bas = Q1   • haut = Q3   (on écarte les extrêmes min/max)
 *   • plancher  = coût/m² médian ÷ (1 − 20 %)   (marge minimale, décision patron)
 *
 * Garde-fou : < 3 chantiers facturés → { suffisant:false } et AUCUN chiffre (jamais de médiane sur 1-2 points).
 *
 * PURE + LECTURE SEULE. Ne modifie rien.
 *
 * @returns {{type, suffisant, nbChantiers, conseille?, bas?, haut?, coutM2Median?, plancher?}}
 */
export function conseilPrixM2ParType({ chantiers = [], factures = [], devis = [], parametres = {}, pointages = [], type }) {
  if (!type) return { type: '', suffisant: false, nbChantiers: 0 };

  const pts = [];
  for (const c of chantiers) {
    if (!(c.typesTravaux || []).includes(type)) continue;
    const surface = parseFloat(c.surface) || 0;
    if (surface <= 0) continue;
    const facHT = _htComptableTotal(factures, c.id);
    if (facHT <= 0) continue; // « facturé » = a réellement des factures comptables
    const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
    const coutReel = couts.totalCoutsReel || 0;
    pts.push({ prixM2: facHT / surface, coutM2: coutReel > 0 ? coutReel / surface : null });
  }

  const nbChantiers = pts.length;
  if (nbChantiers < 3) return { type, suffisant: false, nbChantiers };

  const prix = pts.map(p => p.prixM2).sort((a, b) => a - b);
  const coutsM2 = pts.map(p => p.coutM2).filter(v => v != null).sort((a, b) => a - b);
  const coutM2Median = coutsM2.length ? mediane(coutsM2) : null;

  return {
    type,
    suffisant: true,
    nbChantiers,
    conseille: mediane(prix),
    bas: quantile(prix, 0.25),
    haut: quantile(prix, 0.75),
    coutM2Median,
    plancher: coutM2Median != null ? coutM2Median / (1 - MARGE_MIN_NEGO) : null,
  };
}
