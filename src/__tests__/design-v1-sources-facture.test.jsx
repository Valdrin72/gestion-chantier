/**
 * Design v1 — sources de design, LOT B (dernier) : statut « Facturé » dé-violeté.
 * ⚠ ÉTAT MÉTIER TRANSVERSE. ZÉRO logique touchée : le statut « Facturé », sa signification,
 *   les transitions, les montants — inchangés. Diff = la paire de couleurs du badge dans ds.js.
 *   #ede9fe/#5b21b6 (violet) → #E3EEF7/#2C6FB0 (bleu moyen), aligné sur Kanban/Paramètres.
 *
 * Preuve (non-régression FORTE, transverse) :
 *   1. unitaire : badgeStatut('Facturé') ET badgeStatut('facturé') = nouvelle paire, plus de
 *      violet, distincte de « En cours » (bleu foncé) ;
 *   2. RTL ChantiersListe : un chantier « Facturé » → badge en bleu moyen (couleur exacte) ;
 *   3. RTL DevisPage : un devis « Facturé » → badge en bleu moyen.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { badgeStatut } from '../ds';
import ChantiersListe from '../components/chantiers/ChantiersListe';
import DevisPage from '../pages/DevisPage';

vi.mock('../AssistantDevisIA', () => ({ default: () => null }));
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

const BLEU_MOYEN_TXT = 'rgb(44, 111, 176)';    // #2C6FB0
const BLEU_MOYEN_BG  = 'rgb(227, 238, 247)';   // #E3EEF7
const VIOLET_TXT     = 'rgb(91, 33, 182)';     // #5b21b6 (ex)

describe('UNITAIRE — badgeStatut(«Facturé») = paire bleu moyen (plus de violet)', () => {
  it('les deux casses renvoient la nouvelle paire et aucune couleur violette', () => {
    expect(badgeStatut('Facturé')).toEqual({ bg: '#E3EEF7', color: '#2C6FB0' });
    expect(badgeStatut('facturé')).toEqual({ bg: '#E3EEF7', color: '#2C6FB0' });
    // Plus aucun violet
    expect(badgeStatut('Facturé').color).not.toBe('#5b21b6');
    expect(badgeStatut('Facturé').bg).not.toBe('#ede9fe');
    // Reste distinct du bleu foncé « En cours »
    expect(badgeStatut('Facturé').color).not.toBe(badgeStatut('En cours').color);
    expect(badgeStatut('Facturé').bg).not.toBe(badgeStatut('En cours').bg);
  });
});

// ── RTL ChantiersListe ──────────────────────────────────────────────────────
const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const DEVIS_CH = [{ id: 'd1', numero: 'D-1', montantHT: 80000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];
const CLIENTS_CH = [{ id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' }];
const CH_FACTURE = {
  id: 'CHF', nom: 'Bureaux Grand-Pré', numero: 'C-001', ville: 'Genève',
  statut: 'Facturé', clientId: 'cl1', devisId: 'd1', nombreJours: 20, dateDebut: '2026-07-01', journal: [], extras: [],
};

function renderListe() {
  const chantiers = [CH_FACTURE];
  const ctx = {
    chantiers, clients: CLIENTS_CH, devis: DEVIS_CH, factures: [], pointages: [],
    parametres: { employes: [EMP], localites: [], parametres: { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 } },
    naviguer: vi.fn(), afficherNotif: vi.fn(), confirmer: vi.fn().mockResolvedValue(true),
    agentState: {}, periodeGlobale: 'annee', contexte: {}, ouvrirMenu: vi.fn(), setPeriodeGlobale: vi.fn(),
  };
  return renderWithApp(
    <ChantiersListe chantiersFiltres={chantiers} chantiersArchives={[]} joursParChantier={{ CHF: 5 }}
      filtre="Tous" setFiltre={vi.fn()} onSelect={vi.fn()}
      onModifier={vi.fn()} onSupprimer={vi.fn()} onArchiver={vi.fn()} onRestaurer={vi.fn()} formSlot={null} />,
    ctx,
  );
}

describe('RTL ChantiersListe — badge « Facturé » en bleu moyen', () => {
  it('le badge FACTURÉ est rendu en bleu moyen (texte + fond), plus en violet', () => {
    renderListe();
    // Badge rendu en majuscules via CSS ; le DOM garde le libellé "FACTURÉ".
    const badges = screen.getAllByText('FACTURÉ');
    expect(badges.length).toBeGreaterThanOrEqual(1);
    const badge = badges[0];
    expect(badge.style.color).toBe(BLEU_MOYEN_TXT);
    expect(badge.style.background).toBe(BLEU_MOYEN_BG);
    expect(badge.style.color).not.toBe(VIOLET_TXT);
  });
});

// ── RTL DevisPage ───────────────────────────────────────────────────────────
const CLIENT_D = { id: 1, prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA' };
const DEVIS_FACTURE = {
  id: 'df', numero: 'DEV-2026-009', clientId: 1, statut: 'Facturé',
  montantHT: '40000', date: '2026-03-01', avenants: [], heuresRegie: [], typesTravaux: ['Cloisons'],
};

function renderDevis() {
  return renderWithApp(<DevisPage />, {
    clients: [CLIENT_D], devis: [DEVIS_FACTURE], chantiers: [], factures: [],
    parametres: { employes: [], typesTravaux: [{ id: 1, nom: 'Cloisons' }] },
    periodeGlobale: 'annee',
    setDevis: vi.fn(), setChantiers: vi.fn(), setFactures: vi.fn(),
    confirmer: vi.fn().mockResolvedValue(true), afficherNotif: vi.fn(),
    naviguer: vi.fn(), ouvrirMenu: vi.fn(), setPeriodeGlobale: vi.fn(),
  });
}

describe('RTL DevisPage — badge « Facturé » en bleu moyen', () => {
  it('le badge de statut du devis « Facturé » est rendu en bleu moyen', () => {
    renderDevis();
    // text-transform:uppercase est visuel — le DOM garde "Facturé".
    const badge = screen.getByText('Facturé');
    expect(badge.style.color).toBe(BLEU_MOYEN_TXT);
    expect(badge.style.background).toBe(BLEU_MOYEN_BG);
  });
});
