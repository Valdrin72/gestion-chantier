/**
 * Lot 2c — retrait des doublons Clients/Employés (Paramètres) + écrans morts.
 * PREUVE : Clients et Employés restent ATTEIGNABLES (via Finances), et l'extracteur
 * PDF (réutilisé par la soumission assistée) survit à son nouvel emplacement.
 */
import { describe, it, expect } from 'vitest';
import { construireMaisons, ecransAtteignables } from '../nav/maisons';
import { extraireDonneesPDF } from '../utils/extrairePDF';

describe('Clients & Employés restent atteignables via la maison Finances', () => {
  const maisons = construireMaisons();
  const finances = maisons.find(m => m.label === 'Finances');

  it('la maison Finances contient bien Clients et Employés', () => {
    const enfants = finances.enfants.map(e => e.id);
    expect(enfants).toContain('clients');
    expect(enfants).toContain('employes');
  });

  it('les écrans Clients et Employés sont toujours joignables depuis le menu', () => {
    const atteignables = ecransAtteignables(maisons);
    expect(atteignables).toContain('clients');
    expect(atteignables).toContain('employes');
  });
});

describe('extraireDonneesPDF — l\'extracteur survit (soumission assistée fonctionne)', () => {
  it('extrait client, montant et surface d\'un texte de devis', () => {
    const texte = [
      'Client : Régie Dupont SA',
      'Cloison placo BA13 : 45.5 m²',
      'Peinture murs et plafonds : 120.0 m²',
      'TOTAL TTC : CHF 12\'500.00',
    ].join('\n');
    const r = extraireDonneesPDF(texte);
    expect(r.client.toLowerCase()).toContain('dupont');
    expect(r.montant).toBe(12500);
    expect(r.surface).toBeGreaterThan(0);      // au moins une surface détectée
    expect(r.lignes.length).toBeGreaterThan(0);
    expect(r.qualite).toBe('reussie');          // score ≥ 3 (client + montant + surface + lignes)
  });

  it('texte vide → résultat neutre, jamais de crash', () => {
    const r = extraireDonneesPDF('');
    expect(r.montant).toBe(0);
    expect(r.qualite).toBe('echec');
  });
});
