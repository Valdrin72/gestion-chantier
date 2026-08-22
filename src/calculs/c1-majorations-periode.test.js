/**
 * AUDIT C1 — les coûts de PÉRIODE incluent les majorations CCT (source unique), cohérents avec
 * le moteur vie-entière (Finances / détail chantier) et entre les 3 écrans money.
 *
 * Chemin de code RÉEL exercé (vraies fonctions exportées, zéro logic-mirror) :
 *   - periode.js : coutMODansPeriode (base), coutMajorationsDansPeriode (nouveau), coutChantierDansPeriode
 *     (= base + maj + forfait), indicateursMargeChantier (base des pages Marges/4x).
 *   - donnees.js : calculerCoutsChantier (moteur vie-entière, MÊME définition de majoration via la
 *     source unique surchargeMajorationPointage).
 *
 * Scénario : 1 samedi travaillé (2026-05-16) → majoration ×1.25 sur 8h.
 *   tarif jour chargé 400 → tarifH 50. Base = 8×50 = 400. Majoration = 8×50×(1.25−1) = 100.
 */
import { describe, it, expect } from 'vitest';
import {
  coutMODansPeriode,
  coutMajorationsDansPeriode,
  coutChantierDansPeriode,
  indicateursMargeChantier,
} from './periode';
import { calculerCoutsChantier } from '../donnees';

const EMP = { id: 1, nom: 'Test', tarifJour: 400, tarifDejaCharge: true }; // tarifH = 50
const CFG = { coefficientMainOeuvre: 1 };
// 2026-05-16 est un SAMEDI (mai 2026 : samedis les 2, 9, 16, 23, 30). 8h < 45h/sem → pas de >45h.
const SAMEDI = '2026-05-16';
const CH = { id: 'C1', nom: 'Chantier samedi', canton: 'GE', statut: 'en cours', nombreJours: 10, equipe: [{ employeId: 1 }] };
const P = (date) => ({ id: 'ptg_' + date, date, employeId: 1, repartitions: [{ chantierId: 'C1', categorie: 'production', heures: 8 }] });
const POINTAGES = [P(SAMEDI)];
const refAnnee = new Date(2026, 5, 15);
const refMois = (m) => new Date(2026, m, 15);

describe('C1 — coûts de période AVEC majorations CCT', () => {
  it('le samedi ajoute une majoration ×1.25 : coutChantierDansPeriode = base + majoration', () => {
    const base = coutMODansPeriode(CH, [EMP], CFG, POINTAGES, 'annee', refAnnee);
    const maj  = coutMajorationsDansPeriode(CH, [EMP], CFG, POINTAGES, 'annee', refAnnee);
    const total = coutChantierDansPeriode(CH, [EMP], CFG, POINTAGES, [], 'annee', refAnnee);
    expect(base).toBeCloseTo(400, 6);   // 8h × 50
    expect(maj).toBeCloseTo(100, 6);    // 8h × 50 × 0.25 (samedi ×1.25)
    expect(total).toBeCloseTo(500, 6);  // base + maj (+ 0 forfait)
    // AVANT le fix, coutChantierDansPeriode aurait rendu 400 (hors majorations) → surévaluation de la marge.
  });

  it('même DÉFINITION que le moteur vie-entière : base+maj période == coutEquipeReel de calculerCoutsChantier', () => {
    const r = calculerCoutsChantier(CH, [EMP], [], CFG, [], POINTAGES);
    const basePlusMaj = coutMODansPeriode(CH, [EMP], CFG, POINTAGES, 'annee', refAnnee)
                      + coutMajorationsDansPeriode(CH, [EMP], CFG, POINTAGES, 'annee', refAnnee);
    // coutEquipeReel (vie entière) = base MO + majorations → identique à la reconstitution période.
    expect(basePlusMaj).toBeCloseTo(r.coutEquipeReel, 6);
    expect(r.coutEquipeReel).toBeCloseTo(500, 6);
  });

  it('cohérence des 3 écrans : Dashboard/Statistiques (coutChantierDansPeriode) == Marges (indicateursMargeChantier.couts)', () => {
    const FACT = [{ id: 'f1', chantierId: 'C1', montantHT: 10000, dateEmission: SAMEDI, statut: 'payee' }];
    const coutDashStats = coutChantierDansPeriode(CH, [EMP], CFG, POINTAGES, FACT, 'annee', refAnnee);
    const ind = indicateursMargeChantier(CH, [EMP], CFG, POINTAGES, FACT, 'annee', refAnnee);
    // Les 3 écrans partagent la même base de coût (avec majorations) → même valeur.
    expect(ind.couts).toBeCloseTo(coutDashStats, 6);
    expect(ind.couts).toBeCloseTo(500, 6);
    // Marge de période = CA facturé HT − coûts (avec majorations) = 10000 − 500 = 9500.
    expect(ind.marge).toBeCloseTo(9500, 6);
  });

  it('emboîtement conservé : Σ des 12 mois == année (base ET majorations)', () => {
    const majAnnee   = coutMajorationsDansPeriode(CH, [EMP], CFG, POINTAGES, 'annee', refAnnee);
    const totalAnnee = coutChantierDansPeriode(CH, [EMP], CFG, POINTAGES, [], 'annee', refAnnee);
    const sommeMajMois   = Array.from({ length: 12 }, (_, m) => coutMajorationsDansPeriode(CH, [EMP], CFG, POINTAGES, 'mois', refMois(m))).reduce((a, b) => a + b, 0);
    const sommeTotalMois = Array.from({ length: 12 }, (_, m) => coutChantierDansPeriode(CH, [EMP], CFG, POINTAGES, [], 'mois', refMois(m))).reduce((a, b) => a + b, 0);
    expect(sommeMajMois).toBeCloseTo(majAnnee, 6);       // la majoration du samedi tombe une seule fois (mai)
    expect(sommeTotalMois).toBeCloseTo(totalAnnee, 6);
    expect(majAnnee).toBeCloseTo(100, 6);
  });

  it('aucune majoration un jour de semaine (non-régression) : maj = 0', () => {
    const LUNDI = [P('2026-05-18')]; // lundi
    expect(coutMajorationsDansPeriode(CH, [EMP], CFG, LUNDI, 'annee', refAnnee)).toBeCloseTo(0, 6);
    expect(coutChantierDansPeriode(CH, [EMP], CFG, LUNDI, [], 'annee', refAnnee)).toBeCloseTo(400, 6);
  });
});
