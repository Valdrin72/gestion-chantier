/**
 * Mode consultation mobile — LOT 5 : Planning en lecture seule (mobile).
 * Preuve RÉELLE (vrais composants PlanningPage → Planning + Calendrier).
 *  • mobile : aucun bouton d'écriture (Modifier, + Planifier, Nouvel événement) ;
 *    modale d'édition inatteignable ; « Optimiser l'équipe » conservé et fonctionnel
 *    (n'écrit RIEN → setChantiers jamais appelé) ; calendrier + jalons consultables ;
 *  • desktop : Modifier ouvre la modale (Sauvegarder + Retirer), Nouvel événement
 *    ouvre la modale d'agenda (PC strictement inchangé).
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

const CHANTIERS = [
  { id: 'p1', numero: 'CH-001', nom: 'Villa Dupont', dateDebut: '2026-10-01', nombreJours: 10, statut: 'En cours', avancement: 40, canton: 'GE', clientId: 'c1', nombrePersonnes: 2 },
  { id: 'np1', numero: 'CH-002', nom: 'Cuisine Martin', statut: 'Planifié', canton: 'GE', clientId: 'c1' },
];
const PARAMS = { employes: [{ id: 1, nom: 'Müller', poste: 'Chef', actif: true }], coefficientMainOeuvre: 1.35 };

const renderPage = (over = {}) => renderWithApp(
  <PlanningPage chantiers={CHANTIERS} setChantiers={over.setChantiers || vi.fn()} clients={[{ id: 'c1', nom: 'Client SA' }]}
    devis={[]} factures={[]} parametres={PARAMS} naviguer={vi.fn()} />,
  { ouvrirMenu: vi.fn(), ...over },
);

describe('Planning mobile — lecture seule (375px)', () => {
  it('calendrier : aucun bouton d\'écriture, chantier consultable, modale inatteignable', () => {
    setLargeur(375);
    renderPage({ consultationMobile: true });
    // Chantier "en cours" consultable dans la liste (carte + légende calendrier)
    expect(screen.getAllByText('Villa Dupont').length).toBeGreaterThan(0);
    // "sans date" reste visible mais en chip lecture seule (pas de "+ Planifier")
    expect(screen.getByText('Cuisine Martin')).toBeInTheDocument();
    expect(screen.queryByText(/Planifier/)).toBeNull();
    // Aucun bouton d'écriture
    expect(screen.queryByText('Modifier')).toBeNull();
    expect(screen.queryByText('Nouvel événement')).toBeNull();
    // Modale d'édition jamais ouverte (aucun déclencheur)
    expect(screen.queryByText('Modifier le planning')).toBeNull();
    expect(screen.queryByText('Sauvegarder')).toBeNull();
    expect(screen.queryByText('Retirer du planning')).toBeNull();
  });

  it('« Optimiser l\'équipe » conservé, fonctionnel et sans écriture', () => {
    setLargeur(375);
    const setChantiers = vi.fn();
    renderPage({ consultationMobile: true, setChantiers });
    const btn = screen.getByRole('button', { name: /Optimiser l'équipe/ });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    // Le panneau IA s'affiche (consultatif)
    expect(screen.getByTestId('panneau-optimiseur')).toBeInTheDocument();
    // et n'écrit RIEN dans les chantiers
    expect(setChantiers).not.toHaveBeenCalled();
  });

  it('onglet Événements : agenda consultable, pas de « Nouvel événement »', () => {
    setLargeur(375);
    renderPage({ consultationMobile: true });
    fireEvent.click(screen.getByRole('button', { name: 'Événements' }));
    expect(screen.getByTestId('calendrier-layout')).toBeInTheDocument();
    expect(screen.getByText('Prochains événements')).toBeInTheDocument();
    expect(screen.queryByText('Nouvel événement')).toBeNull();
  });
});

describe('Planning desktop — non-régression (1200px)', () => {
  it('Modifier ouvre la modale (Sauvegarder + Retirer du planning)', () => {
    setLargeur(1200);
    renderPage({ consultationMobile: false });
    const modifier = screen.getByText('Modifier');
    expect(modifier).toBeInTheDocument();
    fireEvent.click(modifier);
    expect(screen.getByText('Modifier le planning')).toBeInTheDocument();
    expect(screen.getByText('Sauvegarder')).toBeInTheDocument();
    expect(screen.getByText('Retirer du planning')).toBeInTheDocument();
  });

  it('Événements : Nouvel événement ouvre la modale agenda', () => {
    setLargeur(1200);
    renderPage({ consultationMobile: false });
    fireEvent.click(screen.getByRole('button', { name: 'Événements' }));
    const nouvel = screen.getByRole('button', { name: /Nouvel événement/ });
    expect(nouvel).toBeInTheDocument();
    fireEvent.click(nouvel);
    // Modale agenda ouverte : champ Titre présent
    expect(screen.getByText('Titre')).toBeInTheDocument();
    expect(screen.getByText('Ajouter')).toBeInTheDocument();
  });
});
