/**
 * Directeur du matin — Étape 1 : score santé /100 et projection trésorerie HONNÊTES.
 * MORDANT anti-faillite : tout est vert SAUF la trésorerie → le score N'EST PLUS 100.
 * Tests sur les VRAIES fonctions (helper de projection + vrai agent CoachDirecteur).
 */
import { describe, it, expect } from 'vitest';
import { projeterTresorerie30j, sortiesMensuellesEstimees, penaliteScoreTresorerie } from '../calculs/tresorerie';
import { runCoachDirecteur } from '../AgentEngine';

const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const EMP = [{ id: 1, nom: 'A', tarifJour: 400, actif: true }]; // masse salariale = 400×20 = 8000/mois

// Contexte agent « tout va bien » : aucun chantier en danger, aucun impayé >90j, données propres.
const CTX_VERT = {
  RadarPrecoce: { risques: [] },
  RelancePaiements: { nb90: 0, montant90: 0 },
  AnomaliesDonnees: { nbAnomalies: 0, score: 100 },
  OptimisationFacturation: { totalFacturable: 0 },
  ProjectionAnnuelle: { txAtteinte: 100 },
};
const params = (over) => ({ employes: EMP, parametres: { ...over } });
const score = (parametres, factures = []) =>
  runCoachDirecteur({ chantiers: [], devis: [], factures, parametres, agentContext: CTX_VERT }).data.scoreGlobal;

describe('Projection trésorerie 30j — honnête (sorties déduites, fournisseurs signalés)', () => {
  it('déduit les sorties estimées (masse salariale) des encaissements', () => {
    const p = projeterTresorerie30j({
      factures: [{ statut: 'envoyee', montantTTC: 3000, montantPaye: 0, dateEcheance: AUJOURDHUI }],
      parametres: params({ soldeBancaire: 10000, soldeBancaireDate: AUJOURDHUI }),
    });
    expect(p.encaissements30j).toBe(3000);
    expect(p.sorties30j).toBe(8000);                 // salaires estimés, plus jamais 0 silencieux
    expect(p.soldeProjete).toBe(10000 + 3000 - 8000); // 5000
    expect(p.fournisseursNonModelises).toBe(true);   // avertissement toujours présent
    expect(p.sourceSorties).toBe('salaires_estimes');
  });

  it('charge mensuelle saisie prioritaire sur l\'estimation salariale', () => {
    const s = sortiesMensuellesEstimees(params({ chargesMensuelles: 30000 }));
    expect(s.montant).toBe(30000);
    expect(s.source).toBe('charges_saisies');
  });

  it('CAS LIMITE : pas de solde bancaire frais → non jugeable (soldeProjete null, jamais un faux 0)', () => {
    const sansSolde = projeterTresorerie30j({ factures: [], parametres: params({}) });
    expect(sansSolde.modelisable).toBe(false);
    expect(sansSolde.soldeProjete).toBeNull();

    const perime = projeterTresorerie30j({
      factures: [], parametres: params({ soldeBancaire: 5000, soldeBancaireDate: '2024-01-01' }),
    });
    expect(perime.soldeFrais).toBe(false);
    expect(perime.soldeProjete).toBeNull();
  });

  it('paliers de pénalité : négatif = 40, sous seuil = 20, au-dessus = 0, non jugeable = 0', () => {
    const seuil = 20000;
    expect(penaliteScoreTresorerie({ modelisable: true, soldeProjete: -5000, seuil })).toBe(40);
    expect(penaliteScoreTresorerie({ modelisable: true, soldeProjete: 10000, seuil })).toBe(20);
    expect(penaliteScoreTresorerie({ modelisable: true, soldeProjete: 30000, seuil })).toBe(0);
    expect(penaliteScoreTresorerie({ modelisable: false, soldeProjete: null, seuil })).toBe(0);
  });
});

describe('Score santé /100 — MORDANT anti-faillite', () => {
  it('🔴 tout est vert SAUF trésorerie NÉGATIVE → le score N\'EST PLUS 100 (chute forte)', () => {
    // Solde frais 1000, aucun encaissement, salaires 8000 → projeté = −7000.
    const s = score(params({ soldeBancaire: 1000, soldeBancaireDate: AUJOURDHUI }));
    expect(s).toBe(60);          // 100 − 40 (trésorerie négative)
    expect(s).not.toBe(100);     // MORDANT : la trésorerie n'est plus ignorée
  });

  it('tout est vert SAUF trésorerie TENDUE (positive mais sous seuil) → −20', () => {
    // Solde 10000, aucun encaissement, salaires 8000 → projeté 2000 (0 ≤ 2000 < 20000).
    const s = score(params({ soldeBancaire: 10000, soldeBancaireDate: AUJOURDHUI }));
    expect(s).toBe(80);          // 100 − 20
  });

  it('trésorerie SAINE (projetée ≥ seuil) → aucune pénalité, score 100', () => {
    const s = score(params({ soldeBancaire: 40000, soldeBancaireDate: AUJOURDHUI }));
    expect(s).toBe(100);         // 40000 − 8000 = 32000 ≥ 20000
  });

  it('CAS LIMITE : pas de solde saisi → trésorerie non jugeable → pas de pénalité (score 100, pas de faux alarme)', () => {
    const s = score(params({}));
    expect(s).toBe(100);
  });

  it('la pénalité trésorerie S\'AJOUTE aux autres (cumul cohérent)', () => {
    const ctx = { ...CTX_VERT, AnomaliesDonnees: { nbAnomalies: 2, score: 50 } }; // −10
    const s = runCoachDirecteur({
      chantiers: [], devis: [], factures: [],
      parametres: params({ soldeBancaire: 1000, soldeBancaireDate: AUJOURDHUI }), // −40
      agentContext: ctx,
    }).data.scoreGlobal;
    expect(s).toBe(50);          // 100 − 10 − 40
  });
});
