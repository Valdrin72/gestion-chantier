/**
 * Phase 7b — GOLDEN MASTER : moteurs V7 (lecture directe pointages) === moteurs
 * originaux (lecture journal dérivé), à <0.01 CHF, champ par champ.
 *
 * Chemin de code RÉEL exercé (zéro logic-mirror, zéro valeur recopiée à la main) :
 *   donneesInitiales (7 chantiers démo + journal + devis + localités + paramètres)
 *     → migrerJournalVersPointages          (vraie migration → pointages)
 *     → regenererJournalDepuisPointages       (vrai strangler fig → journal dérivé)
 *     → calculerCoutsChantier   / calculerEtatChantier    (ORIGINAUX, lisent le journal)
 *     → calculerCoutsChantierV7 / calculerEtatChantierV7  (V7, lisent les pointages)
 *   comparaison AUTOMATIQUE de TOUS les champs (récursive) → aucune omission possible.
 *
 * La comparaison est auto-découverte : elle parcourt l'union des clés des deux
 * sorties. Un champ présent d'un seul côté = échec 'missing'. Un NaN = échec.
 * Les tableaux d'objets {employeId,...} sont triés par employeId avant comparaison
 * (l'ordre d'itération diffère entre journal et pointages, mais pas les valeurs).
 */
import { describe, it, expect } from 'vitest';
import {
  donneesInitiales,
  calculerCoutsChantier,
  calculerEtatChantier,
} from '../../donnees';
import { calculerCoutsChantierV7, calculerEtatChantierV7 } from '../moteursV7';
import { migrerJournalVersPointages } from '../../migration/migrerJournalVersPointages';
import { regenererJournalDepuisPointages } from '../../migration/regenererJournalDepuisPointages';

const CHANTIERS  = donneesInitiales.chantiers;
const EMPLOYES   = donneesInitiales.employes;
const LOCALITES  = donneesInitiales.localites;
const CFG        = donneesInitiales.parametres;
const DEVIS      = donneesInitiales.devis;

const TOLERANCE_CHF = 0.01;

// ── Comparateur récursif : collecte chaque feuille comparée (sans throw) ──────
function collecter(a, b, path, out) {
  const undefA = a === undefined, undefB = b === undefined;
  if (undefA || undefB) {
    if (undefA && undefB) return;
    out.push({ path, kind: 'missing', a, b });
    return;
  }
  if (a === null || b === null) {
    out.push({ path, kind: 'null', equal: a === b, a, b });
    return;
  }
  if (typeof a === 'number' || typeof b === 'number') {
    const bothNum = typeof a === 'number' && typeof b === 'number';
    const nan = !bothNum || Number.isNaN(a) || Number.isNaN(b);
    const ecart = bothNum && !nan ? Math.abs(a - b) : Infinity;
    out.push({ path, kind: 'number', ecart, nan, a, b });
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) { out.push({ path, kind: 'typemismatch', a, b }); return; }
    let aa = a, bb = b;
    const objAvecEmpId = arr => arr.length > 0 && arr.every(x => x && typeof x === 'object' && 'employeId' in x);
    if (objAvecEmpId(a) && objAvecEmpId(b)) {
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

// ── État "chargé" réaliste (séquence exacte d'App.js) ─────────────────────────
const POINTAGES = migrerJournalVersPointages(CHANTIERS, EMPLOYES);
const CHANTIERS_REGEN = regenererJournalDepuisPointages(POINTAGES, CHANTIERS);

// Compare les DEUX moteurs pour un chantier, retourne toutes les feuilles comparées.
function comparerChantier(chantier) {
  const feuilles = [];
  const origC = calculerCoutsChantier(chantier, EMPLOYES, LOCALITES, CFG, DEVIS, POINTAGES);
  const v7C   = calculerCoutsChantierV7(chantier, EMPLOYES, LOCALITES, CFG, DEVIS, POINTAGES);
  collecter(origC, v7C, 'couts', feuilles);

  const origE = calculerEtatChantier(chantier, EMPLOYES, DEVIS, CFG, POINTAGES);
  const v7E   = calculerEtatChantierV7(chantier, EMPLOYES, DEVIS, CFG, POINTAGES);
  collecter(origE, v7E, 'etat', feuilles);

  return { feuilles, origC, v7C, origE, v7E };
}

// Pré-calcul global (une fois) : toutes les comparaisons des 7 chantiers.
const RESULTATS = CHANTIERS_REGEN.map(c => ({ chantier: c, ...comparerChantier(c) }));

// Assertions génériques sur un lot de feuilles.
function assertFeuilles(feuilles, ctx) {
  const missing = feuilles.filter(f => f.kind === 'missing');
  expect(missing, `${ctx} — champ présent d'un seul côté : ${JSON.stringify(missing)}`).toEqual([]);

  const typeMismatch = feuilles.filter(f => f.kind === 'typemismatch' || f.kind === 'length');
  expect(typeMismatch, `${ctx} — type/longueur divergents : ${JSON.stringify(typeMismatch)}`).toEqual([]);

  const nan = feuilles.filter(f => f.kind === 'number' && f.nan);
  expect(nan, `${ctx} — NaN détecté : ${JSON.stringify(nan)}`).toEqual([]);

  const nullMismatch = feuilles.filter(f => f.kind === 'null' && !f.equal);
  expect(nullMismatch, `${ctx} — null d'un seul côté : ${JSON.stringify(nullMismatch)}`).toEqual([]);

  const scalarMismatch = feuilles.filter(f => f.kind === 'scalar' && !f.equal);
  expect(scalarMismatch, `${ctx} — scalaire divergent : ${JSON.stringify(scalarMismatch)}`).toEqual([]);

  const horsTolerance = feuilles.filter(f => f.kind === 'number' && !f.nan && f.ecart > TOLERANCE_CHF);
  expect(
    horsTolerance,
    `${ctx} — écart > ${TOLERANCE_CHF} CHF : ${JSON.stringify(horsTolerance.map(f => ({ champ: f.path, ecart: f.ecart, orig: f.a, v7: f.b })))}`
  ).toEqual([]);
}

describe('Phase 7b — GOLDEN MASTER : V7 === original, champ par champ, 7 chantiers démo', () => {
  it('7 chantiers démo chargés (sanity)', () => {
    expect(CHANTIERS.length).toBe(7);
    expect(RESULTATS.length).toBe(7);
  });

  RESULTATS.forEach(({ chantier, feuilles }) => {
    it(`chantier ${chantier.id} (${chantier.nom}) : tous les champs V7 === original à <${TOLERANCE_CHF} CHF`, () => {
      // Au moins un lot de champs numériques comparés (pas de comparaison vide silencieuse)
      const nbNum = feuilles.filter(f => f.kind === 'number').length;
      expect(nbNum, `chantier ${chantier.id} : aucun champ numérique comparé`).toBeGreaterThanOrEqual(15);
      assertFeuilles(feuilles, `chantier ${chantier.id}`);
    });
  });

  // Champs "money / décision" explicitement nommés — garantit qu'ils SONT dans le lot.
  const CHAMPS_DECISION_COUTS = [
    'couts.coutEquipeReel', 'couts.coutDeplacementReel', 'couts.totalCoutsReel',
    'couts.avancementPct', 'couts.rad', 'couts.margeReel', 'couts.margeActuellePct',
    'couts.margeNette', 'couts.margeNettePct', 'couts.coutFinalEstime',
    'couts.margeFinaleEstimeePct', 'couts.margeFinaleNettePct', 'couts.deriveProjetee',
    'couts.coutMOSansMajoration', 'couts.coutMajorations', 'couts.heuresMajorees',
  ];
  const CHAMPS_DECISION_ETAT = [
    'etat.coutMOReel', 'etat.totalJoursReels', 'etat.avancementPct', 'etat.coutTotalReel',
    'etat.coutFinalEstime', 'etat.rad', 'etat.margeEstimee', 'etat.margeProjeteePct',
    'etat.totalHeuresReelles', 'etat.coutMOSansMajoration', 'etat.coutMajorations',
  ];

  RESULTATS.forEach(({ chantier, feuilles }) => {
    it(`chantier ${chantier.id} (${chantier.nom}) : les 27 champs money/décision sont TOUS présents et comparés`, () => {
      const pathsComparés = new Set(feuilles.map(f => f.path));
      [...CHAMPS_DECISION_COUTS, ...CHAMPS_DECISION_ETAT].forEach(champ => {
        expect(pathsComparés.has(champ), `chantier ${chantier.id} : champ décision ${champ} NON comparé (manquant des deux sorties)`).toBe(true);
      });
    });
  });
});

describe('Phase 7b — VERDICT : écart max sur TOUTES les comparaisons', () => {
  it('écart max ≤ 0.01 CHF, et rapport du pire champ', () => {
    const toutesFeuilles = RESULTATS.flatMap(r => r.feuilles.map(f => ({ ...f, chantierId: r.chantier.id })));
    const numeriques = toutesFeuilles.filter(f => f.kind === 'number' && !f.nan);

    let pire = { ecart: 0, path: '(aucun)', chantierId: null, a: null, b: null };
    for (const f of numeriques) {
      if (f.ecart > pire.ecart) pire = { ecart: f.ecart, path: f.path, chantierId: f.chantierId, a: f.a, b: f.b };
    }

    const totalFeuilles = toutesFeuilles.length;
    const totalNum = numeriques.length;
    // eslint-disable-next-line no-console
    console.log(
      `[CYNA][Phase 7b] Golden master — ${RESULTATS.length} chantiers, ${totalFeuilles} feuilles comparées ` +
      `(${totalNum} numériques). Écart MAX = ${pire.ecart} CHF sur ${pire.path} ` +
      `(chantier ${pire.chantierId}, orig=${pire.a}, v7=${pire.b}).`
    );

    // Preuve de mordant : on a réellement comparé un grand nombre de valeurs.
    expect(totalNum).toBeGreaterThanOrEqual(100);
    // Le verdict lui-même.
    expect(pire.ecart).toBeLessThanOrEqual(TOLERANCE_CHF);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  CAS LIMITES — là où la bascule casse en vrai
// ═══════════════════════════════════════════════════════════════════════════

// Compare V7/original sur un chantier synthétique + pointages : journal dérivé
// pour l'original, pointages directs pour V7 (comparaison honnête).
function comparerSynthetique(chantierBase, pointages, { devis = [] } = {}) {
  const [chDerive] = regenererJournalDepuisPointages(pointages, [chantierBase]);
  const feuilles = [];
  collecter(
    calculerCoutsChantier(chDerive, EMPLOYES, LOCALITES, CFG, devis, pointages),
    calculerCoutsChantierV7(chDerive, EMPLOYES, LOCALITES, CFG, devis, pointages),
    'couts', feuilles
  );
  const origE = calculerEtatChantier(chDerive, EMPLOYES, devis, CFG, pointages);
  const v7E   = calculerEtatChantierV7(chDerive, EMPLOYES, devis, CFG, pointages);
  collecter(origE, v7E, 'etat', feuilles);
  return { chDerive, feuilles, origE, v7E };
}

describe('Phase 7b — cas limite : chantier SANS aucun pointage (journal vide)', () => {
  const muller = CHANTIERS_REGEN.find(c => (c.journal || []).length === 0);

  it('un chantier démo a bien un journal vide (Müller non démarré)', () => {
    expect(muller, 'aucun chantier à journal vide trouvé').toBeTruthy();
  });

  it('V7 === original, aucun NaN, aucune division par zéro (rad/EAC null, avancement 0)', () => {
    const { feuilles, origE, v7E } = comparerSynthetique(
      { ...muller, journal: undefined }, // force la lecture depuis pointages (vides pour lui)
      POINTAGES.filter(() => false),      // aucun pointage
    );
    assertFeuilles(feuilles, 'chantier sans pointage');
    // Pas de division par zéro : projections null, avancement 0.
    expect(origE.avancementPct).toBe(0);
    expect(v7E.avancementPct).toBe(0);
    expect(v7E.coutFinalEstime).toBeNull();
    expect(v7E.rad).toBeNull();
    expect(v7E.totalJoursReels).toBe(0);
    expect(Number.isNaN(v7E.coutMOReel)).toBe(false);
    expect(v7E.coutMOReel).toBe(0);
  });
});

describe('Phase 7b — cas limite : multi-répartitions le même jour (1 pointage, 2 chantiers)', () => {
  const empA = EMPLOYES[0]; // tarif réel
  const pointages = [{
    id: 'multi-1', date: '2025-05-06', employeId: empA.id,
    repartitions: [
      { chantierId: 'A', categorie: 'production', heures: 5 },
      { chantierId: 'B', categorie: 'production', heures: 3 },
    ],
    deplacement: null, majoration: null,
  }];
  const chA = { id: 'A', nom: 'Chantier A', statut: 'En cours', nombreJours: 10, ville: 'Genève', equipe: [] };
  const chB = { id: 'B', nom: 'Chantier B', statut: 'En cours', nombreJours: 10, ville: 'Genève', equipe: [] };

  it('chantier A ne voit QUE ses 5h — V7 === original', () => {
    const { feuilles, v7E } = comparerSynthetique(chA, pointages);
    assertFeuilles(feuilles, 'multi-chantier A');
    expect(v7E.totalHeuresReelles).toBe(5);
    expect(v7E.totalJoursReels).toBe(1);
  });

  it('chantier B ne voit QUE ses 3h — V7 === original', () => {
    const { feuilles, v7E } = comparerSynthetique(chB, pointages);
    assertFeuilles(feuilles, 'multi-chantier B');
    expect(v7E.totalHeuresReelles).toBe(3);
    expect(v7E.totalJoursReels).toBe(1);
  });
});

describe('Phase 7b — cas limite : catégories hors production/atelier (exclues des deux côtés)', () => {
  const empA = EMPLOYES[0];
  const pointages = [{
    id: 'excl-1', date: '2025-05-06', employeId: empA.id,
    repartitions: [
      { chantierId: 'C', categorie: 'deplacement', heures: 2 },
      { chantierId: 'C', categorie: 'absence_cp', heures: 8 },
      { chantierId: 'C', categorie: 'formation', heures: 4 },
    ],
    deplacement: null, majoration: null,
  }];
  const chC = { id: 'C', nom: 'Chantier C', statut: 'En cours', nombreJours: 10, ville: 'Genève', equipe: [] };

  it('déplacement / absence / formation → 0 heure productive, V7 === original, pas de NaN', () => {
    const { feuilles, v7E } = comparerSynthetique(chC, pointages);
    assertFeuilles(feuilles, 'catégories exclues');
    expect(v7E.totalHeuresReelles).toBe(0);
    expect(v7E.totalJoursReels).toBe(0);
    expect(v7E.coutMOReel).toBe(0);
  });
});

describe('Phase 7b — cas limite : majorations CCT (samedi / dimanche / férié) identiques', () => {
  const empA = EMPLOYES[0];
  const ch = { id: 'D', nom: 'Chantier D', statut: 'En cours', nombreJours: 10, ville: 'Genève', canton: 'GE', equipe: [] };

  const pointageLe = (date) => [{
    id: `maj-${date}`, date, employeId: empA.id,
    repartitions: [{ chantierId: 'D', categorie: 'production', heures: 8 }],
    deplacement: null, majoration: null,
  }];

  it('samedi 2025-05-17 : coutMajorations V7 === original ET > 0 (path majoration exercé)', () => {
    const { feuilles, v7E } = comparerSynthetique(ch, pointageLe('2025-05-17'));
    assertFeuilles(feuilles, 'majoration samedi');
    expect(v7E.coutMajorations).toBeGreaterThan(0);
  });

  it('dimanche 2025-05-18 : coutMajorations V7 === original ET > majoration samedi', () => {
    const { v7E: sam } = comparerSynthetique(ch, pointageLe('2025-05-17'));
    const { feuilles, v7E: dim } = comparerSynthetique(ch, pointageLe('2025-05-18'));
    assertFeuilles(feuilles, 'majoration dimanche');
    expect(dim.coutMajorations).toBeGreaterThan(sam.coutMajorations); // 1.50 > 1.25
  });

  it('mardi ordinaire 2025-05-20 : aucune majoration (contrôle négatif), V7 === original', () => {
    const { feuilles, v7E } = comparerSynthetique(ch, pointageLe('2025-05-20'));
    assertFeuilles(feuilles, 'jour ordinaire');
    expect(v7E.coutMajorations).toBe(0);
  });
});

describe('Phase 7b — cas limite : employé inconnu présent dans les pointages', () => {
  const pointages = [{
    id: 'inc-1', date: '2025-05-06', employeId: 99999, // absent de EMPLOYES
    repartitions: [{ chantierId: 'E', categorie: 'production', heures: 8 }],
    deplacement: null, majoration: null,
  }];
  const chE = { id: 'E', nom: 'Chantier E', statut: 'En cours', nombreJours: 10, ville: 'Genève', equipe: [] };

  it('employé inconnu → tarif 0, V7 === original, pas de crash ni NaN', () => {
    const { feuilles, v7E } = comparerSynthetique(chE, pointages);
    assertFeuilles(feuilles, 'employé inconnu');
    // 8h comptées, mais tarif inconnu = 0 → coût 0, aucun NaN.
    expect(v7E.totalHeuresReelles).toBe(8);
    expect(v7E.coutMOReel).toBe(0);
    expect(Number.isNaN(v7E.coutMOReel)).toBe(false);
    expect(v7E.equipe.map(m => m.employeId)).toContain(99999);
  });
});
