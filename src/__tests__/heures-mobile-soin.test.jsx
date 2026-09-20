/**
 * Heures MOBILE — soin. Preuve RTL RÉELLE (vrai composant Heures) :
 *  • mobile : doublon « HEURES / 06 » supprimé ; NON SAISIES en rouge quand > 0 ;
 *    cellule de saisie « + » ≥ 44px (cible tactile chantier) ;
 *  • desktop : « HEURES / 06 » présent (inchangé).
 * Échoue si on réintroduit « HEURES / 06 » en mobile ou si la cible « + » 44px est cassée.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Heures from '../Heures';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const EMP = { id: 1, nom: 'Müller', poste: 'Chef', tarifJour: 400, actif: true };
const PARAMS = { employes: [EMP] };
function renderHeures() {
  return renderWithApp(
    <Heures chantiers={[]} parametres={PARAMS} setChantiers={vi.fn()} />,
    { pointages: [], periodeGlobale: 'semaine', setPeriodeGlobale: vi.fn(), ouvrirMenu: vi.fn() },
  );
}
// première cellule de saisie « + » du tableau
const plusCell = () => [...document.querySelectorAll('td span')].find(s => s.textContent.trim() === '+');

describe('Heures mobile — soin (375px)', () => {
  it('doublon « HEURES / 06 » supprimé ; titre présent', () => {
    setLargeur(375);
    renderHeures();
    expect(screen.getByRole('heading', { name: 'Heures' })).toBeInTheDocument();
    expect(screen.queryByText(/HEURES\s*\/\s*06/)).toBeNull();
  });

  it('cellule de saisie « + » ≥ 44px (cible tactile)', () => {
    setLargeur(375);
    renderHeures();
    const cell = plusCell();
    expect(cell).toBeTruthy();
    expect(cell.style.minWidth).toBe('44px');
    expect(cell.style.minHeight).toBe('44px');
  });

  it('NON SAISIES en rouge quand > 0 (1 seule couleur d\'alerte)', () => {
    setLargeur(375);
    renderHeures();
    const tile = screen.getByTestId('hero-kpi-non-saisies');
    const val = tile.children[1]; // le nombre
    expect(val.style.color).toBe('rgb(255, 122, 107)'); // #FF7A6B
  });
});

describe('Heures desktop — non-régression (1200px)', () => {
  it('« HEURES / 06 » présent (inchangé)', () => {
    setLargeur(1200);
    renderHeures();
    expect(screen.getAllByText(/HEURES\s*\/\s*06/).length).toBeGreaterThan(0);
  });
});
