/**
 * Lot 2c — retrait des doublons Clients/Employés (Paramètres) + écrans morts.
 * PREUVE : Clients et Employés restent ATTEIGNABLES (via Finances).
 * (L'extracteur PDF a été retiré au lot 2c-bis — plus aucun consommateur vivant.)
 */
import { describe, it, expect } from 'vitest';
import { construireMaisons, ecransAtteignables } from '../nav/maisons';

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
