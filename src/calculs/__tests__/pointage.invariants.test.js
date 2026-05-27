import { describe, it, expect } from 'vitest';
import { migrerJournalVersPointages } from '../../migration/migrerJournalVersPointages';
import { donneesInitiales } from '../../donnees';

const employes = donneesInitiales.employes || [];
const chantiers = donneesInitiales.chantiers || [];

describe('Invariants des données pointages migrées', () => {
  it('Unicité (date, employeId) — pas de doublons dans le résultat de migration', () => {
    const result = migrerJournalVersPointages(chantiers, employes);
    const keys = result.map(p => `${p.date}_${p.employeId}`);
    const uniques = new Set(keys);
    expect(uniques.size).toBe(result.length);
  });

  it('Tous les chantierId des repartitions existent dans chantiers[] (intégrité FK)', () => {
    const result = migrerJournalVersPointages(chantiers, employes);
    const chantierIds = new Set(chantiers.map(c => String(c.id)));
    for (const p of result) {
      for (const r of p.repartitions) {
        expect(chantierIds.has(String(r.chantierId))).toBe(true);
      }
    }
  });

  it('Conservation des heures totales — migration = journal (somme identique)', () => {
    // Somme des heures dans les journals bruts
    let totalJournal = 0;
    for (const chantier of chantiers) {
      for (const entry of (chantier.journal || [])) {
        for (const ej of (entry.employes || [])) {
          const h = parseFloat(ej.heuresTravaillees) || 0;
          if (h > 0) totalJournal += h;
        }
      }
    }
    // Somme des heures dans les pointages migrés
    const result = migrerJournalVersPointages(chantiers, employes);
    const totalPointages = result.reduce((sum, p) =>
      sum + p.repartitions.reduce((s, r) => s + r.heures, 0), 0
    );
    expect(Math.abs(totalPointages - totalJournal)).toBeLessThan(0.001);
  });
});
