/**
 * Phase 7a — Tests INVARIANTS des helpers de lecture directe des pointages.
 *
 * Cœur de la fondation : on prouve que lire les pointages directement donne
 * EXACTEMENT le même résultat que lire le journal dérivé, sur les 7 chantiers démo.
 *
 * Chemin de code RÉEL exercé (zéro logic-mirror) :
 *   donneesInitiales (7 chantiers + journal)
 *     → migrerJournalVersPointages        (vraie migration)
 *     → regenererJournalDepuisPointages    (vrai strangler fig)
 *     → heuresEmploye / heuresJour         (vrais helpers journal de donnees.js)
 *   comparés aux helpers pointages.
 */
import { describe, it, expect } from 'vitest';
import { donneesInitiales, heuresEmploye, heuresJour } from '../../donnees';
import { migrerJournalVersPointages } from '../../migration/migrerJournalVersPointages';
import { regenererJournalDepuisPointages } from '../../migration/regenererJournalDepuisPointages';
import {
  joursReelsChantier,
  heuresEmployeChantier,
  heuresJourChantier,
  empIdsChantier,
  indexPointagesParChantier,
} from '../pointagesHelper';

const CHANTIERS = donneesInitiales.chantiers;
const EMPLOYES = donneesInitiales.employes;

// État "chargé" réaliste : pointages dérivés du journal démo, puis journal régénéré
// depuis ces pointages (exactement la séquence de App.js).
const POINTAGES = migrerJournalVersPointages(CHANTIERS, EMPLOYES);
const CHANTIERS_REGEN = regenererJournalDepuisPointages(POINTAGES, CHANTIERS);
const journalDe = (id) => CHANTIERS_REGEN.find(c => String(c.id) === String(id)).journal;

describe('Phase 7a — sanity : composition du jeu démo', () => {
  it('7 chantiers démo, dont au moins 6 avec un journal non vide (le 7e non démarré)', () => {
    expect(CHANTIERS.length).toBe(7);
    const avecJournal = CHANTIERS_REGEN.filter(c => (c.journal || []).length > 0);
    expect(avecJournal.length).toBeGreaterThanOrEqual(6);
  });
});

describe('Phase 7a — INVARIANT joursReelsChantier === jours uniques du journal', () => {
  CHANTIERS.forEach(c => {
    it(`chantier ${c.id} (${c.nom}) : jours uniques identiques`, () => {
      const journal = journalDe(c.id);
      const attendu = new Set(journal.map(e => e.date).filter(Boolean)).size;
      expect(joursReelsChantier(POINTAGES, c.id)).toBe(attendu);
    });
  });
});

describe('Phase 7a — INVARIANT heuresEmployeChantier === heuresEmploye(journal)', () => {
  let comparaisonsNonTriviales = 0;
  CHANTIERS.forEach(c => {
    it(`chantier ${c.id} (${c.nom}) : heures par employé identiques`, () => {
      const journal = journalDe(c.id);
      const empIds = [...new Set(
        journal.flatMap(e => (e.employes || []).map(em => parseInt(em.employeId))).filter(Boolean)
      )];
      empIds.forEach(empId => {
        const attendu = heuresEmploye(journal, empId);
        expect(heuresEmployeChantier(POINTAGES, empId, c.id)).toBeCloseTo(attendu, 6);
        if (attendu > 0) comparaisonsNonTriviales++;
      });
    });
  });
  it('MORDANT : au moins 10 comparaisons employé×heures non triviales (> 0)', () => {
    expect(comparaisonsNonTriviales).toBeGreaterThanOrEqual(10);
  });
});

describe('Phase 7a — INVARIANT heuresJourChantier === heuresJour(journal)', () => {
  let datesComparees = 0;
  CHANTIERS.forEach(c => {
    it(`chantier ${c.id} (${c.nom}) : map heures/jour identique pour chaque date`, () => {
      const journal = journalDe(c.id);
      journal.forEach(entry => {
        const attendu = heuresJour(journal, entry.date);          // { [empId]: heures }
        const obtenu  = heuresJourChantier(POINTAGES, c.id, entry.date);
        expect(obtenu).toEqual(attendu);
        datesComparees++;
      });
    });
  });
  it('MORDANT : au moins 50 jours comparés sur l\'ensemble des chantiers', () => {
    expect(datesComparees).toBeGreaterThanOrEqual(50);
  });
});

describe('Phase 7a — INVARIANT empIdsChantier === employés uniques du journal', () => {
  CHANTIERS.forEach(c => {
    it(`chantier ${c.id} (${c.nom}) : même ensemble d'employés`, () => {
      const journal = journalDe(c.id);
      const attendu = [...new Set(
        journal.flatMap(e => (e.employes || []).map(em => parseInt(em.employeId))).filter(Boolean)
      )].sort((a, b) => a - b);
      const obtenu = empIdsChantier(POINTAGES, c.id).sort((a, b) => a - b);
      expect(obtenu).toEqual(attendu);
    });
  });
});

describe('Phase 7a — indexPointagesParChantier (optimisation O(n))', () => {
  it('regroupe les pointages par chantier, cohérent avec joursReelsChantier', () => {
    const index = indexPointagesParChantier(POINTAGES);
    CHANTIERS.forEach(c => {
      const jours = joursReelsChantier(POINTAGES, c.id);
      if (jours > 0) {
        expect(index.has(String(c.id))).toBe(true);
        // un pointage = au plus 1 entrée par chantier → nb pointages indexés ≥ nb jours
        expect(index.get(String(c.id)).length).toBeGreaterThanOrEqual(jours);
      }
    });
  });
});

describe('Phase 7a — robustesse : entrées vides / catégories exclues', () => {
  it('pointages vide → tous les helpers neutres', () => {
    expect(joursReelsChantier([], 1)).toBe(0);
    expect(heuresEmployeChantier([], 1, 1)).toBe(0);
    expect(heuresJourChantier([], 1, '2025-01-01')).toEqual({});
    expect(empIdsChantier([], 1)).toEqual([]);
    expect(indexPointagesParChantier([]).size).toBe(0);
  });

  it('déplacement / absence / formation EXCLUS (comme le journal dérivé)', () => {
    const pts = [
      { id: 'p1', date: '2025-01-06', employeId: 1, repartitions: [
        { chantierId: '9', categorie: 'deplacement', heures: 2 },
        { chantierId: '9', categorie: 'absence_cp', heures: 8 },
        { chantierId: '9', categorie: 'formation', heures: 4 },
      ]},
    ];
    expect(joursReelsChantier(pts, 9)).toBe(0);
    expect(heuresEmployeChantier(pts, 1, 9)).toBe(0);
    expect(empIdsChantier(pts, 9)).toEqual([]);
  });

  it('production + atelier INCLUS et sommés', () => {
    const pts = [
      { id: 'p1', date: '2025-01-06', employeId: 1, repartitions: [
        { chantierId: '9', categorie: 'production', heures: 5 },
        { chantierId: '9', categorie: 'atelier', heures: 3 },
      ]},
    ];
    expect(joursReelsChantier(pts, 9)).toBe(1);
    expect(heuresEmployeChantier(pts, 1, 9)).toBe(8);
    expect(heuresJourChantier(pts, 9, '2025-01-06')).toEqual({ 1: 8 });
    expect(empIdsChantier(pts, 9)).toEqual([1]);
  });

  it('multi-chantier : un pointage 2 repartitions → chaque chantier voit SES heures', () => {
    const pts = [
      { id: 'p1', date: '2025-01-06', employeId: 1, repartitions: [
        { chantierId: '9', categorie: 'production', heures: 5 },
        { chantierId: '10', categorie: 'production', heures: 3 },
      ]},
    ];
    expect(heuresEmployeChantier(pts, 1, 9)).toBe(5);
    expect(heuresEmployeChantier(pts, 1, 10)).toBe(3);
    expect(joursReelsChantier(pts, 9)).toBe(1);
    expect(joursReelsChantier(pts, 10)).toBe(1);
  });
});
