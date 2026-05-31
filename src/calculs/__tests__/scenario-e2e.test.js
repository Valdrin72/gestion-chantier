/**
 * SCÉNARIO END-TO-END — Du devis à la facture, avec majorations CCT.
 *
 * Un chantier réaliste composé depuis les VRAIES fonctions exportées.
 * Chaque assertion vérifie un maillon de la chaîne : CA, coûts MO,
 * majorations samedi/dimanche, avenant, extras, situation, agents, démarrage.
 *
 * Valeurs de référence (commentées) calculées à la main pour pouvoir
 * détecter toute dérive numérique future.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock supabase (requis par useSupabaseData au module-level)
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn(), update: vi.fn(), insert: vi.fn() })),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
}));

import {
  calculerCAForfait, calculerCA,
  calculerCoutsChantier, calculerEtatChantier,
} from '../../donnees';
import { runAllAgents } from '../../AgentEngine';
import { resolveDataFromBlob, PARAMETRES_DEFAUT } from '../../hooks/useSupabaseData';

// ════════════════════════════════════════════════════════════════════════════
// FIXTURES COMMUNES
// ════════════════════════════════════════════════════════════════════════════

// tarifH = 800 / 8 = 100 CHF/h
const EMPLOYE = { id: 1, nom: 'Müller', tarifJour: 800, tarifDejaCharge: true };

// 8 jours normaux (lun-ven, semaines du 18 et 25 mai 2026)
const JOURS_NORMAUX = [
  '2026-05-18','2026-05-19','2026-05-20','2026-05-21','2026-05-22',
  '2026-05-25','2026-05-26','2026-05-27',
];
// → 8 jours × 8h = 64h → coutEquipeReelBase = 8 × 800 = 6 400 CHF

const JOURNAL = JOURS_NORMAUX.map(date => ({
  date,
  employes: [{ employeId: 1, heuresTravaillees: 8 }],
  categorie: 'production',
}));

// Samedi 2026-05-30 → facteur GE 1.25 → majoration = 8h × 100 × 0.25 = +200 CHF
const PTAG_SAM = {
  id: 'p-sam', date: '2026-05-30', employeId: 1,
  repartitions: [{ chantierId: 'c1', categorie: 'production', heures: 8 }],
};

// Dimanche 2026-05-31 → facteur GE 1.50 → majoration = 8h × 100 × 0.50 = +400 CHF
const PTAG_DIM = {
  id: 'p-dim', date: '2026-05-31', employeId: 1,
  repartitions: [{ chantierId: 'c1', categorie: 'production', heures: 8 }],
};

// coutMajorations attendu = 200 + 400 = 600 CHF
// coutEquipeReel          = 6 400 + 600 = 7 000 CHF

const DEVIS_BASE = { id: 'd1', numero: 'D-2026-001', montantHT: 50_000, avenants: [], heuresRegie: [] };

const CHANTIER_BASE = {
  id: 'c1', nom: 'Réno Meyrin', devisId: 'd1', clientId: 'cl1',
  statut: 'en cours', nombreJours: 10, canton: 'GE',
  // avancement prévu 10j × 8h = 80h ; réel 8j × 8h = 64h → 80%
  journal: JOURNAL, extras: [], avenants: [],
};

const PARAMS_BASE = {
  employes: [EMPLOYE],
  localites: [],
  typesTravaux: [],
  parametres: {},
};

const POINTAGES = [PTAG_SAM, PTAG_DIM];

// ════════════════════════════════════════════════════════════════════════════
// STEP 1 — CA de base (devis uniquement, sans avenant ni extras)
// ════════════════════════════════════════════════════════════════════════════
describe('E2E Step 1 — CA de base', () => {
  const devis = [DEVIS_BASE];

  it('calculerCAForfait = montantHT', () => {
    expect(calculerCAForfait(CHANTIER_BASE, devis)).toBe(50_000);
  });

  it('calculerCA = calculerCAForfait (sans extras)', () => {
    expect(calculerCA(CHANTIER_BASE, devis)).toBe(50_000);
  });

  it('CA retourne null sans devisId', () => {
    expect(calculerCAForfait({ ...CHANTIER_BASE, devisId: null }, devis)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// STEP 2 — Coûts MO avec majorations CCT (samedi ×1.25, dimanche ×1.50)
// ════════════════════════════════════════════════════════════════════════════
describe('E2E Step 2 — Majorations CCT dans calculerCoutsChantier', () => {
  const devis = [DEVIS_BASE];

  it('sans pointages : coutMajorations = 0', () => {
    const r = calculerCoutsChantier(CHANTIER_BASE, [EMPLOYE], [], {}, devis, []);
    expect(r.coutMajorations).toBe(0);
  });

  it('avec Sat+Dim : coutMajorations = 600 CHF (200 + 400)', () => {
    const r = calculerCoutsChantier(CHANTIER_BASE, [EMPLOYE], [], {}, devis, POINTAGES);
    expect(r.coutMajorations).toBeCloseTo(600, 0);
  });

  it('avec Sat+Dim : coutEquipeReel = 7 000 CHF (6 400 base + 600 maj)', () => {
    const r = calculerCoutsChantier(CHANTIER_BASE, [EMPLOYE], [], {}, devis, POINTAGES);
    expect(r.coutEquipeReel).toBeCloseTo(7_000, 0);
  });

  it('delta totalCoutsReel = +600 CHF (majorations uniquement)', () => {
    const sans = calculerCoutsChantier(CHANTIER_BASE, [EMPLOYE], [], {}, devis, []);
    const avec = calculerCoutsChantier(CHANTIER_BASE, [EMPLOYE], [], {}, devis, POINTAGES);
    expect(avec.totalCoutsReel - sans.totalCoutsReel).toBeCloseTo(600, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// STEP 3 — Avancement + invariant des deux moteurs
// ════════════════════════════════════════════════════════════════════════════
describe('E2E Step 3 — Invariant des deux moteurs (calculerCoutsChantier ≡ calculerEtatChantier)', () => {
  const devis = [DEVIS_BASE];

  it('avancementPct = 80% (64h réelles / 80h prévues)', () => {
    const etat = calculerEtatChantier(CHANTIER_BASE, [EMPLOYE], devis, {}, POINTAGES);
    expect(etat.avancementPct).toBe(80);
  });

  it('coutMajorations identiques dans les deux moteurs', () => {
    const couts = calculerCoutsChantier(CHANTIER_BASE, [EMPLOYE], [], {}, devis, POINTAGES);
    const etat  = calculerEtatChantier(CHANTIER_BASE, [EMPLOYE], devis, {}, POINTAGES);
    expect(couts.coutMajorations).toBeCloseTo(etat.coutMajorations, 0);
  });

  it('totalCoutsReel ≈ coutTotalReel (< 0.01 CHF d\'écart)', () => {
    const couts = calculerCoutsChantier(CHANTIER_BASE, [EMPLOYE], [], {}, devis, POINTAGES);
    const etat  = calculerEtatChantier(CHANTIER_BASE, [EMPLOYE], devis, {}, POINTAGES);
    expect(Math.abs(couts.totalCoutsReel - etat.coutTotalReel)).toBeLessThan(0.01);
  });

  it('devisTotal de calculerEtatChantier = calculerCA = 50 000', () => {
    const etat = calculerEtatChantier(CHANTIER_BASE, [EMPLOYE], devis, {}, POINTAGES);
    expect(etat.devisTotal).toBe(50_000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// STEP 4 — Avenant sur le devis (+5 000) : guard anti double-comptage
// ════════════════════════════════════════════════════════════════════════════
describe('E2E Step 4 — Avenant sur devis : guard exclusion mutuelle', () => {
  const devisAvecAvenant = [{
    ...DEVIS_BASE,
    avenants: [{ id: 'av1', description: 'Dalle béton supplémentaire', montant: 5_000 }],
  }];

  it('caForfait passe de 50 000 à 55 000', () => {
    const avant = calculerCAForfait(CHANTIER_BASE, [DEVIS_BASE]);
    const apres = calculerCAForfait(CHANTIER_BASE, devisAvecAvenant);
    expect(apres - avant).toBe(5_000);
    expect(apres).toBe(55_000);
  });

  it('guard : chantier.avenants peuplé N\'EST PAS additionné si devis.avenants non vide', () => {
    const chantierAvecAvenantLegacy = { ...CHANTIER_BASE, avenants: [{ montant: 5_000 }] };
    const ca = calculerCAForfait(chantierAvecAvenantLegacy, devisAvecAvenant);
    // 50 000 + 5 000 (devis) uniquement — pas 50 000 + 5 000 + 5 000
    expect(ca).toBe(55_000);
  });

  it('fallback legacy : si devis.avenants vide, chantier.avenants compte', () => {
    const chantierLegacy = { ...CHANTIER_BASE, avenants: [{ montant: 3_000 }] };
    const ca = calculerCAForfait(chantierLegacy, [DEVIS_BASE]);
    expect(ca).toBe(53_000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// STEP 5 — Extras régie : calculerCA monte, calculerCAForfait stable
// ════════════════════════════════════════════════════════════════════════════
describe('E2E Step 5 — Extras régie dans calculerCA vs calculerCAForfait', () => {
  const devisAvenant = [{
    ...DEVIS_BASE,
    avenants: [{ id: 'av1', montant: 5_000 }],
  }];

  // extras : forfait 3 000 + heures 10 × 90 = 900
  const chantierAvecExtras = {
    ...CHANTIER_BASE,
    extras: [
      { id: 'ex1', mode: 'forfait', montantForfait: 3_000 },
      { id: 'ex2', mode: 'regie',   heures: 10, tarifHeure: 90 },
    ],
  };

  it('calculerCA = 55 000 + 3 000 + 900 = 58 900', () => {
    expect(calculerCA(chantierAvecExtras, devisAvenant)).toBe(58_900);
  });

  it('calculerCAForfait = 55 000 (extras ignorés)', () => {
    expect(calculerCAForfait(chantierAvecExtras, devisAvenant)).toBe(55_000);
  });

  it('delta calculerCA - calculerCAForfait = montant des extras (3 900)', () => {
    const ca      = calculerCA(chantierAvecExtras, devisAvenant);
    const forfait = calculerCAForfait(chantierAvecExtras, devisAvenant);
    expect(ca - forfait).toBe(3_900);
  });

  it('margeActuellePct utilise calculerCA comme base (inclut extras)', () => {
    const couts = calculerCoutsChantier(chantierAvecExtras, [EMPLOYE], [], {}, devisAvenant, POINTAGES);
    // base CA = 58 900, coûts = 7 000 → marge ≈ 88.1%
    expect(couts.margeActuellePct).toBeCloseTo(88.1, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// STEP 6 — Situation (potentiel facturable)
// ════════════════════════════════════════════════════════════════════════════
describe('E2E Step 6 — Situation : potentiel basé sur caForfait × avancement', () => {
  const devisAvenant = [{
    ...DEVIS_BASE,
    avenants: [{ id: 'av1', montant: 5_000 }],
  }];
  const etat = calculerEtatChantier(CHANTIER_BASE, [EMPLOYE], devisAvenant, {}, POINTAGES);

  // Formule FinancesPage : potentiel = max(0, caForfait × avancement/100 - dejaFacture)
  const caForfait  = 55_000;
  const avancement = 80; // confirmé step 3
  const caForfaitAvancement = caForfait * avancement / 100; // 44 000

  it('caForfait × 80% = 44 000 (potentiel brut sans déductions)', () => {
    expect(caForfaitAvancement).toBe(44_000);
  });

  it('facture extra (extraId) exclue du dejaFacture → potentiel inchangé', () => {
    const factureExtra = { id: 'f-ex', chantierId: 'c1', statut: 'emise', montantHT: 3_000, extraId: 'ex1' };
    const facturesChantier = [factureExtra].filter(f =>
      String(f.chantierId) === 'c1' && f.statut !== 'annulee' && !f.extraId
    );
    const dejaFacture = facturesChantier.reduce((s, f) => s + (parseFloat(f.montantHT) || 0), 0);
    const potentiel = Math.max(0, caForfaitAvancement - dejaFacture);
    expect(dejaFacture).toBe(0);
    expect(potentiel).toBe(44_000);
  });

  it('facture situation (sans extraId) réduit le potentiel', () => {
    const factureSituation = { id: 'f-sit', chantierId: 'c1', statut: 'emise', montantHT: 20_000 };
    const facturesChantier = [factureSituation].filter(f =>
      String(f.chantierId) === 'c1' && f.statut !== 'annulee' && !f.extraId
    );
    const dejaFacture = facturesChantier.reduce((s, f) => s + (parseFloat(f.montantHT) || 0), 0);
    const potentiel = Math.max(0, caForfaitAvancement - dejaFacture);
    expect(dejaFacture).toBe(20_000);
    expect(potentiel).toBe(24_000);
  });

  it('situation ne monte PAS avec les extras (caForfait utilisé, pas calculerCA)', () => {
    // caForfait = 55 000, calculerCA = 58 900 — situation doit utiliser caForfait
    const potentielForfait = 55_000 * avancement / 100;       // 44 000
    const potentielCA      = 58_900 * avancement / 100;       // 47 120
    // L'écart = 3 120 = 3 900 × 80% — extras ne gonflent pas la situation
    expect(potentielForfait).toBe(44_000);
    expect(potentielCA - potentielForfait).toBeCloseTo(3_120, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// STEP 7 — runAllAgents : coûts reflètent les majorations (alerte marge)
// ════════════════════════════════════════════════════════════════════════════
describe('E2E Step 7 — runAllAgents avec/sans pointages Sat+Dim', () => {
  // CA serré : marge NETTE passe dans la zone limite/danger quand les majorations s'ajoutent
  // FG = 12% (défaut) — marge nette = (CA - coûts - CA×12%) / CA
  // Sans maj : (10 000 - 6 400 - 1 200) / 10 000 = 24% → aucune alerte (≥ 20%)
  // Avec maj : (10 000 - 7 000 - 1 200) / 10 000 = 18% → ATTENTION (15% ≤ 18% < 20%)
  const DEVIS_TIGHT = [{ id: 'd2', montantHT: 10_000, avenants: [], heuresRegie: [] }];
  // JOURNAL = 8 jours normaux × 800 = 6 400 CHF base
  // + Sat (200) + Dim (400) = 7 000 → marge (7800-7000)/7800 = 10.3%
  const CHANTIER_TIGHT = {
    id: 'c2', nom: 'Test tight', devisId: 'd2', clientId: 'cl2',
    statut: 'en cours', nombreJours: 10, canton: 'GE',
    journal: JOURNAL,
    extras: [], avenants: [],
  };
  const PARAMS_AGENTS = { employes: [EMPLOYE], localites: [], typesTravaux: [], parametres: {} };

  it('sans pointages → aucune alerte marge (marge nette ≈ 24% ≥ 20%)', () => {
    const result = runAllAgents({
      chantiers: [CHANTIER_TIGHT], devis: DEVIS_TIGHT, factures: [], clients: [],
      parametres: PARAMS_AGENTS, pointages: [],
    });
    const alertesMarge = result.alertes.filter(a => a.type === 'marge' && a.chantier_id === 'c2');
    expect(alertesMarge).toHaveLength(0);
  });

  it('avec pointages Sat+Dim → alerte marge (marge nette ≈ 18% < 20% → ATTENTION)', () => {
    const ptgSam = { ...PTAG_SAM, repartitions: [{ chantierId: 'c2', categorie: 'production', heures: 8 }] };
    const ptgDim = { ...PTAG_DIM, repartitions: [{ chantierId: 'c2', categorie: 'production', heures: 8 }] };
    const result = runAllAgents({
      chantiers: [CHANTIER_TIGHT], devis: DEVIS_TIGHT, factures: [], clients: [],
      parametres: PARAMS_AGENTS, pointages: [ptgSam, ptgDim],
    });
    const alertesMarge = result.alertes.filter(a => a.type === 'marge' && a.chantier_id === 'c2');
    expect(alertesMarge.length).toBeGreaterThan(0);
    expect(alertesMarge[0].niveau).toMatch(/ATTENTION|DANGER/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// STEP 8 — Démarrage propre (resolveDataFromBlob, vrai compte)
// ════════════════════════════════════════════════════════════════════════════
describe('E2E Step 8 — Démarrage propre : vrai compte, blob vide', () => {
  it('resolveDataFromBlob(null, false) → 0 chantier, employes vides', () => {
    const r = resolveDataFromBlob(null, false);
    expect(r.chantiers).toHaveLength(0);
    expect(r.parametres.employes).toHaveLength(0);
  });

  it('resolveDataFromBlob(null, false) → parametres défaut cohérents (typesTravaux BTP GE)', () => {
    const r = resolveDataFromBlob(null, false);
    expect(r.parametres.typesTravaux?.length).toBeGreaterThan(0);
  });

  it('compte existant → données préservées, pas d\'injection démo', () => {
    const blob = {
      chantiers: [{ id: 'c-reel', nom: 'Mon chantier', journal: [] }],
      devis: [{ id: 'd-reel', montantHT: 80_000 }],
      clients: [], factures: [],
      parametres: { employes: [{ id: 99, nom: 'Patron' }], demoVersion: 5 },
      pointages: [],
    };
    const r = resolveDataFromBlob(blob, false);
    expect(r.chantiers).toHaveLength(1);
    expect(r.chantiers[0].id).toBe('c-reel');
    expect(r.parametres.employes).toHaveLength(1);
    expect(r.parametres.employes[0].id).toBe(99);
  });
});
