/**
 * Planning MOBILE — soin (hero désencombré + calendrier + états vides).
 * Preuve RTL RÉELLE (vrai PlanningPage → Planning) :
 *  • mobile : triple doublon d'en-tête supprimé (« PLANNING / 07 » absent), bouton
 *    « Optimiser l'équipe » en BLANC, jour actif du calendrier en pastille (rayon 11) ;
 *  • desktop : « PLANNING / 07 » présent, Optimiser translucide, pastille rayon 6 — inchangé.
 * Échoue si on réintroduit le fil d'Ariane mobile ou si on casse la pastille du jour actif.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import PlanningPage from '../pages/PlanningPage';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const isoToday = new Date().toISOString().slice(0, 10);
const CHANTIER = { id: 'P1', nom: 'Chantier Métropole', numero: 'CH-100', statut: 'En cours', dateDebut: isoToday, nombreJours: 10, canton: 'GE', clientId: 'cl1', equipe: [], avancement: 40, nombrePersonnes: 1 };
const CLIENT = { id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' };
const EMPLOYE = { id: 1, nom: 'Muller', poste: 'Chef équipe', actif: true };
function renderPlanning() {
  return renderWithApp(
    <PlanningPage chantiers={[CHANTIER]} setChantiers={vi.fn()} clients={[CLIENT]} devis={[]} factures={[]} parametres={{ employes: [EMPLOYE] }} naviguer={vi.fn()} />,
    { pointages: [], ouvrirMenu: vi.fn() },
  );
}
// cellule active du calendrier = case (aspectRatio 1) au fond non transparent (aujourd'hui)
const celluleActive = () => [...document.querySelectorAll('div')].find(d => d.style.aspectRatio === '1' && d.style.background && d.style.background !== 'transparent');

describe('Planning mobile — soin (375px)', () => {
  it('doublon d\'en-tête supprimé : « PLANNING / 07 » absent, « Optimiser l\'équipe » présent', () => {
    setLargeur(375);
    renderPlanning();
    const hero = screen.getByTestId('hero-planning');
    expect(within(hero).getByRole('heading', { name: 'Planning' })).toBeInTheDocument();
    expect(screen.queryByText(/PLANNING\s*\/\s*07/)).toBeNull();          // fil d'Ariane + doublon supprimés
    expect(screen.getByRole('button', { name: /Optimiser l'équipe/ })).toBeInTheDocument(); // libellé complet conservé
  });

  it('« Optimiser l\'équipe » est un bouton BLANC', () => {
    setLargeur(375);
    renderPlanning();
    const opt = screen.getByRole('button', { name: /Optimiser l'équipe/ });
    expect(opt.style.background).toBe('rgb(255, 255, 255)'); // #fff normalisé par le DOM
  });

  it('jour actif du calendrier en pastille (rayon 11)', () => {
    setLargeur(375);
    renderPlanning();
    const cell = celluleActive();
    expect(cell).toBeTruthy();
    expect(cell.style.borderRadius).toBe('11px');
  });
});

describe('Planning desktop — non-régression (1200px, inchangé)', () => {
  it('« PLANNING / 07 » présent, Optimiser translucide, pastille rayon 6', () => {
    setLargeur(1200);
    renderPlanning();
    expect(screen.getAllByText(/PLANNING\s*\/\s*07/).length).toBeGreaterThan(0);
    const opt = screen.getByRole('button', { name: /Optimiser l'équipe/ });
    expect(opt.style.background).not.toBe('rgb(255, 255, 255)'); // translucide, pas blanc
    const cell = celluleActive();
    expect(cell.style.borderRadius).toBe('6px');
  });
});
