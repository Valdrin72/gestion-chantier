/**
 * Mode consultation mobile — LOT 3 : Devis en lecture seule (option C : la LISTE seule).
 * Preuve RÉELLE (vrai composant Devis).
 *  • mobile : aucun bouton d'écriture/export (Nouveau devis, CSV, Modifier, Archiver, Supprimer,
 *    Créer le chantier, Créer la facture, export PDF) ; colonne « Actions » retirée ; le formulaire
 *    est INATTEIGNABLE (même via contexte.ouvrirNouveau) ; la liste garde ses colonnes ;
 *  • desktop : tous les boutons présents + formulaire ouvrable (PC inchangé).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) } }));
vi.mock('../ExportPDF', () => ({ exportDevis: vi.fn(), exportFicheChantier: vi.fn(), exportFacture: vi.fn() }));
vi.mock('../utils/exportCSV', () => ({ exportCSV: vi.fn() }));

import Devis from '../pages/DevisPage';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const CLIENTS = [{ id: 'c1', nom: 'Dupont', prenom: 'Marc', entreprise: 'Dupont SA' }];
const DEVIS = { id: 'd1', numero: 'DEV-2026-001', clientId: 'c1', date: '2026-03-01', statut: 'accepté', montantHT: 45000, avenants: [], heuresRegie: [] };

const renderDevis = (over = {}) => renderWithApp(<Devis />, {
  devis: [DEVIS], clients: CLIENTS, chantiers: [], factures: [],
  parametres: { employes: [], typesTravaux: [], parametres: { tauxTVA: 8.1 } },
  periodeGlobale: 'annee', setPeriodeGlobale: vi.fn(), naviguer: vi.fn(),
  confirmer: vi.fn(), afficherNotif: vi.fn(), ouvrirMenu: vi.fn(), ...over,
});

describe('Devis mobile — lecture seule / liste seule (375px, consultationMobile)', () => {
  it('liste consultable, colonnes présentes, colonne « Actions » retirée', () => {
    setLargeur(375);
    renderDevis({ consultationMobile: true });
    expect(screen.getByText('DEV-2026-001')).toBeInTheDocument();
    ['Référence', 'Date', 'Client', 'Chantier lié', 'CA HT', 'Statut'].forEach(col =>
      expect(screen.getByText(col)).toBeInTheDocument());
    expect(screen.queryByText('Actions')).toBeNull();
  });

  it('aucun bouton d\'écriture ni d\'export', () => {
    setLargeur(375);
    renderDevis({ consultationMobile: true });
    expect(screen.queryByText(/Nouveau devis/)).toBeNull();
    expect(screen.queryByLabelText('Exporter CSV')).toBeNull();
    expect(screen.queryByText('Créer le chantier')).toBeNull();
    expect(screen.queryByText(/Créer la facture/)).toBeNull();
    ['Modifier', 'Archiver', 'Supprimer', 'Exporter en PDF'].forEach(t =>
      expect(screen.queryByTitle(t)).toBeNull());
  });

  it('formulaire INATTEIGNABLE même via contexte.ouvrirNouveau', () => {
    setLargeur(375);
    renderDevis({ consultationMobile: true, contexte: { ouvrirNouveau: true } });
    expect(screen.queryByText('Sauvegarder')).toBeNull();
    expect(screen.queryByText('+ Ajouter un avenant')).toBeNull();
  });
});

describe('Devis desktop — non-régression (1200px)', () => {
  it('Nouveau devis + Modifier + colonne Actions présents', () => {
    setLargeur(1200);
    renderDevis({ consultationMobile: false });
    expect(screen.getAllByText(/Nouveau devis/).length).toBeGreaterThan(0);
    expect(screen.getByTitle('Modifier')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('formulaire ouvrable via contexte.ouvrirNouveau', () => {
    setLargeur(1200);
    renderDevis({ consultationMobile: false, contexte: { ouvrirNouveau: true } });
    expect(screen.getByText('Sauvegarder')).toBeInTheDocument();
  });
});
