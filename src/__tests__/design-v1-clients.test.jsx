/**
 * Design v1 — page CLIENTS (liste cartes + formulaire). Maquette validée patron.
 * Rhabillage + 2 suppressions demandées (boutons Exporter CSV / Importer CSV).
 * ZÉRO logique métier touchée.
 *
 * Preuve RTL RÉELLE (vrai composant Clients rendu via renderWithApp, aucun logic-mirror) :
 *   1. le hero affiche les 4 chiffres aux vraies valeurs (Total / CA / Avec chantier / Entreprises) ;
 *   2. les cartes listent les vrais clients avec type + CA + badge impayé ;
 *   3. les 2 boutons CSV (Exporter / Importer) sont ABSENTS ;
 *   4. « Nouveau client » ouvre le formulaire ; créer un client appelle setClients ;
 *   5. les actions Chantiers / Devis naviguent.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Clients from '../pages/ClientsPage';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 80000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];
const CH = { id: 'CH1', nom: 'Bureaux', numero: 'C-001', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 20, dateDebut: '2026-07-01', journal: [], extras: [] };
// Facture en retard rattachée au chantier de cl1 → badge impayé sur la carte de cl1.
const FACT = { id: 'F1', numero: 'FAC-1', chantierId: 'CH1', clientId: 'cl1', statut: 'retard', montantTTC: 30000, montantPaye: 0, dateEcheance: '2020-01-01' };

const CLIENT_ENT = { id: 'cl1', prenom: 'Marc', nom: 'Dupont', entreprise: 'Dupont SA', type: 'Entreprise', ville: 'Genève', telephone: '022 000 00 00' };
const CLIENT_PART = { id: 'cl2', prenom: 'Julie', nom: 'Martin', entreprise: '', type: 'Particulier', ville: 'Nyon' };

function renderClients(over = {}) {
  const setClients = over.setClients || vi.fn();
  const naviguer = over.naviguer || vi.fn();
  return renderWithApp(
    <Clients
      clients={over.clients || [CLIENT_ENT, CLIENT_PART]} setClients={setClients}
      chantiers={over.chantiers || [CH]} devis={DEVIS} factures={over.factures || [FACT]}
      naviguer={naviguer} />,
    { confirmer: vi.fn().mockResolvedValue(true), afficherNotif: vi.fn(), ouvrirMenu: over.ouvrirMenu || vi.fn() },
  );
}

describe('HERO — 4 chiffres + ☰ + suppression des boutons CSV', () => {
  it('affiche les 4 chiffres aux vraies valeurs (Total 2, CA 80\'000, Avec chantier 1, Entreprises 1)', () => {
    renderClients();
    const chiffres = screen.getByTestId('hero-chiffres');
    expect(within(chiffres).getByText('TOTAL CLIENTS')).toBeInTheDocument();
    expect(within(chiffres).getByText('CA TOTAL')).toBeInTheDocument();
    expect(within(chiffres).getByText('AVEC CHANTIER')).toBeInTheDocument();
    expect(within(chiffres).getByText('ENTREPRISES')).toBeInTheDocument();
    expect(within(screen.getByTestId('hero-kpi-total-clients')).getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('hero-kpi-ca-total').textContent).toMatch(/80\D?000/);
    expect(within(screen.getByTestId('hero-kpi-avec-chantier')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('hero-kpi-entreprises')).getByText('1')).toBeInTheDocument();
  });

  it('les 2 boutons CSV (Exporter / Importer) sont ABSENTS', () => {
    renderClients();
    expect(screen.queryByRole('button', { name: /Exporter CSV/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Importer CSV/i })).toBeNull();
  });

  it('le bouton ☰ du hero appelle ouvrirMenu', () => {
    const ouvrirMenu = vi.fn();
    renderClients({ ouvrirMenu });
    fireEvent.click(within(screen.getByTestId('hero-clients')).getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });
});

describe('CARTES — vrais clients + type + CA + badge impayé', () => {
  it('liste les clients avec leur nom, type et CA', () => {
    renderClients();
    expect(screen.getByText('Marc Dupont')).toBeInTheDocument();
    expect(screen.getByText('Julie Martin')).toBeInTheDocument();
    // Badge type (dans la carte — « Entreprise » apparaît aussi dans le hero ? non : hero dit ENTREPRISES)
    expect(screen.getByText('Entreprise')).toBeInTheDocument();
    expect(screen.getByText('Particulier')).toBeInTheDocument();
    // CA total du client entreprise
    expect(screen.getAllByText(/80'000|80\s?000/).length).toBeGreaterThan(0);
  });

  it('affiche le badge impayé sur le client concerné', () => {
    renderClients();
    // Facture en retard 30'000 → badge « 1 IMPAYÉE · CHF 30'000 »
    expect(screen.getByText(/1 IMPAYÉE · CHF/)).toBeInTheDocument();
  });

  it('les initiales colorées (« MD », « JM ») ont été retirées', () => {
    renderClients();
    expect(screen.queryByText('MD')).toBeNull();
    expect(screen.queryByText('JM')).toBeNull();
  });
});

describe('FORMULAIRE + navigation', () => {
  it('« Nouveau client » ouvre le formulaire ; créer un client appelle setClients', () => {
    const setClients = vi.fn();
    renderClients({ setClients });
    fireEvent.click(within(screen.getByTestId('hero-clients')).getByRole('button', { name: /Nouveau client/i }));
    expect(screen.getByText(/Créer le client/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Marc'), { target: { value: 'Anna' } });
    fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'Rossi' } });
    fireEvent.click(screen.getByText(/Créer le client/i));
    expect(setClients).toHaveBeenCalledOnce();
    const saved = setClients.mock.calls[0][0];
    expect(saved.some(c => c.nom === 'Rossi' && c.prenom === 'Anna')).toBe(true);
  });

  it('les actions Chantiers / Devis naviguent avec le clientActif', () => {
    const naviguer = vi.fn();
    renderClients({ naviguer });
    fireEvent.click(screen.getByRole('button', { name: /Chantiers \(1\)/i }));
    expect(naviguer).toHaveBeenCalledWith('chantiers', { clientActif: 'cl1' });
    fireEvent.click(screen.getAllByRole('button', { name: /Devis/i })[0]);
    expect(naviguer).toHaveBeenCalledWith('devis', { clientActif: 'cl1' });
  });
});
