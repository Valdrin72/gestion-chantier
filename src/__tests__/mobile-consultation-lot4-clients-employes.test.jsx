/**
 * Mode consultation mobile — LOT 4 : Clients + Employés en lecture seule (mobile).
 * Preuve RÉELLE (vrais composants Clients et Employes).
 *  • mobile : aucun bouton d'écriture (Nouveau client/employé, Modifier, Archiver, Supprimer,
 *    Désactiver/Réactiver) ; formulaires inatteignables ; cartes consultables ; liens nav gardés ;
 *  • desktop : tous les boutons présents + formulaire ouvrable (PC inchangé).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) } }));

import Clients from '../pages/ClientsPage';
import Employes from '../pages/EmployesPage';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const CLIENTS = [{ id: 'c1', nom: 'Dupont', prenom: 'Marc', entreprise: 'Dupont SA', type: 'Entreprise', telephone: '022 000 00 00', email: 'a@b.ch' }];
const PARAMS = { employes: [{ id: 1, nom: 'Müller', poste: 'Chef', tarifJour: 400, tarifHeure: 50, actif: true }], parametres: { coefficientMainOeuvre: 1.35 } };

const renderClients = (over = {}) => renderWithApp(
  <Clients clients={CLIENTS} setClients={vi.fn()} chantiers={[]} devis={[]} factures={[]} naviguer={vi.fn()} />,
  { confirmer: vi.fn(), afficherNotif: vi.fn(), ouvrirMenu: vi.fn(), ...over },
);
const renderEmployes = (over = {}) => renderWithApp(
  <Employes parametres={PARAMS} setParametres={vi.fn()} chantiers={[]} naviguer={vi.fn()} />,
  { profil: { id: 'cyna' }, periodeGlobale: 'mois', afficherNotif: vi.fn(), ouvrirMenu: vi.fn(), ...over },
);

describe('Clients mobile — lecture seule (375px)', () => {
  it('carte consultable + liens nav gardés ; aucun bouton d\'écriture ni formulaire', () => {
    setLargeur(375);
    renderClients({ consultationMobile: true });
    expect(screen.getByText('Dupont SA')).toBeInTheDocument();
    expect(screen.getAllByText(/Chantiers/).length).toBeGreaterThan(0); // lien nav
    expect(screen.getByText('Devis')).toBeInTheDocument();     // lien nav
    expect(screen.queryByText(/Nouveau client/)).toBeNull();
    expect(screen.queryByText('Modifier')).toBeNull();
    expect(screen.queryByTitle(/Archiver ce client/)).toBeNull();
    expect(screen.queryByTitle(/Supprimer ce client/)).toBeNull();
    expect(screen.queryByText('Créer le client')).toBeNull();
    expect(screen.queryByText('Enregistrer les modifications')).toBeNull();
  });
});

describe('Clients desktop — non-régression (1200px)', () => {
  it('Nouveau client + Modifier présents ; formulaire ouvrable', () => {
    setLargeur(1200);
    renderClients({ consultationMobile: false });
    expect(screen.getByText(/Nouveau client/)).toBeInTheDocument();
    expect(screen.getByText('Modifier')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Nouveau client/));
    expect(screen.getByText('Créer le client')).toBeInTheDocument();
  });
});

describe('Employés mobile — lecture seule (375px)', () => {
  it('carte consultable + lien nav gardé ; aucun bouton d\'écriture', () => {
    setLargeur(375);
    renderEmployes({ consultationMobile: true });
    expect(screen.getByText('Müller')).toBeInTheDocument();
    expect(screen.getAllByText(/Chantiers/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Nouvel employé/)).toBeNull();
    expect(screen.queryByText('Désactiver')).toBeNull();
    expect(screen.queryByText('Réactiver')).toBeNull();
    expect(screen.queryByText('Sauvegarder')).toBeNull();
  });

  it('onglet Performance reste accessible (lecture)', () => {
    setLargeur(375);
    renderEmployes({ consultationMobile: true });
    expect(screen.getByRole('button', { name: /Performance/ })).toBeInTheDocument();
  });
});

describe('Employés desktop — non-régression (1200px)', () => {
  it('Nouvel employé + Désactiver présents ; formulaire ouvrable', () => {
    setLargeur(1200);
    renderEmployes({ consultationMobile: false });
    expect(screen.getByText(/Nouvel employé/)).toBeInTheDocument();
    expect(screen.getByText('Désactiver')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Nouvel employé/));
    expect(screen.getByText('Sauvegarder')).toBeInTheDocument();
  });
});
