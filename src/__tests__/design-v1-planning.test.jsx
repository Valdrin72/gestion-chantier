/**
 * Design v1 — page PLANNING (hero unique + 3 onglets : Calendrier / Gantt / Événements).
 * Maquettes validées patron. Rhabillage + réorganisation en onglets — ZÉRO logique
 * touchée (positionnement Gantt, suggestions IA, création d'événements, jalons).
 *
 * Preuve RTL RÉELLE (vrai PlanningPage → vrais Planning + Calendrier, aucun mock) :
 *   1. le hero affiche les 3 onglets et bascule entre eux ;
 *   2. onglet Calendrier : les vrais chantiers du mois sont listés ;
 *   3. onglet Gantt : la barre du chantier est positionnée sur la timeline ;
 *   4. onglet Événements : calendrier affiché + « Nouvel événement » ouvre la modale ;
 *   5. « Optimiser l'équipe » ouvre le panneau IA avec les vraies suggestions ;
 *   6. la création d'un événement fonctionne (action + persistance inchangées).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import PlanningPage from '../pages/PlanningPage';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

beforeEach(() => { localStorage.removeItem('cyna_cal_events'); });

// Chantier « en cours » démarrant aujourd'hui → visible ce mois ET sur la timeline Gantt.
const isoToday = new Date().toISOString().slice(0, 10);
const CHANTIER = {
  id: 'P1', nom: 'Chantier Métropole', numero: 'CH-100', statut: 'En cours',
  dateDebut: isoToday, nombreJours: 10, canton: 'GE', clientId: 'cl1',
  equipe: [], avancement: 40, nombrePersonnes: 1,
};
const CLIENT = { id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' };
const EMPLOYE = { id: 1, nom: 'Muller', poste: 'Chef équipe', actif: true };

function renderPlanning(over = {}) {
  return renderWithApp(
    <PlanningPage
      chantiers={over.chantiers || [CHANTIER]} setChantiers={vi.fn()}
      clients={[CLIENT]} devis={[]} factures={over.factures || []}
      parametres={{ employes: [EMPLOYE] }} naviguer={vi.fn()}
    />,
    { pointages: [], ouvrirMenu: over.ouvrirMenu || vi.fn() },
  );
}

describe('HERO — 3 onglets + bascule', () => {
  it('affiche le hero, le titre et les 3 onglets (Calendrier actif par défaut)', () => {
    renderPlanning();
    const hero = screen.getByTestId('hero-planning');
    expect(within(hero).getByRole('heading', { name: 'Planning' })).toBeInTheDocument();
    expect(within(hero).getByRole('button', { name: 'Calendrier' })).toBeInTheDocument();
    expect(within(hero).getByRole('button', { name: 'Gantt' })).toBeInTheDocument();
    expect(within(hero).getByRole('button', { name: 'Événements' })).toBeInTheDocument();
    // Le mode hero plein écran est actif (Topbar masqué par CSS)
    expect(document.body.classList.contains('hero-fullscreen')).toBe(true);
  });

  it('le bouton ☰ du hero appelle ouvrirMenu', () => {
    const ouvrirMenu = vi.fn();
    renderPlanning({ ouvrirMenu });
    fireEvent.click(within(screen.getByTestId('hero-planning')).getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });
});

describe('ONGLET CALENDRIER — vrais chantiers du mois', () => {
  it('liste le chantier du mois avec ses dates et son état', () => {
    renderPlanning();
    // Le chantier apparaît (carte liste + légende du mini-calendrier)
    expect(screen.getAllByText('Chantier Métropole').length).toBeGreaterThan(0);
    // Champs de la carte : Début / Fin prévue / Restant (« Début »/« Fin prévue »
    // apparaissent aussi dans les jalons → getAll)
    expect(screen.getAllByText('Début').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fin prévue').length).toBeGreaterThan(0);
    expect(screen.getByText('Restant')).toBeInTheDocument();
    // Jalons présents (carte de droite)
    expect(screen.getByText('Prochains jalons')).toBeInTheDocument();
  });
});

describe('ONGLET GANTT — barres positionnées', () => {
  it('bascule sur Gantt : la barre du chantier est présente sur la timeline', () => {
    renderPlanning();
    fireEvent.click(screen.getByRole('button', { name: 'Gantt' }));
    // La barre porte un title avec le nom + début + durée (calcul de positionnement inchangé)
    expect(screen.getByTitle(new RegExp('Chantier Métropole[\\s\\S]*Début'))).toBeInTheDocument();
    // L'en-tête des semaines est rendu (S<num>)
    expect(screen.getAllByText(/^S\d+$/).length).toBeGreaterThan(0);
  });

  it('sans chantier planifié : garde-fou « Aucun chantier sur cette période »', () => {
    renderPlanning({ chantiers: [{ ...CHANTIER, id: 'P2', dateDebut: '' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Gantt' }));
    expect(screen.getByText(/Aucun chantier sur cette période/i)).toBeInTheDocument();
  });
});

describe('PANNEAU IA — Optimiser l\'équipe', () => {
  it('le bouton du hero ouvre le panneau avec les vraies suggestions (employé + charge)', () => {
    renderPlanning();
    fireEvent.click(screen.getByRole('button', { name: /Optimiser l'équipe/i }));
    const panneau = screen.getByTestId('panneau-optimiseur');
    expect(within(panneau).getByText(/Suggestions IA/i)).toBeInTheDocument();
    // L'employé suggéré apparaît avec son métier (suggestions calculées, non mockées)
    expect(within(panneau).getByText('Muller')).toBeInTheDocument();
    expect(within(panneau).getByText('Chef équipe')).toBeInTheDocument();
  });
});

describe('ONGLET ÉVÉNEMENTS — calendrier + création (action inchangée)', () => {
  it('affiche le calendrier mensuel et « Nouvel événement » ouvre la modale', () => {
    renderPlanning();
    fireEvent.click(screen.getByRole('button', { name: 'Événements' }));
    // Grille : en-têtes de jours
    expect(screen.getByText('LUN')).toBeInTheDocument();
    expect(screen.getByText('Prochains événements')).toBeInTheDocument();
    // Le bouton du hero ouvre la modale
    fireEvent.click(screen.getByRole('button', { name: /Nouvel événement/i }));
    expect(screen.getByPlaceholderText(/Réunion de chantier/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ajouter$/i })).toBeInTheDocument();
  });

  it('créer un événement : titre + date + catégorie → il apparaît et est persisté', () => {
    renderPlanning();
    fireEvent.click(screen.getByRole('button', { name: 'Événements' }));
    fireEvent.click(screen.getByRole('button', { name: /Nouvel événement/i }));

    fireEvent.change(screen.getByPlaceholderText(/Réunion de chantier/i), { target: { value: 'Réunion budget' } });
    const dateInput = document.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: isoToday } });
    fireEvent.click(screen.getByRole('button', { name: 'Livraison' }));
    fireEvent.click(screen.getByRole('button', { name: /^Ajouter$/i }));

    // L'événement apparaît (grille et/ou prochains événements) et est persisté en localStorage
    expect(screen.getAllByText('Réunion budget').length).toBeGreaterThan(0);
    const stockes = JSON.parse(localStorage.getItem('cyna_cal_events'));
    expect(stockes).toHaveLength(1);
    expect(stockes[0].label).toBe('Réunion budget');
    expect(stockes[0].sub).toBe('Livraison');
  });
});
