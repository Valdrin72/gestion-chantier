/**
 * Tests Étape 5 régie — widget "Extras à facturer" dans Trésorerie
 * Règle CLAUDE.md : tests RÉELS (RTL — vrais composants)
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import Finances from '../../pages/FinancesPage';
import { renderWithApp } from '../../test-utils/renderWithApp';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../../AgentEngine', () => ({ default: class { analyser() { return []; } } }));
vi.mock('../../Paiements', () => ({ default: () => null }));
vi.mock('../../RelancesTab', () => ({ default: () => null }));
vi.mock('../../relances', () => ({
  prochainRappel: vi.fn(() => null),
  niveauInfo: vi.fn(() => ({ couleur: '#f59e0b', label: 'Rappel 1' })),
  genererTexteRappel: vi.fn(() => ({ texte: '', objet: '' })),
  marquerRappelEnvoye: vi.fn(f => f),
}));
vi.mock('../../ExportPDF', () => ({ exportFacture: vi.fn(), exportFicheChantier: vi.fn() }));
vi.mock('../../utils/exportCSV', () => ({ exportCSV: vi.fn() }));

// ── Fixtures ─────────────────────────────────────────────────────────────────
const DEVIS = [{ id: 'd1', numero: 'D-2026-001', montantHT: 50000, avenants: [], heuresRegie: [] }];
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', prenom: 'Jean', entreprise: '' }];

const EXTRA_FORFAIT = {
  id: 'ex1', description: 'Dépose carrelage', mode: 'forfait',
  montantForfait: '2500', heures: '', tarifHeure: '', employeId: '',
  factureId: null, dateCreation: '2026-05-29',
};
const EXTRA_HEURES = {
  id: 'ex2', description: 'Peinture extra', mode: 'heures',
  montantForfait: '', heures: '4', tarifHeure: '90', employeId: '',
  factureId: null, dateCreation: '2026-05-29',
};

const CHANTIER = {
  id: 'c1', nom: 'Réno Dupont', devisId: 'd1', clientId: 'cl1',
  statut: 'En cours', avancement: 60, journal: [], extras: [],
};

function renderFinances(chantiers, factures = []) {
  return renderWithApp(
    <Finances
      clients={CLIENTS}
      chantiers={chantiers}
      devis={DEVIS}
      factures={factures}
      onSave={vi.fn()}
      profil={{ id: 'cyna' }}
      parametres={{ employes: [] }}
      paiementsData={{}}
      setPaiementsData={vi.fn()}
      naviguer={vi.fn()}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Étape 5 — widget "Extras à facturer" (RTL)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('aucun extra → section "Extras à facturer" absente', () => {
    renderFinances([{ ...CHANTIER, extras: [] }]);
    expect(screen.queryByText(/Extras à facturer/i)).toBeNull();
  });

  it('extra non facturé → section visible + description présente', () => {
    renderFinances([{ ...CHANTIER, extras: [EXTRA_FORFAIT] }]);
    expect(screen.getByText(/Extras à facturer/i)).toBeInTheDocument();
    expect(screen.getByText('Dépose carrelage')).toBeInTheDocument();
  });

  it('extra forfait → montant HT correct affiché (CHF 2 500)', () => {
    renderFinances([{ ...CHANTIER, extras: [EXTRA_FORFAIT] }]);
    // "Total HT CHF 2 500" dans le header du widget
    expect(screen.getByText(/Total HT CHF/i)).toBeInTheDocument();
    expect(screen.getAllByText(/2[\s ]?500/).length).toBeGreaterThan(0);
  });

  it('extra heures → montant HT = heures × tarifHeure (4 × 90 = 360)', () => {
    renderFinances([{ ...CHANTIER, extras: [EXTRA_HEURES] }]);
    expect(screen.getAllByText(/360/).length).toBeGreaterThan(0);
  });

  it('extra avec facture liée non annulée → masqué du widget', () => {
    const factureExtra = {
      id: 'f-ex1', chantierId: 'c1', extraId: 'ex1',
      type: 'standard', statut: 'envoyee',
      montantHT: 2500, montantTVA: 202.5, montantTTC: 2702.5,
    };
    renderFinances([{ ...CHANTIER, extras: [EXTRA_FORFAIT] }], [factureExtra]);
    expect(screen.queryByText(/Extras à facturer/i)).toBeNull();
    expect(screen.queryByText('Dépose carrelage')).toBeNull();
  });

  it('facture annulée → extra réapparaît dans le widget', () => {
    const factureAnnulee = {
      id: 'f-ex1', chantierId: 'c1', extraId: 'ex1',
      type: 'standard', statut: 'annulee',
      montantHT: 2500, montantTVA: 202.5, montantTTC: 2702.5,
    };
    renderFinances([{ ...CHANTIER, extras: [EXTRA_FORFAIT] }], [factureAnnulee]);
    expect(screen.getByText(/Extras à facturer/i)).toBeInTheDocument();
    expect(screen.getByText('Dépose carrelage')).toBeInTheDocument();
  });

  it('mix forfait + heures → total HT = 2500 + 360 = 2860', () => {
    renderFinances([{ ...CHANTIER, extras: [EXTRA_FORFAIT, EXTRA_HEURES] }]);
    expect(screen.getAllByText(/2[\s ]?860/).length).toBeGreaterThan(0);
  });

  it('un extra facturé, un non → seul le non-facturé apparaît', () => {
    const factureExtra1 = {
      id: 'f-ex1', chantierId: 'c1', extraId: 'ex1',
      type: 'standard', statut: 'payee', montantHT: 2500,
    };
    renderFinances([{ ...CHANTIER, extras: [EXTRA_FORFAIT, EXTRA_HEURES] }], [factureExtra1]);
    expect(screen.queryByText('Dépose carrelage')).toBeNull();
    expect(screen.getByText('Peinture extra')).toBeInTheDocument();
  });

  it('clic "Facturer →" forfait → ouvre onglet Factures pré-rempli (objet = Extra — Dépose carrelage)', async () => {
    renderFinances([{ ...CHANTIER, extras: [EXTRA_FORFAIT] }]);

    fireEvent.click(screen.getByRole('button', { name: /Facturer →/i }));

    // L'onglet Factures s'ouvre — le formulaire doit être pré-rempli
    const objetInput = await screen.findByDisplayValue('Extra — Dépose carrelage');
    expect(objetInput).toBeInTheDocument();
  });

  it('clic "Facturer →" heures → formulaire pré-rempli avec quantite=4 et prixUnitaire=90', async () => {
    renderFinances([{ ...CHANTIER, extras: [EXTRA_HEURES] }]);

    fireEvent.click(screen.getByRole('button', { name: /Facturer →/i }));

    const objetInput = await screen.findByDisplayValue('Extra — Peinture extra');
    expect(objetInput).toBeInTheDocument();
    // quantite=4 et prixUnitaire=90 sont dans le formulaire Factures
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('90')).toBeInTheDocument();
  });
});
