/**
 * Tests Phase 5a : regenererJournalDepuisPointages
 *
 * Couvre :
 * - Round-trip : migration → régénération = journal original (7 chantiers démo)
 * - F3 multi-chantier : chaque chantier ne voit que ses heures
 * - Catégories : atelier inclus, déplacement exclu
 * - Tri par date ASC
 * - Chantier sans pointages → journal vide
 */
import { describe, it, expect } from 'vitest';
import { regenererJournalDepuisPointages } from '../../migration/regenererJournalDepuisPointages';
import { migrerJournalVersPointages } from '../../migration/migrerJournalVersPointages';
import { donneesInitiales, heuresEmploye } from '../../donnees';

const { chantiers, employes } = donneesInitiales;

// ── Round-trip sur les 7 chantiers démo ──────────────────────────────────────

describe('round-trip journal → pointages → journal', () => {
  const pointages = migrerJournalVersPointages(chantiers, employes);
  const chantiersRegenes = regenererJournalDepuisPointages(pointages, chantiers);

  for (const chantierOriginal of chantiers) {
    it(`CH${chantierOriginal.id} "${chantierOriginal.nom}" — heures identiques`, () => {
      const chantierRegene = chantiersRegenes.find(c => String(c.id) === String(chantierOriginal.id));
      expect(chantierRegene).toBeDefined();

      // Comparer les heures par (date, employeId)
      const journalOriginal = chantierOriginal.journal || [];
      const journalRegene   = chantierRegene.journal  || [];

      // Même nombre de dates distinctes
      const datesOrig   = new Set(journalOriginal.map(e => e.date));
      const datesRegene = new Set(journalRegene.map(e => e.date));
      expect(datesRegene.size).toBe(datesOrig.size);

      // Pour chaque employé : même total d'heures
      const empIds = [...new Set(
        journalOriginal.flatMap(e => (e.employes || []).map(em => parseInt(em.employeId)))
      )];
      for (const empId of empIds) {
        const hOrig   = heuresEmploye(journalOriginal, empId);
        const hRegene = heuresEmploye(journalRegene,   empId);
        expect(hRegene).toBeCloseTo(hOrig, 5);
      }
    });
  }

  it('chantier 7 (journal vide) → journal régénéré vide', () => {
    const ch7 = chantiersRegenes.find(c => String(c.id) === '7');
    expect(ch7).toBeDefined();
    expect(ch7.journal).toEqual([]);
  });
});

// ── Cas F3 multi-chantier ────────────────────────────────────────────────────

describe('F3 multi-chantier : isolation des repartitions', () => {
  it('un pointage avec 2 repartitions → chaque chantier ne voit que ses heures', () => {
    const ptgF3 = [{
      id: 'ptg_f3',
      date: '2025-09-01',
      employeId: 1,
      repartitions: [
        { categorie: 'production', heures: 5, chantierId: 'A' },
        { categorie: 'production', heures: 3, chantierId: 'B' },
      ],
      majoration: null,
    }];
    const chantiersTest = [
      { id: 'A', nom: 'Chantier A', journal: [] },
      { id: 'B', nom: 'Chantier B', journal: [] },
    ];
    const result = regenererJournalDepuisPointages(ptgF3, chantiersTest);
    const jA = result.find(c => c.id === 'A').journal;
    const jB = result.find(c => c.id === 'B').journal;

    expect(heuresEmploye(jA, 1)).toBeCloseTo(5, 5);
    expect(heuresEmploye(jB, 1)).toBeCloseTo(3, 5);
  });
});

// ── Catégories incluses/exclues ──────────────────────────────────────────────

describe('filtrage par catégorie', () => {
  const chantierTest = [{ id: 'T1', nom: 'Test', journal: [] }];

  it('production → inclus', () => {
    const ptgs = [{
      id: 'p1', date: '2025-09-01', employeId: 1,
      repartitions: [{ categorie: 'production', heures: 8, chantierId: 'T1' }],
    }];
    const j = regenererJournalDepuisPointages(ptgs, chantierTest)[0].journal;
    expect(heuresEmploye(j, 1)).toBeCloseTo(8, 5);
  });

  it('atelier → inclus', () => {
    const ptgs = [{
      id: 'p2', date: '2025-09-01', employeId: 1,
      repartitions: [{ categorie: 'atelier', heures: 4, chantierId: 'T1' }],
    }];
    const j = regenererJournalDepuisPointages(ptgs, chantierTest)[0].journal;
    expect(heuresEmploye(j, 1)).toBeCloseTo(4, 5);
  });

  it('deplacement seul → exclu du journal (0h)', () => {
    const ptgs = [{
      id: 'p3', date: '2025-09-01', employeId: 1,
      repartitions: [{ categorie: 'deplacement', heures: 2, chantierId: 'T1' }],
    }];
    const j = regenererJournalDepuisPointages(ptgs, chantierTest)[0].journal;
    expect(j).toHaveLength(0);
  });

  it('absence → exclue du journal', () => {
    const ptgs = [{
      id: 'p4', date: '2025-09-01', employeId: 1,
      repartitions: [{ categorie: 'absence', heures: 8, chantierId: 'T1' }],
    }];
    const j = regenererJournalDepuisPointages(ptgs, chantierTest)[0].journal;
    expect(j).toHaveLength(0);
  });

  it('production + atelier le même jour → sommés dans le journal', () => {
    const ptgs = [{
      id: 'p5', date: '2025-09-01', employeId: 1,
      repartitions: [
        { categorie: 'production', heures: 5, chantierId: 'T1' },
        { categorie: 'atelier',    heures: 2, chantierId: 'T1' },
      ],
    }];
    const j = regenererJournalDepuisPointages(ptgs, chantierTest)[0].journal;
    expect(heuresEmploye(j, 1)).toBeCloseTo(7, 5);
  });

  it('heures = 0 → exclu', () => {
    const ptgs = [{
      id: 'p6', date: '2025-09-01', employeId: 1,
      repartitions: [{ categorie: 'production', heures: 0, chantierId: 'T1' }],
    }];
    const j = regenererJournalDepuisPointages(ptgs, chantierTest)[0].journal;
    expect(j).toHaveLength(0);
  });
});

// ── Tri par date ASC ─────────────────────────────────────────────────────────

describe('ordre du journal', () => {
  it('entrées triées par date ASC', () => {
    const ptgs = [
      { id: 'pa', date: '2025-09-03', employeId: 1, repartitions: [{ categorie: 'production', heures: 8, chantierId: 'S1' }] },
      { id: 'pb', date: '2025-09-01', employeId: 1, repartitions: [{ categorie: 'production', heures: 8, chantierId: 'S1' }] },
      { id: 'pc', date: '2025-09-02', employeId: 1, repartitions: [{ categorie: 'production', heures: 8, chantierId: 'S1' }] },
    ];
    const j = regenererJournalDepuisPointages(ptgs, [{ id: 'S1', journal: [] }])[0].journal;
    expect(j.map(e => e.date)).toEqual(['2025-09-01', '2025-09-02', '2025-09-03']);
  });
});

// ── Sans pointages ────────────────────────────────────────────────────────────

describe('chantier sans pointages', () => {
  it('journal régénéré = []', () => {
    const j = regenererJournalDepuisPointages([], [{ id: 'X', journal: [{ date: '2025-01-01', employes: [] }] }])[0].journal;
    expect(j).toEqual([]);
  });
});
