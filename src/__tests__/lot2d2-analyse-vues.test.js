/**
 * Lot 2d-2 — regroupement des 12 sous-onglets d'Analyse en 4 vues.
 * GARDE-FOU : aucun contenu perdu — les 12 anciens sous-onglets sont rangés
 * exactement une fois dans les 4 vues (config exportée VUES_ANALYSE).
 */
import { describe, it, expect } from 'vitest';
import { VUES_ANALYSE } from '../Analyse';

// Les 12 anciens sous-onglets (ids), avant regroupement.
const ANCIENS = [
  'marges', 'rentabilite', 'derive', 'chantiers', 'clients', 'employes',
  'corps', 'projection', 'objectifs', 'metres2', 'statistiques', 'rapport',
];

describe('VUES_ANALYSE — 4 vues, aucun contenu orphelin', () => {
  it('exactement 4 vues, dans l\'ordre attendu', () => {
    expect(VUES_ANALYSE.map(v => v.label)).toEqual([
      'Rentabilité', 'Par type & surface', 'Tendances & objectifs', 'Clients',
    ]);
  });

  it('GARDE-FOU : les 12 anciens sous-onglets sont rangés exactement une fois', () => {
    const ranges = VUES_ANALYSE.flatMap(v => v.sous.map(s => s.id));
    expect([...ranges].sort()).toEqual([...ANCIENS].sort()); // aucun perdu, aucun en trop
    expect(new Set(ranges).size).toBe(ranges.length);         // aucun doublon
  });

  it('rangement exact validé (chaque ancien onglet dans la bonne vue)', () => {
    const parLabel = Object.fromEntries(VUES_ANALYSE.map(v => [v.label, v.sous.map(s => s.id)]));
    expect(parLabel['Rentabilité']).toEqual(['marges', 'rentabilite', 'chantiers', 'employes']);
    expect(parLabel['Par type & surface']).toEqual(['corps', 'metres2']);
    expect(parLabel['Tendances & objectifs']).toEqual(['projection', 'objectifs', 'statistiques', 'rapport']);
    expect(parLabel['Clients']).toEqual(['clients', 'derive']);
  });

  it('la vue par défaut (Rentabilité) est la première', () => {
    expect(VUES_ANALYSE[0].id).toBe('v_rentabilite');
  });
});
