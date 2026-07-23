/**
 * MATRICE DATES × MAJORATIONS × CHAÎNES — chasse à la casse.
 *
 * Objectif : croiser les axes fragiles (dates limites, majorations CCT par
 * canton, cohérence Pâques, échappement des chaînes) contre les VRAIES
 * fonctions exportées. Aucune logique n'est ré-implémentée dans ce fichier
 * (règle 7 CLAUDE.md) : on importe et on appelle le vrai chemin de code.
 *
 * Certains tests SONT rouges volontairement — ils documentent une casse réelle.
 * Chaque bloc rouge porte un commentaire "CASSE:" avec attendu/obtenu/gravité.
 *
 * Lancer : npx vitest run src/__tests__/matrice-dates-majorations.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  calculerMajorationDate,
  calculerPartSemaine,
  facteurEffectif,
} from '../calculs/majorations';
import {
  estFerie,
  feriesGeneve,
  feriesVaud,
  paques,
} from '../calculs/feries';
import {
  calculerDateFinOuvrables,
  calculerEtatChantier,
} from '../donnees';

// ── Helpers de construction (données réelles, pas de logique métier) ─────────

/** Un pointage conforme au modèle Phase 5c. */
function ptg(date, employeId, heures, { categorie = 'production', chantierId = 'C1' } = {}) {
  return {
    id: `p_${date}_${employeId}`,
    date,
    employeId,
    repartitions: [{ chantierId, categorie, heures }],
    deplacement: null,
    majoration: null,
  };
}

const EMP = [{ id: 1, nom: 'Test', tarifJour: 400, tarifDejaCharge: true }]; // tarifH = 50 CHF
const CFG = { coefficientMainOeuvre: 1.35, tauxFraisGeneraux: 12 };

function chantierBase(overrides = {}) {
  return {
    id: 'C1',
    nom: 'Chantier test',
    statut: 'en cours',
    nombreJours: 20,
    equipe: [{ employeId: 1, joursPlannifies: 20 }],
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  AXE 1 — COHÉRENCE DE PÂQUES ET DES FÉRIÉS MOBILES
// ════════════════════════════════════════════════════════════════════════════

describe('Pâques — algorithme Meeus-Jones-Butcher', () => {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  it('Pâques 2024 = 31 mars', () => {
    expect(iso(paques(2024))).toBe('2024-03-31');
  });
  it('Pâques 2025 = 20 avril', () => {
    expect(iso(paques(2025))).toBe('2025-04-20');
  });
  it('Pâques 2026 = 5 avril', () => {
    expect(iso(paques(2026))).toBe('2026-04-05');
  });

  it('Ascension 2025 = 29 mai (Pâques + 39j) — suit Pâques', () => {
    expect(feriesGeneve(2025).has('2025-05-29')).toBe(true);
    expect(feriesVaud(2025).has('2025-05-29')).toBe(true);
  });
  it('Lundi de Pentecôte 2025 = 9 juin (Pâques + 50j) — suit Pâques', () => {
    expect(feriesGeneve(2025).has('2025-06-09')).toBe(true);
    expect(feriesVaud(2025).has('2025-06-09')).toBe(true);
  });
  it('Vendredi Saint 2024 = 29 mars (Pâques - 2j)', () => {
    expect(feriesGeneve(2024).has('2024-03-29')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AXE 2 — FÉRIÉS : LE CANTON DOIT CHANGER LE RÉSULTAT
// ════════════════════════════════════════════════════════════════════════════

describe('Fériés — divergence GE / VD (le canton compte)', () => {
  it('Berchtoldstag 2 janvier : férié VD, PAS férié GE', () => {
    expect(estFerie('2025-01-02', 'VD')).toBe(true);
    expect(estFerie('2025-01-02', 'GE')).toBe(false);
  });

  it('Jeûne genevois 2025 = 11 septembre : férié GE, PAS férié VD', () => {
    // jeudi suivant le 1er dimanche de septembre (7 sept 2025) → 11 sept
    expect(estFerie('2025-09-11', 'GE')).toBe(true);
    expect(estFerie('2025-09-11', 'VD')).toBe(false);
  });

  it('Jeûne genevois 2024 = 5 septembre', () => {
    expect(estFerie('2024-09-05', 'GE')).toBe(true);
  });

  it('Restauration genevoise 31 décembre : férié GE, PAS férié VD', () => {
    expect(estFerie('2025-12-31', 'GE')).toBe(true);
    expect(estFerie('2025-12-31', 'VD')).toBe(false);
  });

  it('1er janvier + 1er août + Noël : fériés dans LES DEUX cantons', () => {
    for (const canton of ['GE', 'VD']) {
      expect(estFerie('2025-01-01', canton)).toBe(true);
      expect(estFerie('2025-08-01', canton)).toBe(true);
      expect(estFerie('2025-12-25', canton)).toBe(true);
    }
  });

  it('Escalade (12 déc) N\'EST PAS un férié payé — ne doit pas majorer', () => {
    expect(estFerie('2025-12-12', 'GE')).toBe(false);
    expect(estFerie('2025-12-12', 'VD')).toBe(false);
  });

  it('Saint-Étienne (26 déc) exclu des deux cantons', () => {
    expect(estFerie('2025-12-26', 'GE')).toBe(false);
    expect(estFerie('2025-12-26', 'VD')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AXE 3 — MAJORATION PAR DATE (samedi / dimanche / férié / ouvrable)
// ════════════════════════════════════════════════════════════════════════════

describe('calculerMajorationDate — facteurs de base', () => {
  it('samedi → 1.25', () => {
    // 2025-06-07 = samedi, non férié
    expect(calculerMajorationDate('2025-06-07', 'GE')).toEqual({ type: 'samedi', facteur: 1.25 });
  });
  it('dimanche → 1.50', () => {
    // 2025-06-08 = dimanche
    expect(calculerMajorationDate('2025-06-08', 'GE')).toEqual({ type: 'dimanche', facteur: 1.50 });
  });
  it('jour ouvrable → null', () => {
    // 2025-06-10 = mardi
    expect(calculerMajorationDate('2025-06-10', 'GE')).toBeNull();
  });
  it('férié en semaine → 1.50', () => {
    // 2025-01-01 = mercredi, férié
    expect(calculerMajorationDate('2025-01-01', 'GE')).toEqual({ type: 'ferie', facteur: 1.50 });
  });

  it('31 déc en semaine : GE = férié (1.50) mais VD = ouvrable (null) — canton change le facteur', () => {
    // 2025-12-31 = mercredi
    const ge = calculerMajorationDate('2025-12-31', 'GE');
    const vd = calculerMajorationDate('2025-12-31', 'VD');
    expect(ge).toEqual({ type: 'ferie', facteur: 1.50 });
    expect(vd).toBeNull();
    expect(ge?.facteur ?? 1).not.toBe(vd?.facteur ?? 1); // invariant : le canton compte
  });

  it('férié qui tombe un dimanche → 1.50 (pas de cumul multiplicatif)', () => {
    // choisir un dimanche férié : 1er août 2027 tombe un dimanche
    const r = calculerMajorationDate('2027-08-01', 'GE');
    expect(r?.facteur).toBe(1.50);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AXE 4 — DATES LIMITES (bissextile, passage d'année, invalide)
// ════════════════════════════════════════════════════════════════════════════

describe('Dates limites — pas de crash, pas de NaN', () => {
  it('29 février d\'une année BISSEXTILE (2024) = date valide (jeudi ouvrable)', () => {
    // 2024-02-29 = jeudi
    expect(calculerMajorationDate('2024-02-29', 'GE')).toBeNull();
    expect(estFerie('2024-02-29', 'GE')).toBe(false);
  });

  it('29 février 2028 (bissextile) traité sans NaN', () => {
    const r = calculerMajorationDate('2028-02-29', 'GE');
    // 2028-02-29 = mardi → null attendu
    expect(r === null || !Number.isNaN(r.facteur)).toBe(true);
  });

  it('29 février d\'une année NON bissextile (2025) = date inexistante — pas de facteur NaN', () => {
    // JS fait rouler '2025-02-29' → 2025-03-01 ; le contrat doit rester sans NaN.
    const r = calculerMajorationDate('2025-02-29', 'GE');
    expect(r === null || !Number.isNaN(r.facteur)).toBe(true);
    expect(() => estFerie('2025-02-29', 'GE')).not.toThrow();
  });

  it('date totalement invalide ne fait pas planter estFerie/majoration', () => {
    expect(() => estFerie('pas-une-date', 'GE')).not.toThrow();
    expect(() => calculerMajorationDate('pas-une-date', 'GE')).not.toThrow();
  });

  it('1er janvier (passage d\'année) : férié des deux côtés', () => {
    expect(calculerMajorationDate('2026-01-01', 'GE')?.facteur).toBe(1.50);
    expect(calculerMajorationDate('2026-01-01', 'VD')?.facteur).toBe(1.50);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AXE 5 — JOURS OUVRABLES (passage d'année, date invalide, samedi inclus)
// ════════════════════════════════════════════════════════════════════════════

describe('calculerDateFinOuvrables', () => {
  it('date non-parsable → null (garde OK)', () => {
    expect(calculerDateFinOuvrables('pas-une-date', 5)).toBeNull();
  });

  it('FIX #6 : 29 fév non-bissextile rejeté (null), pas de date fantaisiste roulée au 1er mars', () => {
    // new Date('2025-02-29') ne renvoie PAS Invalid Date sous Node : il roule au
    // 2025-03-01. _parseDateStricte compare les composants ISO d'entrée à la date
    // obtenue → une date impossible est rejetée explicitement (null), au lieu de
    // produire une échéance de chantier fantaisiste.
    expect(calculerDateFinOuvrables('2025-02-29', 5)).toBeNull();       // MORDANT : pas '2025-03-07'
    expect(calculerDateFinOuvrables('2024-02-29', 5)).not.toBeNull();   // 2024 bissextile → date valide
    expect(calculerDateFinOuvrables('2025-13-01', 5)).toBeNull();       // mois impossible
    expect(calculerDateFinOuvrables('2025-04-31', 5)).toBeNull();       // 31 avril n'existe pas
  });

  it('nombreJours 0 ou négatif → null', () => {
    expect(calculerDateFinOuvrables('2025-06-02', 0)).toBeNull();
    expect(calculerDateFinOuvrables('2025-06-02', -3)).toBeNull();
  });

  it('FIX #7 : planning à cheval sur le Nouvel An → le 1er janvier n\'est PAS ouvré, fin repoussée d\'un jour (MORDANT)', () => {
    // Départ mercredi 31 déc 2025, 5 jours ouvrés, canton GE.
    // Sans fériés (ancien bug) : Jan1(1) Jan2(2) Jan5(3) Jan6(4) Jan7(5) → '2026-01-07'.
    // Avec fériés : Jan1 est férié (les deux cantons) → sauté → un jour de plus.
    // Jan2(1) Jan5(2) Jan6(3) Jan7(4) Jan8(5) → '2026-01-08'.
    expect(calculerDateFinOuvrables('2025-12-31', 5, false, 'GE')).toBe('2026-01-08');
    expect(calculerDateFinOuvrables('2025-12-31', 5, false, 'GE')).not.toBe('2026-01-07'); // MORDANT
  });

  it('FIX #7 canton : Jeûne genevois (11 sept 2025) exclu à GE, compté à VD → date de fin différente (MORDANT)', () => {
    // Départ mardi 9 sept 2025, 2 jours ouvrés. Jeudi 11 = Jeûne genevois (férié GE, PAS VD).
    // GE : Sep10(1), Sep11 sauté (férié), Sep12(2) → '2025-09-12'.
    // VD : Sep10(1), Sep11(2) compté → '2025-09-11'.
    const ge = calculerDateFinOuvrables('2025-09-09', 2, false, 'GE');
    const vd = calculerDateFinOuvrables('2025-09-09', 2, false, 'VD');
    expect(ge).toBe('2025-09-12');
    expect(vd).toBe('2025-09-11');
    expect(ge).not.toBe(vd); // MORDANT : le canton change le résultat
  });

  it('samedi inclus décale la date de fin', () => {
    const sansSam = calculerDateFinOuvrables('2025-06-02', 6, false);
    const avecSam = calculerDateFinOuvrables('2025-06-02', 6, true);
    expect(sansSam).not.toBe(avecSam); // le samedi change le résultat
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AXE 6 — MAJORATION SEMAINE > 45h (le helper interne est correct...)
// ════════════════════════════════════════════════════════════════════════════

describe('calculerPartSemaine — split heures normales / sup', () => {
  // Semaine ISO lun 2025-06-02 → dim 2025-06-08, 5 jours × 10h = 50h productives.
  const semaine50h = [
    ptg('2025-06-02', 1, 10),
    ptg('2025-06-03', 1, 10),
    ptg('2025-06-04', 1, 10),
    ptg('2025-06-05', 1, 10),
    ptg('2025-06-06', 1, 10),
  ];

  it('50h/semaine : le vendredi porte 5h normales + 5h majorées (seuil 45h)', () => {
    const r = calculerPartSemaine('2025-06-06', 1, semaine50h);
    expect(r).not.toBeNull();
    expect(r.heuresNormales).toBe(5);
    expect(r.heuresMaj).toBe(5);
    expect(r.facteurMaj).toBe(1.25);
  });

  it('semaine ≤ 45h → aucune majoration semaine (null)', () => {
    const semaine40h = [
      ptg('2025-06-02', 1, 8), ptg('2025-06-03', 1, 8), ptg('2025-06-04', 1, 8),
      ptg('2025-06-05', 1, 8), ptg('2025-06-06', 1, 8),
    ];
    expect(calculerPartSemaine('2025-06-06', 1, semaine40h)).toBeNull();
  });

  it('pointage 0h → null', () => {
    const s = [ptg('2025-06-02', 1, 0)];
    expect(calculerPartSemaine('2025-06-02', 1, s)).toBeNull();
  });

  it('catégorie deplacement/absence ne compte pas dans les heures productives', () => {
    const s = [
      ptg('2025-06-02', 1, 10, { categorie: 'production' }),
      ptg('2025-06-03', 1, 40, { categorie: 'deplacement' }), // ne doit pas gonfler la semaine
    ];
    // seulement 10h productives → pas de sup
    expect(calculerPartSemaine('2025-06-02', 1, s)).toBeNull();
  });
});

describe('facteurEffectif — retient le max, pas de cumul', () => {
  it('samedi (1.25) + semaine sup (1.25) → 1.25', () => {
    expect(facteurEffectif({ facteur: 1.25 }, { facteurMaj: 1.25 })).toBe(1.25);
  });
  it('dimanche (1.50) + semaine sup (1.25) → 1.50 (max)', () => {
    expect(facteurEffectif({ facteur: 1.50 }, { facteurMaj: 1.25 })).toBe(1.50);
  });
  it('aucune majoration → 1.0', () => {
    expect(facteurEffectif(null, null)).toBe(1.0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AXE 7 — MOTEUR : LE CANTON CHANGE LE COÛT DES MAJORATIONS
// ════════════════════════════════════════════════════════════════════════════

describe('calculerEtatChantier — majorations selon canton', () => {
  // 8h le 2025-12-31 (mercredi). Férié GE, ouvrable VD.
  const pointages = [ptg('2025-12-31', 1, 8)];

  it('GE : 31 déc férié → surcoût majoration = 8h × 50 × 0.50 = 200 CHF', () => {
    const etat = calculerEtatChantier(chantierBase({ canton: 'GE' }), EMP, [], CFG, pointages);
    expect(etat.coutMajorations).toBeCloseTo(200, 2);
    expect(Number.isNaN(etat.coutMajorations)).toBe(false);
  });

  it('VD : 31 déc ouvrable → surcoût majoration = 0 CHF', () => {
    const etat = calculerEtatChantier(chantierBase({ canton: 'VD' }), EMP, [], CFG, pointages);
    expect(etat.coutMajorations).toBeCloseTo(0, 2);
  });

  it('INVARIANT : le canton change bien le coût des majorations pour un férié divergent', () => {
    const ge = calculerEtatChantier(chantierBase({ canton: 'GE' }), EMP, [], CFG, pointages).coutMajorations;
    const vd = calculerEtatChantier(chantierBase({ canton: 'VD' }), EMP, [], CFG, pointages).coutMajorations;
    expect(ge).not.toBeCloseTo(vd, 2);
  });

  it('aucune valeur NaN/Infinity dans l\'état renvoyé (férié GE)', () => {
    const etat = calculerEtatChantier(chantierBase({ canton: 'GE' }), EMP, [], CFG, pointages);
    for (const [k, v] of Object.entries(etat)) {
      if (typeof v === 'number') {
        expect(Number.isFinite(v), `champ ${k} = ${v}`).toBe(true);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AXE 8 — CASSE : SUR-MAJORATION DES HEURES SUP EN SEMAINE > 45h
// ════════════════════════════════════════════════════════════════════════════
//
// _surcoutMajorations() applique facteurEffectif au TOTAL des heures du jour
// (coutBase = heuresCeChantier × tarifH) dès que calculerPartSemaine renvoie
// non-null, alors que ce helper distingue heuresNormales / heuresMaj.
// Le split est donc IGNORÉ : sur une semaine de 50h, les 5 heures sup entraînent
// une majoration ×1.25 sur les 50 heures productives de la semaine.

describe('FIX #1 — heures sup semaine : seules les heures au-delà de 45h sont majorées', () => {
  const chantier = chantierBase({ canton: 'VD' }); // VD : juin sans férié
  const jours = (heuresParJour) => heuresParJour.map((h, i) => ptg(`2025-06-0${i + 2}`, 1, h)); // lun→ven

  it('semaine 50h (lun-ven 10h/j) → majoration = 5h × 50 CHF × 0.25 = 62.5 CHF (PAS 625)', () => {
    const etat = calculerEtatChantier(chantier, EMP, [], CFG, jours([10, 10, 10, 10, 10]));
    expect(etat.coutMajorations).toBeCloseTo(62.5, 1);   // et non 625 (×10)
    expect(etat.heuresMajorees).toBeCloseTo(5, 1);
  });

  it('BORD : semaine 45h pile → ZÉRO majoration heures sup', () => {
    const etat = calculerEtatChantier(chantier, EMP, [], CFG, jours([9, 9, 9, 9, 9]));
    expect(etat.coutMajorations).toBeCloseTo(0, 1);
    expect(etat.heuresMajorees).toBeCloseTo(0, 1);
  });

  it('BORD : 44h → 0 majoration ; 46h → exactement 1h majorée (12.5 CHF)', () => {
    const e44 = calculerEtatChantier(chantier, EMP, [], CFG, jours([9, 9, 9, 9, 8]));
    expect(e44.coutMajorations).toBeCloseTo(0, 1);
    const e46 = calculerEtatChantier(chantier, EMP, [], CFG, jours([9, 9, 9, 9, 10]));
    expect(e46.heuresMajorees).toBeCloseTo(1, 1);
    expect(e46.coutMajorations).toBeCloseTo(1 * 50 * 0.25, 1); // 12.5
  });

  it('PRORATA multi-chantiers le jour de dépassement : A 6h → 3h maj, B 4h → 2h maj', () => {
    // Lun-jeu 10h chantier A (40h), vendredi : A 6h + B 4h (10h). Semaine 50h → 5h sup le vendredi.
    const pts = [
      ptg('2025-06-02', 1, 10, { chantierId: 'A' }),
      ptg('2025-06-03', 1, 10, { chantierId: 'A' }),
      ptg('2025-06-04', 1, 10, { chantierId: 'A' }),
      ptg('2025-06-05', 1, 10, { chantierId: 'A' }),
      { id: 'p-ven', date: '2025-06-06', employeId: 1, deplacement: null, majoration: null,
        repartitions: [
          { chantierId: 'A', categorie: 'production', heures: 6 },
          { chantierId: 'B', categorie: 'production', heures: 4 },
        ] },
    ];
    const chA = chantierBase({ id: 'A', canton: 'VD' });
    const chB = chantierBase({ id: 'B', canton: 'VD' });
    const eA = calculerEtatChantier(chA, EMP, [], CFG, pts);
    const eB = calculerEtatChantier(chB, EMP, [], CFG, pts);
    expect(eA.heuresMajorees).toBeCloseTo(3, 1); // 5h × 6/10
    expect(eB.heuresMajorees).toBeCloseTo(2, 1); // 5h × 4/10
    // Somme des majorations des deux chantiers = 5h × 50 × 0.25 = 62.5 (rien perdu ni doublé).
    expect(eA.coutMajorations + eB.coutMajorations).toBeCloseTo(62.5, 1);
  });

  it('CUMUL : samedi qui est aussi en heures sup → facteur 1.25 (MAX), pas de cumul', () => {
    // Lun-ven 9h (45h) + samedi 5h → semaine 50h ; le samedi porte les 5h sup ET est samedi.
    const pts = [
      ...jours([9, 9, 9, 9, 9]),
      ptg('2025-06-07', 1, 5), // samedi
    ];
    const etat = calculerEtatChantier(chantier, EMP, [], CFG, pts);
    // Samedi 5h : max(1.25 samedi, 1.25 sup) = 1.25 → 5h × 50 × 0.25 = 62.5 (pas de cumul à 1.5625).
    expect(etat.coutMajorations).toBeCloseTo(62.5, 1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AXE 9 — CHAÎNES : ÉCHAPPEMENT POUR L'EXPORT PDF (stripHtml)
// ════════════════════════════════════════════════════════════════════════════
//
// La sanitisation des champs libres avant écriture PDF vit dans une const
// stripHtml NON exportée de src/ExportPDF.js. Elle ne peut donc pas être
// testée par le vrai chemin de code (règle 7 : pas de logic-mirror).
// Ce bloc documente la casse "non-testabilité" et vérifie la surface d'export.

describe('FIX #8 — stripHtml exporté : la sanitisation PDF est testable', () => {
  it('stripHtml est désormais exporté (test complet dans stripHtml.test.js)', async () => {
    const mod = await import('../ExportPDF.js');
    expect(typeof mod.stripHtml).toBe('function');
    expect(mod.stripHtml('<b>x</b>')).toBe('x'); // sanity : balise retirée par le vrai code
  });
});
