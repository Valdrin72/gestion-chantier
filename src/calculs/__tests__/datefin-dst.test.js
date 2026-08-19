/**
 * Fix DST — calculerDateFinOuvrables sérialisait sa date de fin en UTC (toISOString) alors qu'elle est
 * construite en heure LOCALE : en fuseau positif (ex. Genève UTC+1/+2, ou UTC+14) la date de fin
 * pouvait reculer d'un jour. Le fix la formate en jour LOCAL → jour correct quel que soit le fuseau.
 *
 * Ce test ancre la valeur correcte (déterministe, indépendante du fuseau après fix). La démonstration
 * avant/après du décalage se fait au niveau processus : `TZ=Pacific/Kiritimati npx vitest run` renvoyait
 * 2026-03-08 avant le fix, 2026-03-09 après (cf. PR).
 */
import { describe, it, expect } from 'vitest';
import { calculerDateFinOuvrables } from '../../donnees';

describe('calculerDateFinOuvrables — date de fin en jour LOCAL (fix DST)', () => {
  it('2026-03-02 (lundi) + 5 jours ouvrés GE = 2026-03-09 (lundi)', () => {
    // jeu ouvrés : mar 3, mer 4, jeu 5, ven 6, lun 9 (sam/dim sautés) → lundi 9 mars.
    expect(calculerDateFinOuvrables('2026-03-02', 5, false, 'GE')).toBe('2026-03-09');
  });

  it('la date de fin porte bien nombreJours jours ouvrés (pas de décalage d\'un jour)', () => {
    // Un décalage UTC ferait tomber la fin un jour trop tôt/tard → cette égalité stricte le détecterait.
    expect(calculerDateFinOuvrables('2026-06-01', 10, false, 'GE')).toBe('2026-06-15');
  });
});
