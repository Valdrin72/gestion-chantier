/**
 * Phase 3 — Double comportement archivage :
 *   MONITORING ACTIF  → exclure archive===true
 *   HISTORIQUE/APPRENT → inclure les archivés
 *
 * Trois preuves obligatoires (brief) :
 *   1. Chantier archivé → AUCUNE alerte active ; alerte existante AUTO-RÉSOLUE.
 *   2. Chantier archivé → exclu des KPIs "en cours" / agents de surveillance.
 *   3. Chantier archivé → TOUJOURS compté dans les totaux historiques/CA annuel.
 */
import { describe, it, expect } from 'vitest';
import { isChantierActif, isChantierComptable, calculerCA } from '../donnees.js';
import { adapterContexteAlertes } from '../modules/alertes/contextAdapter.js';
import { runAlerteChantier } from '../AgentEngine.js';
import { runMemoireChantier } from '../AgentEngine.js';
import { runPlanningCoherence } from '../AgentEngine.js';
import { runConformiteBTP } from '../AgentEngine.js';
import { runProjectionAnnuelle } from '../AgentEngine.js';
import { MARGE_NEGATIVE } from '../modules/alertes/lib/rules/financier.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeChantierActif(overrides = {}) {
  return {
    id: 'c-actif', nom: 'Chantier Actif', statut: 'En cours',
    clientId: 'cl-1', devisId: 'dv-1', nombreJours: 10, journal: [], equipe: [],
    ...overrides,
  };
}

function makeChantierArchive(overrides = {}) {
  return {
    ...makeChantierActif(),
    id: 'c-archive', nom: 'Chantier Archivé',
    archive: true, dateArchivage: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeChantierTermineArchive(overrides = {}) {
  return {
    id: 'c-term-arc', nom: 'Chantier Terminé Archivé',
    statut: 'Terminé', archive: true, dateArchivage: '2025-12-01T00:00:00.000Z',
    typeChantier: 'Faux-plafond', nombreJours: 20,
    journal: [
      { date: '2025-10-01', employes: [{ employeId: 'emp1', heuresTravaillees: 8 }] },
    ],
    ...overrides,
  };
}

const PARAMETRES_BASE = {
  employes: [], localites: [], parametres: {}, agentsConfig: {},
};

const DEVIS_BASE = [{ id: 'dv-1', montantHT: 50000, statut: 'Accepté', clientId: 'cl-1' }];

// ═══════════════════════════════════════════════════════════════════════════
// PREUVE 2 — KPIs actifs / agents de surveillance excluent les archivés
// ═══════════════════════════════════════════════════════════════════════════

describe('isChantierActif — exclut archive===true', () => {
  it('chantier "En cours" normal → actif', () => {
    expect(isChantierActif(makeChantierActif())).toBe(true);
  });

  it('chantier "En cours" avec archive:true → NON actif', () => {
    expect(isChantierActif(makeChantierArchive({ statut: 'En cours' }))).toBe(false);
  });

  it('chantier "Terminé" → non actif (comportement existant préservé)', () => {
    expect(isChantierActif({ statut: 'Terminé' })).toBe(false);
  });
});

describe('isChantierComptable — exclut archive===true', () => {
  it('chantier "En cours" normal → comptable', () => {
    expect(isChantierComptable(makeChantierActif())).toBe(true);
  });

  it('chantier "Planifié" normal → comptable', () => {
    expect(isChantierComptable({ statut: 'Planifié' })).toBe(true);
  });

  it('chantier "En cours" avec archive:true → NON comptable', () => {
    expect(isChantierComptable(makeChantierArchive({ statut: 'En cours' }))).toBe(false);
  });

  it('chantier "Planifié" avec archive:true → NON comptable', () => {
    expect(isChantierComptable({ statut: 'Planifié', archive: true })).toBe(false);
  });
});

describe('runAlerteChantier — chantier archivé exclu du monitoring', () => {
  it('chantier archivé (marge négative) → aucune alerte générée', () => {
    const chantierArchive = makeChantierArchive({ statut: 'En cours' });
    const devis = [{ id: 'dv-1', montantHT: 50000, statut: 'Accepté', clientId: 'cl-1' }];

    const { alertes } = runAlerteChantier({
      chantiers: [chantierArchive],
      devis,
      factures: [],
      parametres: PARAMETRES_BASE,
      getCouts: () => ({
        montantTotal: 50000, totalCoutsReel: 60000, totalCoutsPrevu: 50000,
        margeNettePct: -20, margeNette: -10000, margeReel: -10000,
        donneesIncompletes: false,
      }),
    });

    expect(alertes).toHaveLength(0);
  });

  it('chantier actif (marge négative) → alerte générée normalement', () => {
    const chantierActif = makeChantierActif({ statut: 'En cours' });
    const devis = [{ id: 'dv-1', montantHT: 50000, statut: 'Accepté', clientId: 'cl-1' }];

    const { alertes } = runAlerteChantier({
      chantiers: [chantierActif],
      devis,
      factures: [],
      parametres: PARAMETRES_BASE,
      getCouts: () => ({
        montantTotal: 50000, totalCoutsReel: 60000, totalCoutsPrevu: 50000,
        margeNettePct: -20, margeNette: -10000, margeReel: -10000,
        donneesIncompletes: false,
      }),
    });

    expect(alertes.length).toBeGreaterThan(0);
  });
});

describe('runPlanningCoherence — chantier archivé exclu', () => {
  it('chantier archivé avec date future dans le journal → aucune alerte', () => {
    const futur = '2030-01-01';
    const chantierArchive = makeChantierArchive({
      statut: 'En cours',
      dateDebut: '2026-01-01',
      journal: [{ date: futur, employes: [] }],
    });

    const { alertes } = runPlanningCoherence({
      chantiers: [chantierArchive],
      devis: DEVIS_BASE,
      parametres: PARAMETRES_BASE,
    });

    expect(alertes).toHaveLength(0);
  });

  it('chantier actif avec date future dans le journal → alerte générée', () => {
    const futur = '2030-01-01';
    const chantierActif = makeChantierActif({
      statut: 'En cours',
      dateDebut: '2026-01-01',
      journal: [{ date: futur, employes: [] }],
    });

    const { alertes } = runPlanningCoherence({
      chantiers: [chantierActif],
      devis: DEVIS_BASE,
      parametres: PARAMETRES_BASE,
    });

    expect(alertes.some(a => a.type === 'date_future_journal')).toBe(true);
  });
});

describe('runConformiteBTP — chantier archivé exclu', () => {
  it('chantier archivé avec 12h saisies → aucune alerte CCT', () => {
    const chantierArchive = makeChantierArchive({
      journal: [{ date: '2026-01-15', employes: [{ employeId: 'emp1', heuresTravaillees: 12 }] }],
    });

    const { alertes } = runConformiteBTP({
      chantiers: [chantierArchive],
      parametres: { employes: [{ id: 'emp1', nom: 'Dupont', actif: true }] },
    });

    expect(alertes).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVE 1 — Alertes module : archivé → exclu du contexte → auto-résolution
// ═══════════════════════════════════════════════════════════════════════════

describe('contextAdapter — chantier archivé exclu du contexte des règles', () => {
  it('chantier avec archive:true absent de chantiersAdaptes', () => {
    const chantierArchive = makeChantierArchive({ statut: 'En cours' });
    const chantierActif = makeChantierActif({ statut: 'En cours' });

    const ctx = adapterContexteAlertes({
      chantiers: [chantierActif, chantierArchive],
      devis: DEVIS_BASE,
      factures: [], clients: [], parametres: PARAMETRES_BASE, pointages: [],
    });

    const ids = ctx.chantiers.map(c => c.id);
    expect(ids).toContain('c-actif');
    expect(ids).not.toContain('c-archive');
  });

  it('règle MARGE_NEGATIVE ne déclenche pas sur chantier archivé (passé par contextAdapter)', () => {
    const chantierArchive = makeChantierArchive({ statut: 'En cours' });

    const ctx = adapterContexteAlertes({
      chantiers: [chantierArchive],
      devis: DEVIS_BASE,
      factures: [], clients: [], parametres: PARAMETRES_BASE, pointages: [],
    });

    // ctx.chantiers vide → la règle ne peut pas déclencher
    expect(ctx.chantiers).toHaveLength(0);
    expect(MARGE_NEGATIVE.evaluate(ctx)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVE 3 — Totaux historiques INCLUENT les archivés (CA annuel préservé)
// ═══════════════════════════════════════════════════════════════════════════

describe('runMemoireChantier — chantier archivé terminé INCLUS dans les benchmarks', () => {
  it('chantier terminé archivé contribue aux patterns par type', () => {
    const chantierTermineArchive = makeChantierTermineArchive();

    const { data } = runMemoireChantier({
      chantiers: [chantierTermineArchive],
      devis: [{ id: 'dv-term', montantHT: 30000, statut: 'Accepté', clientId: 'cl-1' }],
      parametres: { ...PARAMETRES_BASE, employes: [{ id: 'emp1', nom: 'Dupont', tarifJour: 350, actif: true }] },
      getCouts: () => ({
        totalCoutsPrevu: 20000, totalCoutsReel: 22000,
        coutEquipeReel: 18000, montantTotal: 30000,
        donneesIncompletes: false,
      }),
    });

    // Le chantier archivé terminé DOIT contribuer au pattern "Faux-plafond"
    expect(data['Faux-plafond']).toBeDefined();
    expect(data['Faux-plafond'].count).toBeGreaterThanOrEqual(1);
  });

  it('archiver un chantier actif ne vide pas les patterns historiques de chantiers terminés', () => {
    const chantierTermine = makeChantierTermineArchive({ id: 'c-term-1', archive: false });
    const chantierActifArchive = makeChantierArchive({ statut: 'En cours', typeChantier: 'Faux-plafond' });

    const { data: avantArchivage } = runMemoireChantier({
      chantiers: [chantierTermine],
      devis: [],
      parametres: PARAMETRES_BASE,
      getCouts: () => ({ totalCoutsPrevu: 20000, totalCoutsReel: 22000, montantTotal: 30000, donneesIncompletes: false }),
    });

    const { data: apresArchivage } = runMemoireChantier({
      chantiers: [chantierTermine, chantierActifArchive],
      devis: [],
      parametres: PARAMETRES_BASE,
      getCouts: () => ({ totalCoutsPrevu: 20000, totalCoutsReel: 22000, montantTotal: 30000, donneesIncompletes: false }),
    });

    // L'archivage du chantier actif ne retire pas le terminé des benchmarks
    expect(apresArchivage['Faux-plafond']?.count).toEqual(avantArchivage['Faux-plafond']?.count);
  });
});

describe('runProjectionAnnuelle — test MONEY : archiver ne fait PAS baisser le CA annuel (CHF)', () => {
  const anneeActuelle = new Date().getFullYear();
  const devisList = [
    { id: 'dv-a', montantHT: 80000, statut: 'Accepté', clientId: 'cl-1' },
    { id: 'dv-b', montantHT: 45000, statut: 'Accepté', clientId: 'cl-2' },
  ];
  const chantierA = {
    id: 'c-a', nom: 'Chantier A', statut: 'Terminé',
    devisId: 'dv-a', dateDebut: `${anneeActuelle}-02-01`, nombreJours: 10, journal: [],
  };
  const chantierB = {
    id: 'c-b', nom: 'Chantier B', statut: 'En cours',
    devisId: 'dv-b', dateDebut: `${anneeActuelle}-03-01`, nombreJours: 10, journal: [],
  };
  const getCouts = () => ({ totalCoutsReel: 30000, totalCoutsPrevu: 30000, montantTotal: 0, donneesIncompletes: false });

  it('CA annuel AVANT archivage = 80 000 + 45 000 = CHF 125 000', () => {
    const { data } = runProjectionAnnuelle({
      chantiers: [chantierA, chantierB],
      devis: devisList, factures: [], parametres: PARAMETRES_BASE, getCouts,
    });
    expect(data.caRealise).toBe(125000);
  });

  it('CA annuel APRÈS archivage du chantier A → reste CHF 125 000 (IDENTIQUE)', () => {
    const chantierAArchive = { ...chantierA, archive: true, dateArchivage: new Date().toISOString() };
    const { data } = runProjectionAnnuelle({
      chantiers: [chantierAArchive, chantierB],
      devis: devisList, factures: [], parametres: PARAMETRES_BASE, getCouts,
    });
    expect(data.caRealise).toBe(125000);
  });

  it('coûts réalisés YTD identiques avant/après archivage (CHF)', () => {
    const avant = runProjectionAnnuelle({
      chantiers: [chantierA, chantierB], devis: devisList, factures: [], parametres: PARAMETRES_BASE, getCouts,
    }).data;
    const apres = runProjectionAnnuelle({
      chantiers: [{ ...chantierA, archive: true }, { ...chantierB, archive: true }],
      devis: devisList, factures: [], parametres: PARAMETRES_BASE, getCouts,
    }).data;
    expect(apres.caRealise).toBe(avant.caRealise);
    expect(apres.coutsRealises).toBe(avant.coutsRealises);
  });

  it('sanity : calculerCA ne dépend pas du flag archive', () => {
    expect(calculerCA(chantierA, devisList)).toBe(80000);
    expect(calculerCA({ ...chantierA, archive: true }, devisList)).toBe(80000);
  });
});
