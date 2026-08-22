/**
 * Design v1 — dé-violetisation résiduelle, LOT 3/5 : encarts décoratifs
 * de DevisPage (Surface / Avenants) et FinancesPage (Extras à facturer / KPI Montant moyen).
 * ⚠ ZÉRO logique métier touchée : surface, avenants (montants qui s'ajoutent au CA),
 *   extras à facturer, montant moyen — inchangés. Diff = couleurs (violet → bleu clair v1).
 *
 * Preuve RTL RÉELLE (vrais composants via renderWithApp) :
 *   1. DevisPage : le formulaire « Nouveau devis » affiche les encarts Surface et Avenants,
 *      dont les libellés ex-violets sont désormais en V1.bleu ;
 *   2. FinancesPage : le KPI « Montant moyen par facture » (ex-violet) est en V1.bleu.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import DevisPage from '../pages/DevisPage';
import Finances from '../pages/FinancesPage';

vi.mock('../ExportPDF', () => ({ exportDevis: vi.fn(), exportFacture: vi.fn(), exportFicheChantier: vi.fn() }));
vi.mock('../utils/exportCSV', () => ({ exportCSV: vi.fn() }));
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

const BLEU   = 'rgb(30, 95, 175)';    // #1E5FAF = V1.bleu
const VIOLET = 'rgb(139, 92, 246)';   // #8b5cf6

// ── DevisPage ───────────────────────────────────────────────────────────────
const CLIENT_D = { id: 1, prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA' };

function renderDevis() {
  return renderWithApp(<DevisPage />, {
    clients: [CLIENT_D], devis: [], chantiers: [], factures: [],
    parametres: { employes: [], typesTravaux: [{ id: 1, nom: 'Cloisons' }] },
    periodeGlobale: 'annee',
    setDevis: vi.fn(), setChantiers: vi.fn(), setFactures: vi.fn(),
    confirmer: vi.fn().mockResolvedValue(true), afficherNotif: vi.fn(),
    naviguer: vi.fn(), ouvrirMenu: vi.fn(), setPeriodeGlobale: vi.fn(),
  });
}

describe('DEVISPAGE — encarts Surface / Avenants en bleu v1', () => {
  it('le formulaire affiche les libellés Surface et Avenants ex-violets, désormais en V1.bleu', () => {
    renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/ }));
    const surface = screen.getByText('Surface (m²)');
    expect(surface.style.color).toBe(BLEU);
    expect(surface.style.color).not.toBe(VIOLET);
    const avenants = screen.getByText('Avenants (travaux supplémentaires)');
    expect(avenants.style.color).toBe(BLEU);
    expect(avenants.style.color).not.toBe(VIOLET);
  });
});

// ── FinancesPage ────────────────────────────────────────────────────────────
const CLIENT_F = { id: 'cl1', prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA' };
const DEVIS_F = { id: 'd1', numero: 'D-1', chantierId: 'CH1', clientId: 'cl1', statut: 'accepté', montantHT: 40000, avenants: [], lignes: [] };
const CHANTIER_F = { id: 'CH1', nom: 'Rénovation Dupont', numero: 'C-001', statut: 'en cours', clientId: 'cl1', devisId: 'd1', avancement: 50, extras: [] };
const FACT_PAYEE = {
  id: 'F2', numero: 'FAC-2026-002', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1',
  statut: 'payee', type: 'situation', montantHT: 4630, montantTTC: 5000, montantPaye: 5000,
  dateEmission: '2026-04-01', dateEcheance: '2026-05-01', paiementsHistorique: [{ id: 'p1', montant: 5000, date: '2026-04-15' }],
};

function renderFinances() {
  return renderWithApp(
    <Finances factures={[FACT_PAYEE]} onSave={vi.fn()} clients={[CLIENT_F]} chantiers={[CHANTIER_F]} devis={[DEVIS_F]}
      naviguer={vi.fn()} contexte={{}} profil={{ id: 'cyna', pages: ['finances'] }}
      periodeGlobale="annee" parametres={{ employes: [] }} pointages={[]} />,
    { afficherNotif: vi.fn(), confirmer: vi.fn().mockResolvedValue(true), ouvrirMenu: vi.fn(), setPeriodeGlobale: vi.fn() },
  );
}

describe('FINANCESPAGE — KPI « Montant moyen par facture » en bleu v1', () => {
  it('l\'icône du KPI Montant moyen (ex-violet) est en V1.bleu', () => {
    renderFinances();
    // Remonter du libellé jusqu'à la tuile qui contient l'icône svg.
    let node = screen.getByText('Montant moyen par facture');
    while (node && !(node.querySelector && node.querySelector('svg'))) node = node.parentElement;
    const svg = node.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.style.color).toBe(BLEU);
    expect(svg.style.color).not.toBe(VIOLET);
  });
});
