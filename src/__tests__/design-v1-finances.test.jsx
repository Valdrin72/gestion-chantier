/**
 * Design v1 — page FINANCES (3 onglets : Trésorerie / Factures / Relances).
 * Maquette OPTION v1 validée patron : hero bleu nuit + 4 chiffres qui S'ADAPTENT
 * à l'onglet + 3 onglets collés au bas du hero + tableaux v1.
 *
 * Preuve RTL RÉELLE (aucun mock de Factures/RelancesTab, aucun logic-mirror) :
 * vrai composant Finances rendu via renderWithApp, vrais calculs.
 *   1. le hero affiche les 4 chiffres, qui changent selon l'onglet actif ;
 *   2. bascule Trésorerie ↔ Factures ↔ Relances ;
 *   3. l'onglet Factures liste les vraies factures avec leur statut ; la recherche filtre ;
 *   4. l'onglet Relances affiche le niveau + le bouton « Marquer envoyé » (action conservée) ;
 *   5. le bouton « Nouvelle facture » du hero ouvre le formulaire.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Finances from '../pages/FinancesPage';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })), auth: { getSession: vi.fn() } },
}));

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const CLIENT = { id: 'cl1', prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA', telephone: '022 000 00 00' };
const DEVIS = { id: 'd1', numero: 'D-1', chantierId: 'CH1', clientId: 'cl1', statut: 'accepté', montantHT: 40000, avenants: [], lignes: [] };
const CHANTIER = { id: 'CH1', nom: 'Rénovation Dupont', numero: 'C-001', statut: 'en cours', clientId: 'cl1', devisId: 'd1', avancement: 50, extras: [] };

// Facture émise, échéance dépassée → EN RETARD + déclenche une relance (aucun rappel envoyé).
const FACT_RETARD = {
  id: 'F1', numero: 'FAC-2026-001', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1',
  statut: 'envoyee', type: 'situation', montantHT: 9259, montantTTC: 10000, montantPaye: 0,
  dateEmission: '2026-03-01', dateEcheance: '2020-06-01', rappels: [], paiementsHistorique: [],
};
// Facture payée (autre client-chantier) pour peupler les totaux.
const FACT_PAYEE = {
  id: 'F2', numero: 'FAC-2026-002', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1',
  statut: 'payee', type: 'situation', montantHT: 4630, montantTTC: 5000, montantPaye: 5000,
  dateEmission: '2026-04-01', dateEcheance: '2026-05-01', paiementsHistorique: [{ id: 'p1', montant: 5000, date: '2026-04-15' }],
};

function renderFinances(over = {}) {
  const onSave = over.onSave || vi.fn();
  return renderWithApp(
    <Finances
      factures={over.factures || [FACT_RETARD, FACT_PAYEE]}
      onSave={onSave}
      clients={[CLIENT]} chantiers={[CHANTIER]} devis={[DEVIS]}
      naviguer={vi.fn()} contexte={{}} profil={{ id: 'cyna', pages: ['finances'] }}
      periodeGlobale="annee" parametres={{ employes: [] }} pointages={[]}
    />,
    { afficherNotif: vi.fn(), confirmer: vi.fn().mockResolvedValue(true),
      ouvrirMenu: over.ouvrirMenu || vi.fn(), setPeriodeGlobale: over.setPeriodeGlobale || vi.fn() },
  );
}

describe('HERO — 4 chiffres qui S\'ADAPTENT à l\'onglet actif', () => {
  it('Trésorerie/Factures : Total facturé / Total payé / En attente / En retard', () => {
    renderFinances();
    const chiffres = screen.getByTestId('hero-chiffres');
    expect(within(chiffres).getByText('TOTAL FACTURÉ')).toBeInTheDocument();
    expect(within(chiffres).getByText('TOTAL PAYÉ')).toBeInTheDocument();
    expect(within(chiffres).getByText('EN ATTENTE')).toBeInTheDocument();
    expect(within(chiffres).getByText('EN RETARD')).toBeInTheDocument();
    // Valeur payé = 5'000 (une facture payée) — tolère le formatage locale (apostrophe / espace fine)
    expect(screen.getByTestId('hero-kpi-total-payé').textContent).toMatch(/5\D?000/);
  });

  it('cliquer Relances → le hero bascule sur À relancer / Montant impayé / 1er rappel / Mise en demeure', () => {
    renderFinances();
    fireEvent.click(screen.getByRole('button', { name: /^Relances/i }));
    const chiffres = screen.getByTestId('hero-chiffres');
    expect(within(chiffres).getByText('À RELANCER')).toBeInTheDocument();
    expect(within(chiffres).getByText('MONTANT IMPAYÉ')).toBeInTheDocument();
    expect(within(chiffres).getByText('1ER RAPPEL')).toBeInTheDocument();
    expect(within(chiffres).getByText('MISE EN DEMEURE')).toBeInTheDocument();
    // Les libellés Trésorerie ont disparu
    expect(within(chiffres).queryByText('TOTAL FACTURÉ')).toBeNull();
  });

  it('le bouton ☰ du hero appelle ouvrirMenu', () => {
    const ouvrirMenu = vi.fn();
    renderFinances({ ouvrirMenu });
    fireEvent.click(within(screen.getByTestId('hero-finances')).getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });
});

describe('ONGLETS — bascule Trésorerie / Factures / Relances', () => {
  it('Trésorerie par défaut, puis Factures affiche le tableau des factures', () => {
    renderFinances();
    // Trésorerie : la timeline est visible
    expect(screen.getByText(/Encaissements prévus — 8 semaines/i)).toBeInTheDocument();
    // → Factures : le tableau liste les vraies factures avec leur numéro
    fireEvent.click(screen.getByRole('button', { name: /^Factures/i }));
    expect(screen.getByText('FAC-2026-001')).toBeInTheDocument();
    expect(screen.getByText('FAC-2026-002')).toBeInTheDocument();
  });
});

describe('ONGLET FACTURES — vraies factures + statut + recherche', () => {
  it('affiche le statut (En retard / Payée) et la recherche filtre par numéro', () => {
    renderFinances();
    fireEvent.click(screen.getByRole('button', { name: /^Factures/i }));
    // Statuts affichés en badge (« Payée » apparaît aussi dans le filtre → getAll)
    expect(screen.getAllByText('En retard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Payée').length).toBeGreaterThan(0);
    // Recherche : filtrer sur "002" ne garde que la facture payée
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/i), { target: { value: '002' } });
    expect(screen.queryByText('FAC-2026-001')).toBeNull();
    expect(screen.getByText('FAC-2026-002')).toBeInTheDocument();
  });

  it('le bouton « Nouvelle facture » du hero ouvre le formulaire', () => {
    renderFinances();
    fireEvent.click(within(screen.getByTestId('hero-finances')).getByRole('button', { name: /Nouvelle facture/i }));
    // Le formulaire Factures est ouvert (bouton d'enregistrement présent)
    expect(screen.getByRole('button', { name: /Enregistrer brouillon/i })).toBeInTheDocument();
  });
});

describe('ONGLET RELANCES — niveau + « Marquer envoyé » (action conservée)', () => {
  it('affiche la facture à relancer avec son retard et le bouton « Marquer envoyé »', () => {
    renderFinances();
    fireEvent.click(screen.getByRole('button', { name: /^Relances/i }));
    // La facture en retard apparaît dans le tableau de relances (le tableau Factures reste
    // monté en display:none → getAll ; les boutons ci-dessous sont propres aux relances).
    expect(screen.getAllByText('FAC-2026-001').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Voir lettre/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Marquer envoyé/i })).toBeInTheDocument();
  });

  it('cliquer « Marquer envoyé » persiste via onSave (action inchangée)', () => {
    const onSave = vi.fn();
    renderFinances({ onSave });
    fireEvent.click(screen.getByRole('button', { name: /^Relances/i }));
    fireEvent.click(screen.getByRole('button', { name: /Marquer envoyé/i }));
    expect(onSave).toHaveBeenCalledOnce();
    // La facture F1 est bien celle mise à jour (trace de rappel ajoutée)
    const saved = onSave.mock.calls[0][0];
    expect(saved.find(f => f.id === 'F1')).toBeTruthy();
  });
});
