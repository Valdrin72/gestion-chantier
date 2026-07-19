/**
 * Fix #1 — Cohérence pointages + taux FG
 * Prouve que les majorations CCT (samedi ×1.25) comptent DANS LE VRAI CHEMIN :
 * (i) calculerCoutsChantier (base du getCouts interne de runAllAgents)
 * (ii) runAllAgents — l'alerte marge change quand le samedi pousse le coût au-dessus du seuil
 * (iii) adapterContexteAlertes — couts_engages reflète les majorations
 * (iv) TAUX_FG unifié à 0.12 dans constants.js
 */
import { describe, it, expect } from 'vitest';
import { calculerCoutsChantier, calculerEtatChantier } from '../../donnees';
import { runAllAgents } from '../../AgentEngine';
import { adapterContexteAlertes } from '../../modules/alertes/contextAdapter';
import { CYNA_PARAMS } from '../constants';

// ── Fixtures ────────────────────────────────────────────────────────────────
// 2026-05-30 = samedi (vérifié : new Date('2026-05-30').getDay() === 6)
const DATE_SAMEDI = '2026-05-30';

const EMPLOYE = {
  id: 1, nom: 'Paul Müller', tarifJour: 800, tarifDejaCharge: true,
};

// Chantier avec une journée journal (production) le samedi
const JOURNAL_SAMEDI = [{
  date: DATE_SAMEDI,
  employes: [{ employeId: 1, heuresTravaillees: 8 }],
  categorie: 'production',
}];

// Pointage samedi : nécessaire pour que _surcoutMajorations détecte le ×1.25
const POINTAGE_SAMEDI = {
  id: 'p1',
  date: DATE_SAMEDI,
  employeId: 1,
  repartitions: [{ chantierId: 'c1', categorie: 'production', heures: 8 }],
};

// 2026-05-28 = jeudi ouvré, hors férié GE → fe = 1 (aucune majoration). Sert de RÉFÉRENCE
// "jour normal" pour la comparaison A/B en source unique (post-bascule 7b).
const DATE_OUVRE = '2026-05-28';
const POINTAGE_OUVRE = {
  id: 'p0',
  date: DATE_OUVRE,
  employeId: 1,
  repartitions: [{ chantierId: 'c1', categorie: 'production', heures: 8 }],
};

// CA = 1200 → marge nette sans maj = (0.88×1200 - 800)/1200 = 21.3% ≥ 20% → aucune alerte
// CA = 1200 → marge nette avec maj = (0.88×1200 - 1000)/1200 = 4.7% < 15% → DANGER
const DEVIS = [{ id: 'd1', numero: 'D-001', montantHT: 1200, avenants: [], heuresRegie: [] }];

const CHANTIER = {
  id: 'c1', nom: 'Test Samedi', devisId: 'd1', clientId: 'cl1',
  statut: 'en cours', nombreJours: 10,
  journal: JOURNAL_SAMEDI, extras: [],
};

// tarifH = 800 / 8 = 100 CHF/h — 8h samedi = base 800 CHF
// Avec majoration ×1.25 : coût total MO = 1000 CHF (+200)
const COUT_BASE = 800;         // sans majoration
const COUT_AVEC_MAJ = 1000;    // 800 × 1.25

// ── (i) calculerCoutsChantier : preuve directe de la majoration ──────────────
describe('Fix #1-A — calculerCoutsChantier : majorations CCT samedi', () => {
  it('jour OUVRÉ (chantier A) → coutMajorations = 0, coutEquipeReel = base 800', () => {
    // Source unique : 1 jour ouvré (jeudi) 8h → base 8h×100 = 800, fe=1 → aucune majoration.
    const res = calculerCoutsChantier(
      CHANTIER, [EMPLOYE], [], {}, DEVIS, [POINTAGE_OUVRE]
    );
    expect(res.coutMajorations).toBe(0);
    expect(res.coutEquipeReel).toBeCloseTo(COUT_BASE, 0);   // 800
    expect(res.totalCoutsReel).toBeCloseTo(COUT_BASE, 0);
  });

  it('avec pointage samedi → coutMajorations > 0, coutEquipeReel = base × 1.25', () => {
    const res = calculerCoutsChantier(
      CHANTIER, [EMPLOYE], [], {}, DEVIS, [POINTAGE_SAMEDI]
    );
    expect(res.coutMajorations).toBeCloseTo(COUT_BASE * 0.25, 0); // +200 CHF
    expect(res.coutEquipeReel).toBeCloseTo(COUT_AVEC_MAJ, 0);
    expect(res.totalCoutsReel).toBeCloseTo(COUT_AVEC_MAJ, 0);
  });

  it('un SAMEDI coûte +200 CHF de plus qu\'un jour ouvré (×1.25 CCT)', () => {
    // Comparaison A/B en source unique, même travail (8h) sur le même chantier :
    //   A = jour ouvré → totalCoutsReel 800.  B = samedi → 800×1.25 = 1000.
    //   delta B − A = 200 (c'est l'assertion d'origine, préservée).
    const A = calculerCoutsChantier(CHANTIER, [EMPLOYE], [], {}, DEVIS, [POINTAGE_OUVRE]);
    const B = calculerCoutsChantier(CHANTIER, [EMPLOYE], [], {}, DEVIS, [POINTAGE_SAMEDI]);
    expect(B.totalCoutsReel - A.totalCoutsReel).toBeCloseTo(200, 0);
  });
});

// ── (ii) runAllAgents : le chemin getCouts interne inclut pointages ──────────
// CA = 1200, base 800 → marge NETTE 21.3% → aucune alerte (≥ 20%)
// CA = 1200, avec samedi → totalCoutsReel = 1000, marge NETTE 4.7% < 15% → DANGER
describe('Fix #1-B — runAllAgents : alerte marge change avec pointage samedi', () => {
  const PARAMS = {
    employes: [EMPLOYE],
    localites: [],
    typesTravaux: [],
    parametres: {},
  };

  it('sans pointages → aucune alerte marge (marge nette 21.3% ≥ 20%)', () => {
    const result = runAllAgents({
      chantiers: [CHANTIER], devis: DEVIS, factures: [], clients: [], parametres: PARAMS,
      pointages: [],
    });
    const alertesMarge = result.alertes.filter(a => a.type === 'marge' && a.chantier_id === 'c1');
    expect(alertesMarge).toHaveLength(0);
  });

  it('avec pointage samedi → alerte marge DANGER (marge nette 4.7% < 15%)', () => {
    const result = runAllAgents({
      chantiers: [CHANTIER], devis: DEVIS, factures: [], clients: [], parametres: PARAMS,
      pointages: [POINTAGE_SAMEDI],
    });
    const alertesMarge = result.alertes.filter(a => a.type === 'marge' && a.chantier_id === 'c1');
    expect(alertesMarge.length).toBeGreaterThan(0);
    expect(alertesMarge[0].niveau).toMatch(/ATTENTION|DANGER/);
  });
});

// ── (iii) adapterContexteAlertes : couts_engages reflète les majorations ────
describe('Fix #1-C — adapterContexteAlertes : couts_engages avec pointage samedi', () => {
  const PARAMS_ADAPTER = { employes: [EMPLOYE], coefficientMainOeuvre: 1 };

  it('jour OUVRÉ (A) → couts_engages = 800 ; un samedi (B) vaut 1000 → écart 200', () => {
    // Source unique (bascule 7b). A = 1 jour ouvré 8h → couts_engages = base 800 (fe=1).
    const ctxA = adapterContexteAlertes({
      chantiers: [CHANTIER], devis: DEVIS, factures: [], clients: [],
      parametres: PARAMS_ADAPTER, pointages: [POINTAGE_OUVRE],
    });
    const chA = ctxA.chantiers[0];
    expect(chA.couts_engages).toBeCloseTo(COUT_BASE, 0);   // 800 (assertion d'origine préservée)
    // B = 1 samedi 8h → couts_engages = 800×1.25 = 1000. Écart B − A = 200 CHF (majoration CCT).
    const ctxB = adapterContexteAlertes({
      chantiers: [CHANTIER], devis: DEVIS, factures: [], clients: [],
      parametres: PARAMS_ADAPTER, pointages: [POINTAGE_SAMEDI],
    });
    const chB = ctxB.chantiers[0];
    expect(chB.couts_engages - chA.couts_engages).toBeCloseTo(200, 0);
  });

  it('avec pointage samedi → couts_engages = 1000 (+200 de majoration)', () => {
    const ctx = adapterContexteAlertes({
      chantiers: [CHANTIER], devis: DEVIS, factures: [], clients: [],
      parametres: PARAMS_ADAPTER, pointages: [POINTAGE_SAMEDI],
    });
    const ch = ctx.chantiers[0];
    expect(ch.couts_engages).toBeCloseTo(COUT_AVEC_MAJ, 0);
  });

  it('marge_brute_actuelle avec samedi = CA - coutTotalReel = 1200 - 1000 = 200', () => {
    const ctx = adapterContexteAlertes({
      chantiers: [CHANTIER], devis: DEVIS, factures: [], clients: [],
      parametres: PARAMS_ADAPTER, pointages: [POINTAGE_SAMEDI],
    });
    const ch = ctx.chantiers[0];
    expect(ch.marge_brute_actuelle).toBeCloseTo(200, 0);
  });
});

// ── (iv) TAUX_FG unifié ──────────────────────────────────────────────────────
describe('Fix #1-D — CYNA_PARAMS.TAUX_FG aligné sur donnees.js défaut (12%)', () => {
  it('CYNA_PARAMS.TAUX_FG === 0.12', () => {
    expect(CYNA_PARAMS.TAUX_FG).toBe(0.12);
  });
});
