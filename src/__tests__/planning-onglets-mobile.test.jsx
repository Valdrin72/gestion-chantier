/**
 * Planning MOBILE — onglets : Gantt retiré du mobile (gardé PC) + Événements non écrasé.
 * Preuve RTL RÉELLE (vrai PlanningPage → Planning / Calendrier) :
 *  • mobile : pas d'onglet « Gantt » ; « Calendrier » + « Événements » présents ;
 *    l'onglet Événements passe la mise en page du calendrier en 1 colonne (plus d'écrasement) ;
 *  • desktop : onglet « Gantt » présent ; calendrier Événements en 2 colonnes (inchangé).
 * Échoue si on réintroduit l'onglet Gantt en mobile ou si le calendrier Événements
 * reste en multi-colonnes sur mobile (écrasé).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import PlanningPage from '../pages/PlanningPage';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const isoToday = new Date().toISOString().slice(0, 10);
const CHANTIER = { id: 'P1', nom: 'Chantier Métropole', numero: 'CH-100', statut: 'En cours', dateDebut: isoToday, nombreJours: 10, canton: 'GE', clientId: 'cl1', avancement: 40, nombrePersonnes: 1 };
const CLIENT = { id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' };
function renderPlanning() {
  return renderWithApp(
    <PlanningPage chantiers={[CHANTIER]} setChantiers={vi.fn()} clients={[CLIENT]} devis={[]} factures={[]} parametres={{ employes: [] }} naviguer={vi.fn()} />,
    { pointages: [], ouvrirMenu: vi.fn() },
  );
}

describe('Planning mobile (375px) — Gantt retiré, Événements adapté', () => {
  it('l\'onglet « Gantt » est absent ; Calendrier + Événements présents', () => {
    setLargeur(375);
    renderPlanning();
    expect(screen.queryByRole('button', { name: 'Gantt' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Calendrier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Événements' })).toBeInTheDocument();
  });

  it('onglet Événements : calendrier en 1 colonne (plus d\'écrasement)', () => {
    setLargeur(375);
    renderPlanning();
    fireEvent.click(screen.getByRole('button', { name: 'Événements' }));
    expect(screen.getByTestId('calendrier-layout').style.gridTemplateColumns).toBe('1fr');
  });
});

describe('Planning desktop (1200px) — inchangé', () => {
  it('l\'onglet « Gantt » est présent', () => {
    setLargeur(1200);
    renderPlanning();
    expect(screen.getByRole('button', { name: 'Gantt' })).toBeInTheDocument();
  });

  it('onglet Événements : calendrier en 2 colonnes (minmax)', () => {
    setLargeur(1200);
    renderPlanning();
    fireEvent.click(screen.getByRole('button', { name: 'Événements' }));
    expect(screen.getByTestId('calendrier-layout').style.gridTemplateColumns).toContain('minmax');
  });
});
