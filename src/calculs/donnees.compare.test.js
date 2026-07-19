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
