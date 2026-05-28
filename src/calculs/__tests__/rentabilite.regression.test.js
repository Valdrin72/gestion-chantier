/**
 * Tests de non-régression Phase 5a — RENTABILITÉ.
 *
 * Vérifie que coutEquipeReel et margeActuellePct de chaque chantier démo
 * restent IDENTIQUES (±0.1%) quand le journal est régénéré depuis les pointages.
 *
 * Si un seul assert échoue → régression rentabilité → STOPPER.
 */
import { describe, it, expect } from 'vitest';
import { calculerCoutsChantier, calculerEtatChantier, donneesInitiales } from '../../donnees';
import { migrerJournalVersPointages } from '../../migration/migrerJournalVersPointages';
import { regenererJournalDepuisPointages } from '../../migration/regenererJournalDepuisPointages';

const { chantiers, employes, devis, parametres } = donneesInitiales;

const pointagesMigres = migrerJournalVersPointages(chantiers, employes);
const chantiersRegenes = regenererJournalDepuisPointages(pointagesMigres, chantiers);

const cfg = {
  coefficientMainOeuvre: parametres?.coefficientMainOeuvre ?? 1.35,
  tauxFraisGeneraux:     parametres?.tauxFraisGeneraux ?? 12,
};

function proches(a, b, tolerancePct = 0.1) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a === 0 && b === 0) return true;
  const ref = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / ref * 100 < tolerancePct;
}

describe('Non-régression rentabilité — journal original vs journal régénéré', () => {
  for (const chantierOriginal of chantiers) {
    const chantierRegene = chantiersRegenes.find(c => String(c.id) === String(chantierOriginal.id));

    it(`CH${chantierOriginal.id} "${chantierOriginal.nom}" — coutEquipeReel identique (±0.1%)`, () => {
      const coutsOrig   = calculerCoutsChantier(chantierOriginal, employes, [], cfg, devis);
      const coutsRegene = calculerCoutsChantier(chantierRegene,   employes, [], cfg, devis);
      expect(
        proches(coutsOrig.coutEquipeReel, coutsRegene.coutEquipeReel),
        `orig=${coutsOrig.coutEquipeReel} vs regene=${coutsRegene.coutEquipeReel}`
      ).toBe(true);
    });

    it(`CH${chantierOriginal.id} — totalCoutsReel identique (±0.1%)`, () => {
      const coutsOrig   = calculerCoutsChantier(chantierOriginal, employes, [], cfg, devis);
      const coutsRegene = calculerCoutsChantier(chantierRegene,   employes, [], cfg, devis);
      expect(
        proches(coutsOrig.totalCoutsReel, coutsRegene.totalCoutsReel),
        `orig=${coutsOrig.totalCoutsReel} vs regene=${coutsRegene.totalCoutsReel}`
      ).toBe(true);
    });

    it(`CH${chantierOriginal.id} — margeActuellePct identique (±0.1%)`, () => {
      const coutsOrig   = calculerCoutsChantier(chantierOriginal, employes, [], cfg, devis);
      const coutsRegene = calculerCoutsChantier(chantierRegene,   employes, [], cfg, devis);
      expect(
        proches(coutsOrig.margeActuellePct, coutsRegene.margeActuellePct),
        `orig=${coutsOrig.margeActuellePct} vs regene=${coutsRegene.margeActuellePct}`
      ).toBe(true);
    });

    it(`CH${chantierOriginal.id} — coutMOReel (calculerEtatChantier) identique (±0.1%)`, () => {
      const etatOrig   = calculerEtatChantier(chantierOriginal, employes, devis, cfg);
      const etatRegene = calculerEtatChantier(chantierRegene,   employes, devis, cfg);
      expect(
        proches(etatOrig.coutMOReel, etatRegene.coutMOReel),
        `orig=${etatOrig.coutMOReel} vs regene=${etatRegene.coutMOReel}`
      ).toBe(true);
    });
  }
});
