/**
 * Tests de non-régression Phase 5a — AVANCEMENT.
 *
 * Vérifie que avancementPct de chaque chantier démo reste IDENTIQUE
 * quand le journal est régénéré depuis les pointages migrés.
 *
 * Si un seul assert échoue → régression avancement détectée → STOPPER.
 */
import { describe, it, expect } from 'vitest';
import { calculerEtatChantier, donneesInitiales } from '../../donnees';
import { migrerJournalVersPointages } from '../../migration/migrerJournalVersPointages';
import { regenererJournalDepuisPointages } from '../../migration/regenererJournalDepuisPointages';

const { chantiers, employes, devis, parametres } = donneesInitiales;

const pointagesMigres = migrerJournalVersPointages(chantiers, employes);
const chantiersRegenes = regenererJournalDepuisPointages(pointagesMigres, chantiers);

const cfg = {
  coefficientMainOeuvre: parametres?.coefficientMainOeuvre ?? 1.35,
  tauxFraisGeneraux:     parametres?.tauxFraisGeneraux ?? 12,
};

describe('Non-régression avancement — journal original vs journal régénéré', () => {
  for (const chantierOriginal of chantiers) {
    const chantierRegene = chantiersRegenes.find(c => String(c.id) === String(chantierOriginal.id));

    it(`CH${chantierOriginal.id} "${chantierOriginal.nom}" — avancementPct identique`, () => {
      const etatOriginal = calculerEtatChantier(chantierOriginal, employes, devis, cfg);
      const etatRegene   = calculerEtatChantier(chantierRegene,   employes, devis, cfg);
      expect(etatRegene.avancementPct).toBe(etatOriginal.avancementPct);
    });

    it(`CH${chantierOriginal.id} — totalJoursReels identique`, () => {
      const etatOriginal = calculerEtatChantier(chantierOriginal, employes, devis, cfg);
      const etatRegene   = calculerEtatChantier(chantierRegene,   employes, devis, cfg);
      expect(etatRegene.totalJoursReels).toBe(etatOriginal.totalJoursReels);
    });
  }

  it('chantier clos → avancementPct = 100 inchangé', () => {
    const chantiClos = { ...chantiers[0], statut: 'terminé' };
    const chantiClosRegene = chantiersRegenes.find(c => String(c.id) === String(chantiers[0].id));
    const chantiClosRegeneStatut = { ...chantiClosRegene, statut: 'terminé' };
    expect(calculerEtatChantier(chantiClos, employes, devis, cfg).avancementPct).toBe(100);
    expect(calculerEtatChantier(chantiClosRegeneStatut, employes, devis, cfg).avancementPct).toBe(100);
  });

  it('chantier 7 (journal vide) → avancementPct = 0 inchangé', () => {
    const ch7 = chantiers.find(c => String(c.id) === '7');
    const ch7Regene = chantiersRegenes.find(c => String(c.id) === '7');
    expect(calculerEtatChantier(ch7, employes, devis, cfg).avancementPct).toBe(0);
    expect(calculerEtatChantier(ch7Regene, employes, devis, cfg).avancementPct).toBe(0);
  });
});
