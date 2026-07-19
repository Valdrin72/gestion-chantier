/**
 * Fix #4 — Seuils de marge NETTE (15% danger / 20% attention)
 *          + garde jours planifiés manquants.
 *
 * Règles validées :
 *   marge nette ≥ 20%     → aucune alerte marge
 *   marge nette [15–20[   → ATTENTION
 *   marge nette < 15%     → DANGER
 *
 *   chantier actif + heures réelles > 0 + nombreJours absent/0
 *     → alerte type 'jours_planifies_manquants' (ATTENTION)
 *
 * Tous les tests passent par runAlerteChantier (VRAI chemin de code)
 * via le callback getCouts — preuve que c'est la marge NETTE qui est lue
 * (margeActuellePct brute intentionnellement différente).
 */
import { describe, it, expect } from 'vitest';
import { calculerCoutsChantier } from '../../donnees';
import { adapterContexteAlertes } from '../../modules/alertes/contextAdapter';
import { runAlerteChantier } from '../../AgentEngine';
import { pointagesDepuisChantier } from './__fixtures__/pointagesDepuisFixture';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fabrique un getCouts retournant une marge nette précise. */
const fakeCouts = (margeNettePct, margeActuellePct = margeNettePct + 8) => () => ({
  montantTotal: 10_000,
  totalCoutsReel: 8_000,
  totalCoutsPrevu: 8_000,
  margeNettePct,
  margeActuellePct,   // intentionnellement ≠ pour prouver que nette est lue
  margeReel: 2_000,
  margeNette: 10_000 * (margeNettePct / 100),
});

const chantierActif = (overrides = {}) => ({
  id: 'c1', nom: 'Test', statut: 'en cours', nombreJours: 10, journal: [],
  ...overrides,
});

const params = { employes: [], agentsConfig: {} };

// ════════════════════════════════════════════════════════════════════════════
// Partie A — Seuils de marge NETTE
// ════════════════════════════════════════════════════════════════════════════

describe('Fix #4-A — marge nette ≥ 20% → aucune alerte marge', () => {
  it('22% → 0 alerte marge', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif()], devis: [], parametres: params,
      getCouts: fakeCouts(22),
    });
    expect(r.alertes.filter(a => a.type === 'marge')).toHaveLength(0);
  });

  it('20% exact → 0 alerte marge (seuil inclus)', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif()], devis: [], parametres: params,
      getCouts: fakeCouts(20),
    });
    expect(r.alertes.filter(a => a.type === 'marge')).toHaveLength(0);
  });
});

describe('Fix #4-B — marge nette [15–20[ → ATTENTION (pas DANGER)', () => {
  it('18% → 1 alerte marge ATTENTION', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif()], devis: [], parametres: params,
      getCouts: fakeCouts(18),
    });
    const alertes = r.alertes.filter(a => a.type === 'marge');
    expect(alertes).toHaveLength(1);
    expect(alertes[0].niveau).toBe('ATTENTION');
  });

  it('19.9% → ATTENTION (juste sous seuil rentable)', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif()], devis: [], parametres: params,
      getCouts: fakeCouts(19.9),
    });
    expect(r.alertes.filter(a => a.type === 'marge')[0]?.niveau).toBe('ATTENTION');
  });

  it('15% exact → ATTENTION (pas DANGER — limite inférieure ATTENTION)', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif()], devis: [], parametres: params,
      getCouts: fakeCouts(15),
    });
    expect(r.alertes.filter(a => a.type === 'marge')[0]?.niveau).toBe('ATTENTION');
  });
});

describe('Fix #4-C — marge nette < 15% → DANGER', () => {
  it('12% → DANGER', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif()], devis: [], parametres: params,
      getCouts: fakeCouts(12),
    });
    const alertes = r.alertes.filter(a => a.type === 'marge');
    expect(alertes).toHaveLength(1);
    expect(alertes[0].niveau).toBe('DANGER');
  });

  it('0% → DANGER', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif()], devis: [], parametres: params,
      getCouts: fakeCouts(0),
    });
    expect(r.alertes.filter(a => a.type === 'marge')[0]?.niveau).toBe('DANGER');
  });

  it('-5% (perte) → DANGER', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif()], devis: [], parametres: params,
      getCouts: fakeCouts(-5),
    });
    expect(r.alertes.filter(a => a.type === 'marge')[0]?.niveau).toBe('DANGER');
  });
});

describe('Fix #4-D — marge NETTE lue (pas brute) — test discriminant', () => {
  it('brute = 26% (OK) mais nette = 18% → ATTENTION (c\'est la nette qui compte)', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif()], devis: [], parametres: params,
      getCouts: fakeCouts(18, 26),   // nette=18, brute=26
    });
    const alertes = r.alertes.filter(a => a.type === 'marge');
    expect(alertes).toHaveLength(1);
    expect(alertes[0].niveau).toBe('ATTENTION');
  });

  it('brute = 13% (danger brute) mais nette = 21% → aucune alerte (nette ≥ 20%)', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif()], devis: [], parametres: params,
      getCouts: fakeCouts(21, 13),   // nette=21, brute=13
    });
    expect(r.alertes.filter(a => a.type === 'marge')).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Partie B — Jours planifiés manquants
// ════════════════════════════════════════════════════════════════════════════

describe('Fix #4-E — jours planifiés manquants → alerte', () => {
  const coutsAvecHeures = () => ({ montantTotal: 10_000, totalCoutsReel: 2_000, totalCoutsPrevu: 8_000, margeNettePct: 22, margeActuellePct: 30 });

  it('nombreJours = 0 + heures réelles → alerte jours_planifies_manquants', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif({ nombreJours: 0 })],
      devis: [], parametres: params,
      getCouts: coutsAvecHeures,
    });
    const a = r.alertes.filter(a => a.type === 'jours_planifies_manquants');
    expect(a).toHaveLength(1);
    expect(a[0].niveau).toBe('ATTENTION');
  });

  it('nombreJours absent + heures réelles → alerte jours_planifies_manquants', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif({ nombreJours: undefined })],
      devis: [], parametres: params,
      getCouts: coutsAvecHeures,
    });
    expect(r.alertes.filter(a => a.type === 'jours_planifies_manquants')).toHaveLength(1);
  });

  it('nombreJours = 10 (renseigné) → pas d\'alerte jours', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif({ nombreJours: 10 })],
      devis: [], parametres: params,
      getCouts: coutsAvecHeures,
    });
    expect(r.alertes.filter(a => a.type === 'jours_planifies_manquants')).toHaveLength(0);
  });

  it('nombreJours = 0 mais totalCoutsReel = 0 → pas d\'alerte (aucune heure → pas utile)', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif({ nombreJours: 0 })],
      devis: [], parametres: params,
      getCouts: () => ({ montantTotal: 0, totalCoutsReel: 0, totalCoutsPrevu: 0, margeNettePct: null, margeActuellePct: null }),
    });
    expect(r.alertes.filter(a => a.type === 'jours_planifies_manquants')).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Partie C — Non-régression : les deux alertes coexistent sans conflit
// ════════════════════════════════════════════════════════════════════════════

describe('Fix #4-F — coexistence des deux alertes', () => {
  it('marge nette 12% + nombreJours=0 → DANGER marge + alerte jours (les deux)', () => {
    const r = runAlerteChantier({
      chantiers: [chantierActif({ nombreJours: 0 })],
      devis: [], parametres: params,
      getCouts: fakeCouts(12),
    });
    expect(r.alertes.filter(a => a.type === 'marge')[0]?.niveau).toBe('DANGER');
    expect(r.alertes.filter(a => a.type === 'jours_planifies_manquants')).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Partie G — Cohérence : marge nette alertes == marge nette fiche (VRAI chemin)
//
// Prouve que contextAdapter.marge_nette_actuelle et calculerCoutsChantier.margeNettePct
// produisent la MÊME valeur (formule identique, même tauxFG 12%).
// FG = tauxFraisGeneraux / 100 → 12/100 = 0.12 = 12% du CA — PAS 0.12%.
// ════════════════════════════════════════════════════════════════════════════
describe('Fix #4-G — cohérence marge nette alertes == fiche (< 0.5 point d\'écart)', () => {
  const EMP = { id: 1, nom: 'Müller', tarifJour: 800, tarifDejaCharge: true };
  const DV  = [{ id: 'd1', montantHT: 10_000, avenants: [], heuresRegie: [] }];
  // 3 jours production = 3 × 800 = 2 400 CHF coûts
  const JRNL = [
    { date: '2026-05-18', employes: [{ employeId: 1, heuresTravaillees: 8 }], categorie: 'production' },
    { date: '2026-05-19', employes: [{ employeId: 1, heuresTravaillees: 8 }], categorie: 'production' },
    { date: '2026-05-20', employes: [{ employeId: 1, heuresTravaillees: 8 }], categorie: 'production' },
  ];
  const CH = { id: 'c1', nom: 'Cohérence', devisId: 'd1', statut: 'en cours',
    nombreJours: 10, journal: JRNL, extras: [], avenants: [] };
  // tauxFraisGeneraux = 12 (pourcent) → FG = CA × 12/100 = 10000 × 0.12 = 1200 CHF
  // marge nette attendue = (10000 - 2400 - 1200) / 10000 × 100 = 64%
  const PARAMS = { employes: [EMP], localites: [], typesTravaux: [], tauxFraisGeneraux: 12 };
  const PTG = pointagesDepuisChantier(CH, [EMP]);

  it('FG réel = 12% du CA (pas 0.12%, pas 18%)', () => {
    const couts = calculerCoutsChantier(CH, [EMP], [], { tauxFraisGeneraux: 12 }, DV, PTG);
    // fraisGeneraux = montantTotal × tauxFG/100 = 10000 × 12/100 = 1200 CHF
    expect(couts.fraisGeneraux).toBeCloseTo(1_200, 0);
    // marge nette % = (10000 - 2400 - 1200) / 10000 × 100 = 64%
    expect(couts.margeNettePct).toBeCloseTo(64, 0);
  });

  it('marge_nette_actuelle (contextAdapter) == margeNettePct (calculerCoutsChantier) à < 0.5 pt', () => {
    // Chemin fiche (AgentEngine utilise calculerCoutsChantier)
    const couts = calculerCoutsChantier(CH, [EMP], [], { tauxFraisGeneraux: 12 }, DV, PTG);
    const margeNetteFiche = couts.margeNettePct; // en %

    // Chemin alertes (contextAdapter utilise calculerEtatChantier)
    const ctx = adapterContexteAlertes({
      chantiers: [CH], devis: DV, factures: [], clients: [],
      parametres: PARAMS, pointages: PTG,
    });
    const ch = ctx.chantiers[0];
    // marge_nette_actuelle est en CHF absolu → convertir en %
    const margeNetteAlertes = ch.budget_total > 0
      ? (ch.marge_nette_actuelle / ch.budget_total) * 100
      : null;

    expect(margeNetteAlertes).not.toBeNull();
    expect(Math.abs(margeNetteFiche - margeNetteAlertes)).toBeLessThan(0.5);
  });

  it('le taux FG ne vaut PAS 18% ni 0.12% : FG = 1200 ≠ CA×18/100=1800 ≠ CA×0.12/100=12', () => {
    const couts = calculerCoutsChantier(CH, [EMP], [], { tauxFraisGeneraux: 12 }, DV, PTG);
    expect(couts.fraisGeneraux).not.toBeCloseTo(1_800, 0); // pas 18%
    expect(couts.fraisGeneraux).not.toBeCloseTo(12, 0);    // pas 0.12%
    expect(couts.fraisGeneraux).toBeCloseTo(1_200, 0);     // bien 12%
  });
});
