/**
 * Mode consultation mobile — LOT 1 : Chantiers en lecture seule (mobile).
 * Preuve RÉELLE (vrai composant Chantiers = liste + fiche via ChantierDetail).
 *  • mobile : plus de Modifier/Supprimer/Archiver/CSV (liste) ni Modifier/Supprimer/
 *    Passer en cours/Travaux terminés (fiche) ; la fiche s'ouvre en lecture ;
 *    ⭐ « Saisir heures » présent ET fonctionnel (ouvre la saisie) ; Retour + Finances gardés ;
 *  • desktop : tous les boutons présents (PC inchangé).
 * Échoue si un bouton d'écriture réapparaît en mobile.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) } }));
vi.mock('../ExportPDF', () => ({ exportDevis: vi.fn(), exportFicheChantier: vi.fn(), exportFacture: vi.fn() }));
vi.mock('../utils/exportCSV', () => ({ exportCSV: vi.fn() }));

import Chantiers from '../pages/ChantiersPage';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const CLIENT = { id: 'cl1', nom: 'Dupont', prenom: 'Marc', entreprise: 'Dupont SA' };
const DEVIS = { id: 'd1', numero: 'DEV-2026-001', montantHT: 45000, statut: 'accepté' };
const CHANTIER = {
  id: 1, numero: 'CH-2026-001', nom: 'Chantier Test', clientId: 'cl1', devisId: 'd1',
  statut: 'En cours', surface: 100, dateDebut: '2026-01-01', nombreJours: 10, avancement: 20,
  equipe: [], employes: [], journal: [], avenants: [], imprevus: [], extras: [],
};

const baseCtx = (over = {}) => ({
  chantiers: [CHANTIER], clients: [CLIENT], devis: [DEVIS], factures: [], pointages: [],
  parametres: { employes: [], parametres: { coefficientMainOeuvre: 1.35, tauxTVA: 8.1 } },
  agentState: {}, periodeGlobale: 'annee', setPeriodeGlobale: vi.fn(),
  naviguer: vi.fn(), confirmer: vi.fn(), afficherNotif: vi.fn(), ...over,
});
const renderChantiers = (over) => renderWithApp(<Chantiers />, baseCtx(over));

describe('Chantiers mobile — lecture seule (375px, consultationMobile)', () => {
  it('LISTE : aucun bouton Modifier/Supprimer/Archiver/CSV, chantier consultable', () => {
    setLargeur(375);
    renderChantiers({ consultationMobile: true });
    expect(screen.getByText('Chantier Test')).toBeInTheDocument();
    expect(screen.queryByTitle('Modifier')).toBeNull();
    expect(screen.queryByTitle('Supprimer')).toBeNull();
    expect(screen.queryByTitle('Archiver')).toBeNull();
    expect(screen.queryByTitle('Voir détail')).toBeNull(); // rangée d'actions masquée
    expect(screen.queryByText('CSV')).toBeNull();
  });

  it('FICHE : lecture seule mais « Saisir heures » présent et fonctionnel', () => {
    setLargeur(375);
    const { ctx } = renderChantiers({ consultationMobile: true, contexte: { chantierActif: 1 } });
    // ouverture en lecture
    expect(screen.getByRole('heading', { name: 'Chantier Test' })).toBeInTheDocument();
    // écritures masquées
    expect(screen.queryByText('Modifier')).toBeNull();
    expect(screen.queryByText('Supprimer')).toBeNull();
    expect(screen.queryByText('Passer en cours')).toBeNull();
    expect(screen.queryByText('Travaux terminés')).toBeNull();
    // gardés
    expect(screen.getByText('Retour')).toBeInTheDocument();
    expect(screen.getByText('Finances')).toBeInTheDocument();
    const saisir = screen.getByText('Saisir heures');
    expect(saisir).toBeInTheDocument();
    fireEvent.click(saisir);
    expect(ctx.ouvrirSaisieHeures).toHaveBeenCalledTimes(1);
  });
});

describe('Chantiers desktop — non-régression (1200px)', () => {
  it('LISTE : boutons Modifier présents (PC inchangé)', () => {
    setLargeur(1200);
    renderChantiers({ consultationMobile: false });
    expect(screen.getAllByTitle('Modifier').length).toBeGreaterThan(0);
  });

  it('FICHE : Modifier et Supprimer présents (PC inchangé)', () => {
    setLargeur(1200);
    renderChantiers({ consultationMobile: false, contexte: { chantierActif: 1 } });
    expect(screen.getByText('Modifier')).toBeInTheDocument();
    expect(screen.getByText('Supprimer')).toBeInTheDocument();
    expect(screen.getByText('Saisir heures')).toBeInTheDocument();
  });
});
