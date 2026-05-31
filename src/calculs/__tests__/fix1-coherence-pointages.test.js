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
  it('sans pointages → coutMajorations = 0, coutEquipeReel = base', () => {
    const res = calculerCoutsChantier(
      CHANTIER, [EMPLOYE], [], {}, DEVIS, []
    );
    expect(res.coutMajorations).toBe(0);
    expect(res.coutEquipeReel).toBeCloseTo(COUT_BASE, 0);
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

  it('delta totalCoutsReel = +200 CHF (25% de 800)', () => {
    const sans = calculerCoutsChantier(CHANTIER, [EMPLOYE], [], {}, DEVIS, []);
    const avec = calculerCoutsChantier(CHANTIER, [EMPLOYE], [], {}, DEVIS, [POINTAGE_SAMEDI]);
    expect(avec.totalCoutsReel - sans.totalCoutsReel).toBeCloseTo(200, 0);
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

  it('sans pointages → couts_engages = base (journal a 1 journée = 800 CHF, sans majoration)', () => {
    // calculerEtatChantier lit le journal pour coutMOReelBase + majorations via pointages
    // Sans pointage : coutMajorations = 0, coutMOReelBase = 800 (1 journée dans le journal)
    const ctx = adapterContexteAlertes({
      chantiers: [CHANTIER], devis: DEVIS, factures: [], clients: [],
      parametres: PARAMS_ADAPTER, pointages: [],
    });
    const ch = ctx.chantiers[0];
    expect(ch.couts_engages).toBeCloseTo(COUT_BASE, 0);
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
