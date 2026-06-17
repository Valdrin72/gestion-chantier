/**
 * Phase 7a — Tests de la pré-condition de complétude (désamorçage du risque 🔴).
 *
 * Chemin de code RÉEL exercé :
 *   completerPointagesDepuisJournal → migrerJournalVersPointages (vraie migration)
 *   puis regenererJournalDepuisPointages pour PROUVER qu'aucune heure n'est perdue.
 */
import { describe, it, expect } from 'vitest';
import { completerPointagesDepuisJournal } from '../completerPointagesDepuisJournal';
import { migrerJournalVersPointages } from '../migrerJournalVersPointages';
import { regenererJournalDepuisPointages } from '../regenererJournalDepuisPointages';
import { donneesInitiales } from '../../donnees';

const EMPLOYES = donneesInitiales.employes;

// Chantier legacy synthétique : journal avec heures réelles, AUCUN pointage.
const chantierLegacy = {
  id: 'legacy-1',
  nom: 'Chantier Legacy',
  statut: 'En cours',
  journal: [
    { date: '2025-05-05', employes: [{ employeId: 1, heuresTravaillees: 8 }, { employeId: 2, heuresTravaillees: 6 }] },
    { date: '2025-05-06', employes: [{ employeId: 1, heuresTravaillees: 7 }] },
  ],
};

describe('Phase 7a — détection : chantier legacy (journal sans pointage) est repéré', () => {
  it('migre le chantier legacy et crée les pointages manquants', () => {
    const { pointages, migres, chantiersMigres } = completerPointagesDepuisJournal(
      [chantierLegacy], [], EMPLOYES
    );
    expect(migres).toBeGreaterThan(0);
    expect(chantiersMigres).toContain('legacy-1');
    // 2 dates × employés : (2025-05-05 → emp1, emp2) + (2025-05-06 → emp1) = 3 pointages
    expect(pointages.length).toBe(3);
  });

  it('🔴 AUCUNE HEURE PERDUE : journal régénéré depuis les pointages === journal d\'origine', () => {
    const { pointages } = completerPointagesDepuisJournal([chantierLegacy], [], EMPLOYES);
    const [regen] = regenererJournalDepuisPointages(pointages, [chantierLegacy]);

    // Total heures conservé
    const totalAvant = chantierLegacy.journal
      .flatMap(e => e.employes).reduce((s, e) => s + e.heuresTravaillees, 0); // 8+6+7 = 21
    const totalApres = regen.journal
      .flatMap(e => e.employes).reduce((s, e) => s + e.heuresTravaillees, 0);
    expect(totalApres).toBe(totalAvant);
    expect(totalApres).toBe(21);

    // Jours conservés
    expect(regen.journal.length).toBe(chantierLegacy.journal.length);
    expect(new Set(regen.journal.map(e => e.date))).toEqual(
      new Set(chantierLegacy.journal.map(e => e.date))
    );
  });

  it('SANS la complétude, la régénération directe efface le journal legacy (preuve du danger)', () => {
    // Pointages d'un AUTRE chantier seulement → le legacy n'est couvert par aucun pointage
    const pointagesAutres = migrerJournalVersPointages([
      { id: 'autre', journal: [{ date: '2025-05-05', employes: [{ employeId: 3, heuresTravaillees: 8 }] }] },
    ], EMPLOYES);
    const [regenSansFix] = regenererJournalDepuisPointages(pointagesAutres, [chantierLegacy]);
    // Le bug : le journal du legacy part à [] (toutes ses heures disparaissent)
    expect(regenSansFix.journal).toEqual([]);
  });
});

describe('Phase 7a — fusion respecte l\'unicité (date, employeId)', () => {
  it('un pointage existant (autre chantier) reçoit une repartition au lieu d\'un doublon', () => {
    // Pointage existant : emp1, 2025-05-05, sur chantier "X"
    const pointagesExistants = [
      { id: 'p-x', date: '2025-05-05', employeId: 1, repartitions: [
        { chantierId: 'X', categorie: 'production', heures: 4 },
      ], deplacement: null, majoration: null },
    ];
    const { pointages } = completerPointagesDepuisJournal([chantierLegacy], pointagesExistants, EMPLOYES);

    // emp1 / 2025-05-05 doit rester UN SEUL pointage (pas de doublon (date, emp))
    const empUnJour05 = pointages.filter(p => p.date === '2025-05-05' && parseInt(p.employeId) === 1);
    expect(empUnJour05.length).toBe(1);
    // ... mais avec 2 repartitions : chantier X (existant) + legacy-1 (fusionné)
    const chantiers = empUnJour05[0].repartitions.map(r => String(r.chantierId)).sort();
    expect(chantiers).toEqual(['X', 'legacy-1']);

    // L'original n'est pas muté (pureté)
    expect(pointagesExistants[0].repartitions.length).toBe(1);
  });
});

describe('Phase 7a — idempotence et no-op', () => {
  it('chantier DÉJÀ couvert par des pointages → migres 0, tableau inchangé (même référence)', () => {
    const pts = migrerJournalVersPointages([chantierLegacy], EMPLOYES);
    const res = completerPointagesDepuisJournal([chantierLegacy], pts, EMPLOYES);
    expect(res.migres).toBe(0);
    expect(res.pointages).toBe(pts); // référence identique → App.js ne re-render pas
  });

  it('second appel après complétude ne crée plus rien (idempotent)', () => {
    const premier = completerPointagesDepuisJournal([chantierLegacy], [], EMPLOYES);
    const second = completerPointagesDepuisJournal([chantierLegacy], premier.pointages, EMPLOYES);
    expect(second.migres).toBe(0);
  });

  it('chantier sans heures (journal vide ou 0h) → ignoré', () => {
    const vide = { id: 'v', journal: [] };
    const zero = { id: 'z', journal: [{ date: '2025-01-01', employes: [{ employeId: 1, heuresTravaillees: 0 }] }] };
    expect(completerPointagesDepuisJournal([vide, zero], [], EMPLOYES).migres).toBe(0);
  });
});

describe('Phase 7a — PREUVE : 0 chantier démo concerné (état chargé réaliste)', () => {
  it('après migration Phase 3 des 7 chantiers démo, completer ne détecte AUCUN legacy', () => {
    const chantiers = donneesInitiales.chantiers;
    // État chargé réaliste : pointages dérivés du journal démo (séquence App.js)
    const pointages = migrerJournalVersPointages(chantiers, EMPLOYES);
    const { migres, chantiersMigres } = completerPointagesDepuisJournal(chantiers, pointages, EMPLOYES);
    expect(migres).toBe(0);
    expect(chantiersMigres).toEqual([]);
  });
});
