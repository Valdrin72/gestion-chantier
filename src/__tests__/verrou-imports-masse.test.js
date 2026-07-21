/**
 * C3 + C4 + C5 — verrous des imports/écrasements de masse (principe "Rien ne se détruit").
 * Vraies fonctions de production, mordant prouvé pour chaque.
 */
import { describe, it, expect } from 'vitest';
import { remplacerClientsAvecGarde, pointagesApresRestauration, totalHeuresPointages } from '../utils/importGuard';
import {
  completerPointagesDepuisJournal, aChantierLegacy, detecterChantiersLegacy,
} from '../migration/completerPointagesDepuisJournal';
import { regenererJournalDepuisPointages } from '../migration/regenererJournalDepuisPointages';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';

const EMP = [{ id: 1, nom: 'Müller' }];

// ══════════════════════════════════════════════════════════════════════════
// C3 — restaurer un backup ne doit jamais effacer les heures pointées
// ══════════════════════════════════════════════════════════════════════════
describe('C3 — restauration de backup : les heures ne partent jamais à zéro', () => {
  const pointagesActuels = [
    { id: 'p1', date: '2025-05-05', employeId: 1, repartitions: [{ chantierId: 'c1', categorie: 'production', heures: 8 }] },
    { id: 'p2', date: '2025-05-06', employeId: 1, repartitions: [{ chantierId: 'c1', categorie: 'production', heures: 6 }] },
  ];

  it('backup ANCIEN FORMAT (pas de clé pointages) → pointages actuels CONSERVÉS', () => {
    const backup = { chantiers: [], devis: [], factures: [], clients: [] }; // pas de pointages
    const r = pointagesApresRestauration(backup, pointagesActuels);
    expect(r.ancienFormat).toBe(true);
    expect(r.ecrase).toBe(false);
    expect(r.pointages).toBe(pointagesActuels);      // même référence → rien écrasé
    expect(totalHeuresPointages(r.pointages)).toBe(14);
  });

  it('🔴 MORDANT : l\'ancien comportement (setPointages([]) sur ancien format) aurait tout effacé', () => {
    const backup = { chantiers: [], devis: [], factures: [], clients: [] };
    const ancienComportement = Array.isArray(backup.pointages) ? backup.pointages : []; // = []
    const nouveau = pointagesApresRestauration(backup, pointagesActuels).pointages;
    expect(totalHeuresPointages(ancienComportement)).toBe(0);   // l'ancien code perdait 14h
    expect(totalHeuresPointages(nouveau)).toBe(14);             // le fix les garde
  });

  it('backup AVEC pointages → remplacement autorisé (l\'appelant confirme de façon typée)', () => {
    const backup = { pointages: [{ id: 'pb', date: '2025-01-01', employeId: 1, repartitions: [{ chantierId: 'c9', categorie: 'production', heures: 4 }] }] };
    const r = pointagesApresRestauration(backup, pointagesActuels);
    expect(r.ancienFormat).toBe(false);
    expect(r.ecrase).toBe(true);
    expect(totalHeuresPointages(r.pointages)).toBe(4);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// C4 — import CSV "Remplacer" ne supprime jamais un client référencé
// ══════════════════════════════════════════════════════════════════════════
describe('C4 — remplacement clients : un client référencé survit', () => {
  const clientAvecFacture = { id: 'cl1', nom: 'Client Historique' };
  const clientVierge = { id: 'cl2', nom: 'Client Vierge' };
  // cl1 a un chantier (ch1) qui porte une facture → référencé (contrat referenceGuard).
  const refs = { chantiers: [{ id: 'ch1', clientId: 'cl1' }], devis: [], factures: [{ id: 'f1', chantierId: 'ch1', montantHT: 5000 }] };
  const nouveaux = [{ id: 'new1', nom: 'Importé A' }, { id: 'new2', nom: 'Importé B' }];

  it('client avec une facture → CONSERVÉ ; client vierge → remplacé', () => {
    const r = remplacerClientsAvecGarde([clientAvecFacture, clientVierge], nouveaux, refs);
    const noms = r.resultat.map(c => c.nom);
    expect(noms).toContain('Client Historique');   // référencé → survit
    expect(noms).not.toContain('Client Vierge');   // vierge → remplacé
    expect(noms).toContain('Importé A');
    expect(r.conserves).toBe(1);
    expect(r.remplaces).toBe(1);
    // Total = 1 conservé + 2 importés
    expect(r.resultat).toHaveLength(3);
  });

  it('🔴 MORDANT : l\'ancien comportement (setClients(nouveaux)) aurait effacé le client référencé', () => {
    const ancien = nouveaux; // setClients(withIds) écrasait tout
    expect(ancien.map(c => c.id)).not.toContain('cl1'); // l'historique disparaissait
    const nouveau = remplacerClientsAvecGarde([clientAvecFacture, clientVierge], nouveaux, refs).resultat;
    expect(nouveau.map(c => c.id)).toContain('cl1');     // le fix le garde
  });
});

// ══════════════════════════════════════════════════════════════════════════
// C5 — chantier legacy arrivant TARD : ses heures sont préservées (plus de drapeau one-time)
// ══════════════════════════════════════════════════════════════════════════
describe('C5 — arrivée tardive d\'un chantier legacy : heures préservées', () => {
  // Compte déjà "flaggé" : un chantier normal a déjà ses pointages.
  const chantierNormal = { id: 'cN', journal: [{ date: '2025-04-01', employes: [{ employeId: 1, heuresTravaillees: 8 }] }] };
  const pointagesExistants = migrerJournalVersPointages([chantierNormal], EMP);
  // Plus tard : un chantier legacy débarque (journal peuplé, AUCUN pointage sur son id).
  const chantierLegacy = { id: 'cLegacy', journal: [
    { date: '2025-05-05', employes: [{ employeId: 1, heuresTravaillees: 7 }] },
    { date: '2025-05-06', employes: [{ employeId: 1, heuresTravaillees: 5 }] },
  ]};
  const tousChantiers = [chantierNormal, chantierLegacy];

  it('le legacy est détecté même sur un compte déjà chargé', () => {
    expect(aChantierLegacy(tousChantiers, pointagesExistants)).toBe(true);
    expect(detecterChantiersLegacy(tousChantiers, pointagesExistants).map(c => c.id)).toEqual(['cLegacy']);
  });

  it('complétude REJOUÉE → puis régénération → les 12h du legacy sont préservées', () => {
    // Séquence App.js corrigée : complétude d'abord (crée les pointages manquants)…
    const { pointages: complets, migres } = completerPointagesDepuisJournal(tousChantiers, pointagesExistants, EMP);
    expect(migres).toBe(2);
    // …puis régénération depuis les pointages complétés.
    const regenes = regenererJournalDepuisPointages(complets, tousChantiers);
    const legacyRegen = regenes.find(c => c.id === 'cLegacy');
    const heures = legacyRegen.journal.flatMap(e => e.employes).reduce((s, e) => s + e.heuresTravaillees, 0);
    expect(heures).toBe(12); // 7 + 5, rien perdu
  });

  it('🔴 MORDANT : avec le drapeau one-time (complétude SAUTÉE), la régénération efface le legacy', () => {
    // Ancien comportement : compte déjà flaggé → la complétude ne se rejoue pas → régénération directe.
    const regenSansCompletude = regenererJournalDepuisPointages(pointagesExistants, [chantierLegacy]);
    expect(regenSansCompletude[0].journal).toEqual([]); // ← les 12h disparaissaient en silence
  });

  it('IDEMPOTENCE (anti-boucle) : la complétude tourne UNE fois, la passe suivante ne fait plus rien', () => {
    // Passe 1 : legacy détecté → migration effectuée, NOUVEAU tableau de pointages.
    const passe1 = completerPointagesDepuisJournal(tousChantiers, pointagesExistants, EMP);
    expect(passe1.migres).toBe(2);
    expect(passe1.pointages).not.toBe(pointagesExistants); // référence changée → 1 seul setPointages

    // Passe 2 : on renvoie l'état issu de la passe 1 (ce que ferait le re-render de l'effet).
    const passe2 = completerPointagesDepuisJournal(tousChantiers, passe1.pointages, EMP);
    expect(passe2.migres).toBe(0);                     // plus rien à compléter
    expect(passe2.pointages).toBe(passe1.pointages);   // MÊME référence → setState bail-out → pas de re-render → pas de boucle
  });

  it('AUCUNE écriture inutile : rien à compléter → même référence retournée (App ne fait pas setPointages)', () => {
    // Compte sain, tous les chantiers déjà couverts par leurs pointages.
    const r = completerPointagesDepuisJournal([chantierNormal], pointagesExistants, EMP);
    expect(r.migres).toBe(0);
    expect(r.pointages).toBe(pointagesExistants); // référence identique → App.js n'appelle pas setPointages → aucun save Supabase
  });
});
