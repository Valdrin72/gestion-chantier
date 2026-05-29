/**
 * STRESS-TEST — Scénarios réels CYNA
 * Objectif : couvrir tous les cas métier plausibles sur les deux moteurs de calcul.
 * Aucune modification du code de production — les échecs = bugs à corriger.
 *
 * D1 — Matrice avancement × résultat (20 + 2 cas)
 * D2 — États & cycle de vie (6 statuts)
 * D3 — Devis non signé / CA inconnu
 * D4 — Robustesse edge cases
 * D5 — Smoke tests pages React
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import {
  calculerCoutsChantier,
  calculerEtatChantier,
  statutRentabilite,
  calculerCA,
  isChantierActif,
  SEUILS,
} from '../../donnees.js';
import { calculerAlertes } from '../../alertes.js';

// ── Mocks pour les smoke tests ────────────────────────────────────────────────
vi.mock('../../hooks/usePointages', () => ({
  usePointages: () => ({
    upsertPointage: vi.fn(), addPointage: vi.fn(), updatePointage: vi.fn(),
    deletePointage: vi.fn(), getPointage: vi.fn(),
    getPointagesParDate: vi.fn(() => []), getPointagesParEmploye: vi.fn(() => []),
    getPointagesParChantier: vi.fn(() => []),
  }),
}));
vi.mock('../../hooks/useIsMobile', () => ({ default: () => false }));

// ── Config standard ───────────────────────────────────────────────────────────
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };

// ── Helpers ───────────────────────────────────────────────────────────────────

let _empSeq = 1;
function makeEmploye(tarifJour = 400, overrides = {}) {
  return { id: _empSeq++, nom: `Emp${_empSeq}`, tarifJour, tarifDejaCharge: true, actif: true, ...overrides };
}

function makeDevis(montantHT, id = 'd1') {
  return { id, numero: `DEV-${id}`, statut: 'Accepté', montantHT };
}

/** Construit un chantier avec journal de N jours distincts (1 employé par défaut). */
function makeChantier(opts = {}) {
  const {
    id = 'C1', statut = 'en cours', nombreJours = 100,
    joursReels = 0, empId = 1, heuresParJour = 8,
    autresCoutsReels = 0, devisId = 'd1',
    dateDebut = '2025-01-02', avancement = 0,
  } = opts;

  const journal = Array.from({ length: joursReels }, (_, i) => {
    const d = new Date('2025-01-02');
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      employes: [{ employeId: empId, heuresTravaillees: heuresParJour }],
    };
  });

  return {
    id, statut, nombreJours, journal,
    dateDebut, avancement,
    devisId, equipe: [{ employeId: empId, joursPlannifies: nombreJours }],
    autresCoutsReels: autresCoutsReels || undefined,
  };
}

/** Vérifie qu'aucune valeur numérique n'est NaN ou Infinity dans l'objet retourné. */
function assertNoNaN(obj, label) {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') {
      expect(isNaN(v), `${label}.${k} ne doit pas être NaN`).toBe(false);
      expect(isFinite(v), `${label}.${k} ne doit pas être Infinity`).toBe(true);
    }
  }
}

/** Vérifie l'équivalence de deux valeurs à tolerancePct% près. */
function equiv(a, b, tol = 0.15) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  const ref = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / ref * 100 < tol;
}

/**
 * Lance les deux moteurs sur un scénario et retourne les résultats + assertions de base.
 */
function runScenario({ chantier, devis, employes, label = '' }) {
  const devLst = [devis].filter(Boolean);
  const empLst = employes;
  const r1 = calculerCoutsChantier(chantier, empLst, [], CFG, devLst, []);
  const r2 = calculerEtatChantier(chantier, empLst, devLst, CFG, []);
  const st = statutRentabilite(r1.margeActuellePct);

  assertNoNaN(r1, `r1[${label}]`);
  assertNoNaN(r2, `r2[${label}]`);

  // Invariant : les deux moteurs donnent le même coutTotal
  expect(
    equiv(r1.totalCoutsReel, r2.coutTotalReel),
    `[${label}] totalCoutsReel: r1=${r1.totalCoutsReel} r2=${r2.coutTotalReel}`
  ).toBe(true);

  // Invariant : avancement cohérent
  expect(
    equiv(r1.avancementPct, r2.avancementPct),
    `[${label}] avancementPct: r1=${r1.avancementPct} r2=${r2.avancementPct}`
  ).toBe(true);

  // Avancement capé 0-100
  if (r1.avancementPct !== null) {
    expect(r1.avancementPct).toBeGreaterThanOrEqual(0);
    expect(r1.avancementPct).toBeLessThanOrEqual(100);
  }

  // CA cohérent entre les deux moteurs
  expect(
    equiv(r1.montantTotal, r2.devisTotal),
    `[${label}] CA: r1=${r1.montantTotal} r2=${r2.devisTotal}`
  ).toBe(true);

  return { r1, r2, st };
}

// ── D1 — MATRICE avancement × résultat ───────────────────────────────────────

describe('D1 — Matrice avancement × résultat', () => {
  const CA = 100_000;

  /**
   * Construit un scénario avec l'avancement ET la marge brute cibles.
   * L'employé a tarifJour=400. Les coûts supplémentaires sont injectés via autresCoutsReels.
   */
  function scenario(avancementPct, margeBrutePct, label) {
    const emp = makeEmploye(400);
    const devis = makeDevis(CA);
    const joursReels = Math.round(100 * avancementPct / 100);
    const coutEquipe = joursReels * 400;
    const totalCoutsCible = Math.round(CA * (1 - margeBrutePct / 100));
    const autresCoutsReels = Math.max(0, totalCoutsCible - coutEquipe);
    const chantier = makeChantier({ joursReels, empId: emp.id, autresCoutsReels, nombreJours: 100 });
    return { chantier, devis, employes: [emp], label };
  }

  const MARGES = [
    { label: 'grosse_perte', pct: -20 },
    { label: 'petite_perte', pct: -5 },
    { label: 'equilibre',    pct:  0 },
    { label: 'marge_ok',     pct: 18 },
    { label: 'grosse_marge', pct: 35 },
  ];

  const AVANCEMENTS = [20, 50, 80, 100];

  AVANCEMENTS.forEach(avt => {
    MARGES.forEach(({ label: ml, pct }) => {
      it(`avt=${avt}% × marge=${pct}% (${ml})`, () => {
        const s = scenario(avt, pct, `${avt}%×${ml}`);
        const { r1, r2, st } = runScenario(s);

        // Avancement attendu
        expect(r1.avancementPct).toBe(avt);

        // Marge brute calculée : (CA - totalCoutsReel) / CA × 100
        if (r1.montantTotal > 0 && r1.margeActuellePct !== null) {
          const margeAttendue = (r1.montantTotal - r1.totalCoutsReel) / r1.montantTotal * 100;
          expect(Math.abs(r1.margeActuellePct - margeAttendue)).toBeLessThan(0.2);
        }

        // Marge nette = marge brute - tauxFG (12)
        if (r1.margeActuellePct !== null && r1.margeNettePct !== null) {
          expect(Math.abs(r1.margeNettePct - (r1.margeActuellePct - 12))).toBeLessThan(0.2);
        }

        // statutRentabilite cohérent avec SEUILS
        if (r1.margeActuellePct !== null) {
          if (r1.margeActuellePct < 0) {
            expect(st.label).toBe('À perte');
          } else if (r1.margeActuellePct >= SEUILS.margeRentable) {
            expect(st.label).toBe('Rentable');
          } else if (r1.margeActuellePct >= SEUILS.margeLimite) {
            expect(st.label).toBe('Limite');
          } else {
            expect(st.label).toBe('Non rentable');
          }
        }
      });
    });
  });

  it('explicite — 80% EN PERTE : avt=80% marge=-20%', () => {
    const emp = makeEmploye(400);
    const devis = makeDevis(CA);
    const joursReels = 80;
    const autresCoutsReels = Math.max(0, Math.round(CA * 1.20) - joursReels * 400);
    const chantier = makeChantier({ joursReels, empId: emp.id, autresCoutsReels, nombreJours: 100 });
    const { r1, st } = runScenario({ chantier, devis, employes: [emp], label: '80%_en_perte' });
    expect(r1.avancementPct).toBe(80);
    expect(r1.margeActuellePct).toBeLessThan(0);
    expect(st.label).toBe('À perte');
  });

  it('explicite — 60% qui GAGNE : avt=60% marge=+22%', () => {
    const emp = makeEmploye(400);
    const devis = makeDevis(CA);
    const joursReels = 60;
    const autresCoutsReels = Math.max(0, Math.round(CA * 0.78) - joursReels * 400);
    const chantier = makeChantier({ joursReels, empId: emp.id, autresCoutsReels, nombreJours: 100 });
    const { r1, st } = runScenario({ chantier, devis, employes: [emp], label: '60%_qui_gagne' });
    expect(r1.avancementPct).toBe(60);
    expect(r1.margeActuellePct).toBeGreaterThanOrEqual(20);
    expect(st.label).toBe('Rentable');
  });
});

// ── D2 — États & cycle de vie ─────────────────────────────────────────────────

describe('D2 — États & cycle de vie', () => {
  const STATUTS_CLOS = ['terminé', 'termine', 'clôturé', 'cloture', 'facturé', 'facture'];
  const STATUTS_ACTIFS = ['en cours', 'planifié', 'planifie'];
  const STATUT_SUSPENDU = 'suspendu';

  function chantierId(statut) {
    const emp = makeEmploye(400);
    const devis = makeDevis(100_000);
    const chantier = makeChantier({
      statut, joursReels: 5, empId: emp.id, nombreJours: 10,
      dateDebut: '2020-01-02',
    });
    return { chantier, devis, employes: [emp] };
  }

  STATUTS_CLOS.forEach(statut => {
    it(`statut "${statut}" → avancement = 100`, () => {
      const s = chantierId(statut);
      const { r1, r2 } = runScenario({ ...s, label: statut });
      expect(r1.avancementPct).toBe(100);
      expect(r2.avancementPct).toBe(100);
    });
  });

  it('chantier clôturé exclu de isChantierActif()', () => {
    const { chantier } = chantierId('clôturé');
    expect(isChantierActif(chantier)).toBe(false);
  });

  it('chantier en cours inclus dans isChantierActif()', () => {
    const { chantier } = chantierId('en cours');
    expect(isChantierActif(chantier)).toBe(true);
  });

  it('statut "suspendu" → avancement depuis journal (pas 100)', () => {
    const s = chantierId(STATUT_SUSPENDU);
    const { r1, r2 } = runScenario({ ...s, label: 'suspendu' });
    // Suspendu n'est pas dans STATUTS_CLOS → avancement depuis journal = 5/10 = 50%
    expect(r1.avancementPct).toBe(50);
    expect(r2.avancementPct).toBe(50);
  });

  it('alertes de retard ARRÊTÉES sur chantier clôturé', () => {
    const { chantier } = chantierId('terminé');
    const alertes = calculerAlertes({ chantiers: [chantier], devis: [], factures: [] });
    const retardAlertes = alertes.filter(a => a.type === 'chantier_retard' && a.entityId === chantier.id);
    expect(retardAlertes).toHaveLength(0);
  });

  it('chantier en cours retardé → alerte retard générée', () => {
    const emp = makeEmploye(400);
    const chantier = makeChantier({
      statut: 'en cours', joursReels: 5, empId: emp.id, nombreJours: 3,
      dateDebut: '2020-01-02', // loin dans le passé → forcément en retard
    });
    const alertes = calculerAlertes({ chantiers: [chantier], devis: [], factures: [] });
    const retardAlertes = alertes.filter(a => a.type === 'chantier_retard');
    expect(retardAlertes.length).toBeGreaterThanOrEqual(1);
  });

  it('chantier planifié absent des KPI actifs (isChantierActif)', () => {
    const { chantier } = chantierId('planifié');
    expect(isChantierActif(chantier)).toBe(false);
  });
});

// ── D3 — Devis non signé / CA inconnu ────────────────────────────────────────

describe('D3 — CA inconnu (devis absent ou non accepté)', () => {
  it('sans devisId → CA = null, aucune marge affichée', () => {
    const emp = makeEmploye(400);
    const chantier = makeChantier({ joursReels: 5, empId: emp.id, devisId: undefined });
    const r1 = calculerCoutsChantier(chantier, [emp], [], CFG, [], []);
    const r2 = calculerEtatChantier(chantier, [emp], [], CFG, []);
    assertNoNaN(r1, 'D3.r1');
    assertNoNaN(r2, 'D3.r2');
    expect(r1.montantTotal).toBeNull();
    expect(r1.margeActuellePct).toBeNull();
    expect(r1.margeNettePct).toBeNull();
    expect(r2.devisTotal).toBeNull();
    expect(r2.margeProjeteePct).toBeNull();
  });

  it('devisId présent mais devis introuvable dans la liste → CA = null', () => {
    const emp = makeEmploye(400);
    const chantier = makeChantier({ joursReels: 5, empId: emp.id, devisId: 'introuvable' });
    const r1 = calculerCoutsChantier(chantier, [emp], [], CFG, [], []);
    expect(r1.montantTotal).toBeNull();
    expect(r1.margeActuellePct).toBeNull();
    assertNoNaN(r1, 'D3.introuvable');
  });

  it('devis.montantHT = 0 → CA = 0, marges = null (pas de division par zéro)', () => {
    const emp = makeEmploye(400);
    const devis = makeDevis(0);
    const chantier = makeChantier({ joursReels: 5, empId: emp.id });
    const r1 = calculerCoutsChantier(chantier, [emp], [], CFG, [devis], []);
    assertNoNaN(r1, 'D3.ca0');
    expect(r1.montantTotal).toBe(0);
    expect(r1.margeActuellePct).toBeNull(); // guard CA > 0
  });

  it('CA inconnu, 50% avancement : coûts calculés, marges null — dégradation propre', () => {
    const emp = makeEmploye(400);
    const chantier = makeChantier({ joursReels: 50, empId: emp.id, devisId: undefined, nombreJours: 100 });
    const r1 = calculerCoutsChantier(chantier, [emp], [], CFG, [], []);
    const r2 = calculerEtatChantier(chantier, [emp], [], CFG, []);
    // Les coûts sont calculés même sans CA
    expect(r1.coutEquipeReel).toBe(50 * 400);
    expect(r1.totalCoutsReel).toBe(50 * 400);
    expect(r2.coutTotalReel).toBe(50 * 400);
    // Mais les marges restent null (pas de CA)
    expect(r1.margeActuellePct).toBeNull();
    expect(r2.margeProjeteePct).toBeNull();
  });
});

// ── D4 — Robustesse edge cases ────────────────────────────────────────────────

describe('D4 — Robustesse', () => {
  it('0 jour planifié → avancement = 0, aucun crash', () => {
    const emp = makeEmploye(400);
    const devis = makeDevis(50_000);
    const chantier = makeChantier({ nombreJours: 0, joursReels: 0, empId: emp.id });
    const r1 = calculerCoutsChantier(chantier, [emp], [], CFG, [devis], []);
    const r2 = calculerEtatChantier(chantier, [emp], [devis], CFG, []);
    assertNoNaN(r1, 'D4.0j.r1');
    assertNoNaN(r2, 'D4.0j.r2');
    expect(r1.avancementPct).toBe(0);
    expect(r2.avancementPct).toBe(0);
  });

  it('employé introuvable dans la liste → coût = 0, aucun crash', () => {
    const devis = makeDevis(50_000);
    const chantier = makeChantier({ joursReels: 5, empId: 999 }); // empId 999 absent
    const r1 = calculerCoutsChantier(chantier, [], [], CFG, [devis], []);
    assertNoNaN(r1, 'D4.emp_manquant');
    expect(r1.coutEquipeReel).toBe(0);
  });

  it('journal vide → coûts MO = 0, aucun crash', () => {
    const emp = makeEmploye(400);
    const devis = makeDevis(50_000);
    const chantier = makeChantier({ joursReels: 0, empId: emp.id, nombreJours: 20 });
    const r1 = calculerCoutsChantier(chantier, [emp], [], CFG, [devis], []);
    const r2 = calculerEtatChantier(chantier, [emp], [devis], CFG, []);
    assertNoNaN(r1, 'D4.journal_vide');
    assertNoNaN(r2, 'D4.journal_vide.r2');
    expect(r1.coutEquipeReel).toBe(0);
    expect(r2.coutTotalReel).toBe(0);
  });

  it('avancement manuel > 100% sans journal → plafonné à 100, RAD ≥ 0 (BUG-1 corrigé)', () => {
    const emp = makeEmploye(400);
    const devis = makeDevis(50_000);
    // journal vide, c.avancement = 150 (donnée corrompue)
    const chantier = {
      ...makeChantier({ joursReels: 0, empId: emp.id, nombreJours: 10, autresCoutsReels: 5000 }),
      avancement: 150,
    };
    const r1 = calculerCoutsChantier(chantier, [emp], [], CFG, [devis], []);
    const r2 = calculerEtatChantier(chantier, [emp], [devis], CFG, []);
    assertNoNaN(r1, 'D4.avt>100.r1');
    assertNoNaN(r2, 'D4.avt>100.r2');
    // Avancement plafonné à 100 dans les deux moteurs
    expect(r1.avancementPct).toBeLessThanOrEqual(100);
    expect(r2.avancementPct).toBeLessThanOrEqual(100);
    // RAD ne peut pas être négatif (métier)
    if (r1.rad !== null) {
      expect(r1.rad).toBeGreaterThanOrEqual(0);
    }
  });

  it('montants négatifs dans autresCoutsReels → clampés à 0, marge ≤ 100% (OBS-1 corrigé)', () => {
    const emp = makeEmploye(400);
    const devis = makeDevis(50_000);
    const chantier = makeChantier({ joursReels: 10, empId: emp.id, autresCoutsReels: -100_000 });
    const r1 = calculerCoutsChantier(chantier, [emp], [], CFG, [devis], []);
    assertNoNaN(r1, 'D4.negatif');
    // Coûts négatifs clampés → autresCoutsReel = 0, marge physiquement possible
    expect(r1.autresCoutsReel).toBe(0);
    if (r1.margeActuellePct !== null) {
      expect(r1.margeActuellePct).toBeLessThanOrEqual(100);
    }
  });

  it('devis.montantHT = 0 → aucune division par zéro', () => {
    const emp = makeEmploye(400);
    const devis = makeDevis(0);
    const chantier = makeChantier({ joursReels: 5, empId: emp.id });
    const r1 = calculerCoutsChantier(chantier, [emp], [], CFG, [devis], []);
    const r2 = calculerEtatChantier(chantier, [emp], [devis], CFG, []);
    assertNoNaN(r1, 'D4.devis0.r1');
    assertNoNaN(r2, 'D4.devis0.r2');
  });

  it('grand volume : 50 chantiers × 20 jours de journal — aucun crash', () => {
    const employes = Array.from({ length: 5 }, (_, i) => makeEmploye(350 + i * 50));
    const devis = Array.from({ length: 50 }, (_, i) => makeDevis(80_000 + i * 1000, `d${i}`));
    const chantiers = devis.map((d, i) => makeChantier({
      id: `C${i}`, joursReels: 20, empId: employes[i % 5].id,
      devisId: d.id, nombreJours: 30,
    }));

    chantiers.forEach((c, i) => {
      const r1 = calculerCoutsChantier(c, employes, [], CFG, devis, []);
      const r2 = calculerEtatChantier(c, employes, devis, CFG, []);
      assertNoNaN(r1, `D4.volume[${i}].r1`);
      assertNoNaN(r2, `D4.volume[${i}].r2`);
    });
  });

  it('nombreJours négatif → aucun crash (données corrompues)', () => {
    const emp = makeEmploye(400);
    const devis = makeDevis(50_000);
    const chantier = { ...makeChantier({ joursReels: 0, empId: emp.id }), nombreJours: -5 };
    const r1 = calculerCoutsChantier(chantier, [emp], [], CFG, [devis], []);
    const r2 = calculerEtatChantier(chantier, [emp], [devis], CFG, []);
    assertNoNaN(r1, 'D4.jours_negatifs.r1');
    assertNoNaN(r2, 'D4.jours_negatifs.r2');
  });
});

// ── D5 — Smoke tests pages React ─────────────────────────────────────────────

import { render } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext.js';

function renderPage(ui, ctx = {}) {
  const defaultCtx = {
    chantiers: [], setChantiers: vi.fn(), clients: [], setClients: vi.fn(),
    devis: [], setDevis: vi.fn(), factures: [], setFactures: vi.fn(),
    parametres: { employes: [], localites: [], parametres: { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 } },
    setParametres: vi.fn(), pointages: [], setPointages: vi.fn(),
    paiementsData: [], setPaiementsData: vi.fn(), actionsLog: [],
    profil: { id: 'cyna', pages: ['dashboard','chantiers','finances','devis','calculs','alertes'] },
    logAction: vi.fn(), naviguer: vi.fn(), contexte: {},
    periodeGlobale: 'semaine', setPeriodeGlobale: vi.fn(),
    agentState: { alertes: [] }, ouvrirSaisieHeures: vi.fn(),
    deconnecter: vi.fn(), afficherNotif: vi.fn(), confirmer: vi.fn(),
    ...ctx,
  };
  return render(<AppProvider value={defaultCtx}>{ui}</AppProvider>);
}

describe('D5 — Smoke tests pages React', () => {
  it('Dashboard se rend sans crash avec données vides', async () => {
    const { default: Dashboard } = await import('../../pages/Dashboard.js');
    expect(() => renderPage(<Dashboard />)).not.toThrow();
  });

  it('Dashboard se rend sans crash avec un jeu de données réaliste', async () => {
    const { default: Dashboard } = await import('../../pages/Dashboard.js');
    const emp = { id: 1, nom: 'Test', tarifJour: 400, tarifDejaCharge: true, actif: true };
    const devis = { id: 'd1', montantHT: 80_000, statut: 'Accepté', clientId: 'cl1' };
    const chantier = {
      id: 'C1', nom: 'Chantier Test', statut: 'en cours', nombreJours: 20,
      devisId: 'd1', clientId: 'cl1',
      equipe: [{ employeId: 1, joursPlannifies: 20 }],
      journal: [
        { date: '2026-03-01', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
        { date: '2026-03-02', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
      ],
      dateDebut: '2026-03-01',
    };
    const ctx = {
      chantiers: [chantier],
      devis: [devis],
      clients: [{ id: 'cl1', nom: 'Client Test', type: 'prive' }],
      parametres: {
        employes: [emp], localites: [], parametres: CFG,
        tauxFraisGeneraux: 12, coefficientMainOeuvre: 1.0,
      },
    };
    expect(() => renderPage(<Dashboard />, ctx)).not.toThrow();
  });

  it('ChantiersPage se rend sans crash avec données vides', async () => {
    const { default: ChantiersPage } = await import('../../pages/ChantiersPage.js');
    expect(() => renderPage(<ChantiersPage />)).not.toThrow();
  });

  it('FinancesPage se rend sans crash avec données vides', async () => {
    const { default: FinancesPage } = await import('../../pages/FinancesPage.js');
    expect(() => renderPage(
      <FinancesPage
        factures={[]} onSave={vi.fn()} clients={[]} chantiers={[]} devis={[]}
        paiementsData={[]} setPaiementsData={vi.fn()} naviguer={vi.fn()}
        contexte={{}} profil={null} periodeGlobale="semaine" parametres={{}}
      />
    )).not.toThrow();
  });
});
