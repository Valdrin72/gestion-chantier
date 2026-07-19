/**
 * Phase 7b bis — GOLDEN MASTER POST-BASCULE.
 *
 * Les moteurs de donnees.js lisent désormais les POINTAGES (helpers Phase 7a).
 * Ce test les compare à l'ORACLE FIGÉ (moteursJournalFige) qui, lui, lit encore
 * chantier.journal — le comportement d'AVANT bascule, gelé au commit #61.
 *
 *   donnees.js (pointages)   ═══compare═══   oracle figé (journal)
 *
 * MORDANT PRÉSERVÉ : l'oracle n'utilise PAS les helpers. Une régression dans un
 * helper fait diverger donnees.js de l'oracle → test rouge. (Prouvé par test de
 * mutation : dédup jours cassée → 130'455 CHF d'écart sur 6 chantiers.)
 *
 * Couvre en plus la catégorie 'atelier' (absente des données démo, 100% production) —
 * angle mort du golden master #61, fermé ici par un cas synthétique.
 */
import { describe, it, expect } from 'vitest';
import {
  donneesInitiales,
  calculerCoutsChantier,
  calculerEtatChantier,
} from '../../donnees';
import {
  calculerCoutsChantierJournalFige,
  calculerEtatChantierJournalFige,
} from './__fixtures__/moteursJournalFige';
import { migrerJournalVersPointages } from '../../migration/migrerJournalVersPointages';
import { regenererJournalDepuisPointages } from '../../migration/regenererJournalDepuisPointages';

const CHANTIERS  = donneesInitiales.chantiers;
const EMPLOYES   = donneesInitiales.employes;
const LOCALITES  = donneesInitiales.localites;
const CFG        = donneesInitiales.parametres;
const DEVIS      = donneesInitiales.devis;
const TOLERANCE_CHF = 0.01;

// Comparateur récursif auto-découvert (aucune omission de champ possible).
function collecter(a, b, path, out) {
  const undefA = a === undefined, undefB = b === undefined;
  if (undefA || undefB) {
    if (undefA && undefB) return;
    out.push({ path, kind: 'missing', a, b });
    return;
  }
  if (a === null || b === null) { out.push({ path, kind: 'null', equal: a === b, a, b }); return; }
  if (typeof a === 'number' || typeof b === 'number') {
    const bothNum = typeof a === 'number' && typeof b === 'number';
    const nan = !bothNum || Number.isNaN(a) || Number.isNaN(b);
    out.push({ path, kind: 'number', ecart: bothNum && !nan ? Math.abs(a - b) : Infinity, nan, a, b });
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) { out.push({ path, kind: 'typemismatch', a, b }); return; }
    let aa = a, bb = b;
    const objEmp = arr => arr.length > 0 && arr.every(x => x && typeof x === 'object' && 'employeId' in x);
    if (objEmp(a) && objEmp(b)) {
      aa = [...a].sort((x, y) => x.employeId - y.employeId);
      bb = [...b].sort((x, y) => x.employeId - y.employeId);
    }
    if (aa.length !== bb.length) { out.push({ path, kind: 'length', a: aa.length, b: bb.length }); return; }
    aa.forEach((_, i) => collecter(aa[i], bb[i], `${path}[${i}]`, out));
    return;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) collecter(a[k], b[k], `${path}.${k}`, out);
    return;
  }
  out.push({ path, kind: 'scalar', equal: a === b, a, b });
}

function assertFeuilles(feuilles, ctx) {
  expect(feuilles.filter(f => f.kind === 'missing'), `${ctx} — champ d'un seul côté`).toEqual([]);
  expect(feuilles.filter(f => f.kind === 'typemismatch' || f.kind === 'length'), `${ctx} — type/longueur`).toEqual([]);
  expect(feuilles.filter(f => f.kind === 'number' && f.nan), `${ctx} — NaN`).toEqual([]);
  expect(feuilles.filter(f => f.kind === 'null' && !f.equal), `${ctx} — null d'un seul côté`).toEqual([]);
  expect(feuilles.filter(f => f.kind === 'scalar' && !f.equal), `${ctx} — scalaire`).toEqual([]);
  const horsTol = feuilles.filter(f => f.kind === 'number' && !f.nan && f.ecart > TOLERANCE_CHF);
  expect(
    horsTol,
    `${ctx} — écart > ${TOLERANCE_CHF} CHF : ${JSON.stringify(horsTol.map(f => ({ champ: f.path, ecart: f.ecart, journal: f.a, pointages: f.b })))}`
  ).toEqual([]);
}

// État chargé réaliste (séquence App.js).
const POINTAGES = migrerJournalVersPointages(CHANTIERS, EMPLOYES);
const CHANTIERS_REGEN = regenererJournalDepuisPointages(POINTAGES, CHANTIERS);

function comparerChantier(chantier, pointages = POINTAGES, devis = DEVIS) {
  const feuilles = [];
  collecter(
    calculerCoutsChantierJournalFige(chantier, EMPLOYES, LOCALITES, CFG, devis, pointages),
    calculerCoutsChantier(chantier, EMPLOYES, LOCALITES, CFG, devis, pointages),
    'couts', feuilles
  );
  collecter(
    calculerEtatChantierJournalFige(chantier, EMPLOYES, devis, CFG, pointages),
    calculerEtatChantier(chantier, EMPLOYES, devis, CFG, pointages),
    'etat', feuilles
  );
  return feuilles;
}

const RESULTATS = CHANTIERS_REGEN.map(c => ({ chantier: c, feuilles: comparerChantier(c) }));

describe('Phase 7b bis — donnees.js (pointages) === oracle journal figé, 7 chantiers démo', () => {
  RESULTATS.forEach(({ chantier, feuilles }) => {
    it(`chantier ${chantier.id} (${chantier.nom}) : aucun écart > ${TOLERANCE_CHF} CHF`, () => {
      expect(feuilles.filter(f => f.kind === 'number').length, `chantier ${chantier.id} : rien de comparé`).toBeGreaterThanOrEqual(15);
      assertFeuilles(feuilles, `chantier ${chantier.id}`);
    });
  });

  it('VERDICT post-bascule : écart max sur toutes les comparaisons', () => {
    const toutes = RESULTATS.flatMap(r => r.feuilles.map(f => ({ ...f, cid: r.chantier.id })));
    const num = toutes.filter(f => f.kind === 'number' && !f.nan);
    let pire = { ecart: 0, path: '(aucun)', cid: null, a: null, b: null };
    for (const f of num) if (f.ecart > pire.ecart) pire = { ecart: f.ecart, path: f.path, cid: f.cid, a: f.a, b: f.b };
    // eslint-disable-next-line no-console
    console.log(`[CYNA][Phase 7b bis] Post-bascule — ${num.length} valeurs numériques comparées. Écart MAX = ${pire.ecart} CHF sur ${pire.path} (chantier ${pire.cid}).`);
    expect(num.length).toBeGreaterThanOrEqual(100);
    expect(pire.ecart).toBeLessThanOrEqual(TOLERANCE_CHF);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Catégorie 'atelier' — fermeture de l'angle mort (démo = 100% production)
// ═══════════════════════════════════════════════════════════════════════════
describe('Phase 7b bis — catégorie atelier (synthétique) : donnees === oracle journal', () => {
  const empA = EMPLOYES[0];
  const chAtelier = { id: 'AT', nom: 'Chantier Atelier', statut: 'En cours', nombreJours: 10, ville: 'Genève', canton: 'GE', equipe: [] };
  // Mix production + atelier le même jour + un 2e jour atelier pur.
  const pointages = [
    { id: 'at-1', date: '2025-05-06', employeId: empA.id, repartitions: [
      { chantierId: 'AT', categorie: 'production', heures: 5 },
      { chantierId: 'AT', categorie: 'atelier', heures: 3 },
    ], deplacement: null, majoration: null },
    { id: 'at-2', date: '2025-05-07', employeId: empA.id, repartitions: [
      { chantierId: 'AT', categorie: 'atelier', heures: 8 },
    ], deplacement: null, majoration: null },
  ];
  const [chDerive] = regenererJournalDepuisPointages(pointages, [chAtelier]);

  it('atelier compté comme production (8h+8h = 16h, 2 jours) — donnees === oracle', () => {
    const feuilles = comparerChantier(chDerive, pointages, []);
    assertFeuilles(feuilles, 'atelier');
    const etat = calculerEtatChantier(chDerive, EMPLOYES, [], CFG, pointages);
    expect(etat.totalHeuresReelles).toBe(16); // 5 prod + 3 atelier + 8 atelier
    expect(etat.totalJoursReels).toBe(2);
    // L'oracle journal donne le même total (atelier inclus dans le journal dérivé).
    const oracle = calculerEtatChantierJournalFige(chDerive, EMPLOYES, [], CFG, pointages);
    expect(oracle.totalHeuresReelles).toBe(16);
  });
});

describe('Phase 7b bis — cas limite : chantier sans pointage (donnees === oracle, pas de NaN)', () => {
  it('Müller (journal vide) : donnees === oracle, avancement 0, EAC/rad null', () => {
    const muller = CHANTIERS_REGEN.find(c => (c.journal || []).length === 0);
    expect(muller).toBeTruthy();
    const feuilles = comparerChantier(muller);
    assertFeuilles(feuilles, 'sans pointage');
    const etat = calculerEtatChantier(muller, EMPLOYES, DEVIS, CFG, POINTAGES);
    expect(etat.avancementPct).toBe(0);
    expect(etat.coutFinalEstime).toBeNull();
    expect(Number.isNaN(etat.coutMOReel)).toBe(false);
  });
});
