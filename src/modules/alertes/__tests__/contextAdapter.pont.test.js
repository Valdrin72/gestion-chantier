/**
 * I2 — PREUVE du pont d'alertes : le VRAI contextAdapter + le VRAI moteur de règles.
 *
 * Chaîne RÉELLE exercée (zéro logic-mirror) :
 *   données CYNA réalistes → adapterContexteAlertes (vrai pont, calcule les marges/DSO)
 *     → AlertEngine(ALL_RULES).evaluateAll (vrai moteur, 15 règles métier)
 *   On asserte quelles alertes sortent, avec quel niveau. Chaque test MORD (il échoue si
 *   le calcul est faussé — prouvé en I2 par revert du fix FG).
 *
 * Nesting : l'app passe `parametres = { parametres: {config}, employes, localites }` — la config
 * (FG, coefficient) vit sous parametres.parametres. Le pont doit lire à ce niveau.
 */
import { describe, it, expect } from 'vitest';
import { adapterContexteAlertes } from '../contextAdapter';
import { AlertEngine } from '../lib/engine';
import { ALL_RULES } from '../lib/rules/index';
import { migrerJournalVersPointages } from '../../../migration/migrerJournalVersPointages';

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const FG = 15; // frais généraux configurés (≠ 12 défaut) → discrimine le fix de nesting.
const PARAMS = { employes: [EMP], localites: [], parametres: { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: FG } };

// 5 jours ouvrés → coût MO = 5×400 = 2 000. + materielReel → coût total calibré.
const journal5 = () => Array.from({ length: 5 }, (_, i) => ({
  date: `2026-03-0${i + 2}`, employes: [{ employeId: 1, heuresTravaillees: 8 }],
}));
// marge nette = (CA − coûts)/CA − FG% . CA=100000, MO=2000.
//   materiel 69000 → coûts 71000 → net = 29% − 15% = 14%  → DANGER (<15% ; à FG 12% = 17% → limite, d'où le mordant)
//   materiel 65000 → coûts 67000 → net = 33% − 15% = 18%  → LIMITE (15–20% ; à FG 12% = 21% → sain)
//   materiel 38000 → coûts 40000 → net = 60% − 15% = 45%  → SAIN (≥20%)
const chantier = (id, materielReel) => ({
  id, nom: `Chantier ${id}`, statut: 'en cours', nombreJours: 100,
  devisId: `dev-${id}`, clientId: 'cl1', materielReel, journal: journal5(),
});
const devis = (id) => ({ id: `dev-${id}`, numero: `D-${id}`, montantHT: 100_000, statut: 'accepté', clientId: 'cl1' });

function alertes(data) {
  const ctx = adapterContexteAlertes(data);
  return new AlertEngine(ALL_RULES).evaluateAll(ctx);
}
// ids fin.marge.* déclenchés pour un chantier donné
const margeAlerte = (alerts, chId) =>
  alerts.filter(a => a.ruleId.startsWith('fin.marge') && String(a.contextRef?.id) === String(chId));

describe('I2 — pont : alertes de marge au bon seuil et bon niveau', () => {
  const CH = [chantier('DANGER', 69000), chantier('LIMITE', 65000), chantier('SAIN', 38000)];
  const DV = CH.map(c => devis(c.id.replace('dev-', '')));
  const POINTAGES = migrerJournalVersPointages(CH, [EMP]);
  const data = { chantiers: CH, devis: DV, factures: [], clients: [{ id: 'cl1', nom: 'Client' }], parametres: PARAMS, pointages: POINTAGES };

  it('marge nette 14% (<15%) → alerte DANGER (fin.marge.faible, HIGH)', () => {
    const a = margeAlerte(alertes(data), 'DANGER');
    expect(a.map(x => x.ruleId)).toContain('fin.marge.faible');
    expect(a.find(x => x.ruleId === 'fin.marge.faible').severity).toBe('HIGH');
  });

  it('marge nette 18% (15–20%) → alerte LIMITE (fin.marge.limite, MEDIUM), PAS danger', () => {
    const a = margeAlerte(alertes(data), 'LIMITE');
    expect(a.map(x => x.ruleId)).toContain('fin.marge.limite');
    expect(a.map(x => x.ruleId)).not.toContain('fin.marge.faible');
    expect(a.find(x => x.ruleId === 'fin.marge.limite').severity).toBe('MEDIUM');
  });

  it('marge nette 45% (saine) → AUCUNE alerte de marge (pas de faux positif)', () => {
    expect(margeAlerte(alertes(data), 'SAIN')).toHaveLength(0);
  });

  it('🔴 MORDANT FG : le DANGER (net 14% à FG 15%, 17% à FG 12%) ne se déclenche QUE si le pont lit les vrais FG', () => {
    // À FG=12 (ancienne lecture top-level erronée), à FG 12% ce chantier aurait net 17% → limite, PAS danger.
    // Le déclenchement de fin.marge.faible prouve que le pont lit FG=15 (nesting corrigé).
    const a = margeAlerte(alertes(data), 'DANGER');
    expect(a.map(x => x.ruleId)).toContain('fin.marge.faible');
  });
});

describe('I2 — pont : chantier archivé exclu du monitoring (acquis Phase 3)', () => {
  it('un chantier DANGER mais archivé → aucune alerte de marge', () => {
    const CH = [{ ...chantier('ARCH', 69000), archive: true }];
    const data = { chantiers: CH, devis: [devis('ARCH')], factures: [], clients: [{ id: 'cl1', nom: 'Client' }],
      parametres: PARAMS, pointages: migrerJournalVersPointages(CH, [EMP]) };
    expect(margeAlerte(alertes(data), 'ARCH')).toHaveLength(0);
  });
});

describe('I2 — pont : facture impayée au bon moment, pas avant', () => {
  const now = Date.now();
  const jours = n => new Date(now - n * 86400000).toISOString();
  const facture = (id, echeanceJoursDepasses) => ({
    id, numero: `F-2026-0${id}`, clientId: 'cl1', chantierId: 'DANGER', statut: 'émise',
    montantTTC: 10000, montantPaye: 0, dateEmission: jours(echeanceJoursDepasses + 30),
    dateEcheance: jours(echeanceJoursDepasses),
  });
  const base = { chantiers: [], devis: [], clients: [{ id: 'cl1', nom: 'Client' }], parametres: PARAMS, pointages: [] };

  it('facture échue depuis 45j → alerte retard 30j (treso.facture.retard.30)', () => {
    const ids = new Set(alertes({ ...base, factures: [facture('45', 45)] }).map(a => a.ruleId));
    expect(ids.has('treso.facture.retard.30')).toBe(true);
  });

  it('facture échue depuis 20j (< 30j) → PAS encore d\'alerte retard', () => {
    const ids = new Set(alertes({ ...base, factures: [facture('20', 20)] }).map(a => a.ruleId));
    expect(ids.has('treso.facture.retard.30')).toBe(false);
    expect(ids.has('treso.facture.retard.60')).toBe(false);
  });
});

describe('I2 — trésorerie : solde bancaire saisi + horodaté (jamais de calcul sur 0)', () => {
  const now = Date.now();
  const iso = (joursAvant) => new Date(now - joursAvant * 86400000).toISOString().slice(0, 10);
  // Facture émise, échéance dans 10j, restant dû 3000 → encaissement attendu 3000.
  const factureAttendue = {
    id: 'fa', numero: 'F-2026-999', clientId: 'cl1', statut: 'émise',
    montantTTC: 3000, montantPaye: 0,
    dateEmission: new Date(now - 20 * 86400000).toISOString(),
    dateEcheance: new Date(now + 10 * 86400000).toISOString(),
  };
  const paramsTreso = (solde, dateSolde, seuil) => ({
    employes: [EMP], localites: [],
    parametres: {
      coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 15,
      ...(solde !== undefined ? { soldeBancaire: solde } : {}),
      ...(dateSolde !== undefined ? { soldeBancaireDate: dateSolde } : {}),
      ...(seuil !== undefined ? { seuilTresorerie: seuil } : {}),
    },
  });
  const dataTreso = (params) => ({ chantiers: [], devis: [], factures: [factureAttendue], clients: [{ id: 'cl1', nom: 'Client' }], parametres: params, pointages: [] });
  const ids = (params) => new Set(alertes(dataTreso(params)).map(a => a.ruleId));

  it('solde FRAIS 5 000 (aujourd\'hui) + 3 000 attendus = 8 000 < seuil 20 000 → alerte trésorerie (HIGH)', () => {
    const alerts = alertes(dataTreso(paramsTreso(5000, iso(0))));
    const solde = alerts.find(a => a.ruleId === 'treso.solde.alerte');
    expect(solde).toBeTruthy();
    expect(solde.severity).toBe('HIGH');
    expect(new Set(alerts.map(a => a.ruleId)).has('treso.solde.perime')).toBe(false);
    expect(new Set(alerts.map(a => a.ruleId)).has('treso.solde.absent')).toBe(false);
  });

  it('HONNÊTETÉ : le message d\'alerte dit que la projection exclut les sorties (salaires/charges/fournisseurs)', () => {
    const alerts = alertes(dataTreso(paramsTreso(5000, iso(0))));
    const msg = alerts.find(a => a.ruleId === 'treso.solde.alerte').message;
    // Verrou anti-refactor : la mention du périmètre optimiste ne doit jamais disparaître.
    expect(msg).toMatch(/hors salaires, charges sociales et fournisseurs/i);
    expect(msg).toMatch(/non modélisées/i);
  });

  it('solde FRAIS 50 000 (aujourd\'hui) → projeté 53 000 ≥ seuil → AUCUNE alerte trésorerie (mordant seuil)', () => {
    expect(ids(paramsTreso(50000, iso(0))).has('treso.solde.alerte')).toBe(false);
  });

  it('🔴 solde PÉRIMÉ (daté de 30j > 14j) → PAS d\'alerte trésorerie, mais alerte de fraîcheur', () => {
    const alerts = alertes(dataTreso(paramsTreso(5000, iso(30))));
    const set = new Set(alerts.map(a => a.ruleId));
    expect(set.has('treso.solde.alerte')).toBe(false);   // on ne projette pas sur du périmé
    expect(set.has('treso.solde.perime')).toBe(true);
    // message mentionne la date du solde
    expect(alerts.find(a => a.ruleId === 'treso.solde.perime').title).toMatch(/à mettre à jour/);
  });

  it('🔴 AUCUN solde saisi → surveillance DÉSACTIVÉE, message présent, aucun faux positif', () => {
    const alerts = alertes(dataTreso(paramsTreso(undefined, undefined))); // rien de saisi
    const set = new Set(alerts.map(a => a.ruleId));
    expect(set.has('treso.solde.alerte')).toBe(false);   // JAMAIS de calcul sur 0
    expect(set.has('treso.solde.absent')).toBe(true);
    expect(alerts.find(a => a.ruleId === 'treso.solde.absent').message).toMatch(/Renseigne ton solde bancaire/);
  });

  it('seuil configurable : seuil 5 000 → solde frais 8 000 projeté ≥ 5 000 → pas d\'alerte', () => {
    expect(ids(paramsTreso(5000, iso(0), 5000)).has('treso.solde.alerte')).toBe(false);
  });
});

describe('I2 — pont : robustesse (pas de crash, pas d\'alerte fantôme de chantier)', () => {
  it('données vides + pointages vides → pas de crash, aucune alerte de chantier', () => {
    const alerts = alertes({ chantiers: [], devis: [], factures: [], clients: [], parametres: PARAMS, pointages: [] });
    // Aucune alerte rattachée à un chantier (fin.*, planning, rh chantier).
    expect(alerts.filter(a => a.contextRef?.type === 'chantier')).toHaveLength(0);
  });

  it('chantier réel MAIS pointages absents → pas de crash, coûts lus sans exception', () => {
    const CH = [chantier('NOPTG', 10000)];
    expect(() => alertes({ chantiers: CH, devis: [devis('NOPTG')], factures: [], clients: [], parametres: PARAMS, pointages: [] })).not.toThrow();
  });
});
