/**
 * INVARIANT : équivalence des coûts entre les deux moteurs de calcul chantier.
 *
 * calculerCoutsChantier (L221) — moteur "état actuel" (margeActuellePct)
 * calculerEtatChantier  (L883) — moteur "projection" (margeProjeteePct)
 *
 * Les deux moteurs DOIVENT produire les mêmes valeurs de coûts (CA, MO,
 * matériaux, sous-traitance, imprévus). Tout écart > 0.1% sur ces champs
 * signale une régression et fait échouer ce test.
 *
 * Les champs qui divergent PAR DESIGN (marge actuelle vs projetée) sont
 * vérifiés uniquement par console.log — pas d'assertion stricte.
 *
 * Lancer : npm run test:unit -- donnees.compare.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  calculerCoutsChantier,
  calculerEtatChantier,
  donneesInitiales,
} from '../donnees.js';
import { pointagesDepuisChantier, pointagesDepuisChantiers } from './__tests__/__fixtures__/pointagesDepuisFixture';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' && isNaN(v)) return 'NaN ⚠️';
  if (typeof v === 'number') return v.toLocaleString('fr-CH', { maximumFractionDigits: 2 });
  return String(v);
}

// Retourne true si deux valeurs sont équivalentes à `tolerancePct` près.
// null === null est équivalent. null !== nombre est non-équivalent.
function equivPct(a, b, tolerancePct = 0.1) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  if (isNaN(a) || isNaN(b)) return false;
  if (a === 0 && b === 0) return true;
  const ref = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / ref * 100 < tolerancePct;
}

// ── Données de test ──────────────────────────────────────────────────────────

const { chantiers, employes, devis, parametres } = donneesInitiales;

// Phase 7b bis — pointages dérivés des journaux démo (vraie migration prod).
const POINTAGES_DEMO = pointagesDepuisChantiers(chantiers, employes);

const cfg = {
  coefficientMainOeuvre: parametres?.coefficientMainOeuvre ?? 1.35,
  tauxFraisGeneraux: parametres?.tauxFraisGeneraux ?? 12,
};

// ── Invariant strict : équivalence des coûts ────────────────────────────────

describe('Invariant coûts — calculerCoutsChantier vs calculerEtatChantier', () => {
  for (const chantier of chantiers) {
    it(`chantier #${chantier.id} "${chantier.nom}" — coûts identiques`, () => {
      const ancien = calculerCoutsChantier(chantier, employes, [], cfg, devis, POINTAGES_DEMO);
      const nouveau = calculerEtatChantier(chantier, employes, devis, cfg, POINTAGES_DEMO);

      // CA — source unique : devis.montantHT
      expect(equivPct(ancien.montantTotal, nouveau.devisTotal),
        `CA: ancien=${fmt(ancien.montantTotal)} nouveau=${fmt(nouveau.devisTotal)}`
      ).toBe(true);

      // Coût MO réel — calculé depuis le journal, doit être identique
      expect(equivPct(ancien.coutEquipeReel, nouveau.coutMOReel),
        `Coût MO réel: ancien=${fmt(ancien.coutEquipeReel)} nouveau=${fmt(nouveau.coutMOReel)}`
      ).toBe(true);

      // Coût matériaux réel
      expect(equivPct(ancien.coutMaterielReel, nouveau.coutMateriel),
        `Coût matériaux: ancien=${fmt(ancien.coutMaterielReel)} nouveau=${fmt(nouveau.coutMateriel)}`
      ).toBe(true);

      // Coût sous-traitance réel
      expect(equivPct(ancien.coutSousTraitanceReel, nouveau.coutSousTraitance),
        `Coût sous-traitance: ancien=${fmt(ancien.coutSousTraitanceReel)} nouveau=${fmt(nouveau.coutSousTraitance)}`
      ).toBe(true);

      // Coût imprévus
      expect(equivPct(ancien.coutImprevus, nouveau.coutImprevus),
        `Coût imprévus: ancien=${fmt(ancien.coutImprevus)} nouveau=${fmt(nouveau.coutImprevus)}`
      ).toBe(true);

      // Avancement — maintenant retourné par les deux moteurs
      expect(equivPct(ancien.avancementPct, nouveau.avancementPct),
        `Avancement: ancien=${fmt(ancien.avancementPct)} nouveau=${fmt(nouveau.avancementPct)}`
      ).toBe(true);
    });
  }
});

// ── Observation : divergences par design ────────────────────────────────────
// Ces champs divergent intentionnellement — on les documente sans assertion stricte.

describe('Observation — divergences par design (pas d\'assertion)', () => {
  it('margeActuellePct vs margeProjeteePct — sémantique différente', () => {
    console.log('\n');
    console.log('════════════════════════════════════════════════════════════════');
    console.log('  DIVERGENCES PAR DESIGN — margeActuellePct vs margeProjeteePct');
    console.log('  (actuelle = ce qu\'on a dépensé | projetée = où on va finir)');
    console.log('════════════════════════════════════════════════════════════════');

    for (const chantier of chantiers) {
      const ancien = calculerCoutsChantier(chantier, employes, [], cfg, devis, POINTAGES_DEMO);
      const nouveau = calculerEtatChantier(chantier, employes, devis, cfg, POINTAGES_DEMO);

      const actuelle  = ancien.margeActuellePct;
      const projetee  = nouveau.margeProjeteePct;
      const avancement = ancien.avancementPct;

      const note = actuelle === null && projetee === null ? '(aucune donnée)'
        : actuelle !== null && projetee === null ? '(projection indisponible — avancement < 20%)'
        : actuelle === projetee ? '(identiques — chantier clos ou parfaitement dans les clous)'
        : '';

      console.log(
        `  #${String(chantier.id).padEnd(2)} ${chantier.nom.slice(0, 38).padEnd(38)}` +
        `  avt=${String(avancement ?? '—').padStart(4)}%` +
        `  actuelle=${String(actuelle ?? '—').padStart(7)}%` +
        `  projetée=${String(projetee ?? '—').padStart(7)}%` +
        (note ? `  ${note}` : '')
      );
    }

    console.log('════════════════════════════════════════════════════════════════');
    console.log('');
  });
});

// ── Invariant F2 : déplacement exclu de totalCoutsReel ──────────────────────
// F2 : les frais de déplacement sont imputés aux FG, pas au coût chantier.
// coutDeplacementReel doit être exposé séparément dans le retour mais ne
// doit PAS gonfler totalCoutsReel. Les deux moteurs doivent produire le
// même coutTotalReel (chantier sans déplacement dans leurs coûts).

describe('Invariant F2 — déplacement hors totalCoutsReel', () => {
  const localiteTest = [{ nom: 'Meyrin', tarifJour: 60 }];
  const empTest = [{ id: 1, nom: 'Test', tarifJour: 400, tarifDejaCharge: true }];
  const chantierAvecVille = {
    id: 'TEST_F2',
    nom: 'Chantier Meyrin',
    ville: 'Meyrin',
    statut: 'en cours',
    nombreJours: 20,
    equipe: [{ employeId: 1, joursPlannifies: 20 }],
    journal: [
      { date: '2026-05-05', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
      { date: '2026-05-06', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
      { date: '2026-05-07', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
    ],
  };
  // 3 jours journal × CHF 60/j → coutDeplacementReel = 180

  it('coutDeplacementReel exposé dans le retour et non nul', () => {
    const ptg = pointagesDepuisChantier(chantierAvecVille, empTest);
    const r = calculerCoutsChantier(chantierAvecVille, empTest, localiteTest, {}, [], ptg);
    expect(r.coutDeplacementReel).toBe(180);
  });

  it('totalCoutsReel n\'inclut PAS coutDeplacementReel (F2 : déplacement → FG)', () => {
    const ptg = pointagesDepuisChantier(chantierAvecVille, empTest);
    const r = calculerCoutsChantier(chantierAvecVille, empTest, localiteTest, {}, [], ptg);
    // Coût MO = 3j × 400 CHF/j = 1200. Pas de matériaux ni autres.
    expect(r.totalCoutsReel).toBe(r.coutEquipeReel); // déplacement absent
    expect(r.totalCoutsReel).not.toBe(r.coutEquipeReel + r.coutDeplacementReel);
  });

  it('invariant : totalCoutsReel moteur1 == coutTotalReel moteur2 (même chantier avec localité)', () => {
    const ptg = pointagesDepuisChantier(chantierAvecVille, empTest);
    const r1 = calculerCoutsChantier(chantierAvecVille, empTest, localiteTest, {}, [], ptg);
    const r2 = calculerEtatChantier(chantierAvecVille, empTest, [], {}, ptg);
    expect(equivPct(r1.totalCoutsReel, r2.coutTotalReel)).toBe(true);
  });
});

// ── Invariant C2 : un coût réel à ZÉRO (avoir) est respecté par les 2 moteurs ──
// Régression corrigée : calculerEtatChantier utilisait `|| ... || 0`, donc un 0 réel
// (falsy) retombait à tort sur le champ legacy → divergence avec calculerCoutsChantier
// (qui utilise `??`, respectant le 0). Le fix aligne les 2 moteurs sur la sémantique `??`.

describe('Invariant C2 — coût réel à 0 (avoir) : équivalence des 2 moteurs', () => {
  const empC2 = [{ id: 1, nom: 'Test', tarifJour: 400, tarifDejaCharge: true }];
  // 3 jours ouvrés (mar–jeu, aucune majoration) → coût MO = 3 × 400 = 1200 dans les 2 moteurs.
  const journalC2 = [
    { date: '2026-05-05', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
    { date: '2026-05-06', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
    { date: '2026-05-07', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  ];
  const chantierAvoir = {
    id: 'TEST_C2', nom: 'Chantier avec avoir matériel', statut: 'en cours', nombreJours: 20,
    materielReel: 0,          // ← 0 RÉEL (un avoir a annulé le coût matériel)
    coutMaterielReel: 5000,   // ← champ legacy non nul : NE doit PAS être utilisé
    equipe: [{ employeId: 1, joursPlannifies: 20 }],
    journal: journalC2,
  };

  it('materielReel=0 est respecté par les DEUX moteurs (0, jamais le legacy 5000)', () => {
    const ptg = pointagesDepuisChantier(chantierAvoir, empC2);
    const r1 = calculerCoutsChantier(chantierAvoir, empC2, [], {}, [], ptg);
    const r2 = calculerEtatChantier(chantierAvoir, empC2, [], {}, ptg);
    // Moteur 1 (référence, `??`) : le 0 réel est conservé.
    expect(r1.coutMaterielReel).toBe(0);
    // Moteur 2 : APRÈS le fix ||→?? , identique (AVANT : 5000 via fallback legacy → divergence).
    expect(r2.coutMateriel).toBe(0);
    // Invariant des 2 moteurs restauré sur ce cas précis.
    expect(r2.coutMateriel).toBe(r1.coutMaterielReel);
    expect(equivPct(r1.totalCoutsReel, r2.coutTotalReel)).toBe(true);
  });

  it('champ réel ABSENT → le legacy sert bien de fallback dans les 2 moteurs (comportement conservé)', () => {
    const chantierLegacy = { ...chantierAvoir, materielReel: undefined, coutMaterielReel: 5000 };
    const ptg = pointagesDepuisChantier(chantierLegacy, empC2);
    const r1 = calculerCoutsChantier(chantierLegacy, empC2, [], {}, [], ptg);
    const r2 = calculerEtatChantier(chantierLegacy, empC2, [], {}, ptg);
    // Absence réelle (NaN→null) → fallback legacy 5000, inchangé dans les DEUX moteurs.
    expect(r1.coutMaterielReel).toBe(5000);
    expect(r2.coutMateriel).toBe(5000);
  });
});
