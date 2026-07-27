/**
 * Directeur du matin — FIX impayés : les créances anciennes pèsent sur le score
 * ET sont décotées de la projection trésorerie (délais CYNA courts).
 *
 * Chaîne RÉELLE (zéro logic-mirror) :
 *   penaliteScoreCreancesAnciennes / projeterTresorerie30j (vraies fonctions pures),
 *   runCoachDirecteur (vrai score), synthesePhraseDirecteur (vrai titre).
 */
import { describe, it, expect } from 'vitest';
import {
  penaliteScoreCreancesAnciennes, projeterTresorerie30j,
} from '../calculs/tresorerie';
import { runCoachDirecteur } from '../AgentEngine';
import { synthesePhraseDirecteur } from '../components/DirecteurMatin';

const NOW = new Date(2026, 6, 27, 9, 0, 0).getTime(); // déterministe pour les fonctions pures
const isoAge = (jours, base = NOW) => new Date(base - jours * 86400000).toISOString();
const factureOuverte = (montantTTC, ageJours) => ({
  statut: 'envoyee', montantTTC, montantPaye: 0,
  dateEmission: isoAge(ageJours), dateEcheance: isoAge(Math.max(0, ageJours - 30)),
});

// Pour l'end-to-end via runCoachDirecteur (qui utilise Date.now() en interne).
const reel = (jours) => new Date(Date.now() - jours * 86400000).toISOString();
const CTX_VERT = { RadarPrecoce: { risques: [] }, AnomaliesDonnees: { nbAnomalies: 0 }, RelancePaiements: { nb90: 2, montant90: 56000 } };

describe('MORDANT titre/réalité — 56 000 CHF impayés → plus « bonne santé »', () => {
  it('démo (39 997 @139j + 16 215 @104j) : le score sort de la zone ≥ 75', () => {
    const factures = [
      { statut: 'envoyee', montantTTC: 39997, montantPaye: 0, dateEmission: reel(139), dateEcheance: reel(109) },
      { statut: 'envoyee', montantTTC: 16215, montantPaye: 0, dateEmission: reel(104), dateEcheance: reel(74) },
    ];
    const score = runCoachDirecteur({
      chantiers: [], devis: [], factures,
      parametres: { employes: [{ id: 1, tarifJour: 400, actif: true }], parametres: {} },
      agentContext: CTX_VERT,
    }).data.scoreGlobal;
    expect(score).toBeLessThan(75); // MORDANT : ne reste PAS « bonne santé »
  });

  it('le titre dérive du score : sous 75 → jamais « bonne santé »', () => {
    // 56k d'impayés anciens → score 60 (100 − 40). Le titre doit refléter le risque.
    expect(synthesePhraseDirecteur(60)).not.toMatch(/bonne santé/i);
    expect(synthesePhraseDirecteur(60)).toMatch(/surveiller|vigilance/i);
    // Contrôle : un vrai bon score reste « bonne santé ».
    expect(synthesePhraseDirecteur(90)).toMatch(/bonne santé/i);
  });
});

describe('MORDANT gradation âge — plus c\'est vieux, plus ça pénalise', () => {
  const p = (age) => penaliteScoreCreancesAnciennes({ factures: [factureOuverte(10000, age)], maintenant: NOW });
  it('≥75j > 45-74j > 30-44j > <30j (à montant égal 10 000 CHF)', () => {
    expect(p(20)).toBe(0);   // dans les délais → rien
    expect(p(35)).toBe(3);   // 30-44j
    expect(p(60)).toBe(6);   // 45-74j
    expect(p(100)).toBe(9);  // ≥75j
    expect(p(100)).toBeGreaterThan(p(60));
    expect(p(60)).toBeGreaterThan(p(35));
    expect(p(35)).toBeGreaterThan(p(20));
  });
});

describe('MORDANT pondération montant — le gros ancien pèse, le petit ancien non', () => {
  it('40 000 CHF @100j pénalise fort ; 500 CHF @100j quasi rien', () => {
    const gros = penaliteScoreCreancesAnciennes({ factures: [factureOuverte(40000, 100)], maintenant: NOW });
    const petit = penaliteScoreCreancesAnciennes({ factures: [factureOuverte(500, 100)], maintenant: NOW });
    expect(gros).toBe(36);        // 9 × 4.0
    expect(petit).toBe(0);        // 9 × 0.05 ≈ 0
    expect(gros).toBeGreaterThan(petit);
  });
  it('la pénalité est plafonnée à 40', () => {
    const enorme = penaliteScoreCreancesAnciennes({ factures: [factureOuverte(200000, 100)], maintenant: NOW });
    expect(enorme).toBe(40);
  });
});

describe('MORDANT décote projection — une créance ≥75j ne compte plus à J+30', () => {
  const parametres = { employes: [], parametres: { soldeBancaire: 50000, soldeBancaireDate: isoAge(1), chargesMensuelles: 0 } };
  it('facture 10 000 @100j → 0 % dans les encaissements, 100 % à risque', () => {
    const proj = projeterTresorerie30j({ factures: [factureOuverte(10000, 100)], parametres, maintenant: NOW });
    expect(proj.encaissements30jBrut).toBe(10000);
    expect(proj.encaissements30j).toBe(0);                 // ≥75j → décote totale
    expect(proj.creancesAnciennesARisque).toBe(10000);
    expect(proj.soldeProjete).toBe(50000);                 // le vieux impayé ne gonfle plus le projeté
  });
  it('facture 10 000 @50j → 50 % comptée', () => {
    const proj = projeterTresorerie30j({ factures: [factureOuverte(10000, 50)], parametres, maintenant: NOW });
    expect(proj.encaissements30j).toBe(5000);
    expect(proj.creancesAnciennesARisque).toBe(5000);
  });
  it('facture 10 000 @10j (dans les délais) → 100 % comptée, rien à risque', () => {
    const proj = projeterTresorerie30j({ factures: [factureOuverte(10000, 10)], parametres, maintenant: NOW });
    expect(proj.encaissements30j).toBe(10000);
    expect(proj.creancesAnciennesARisque).toBe(0);
  });
});

describe('MORDANT ratio « tout dépend des autres » — concentration du risque signalée', () => {
  it('beaucoup de PETITES créances en retard = grosse PART du cash → alerte', () => {
    // 1 facture récente 10 000 (à l\'heure) + 4 petites 2 000 en retard 40j = 8 000 en retard.
    // Part retard = 8 000 / 18 000 ≈ 44 % ≥ 40 % → le Directeur doit le signaler.
    const factures = [
      factureOuverte(10000, 10),
      factureOuverte(2000, 40), factureOuverte(2000, 40),
      factureOuverte(2000, 40), factureOuverte(2000, 40),
    ];
    const proj = projeterTresorerie30j({
      factures, maintenant: NOW,
      parametres: { employes: [], parametres: { soldeBancaire: 30000, soldeBancaireDate: isoAge(1) } },
    });
    expect(proj.ratioRetard).toBeGreaterThanOrEqual(0.40);
    expect(proj.alerteRatioRetard).toBe(true);
    expect(proj.montantRetard30j).toBe(8000);
  });
  it('cash majoritairement à l\'heure → pas d\'alerte de concentration', () => {
    const factures = [factureOuverte(30000, 10), factureOuverte(2000, 40)];
    const proj = projeterTresorerie30j({
      factures, maintenant: NOW,
      parametres: { employes: [], parametres: { soldeBancaire: 30000, soldeBancaireDate: isoAge(1) } },
    });
    expect(proj.ratioRetard).toBeLessThan(0.40); // 2000 / 32000 ≈ 6 %
    expect(proj.alerteRatioRetard).toBe(false);
  });
});

describe('NON-RÉGRESSION — sans impayé ancien, aucune pénalité ni décote', () => {
  it('base saine : penaliteCreances 0, aucune créance à risque', () => {
    expect(penaliteScoreCreancesAnciennes({ factures: [], maintenant: NOW })).toBe(0);
    const proj = projeterTresorerie30j({
      factures: [factureOuverte(20000, 5)], maintenant: NOW,
      parametres: { employes: [], parametres: { soldeBancaire: 10000, soldeBancaireDate: isoAge(1) } },
    });
    expect(proj.creancesAnciennesARisque).toBe(0);
    expect(proj.alerteRatioRetard).toBe(false);
    expect(proj.encaissements30j).toBe(20000);
  });
});
