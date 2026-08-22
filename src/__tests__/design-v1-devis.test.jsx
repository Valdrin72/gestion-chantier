/**
 * Design v1 — page DEVIS (liste + formulaire). Maquette validée patron :
 * hero bleu nuit (4 chiffres) + tableau v1 pour la liste, formulaire épuré v1.
 * Rhabillage pur : aucune logique métier touchée.
 *
 * Preuve RTL RÉELLE (vrai composant DevisPage rendu via renderWithApp, aucun
 * logic-mirror) :
 *   1. le hero affiche les 4 chiffres aux vraies valeurs (CA signé / taux / en attente / délai) ;
 *   2. la liste affiche les vrais devis avec leur statut ;
 *   3. le filtre par statut filtre ;
 *   4. le badge « chantier lié » navigue vers le chantier ;
 *   5. « Créer la facture » présent sur un devis accepté ;
 *   6. « Nouveau devis » ouvre le formulaire (bouton Sauvegarder) ; ☰ ouvre le drawer.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import DevisPage from '../pages/DevisPage';

vi.mock('../ExportPDF', () => ({ exportDevis: vi.fn() }));
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

const CLIENT = { id: 1, prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA' };
const CHANTIER_LIE = { id: 'ch1', devisId: 'da', numero: 'CH-2026-001', nom: 'Rénovation Dupont', clientId: 1, statut: 'en cours' };
const DEVIS_ACCEPTE = {
  id: 'da', numero: 'DEV-2026-001', clientId: 1, statut: 'accepté',
  montantHT: '40000', date: '2026-03-01', avenants: [], heuresRegie: [], typesTravaux: ['Cloisons vitrées'],
};
const DEVIS_ENVOYE = {
  id: 'de', numero: 'DEV-2026-002', clientId: 1, statut: 'envoyé',
  montantHT: '20000', date: '2026-06-01', avenants: [], heuresRegie: [],
};

function renderDevis(over = {}) {
  return renderWithApp(
    <DevisPage />,
    {
      clients: [CLIENT], devis: over.devis || [DEVIS_ACCEPTE, DEVIS_ENVOYE],
      chantiers: over.chantiers || [CHANTIER_LIE], factures: over.factures || [],
      parametres: { employes: [], typesTravaux: [{ id: 1, nom: 'Cloisons vitrées' }] },
      periodeGlobale: 'annee',
      setDevis: vi.fn(), setChantiers: vi.fn(), setFactures: vi.fn(),
      confirmer: vi.fn().mockResolvedValue(true), afficherNotif: vi.fn(),
      naviguer: over.naviguer || vi.fn(), ouvrirMenu: over.ouvrirMenu || vi.fn(),
      setPeriodeGlobale: over.setPeriodeGlobale || vi.fn(),
    },
  );
}

describe('HERO — 4 chiffres aux vraies valeurs', () => {
  it('CA signé (40\'000), Taux d\'acceptation (50%), En attente réponse (1)', () => {
    renderDevis();
    const chiffres = screen.getByTestId('hero-chiffres');
    expect(within(chiffres).getByText('CA SIGNÉ')).toBeInTheDocument();
    expect(within(chiffres).getByText("TAUX D'ACCEPTATION")).toBeInTheDocument();
    // « en cours » : ces 2 KPI sont l'état COURANT du pipeline (hors période) — libellé explicite (lot 2 périodes).
    expect(within(chiffres).getByText('EN ATTENTE · EN COURS')).toBeInTheDocument();
    expect(within(chiffres).getByText('DÉLAI MOYEN · EN COURS')).toBeInTheDocument();
    // CA signé = Σ montantHT des acceptés de la période = 40'000 (via caSigneDevisDansPeriode, valeur inchangée)
    expect(screen.getByTestId('hero-kpi-ca-signé').textContent).toMatch(/40\D?000/);
    // 1 accepté / 2 devis = 50%
    expect(screen.getByTestId("hero-kpi-taux-d-acceptation").textContent).toMatch(/50%/);
    // 1 devis envoyé en attente
    expect(within(screen.getByTestId('hero-kpi-en-attente-en-cours')).getByText('1')).toBeInTheDocument();
  });

  it('le titre « Devis » et le bouton ☰ (drawer) sont dans le hero', () => {
    const ouvrirMenu = vi.fn();
    renderDevis({ ouvrirMenu });
    const hero = screen.getByTestId('hero-devis');
    expect(within(hero).getByRole('heading', { name: 'Devis' })).toBeInTheDocument();
    fireEvent.click(within(hero).getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });
});

describe('LISTE — vrais devis + statut + filtre', () => {
  it('affiche les 2 devis avec leur statut', () => {
    renderDevis();
    expect(screen.getByText('DEV-2026-001')).toBeInTheDocument();
    expect(screen.getByText('DEV-2026-002')).toBeInTheDocument();
    // Badges de statut (texte « accepté »/« envoyé » — présent aussi dans les pastilles
    // de filtre, d'où getAll ; au moins la ligne + le filtre).
    expect(screen.getAllByText('accepté').length).toBeGreaterThan(0);
    expect(screen.getAllByText('envoyé').length).toBeGreaterThan(0);
  });

  it('le filtre « accepté » ne garde que le devis accepté', () => {
    renderDevis();
    fireEvent.click(screen.getByRole('button', { name: 'accepté' }));
    expect(screen.getByText('DEV-2026-001')).toBeInTheDocument();
    expect(screen.queryByText('DEV-2026-002')).toBeNull();
  });

  it('le filtre actif est mis en avant (fond bleu CYNA)', () => {
    renderDevis();
    fireEvent.click(screen.getByRole('button', { name: 'accepté' }));
    const actif = screen.getByRole('button', { name: 'accepté' });
    expect(actif.style.background).toBe('rgb(30, 95, 175)'); // V1.bleu #1E5FAF
  });
});

describe('TABLEAU — badge chantier lié + Créer la facture', () => {
  it('le badge « chantier lié » navigue vers le chantier', () => {
    const naviguer = vi.fn();
    renderDevis({ naviguer });
    fireEvent.click(screen.getByText(/CH-2026-001/));
    expect(naviguer).toHaveBeenCalledWith('chantiers', { chantierActif: 'ch1' });
  });

  it('« Créer la facture » est présent sur un devis accepté sans facture', () => {
    renderDevis();
    expect(screen.getByRole('button', { name: /Créer la facture/i })).toBeInTheDocument();
  });
});

describe('FORMULAIRE — ouverture depuis le hero', () => {
  it('« Nouveau devis » ouvre le formulaire (bouton Sauvegarder visible)', () => {
    renderDevis();
    fireEvent.click(within(screen.getByTestId('hero-devis')).getByRole('button', { name: /Nouveau devis/i }));
    expect(screen.getByRole('button', { name: /Sauvegarder/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Annuler$/i })).toBeInTheDocument();
  });
});
