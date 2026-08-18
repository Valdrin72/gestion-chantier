/**
 * Design v1 — dé-violetisation résiduelle, LOT 2/5 : statuts & identités.
 * ⚠ ZÉRO logique métier touchée : statut « Brouillon », type d'entité « facture »,
 *   montants, résultats de recherche — inchangés. Diff = couleurs.
 *   Factures « Brouillon » : violet → gris (aligné DS.statuts['Brouillon'] #f1f5f9/#475569).
 *   GlobalSearch entité « facture » : violet → V1.bleuMoyen #4C8FD1 (aligné statut Facturé).
 *
 * Preuve RTL RÉELLE (vrais composants via renderWithApp) :
 *   1. Factures : le badge « Brouillon » est en gris (couleur + fond exacts), plus en violet ;
 *   2. GlobalSearch : un résultat « facture » a l'icône en bleu moyen, plus en violet.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Factures from '../Factures';
import GlobalSearch from '../components/GlobalSearch';

vi.mock('../utils/exportCSV', () => ({ exportCSV: vi.fn() }));
vi.mock('../ExportPDF', () => ({ exportFacture: vi.fn(), exportFicheChantier: vi.fn() }));
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

const GRIS_TXT   = 'rgb(71, 85, 105)';    // #475569
const GRIS_BG    = 'rgb(241, 245, 249)';  // #f1f5f9
const BLEU_MOYEN = 'rgb(76, 143, 209)';   // #4C8FD1
const VIOLET     = 'rgb(139, 92, 246)';   // #8b5cf6

// ── Factures ────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);
const IN_30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const CLIENT = { id: '1', prenom: 'Alice', nom: 'Dupont', entreprise: 'Dupont SA' };
const CHANTIER = { id: 'CH1', nom: 'Chantier Test', numero: 'C-001', statut: 'en cours', clientId: '1', devisId: 'D1' };
const DEVIS = { id: 'D1', numero: 'D-2026-001', chantierId: 'CH1', montantHT: 20000, statut: 'accepté' };
const FACTURE_BROUILLON = {
  id: 'F2', numero: 'F-2026-002', clientId: '1', chantierId: 'CH1', devisId: 'D1',
  statut: 'brouillon', type: 'standard', source: 'manuel',
  montantHT: 2000, montantTVA: 162, montantTTC: 2162, montantPaye: 0,
  dateEmission: TODAY, dateEcheance: IN_30,
  lignes: [{ description: 'Travaux divers', quantite: 2, prixUnitaire: 1000, tva: 8.1 }],
  paiementsHistorique: [], rappels: [],
};

function renderFactures() {
  return renderWithApp(
    <Factures factures={[FACTURE_BROUILLON]} onSave={vi.fn()} clients={[CLIENT]} chantiers={[CHANTIER]}
      devis={[DEVIS]} paiementsData={{}} setPaiementsData={vi.fn()} naviguer={vi.fn()}
      profil={{ id: 'cyna' }} periodeGlobale="annee" parametres={{ employes: [] }}
      preRemplir={null} onConsumePreRemplir={vi.fn()} />,
    {},
  );
}

describe('FACTURES — badge « Brouillon » en gris (aligné DS.statuts)', () => {
  it('le badge de statut Brouillon est gris (texte + fond), plus en violet', () => {
    renderFactures();
    const brouillons = screen.getAllByText('Brouillon');
    // Le badge de statut = celui coloré en gris #475569.
    const badge = brouillons.find(el => el.style.color === GRIS_TXT);
    expect(badge).toBeTruthy();
    expect(badge.style.background).toBe(GRIS_BG);
    // Aucun « Brouillon » n'est violet.
    brouillons.forEach(el => expect(el.style.color).not.toBe(VIOLET));
  });
});

// ── GlobalSearch ────────────────────────────────────────────────────────────
const FACTURE_SEARCH = { id: 'FS1', numero: 'FAC-ROUGE-777', clientId: '1', chantierId: 'CH1', statut: 'brouillon', objet: 'Test' };

function renderSearch() {
  return renderWithApp(<GlobalSearch naviguer={vi.fn()} />, {
    chantiers: [], clients: [], devis: [], factures: [FACTURE_SEARCH],
  });
}

describe('GLOBALSEARCH — entité « facture » en bleu moyen', () => {
  it('un résultat facture affiche son icône en bleu moyen, plus en violet', () => {
    renderSearch();
    // Ouvrir la recherche (bouton déclencheur), puis taper le numéro de facture.
    fireEvent.click(screen.getByTitle('Recherche globale (Ctrl+K)'));
    fireEvent.change(screen.getByPlaceholderText(/Rechercher un chantier/), { target: { value: 'FAC-ROUGE' } });
    const label = screen.getByText('FAC-ROUGE-777');
    const bouton = label.closest('button');
    const svg = bouton.querySelector('svg');   // icône DollarSign, style color = couleur entité
    expect(svg).toBeTruthy();
    expect(svg.style.color).toBe(BLEU_MOYEN);
    expect(svg.style.color).not.toBe(VIOLET);
  });
});
