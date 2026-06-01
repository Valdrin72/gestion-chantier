/**
 * Tests Étape 4 régie — facturation standalone d'un extra
 * Règle CLAUDE.md : tests RÉELS (RTL — vrais composants)
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ChantierDetail from '../../components/chantiers/ChantierDetail';
import Factures from '../../Factures';
import { renderWithApp } from '../../test-utils/renderWithApp';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../../AgentEngine', () => ({ default: class { analyser() { return []; } } }));
vi.mock('../../components/chantiers/detail/DetailVelocite',        () => ({ default: () => null }));
vi.mock('../../components/chantiers/detail/DetailProjection',      () => ({ default: () => null }));
vi.mock('../../components/chantiers/detail/DetailRecommandations', () => ({ default: () => null }));
vi.mock('../../components/chantiers/detail/DetailEcarts',          () => ({ default: () => null }));
vi.mock('../../ExportPDF', () => ({ exportFacture: vi.fn(), exportFicheChantier: vi.fn() }));
vi.mock('../../utils/exportCSV', () => ({ exportCSV: vi.fn() }));
vi.mock('../../relances', () => ({
  prochainRappel: vi.fn(() => null),
  niveauInfo: vi.fn(() => ({ couleur: '#f59e0b', label: 'Rappel 1' })),
  genererTexteRappel: vi.fn(() => ({ texte: '', objet: '' })),
  marquerRappelEnvoye: vi.fn(f => f),
}));
vi.mock('../../Paiements', () => ({ default: () => null }));
vi.mock('../../RelancesTab', () => ({ default: () => null }));

// ── Fixtures ─────────────────────────────────────────────────────────────────
const DEVIS = [{ id: 'd1', numero: 'D-2026-001', montantHT: 50000, avenants: [], heuresRegie: [] }];
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', prenom: 'Jean', entreprise: '' }];
const EXTRA_FORFAIT = { id: 'ex1', description: 'Dépose carrelage', mode: 'forfait', montantForfait: '2500', heures: '', tarifHeure: '', employeId: '', factureId: null, dateCreation: '2026-05-29' };
const EXTRA_HEURES  = { id: 'ex2', description: 'Peinture extra',   mode: 'heures',  montantForfait: '', heures: '4', tarifHeure: '90', employeId: '', factureId: null, dateCreation: '2026-05-29' };
const CHANTIER_BASE = { id: 'c1', nom: 'Réno Dupont', devisId: 'd1', clientId: 'cl1', statut: 'En cours', avancement: 60, journal: [], extras: [] };

function renderDetail(chantier, factures = [], naviguer = vi.fn()) {
  return renderWithApp(
    <ChantierDetail
      chantier={chantier}
      detailOnglet="financier"
      setDetailOnglet={vi.fn()}
      modeCompleter={false}
      onRetour={vi.fn()}
      onModifier={vi.fn()}
      onSupprimer={vi.fn()}
      onPasserEnCours={vi.fn()}
    />,
    {
      devis: DEVIS,
      factures,
      clients: CLIENTS,
      parametres: { employes: [] },
      setChantiers: vi.fn(),
      naviguer,
      agentState: {},
    },
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Étape 4 — facturation standalone extra (RTL)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('extra non facturé → bouton "Facturer l\'extra" présent', () => {
    renderDetail({ ...CHANTIER_BASE, extras: [EXTRA_FORFAIT] });
    expect(screen.getByRole('button', { name: /Facturer l'extra/i })).toBeInTheDocument();
  });

  it('clic "Facturer l\'extra" forfait → naviguer("finances") avec preRemplirExtra correct', () => {
    const naviguer = vi.fn();
    renderDetail({ ...CHANTIER_BASE, extras: [EXTRA_FORFAIT] }, [], naviguer);

    fireEvent.click(screen.getByRole('button', { name: /Facturer l'extra/i }));

    expect(naviguer).toHaveBeenCalledOnce();
    const [page, ctx] = naviguer.mock.calls[0];
    expect(page).toBe('finances');
    expect(ctx.preRemplirExtra).toBeDefined();
    expect(ctx.preRemplirExtra.objet).toBe('Extra — Dépose carrelage');
    expect(ctx.preRemplirExtra.extraId).toBe('ex1');
    expect(ctx.preRemplirExtra.type).toBe('standard');
    expect(ctx.preRemplirExtra.chantierId).toBe('c1');
    expect(ctx.preRemplirExtra.lignes[0].quantite).toBe(1);
    expect(ctx.preRemplirExtra.lignes[0].prixUnitaire).toBe(2500);
    expect(ctx.preRemplirExtra.lignes[0].tva).toBe(8.1);
  });

  it('clic "Facturer l\'extra" heures → preRemplirExtra avec quantite=heures, prixUnitaire=tarifHeure', () => {
    const naviguer = vi.fn();
    renderDetail({ ...CHANTIER_BASE, extras: [EXTRA_HEURES] }, [], naviguer);

    fireEvent.click(screen.getByRole('button', { name: /Facturer l'extra/i }));

    const { preRemplirExtra } = naviguer.mock.calls[0][1];
    expect(preRemplirExtra.objet).toBe('Extra — Peinture extra');
    expect(preRemplirExtra.extraId).toBe('ex2');
    expect(preRemplirExtra.lignes[0].quantite).toBe(4);
    expect(preRemplirExtra.lignes[0].prixUnitaire).toBe(90);
  });

  // (a) TEST RÉEL : la facture SAUVEGARDÉE depuis un extra porte extraId
  // Exerce le vrai composant Factures : preRemplir → form ouvert → clic "Enregistrer brouillon" → onSave
  it('(a) facture sauvegardée depuis un extra porte bien facture.extraId === extra.id', async () => {
    const onSave = vi.fn();
    const preRemplir = {
      chantierId: 'c1',
      devisId: 'd1',
      clientId: 'cl1',
      type: 'standard',
      objet: 'Extra — Dépose carrelage',
      extraId: 'ex1',
      lignes: [{ description: 'Dépose carrelage', quantite: 1, prixUnitaire: 2500, tva: 8.1 }],
    };
    renderWithApp(
      <Factures
        clients={CLIENTS}
        chantiers={[CHANTIER_BASE]}
        devis={DEVIS}
        factures={[]}
        onSave={onSave}
        profil={{ id: 'cyna' }}
        preRemplir={preRemplir}
        onConsumePreRemplir={vi.fn()}
      />,
    );

    // Le formulaire s'ouvre via useEffect sur preRemplir
    const objetInput = await screen.findByDisplayValue('Extra — Dépose carrelage');
    expect(objetInput).toBeInTheDocument();

    // Sauvegarder → appelle onSave avec la facture incluant extraId
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer brouillon/i }));

    expect(onSave).toHaveBeenCalledOnce();
    const factures = onSave.mock.calls[0][0];
    const factureCreee = factures[factures.length - 1];
    expect(factureCreee.extraId).toBe('ex1');
  });

  // (b) Facture liée ANNULÉE → l'extra redevient facturable
  it('(b) facture liée ANNULÉE → l\'extra redevient facturable (bouton revient)', () => {
    const factureAnnulee = {
      id: 'f-ex1', chantierId: 'c1', extraId: 'ex1',
      type: 'standard', statut: 'annulee',
      montantHT: 2500, montantTVA: 202.5, montantTTC: 2702.5,
    };
    renderDetail({ ...CHANTIER_BASE, extras: [EXTRA_FORFAIT] }, [factureAnnulee]);

    expect(screen.getByRole('button', { name: /Facturer l'extra/i })).toBeInTheDocument();
    expect(screen.queryByText('✓ Facturé')).toBeNull();
  });

  it('extra avec facture liée non annulée → badge "Facturé ✓", bouton absent', () => {
    const factureExtra = {
      id: 'f-ex1', chantierId: 'c1', extraId: 'ex1',
      type: 'standard', statut: 'envoyee',
      montantHT: 2500, montantTVA: 202.5, montantTTC: 2702.5,
    };
    renderDetail({ ...CHANTIER_BASE, extras: [EXTRA_FORFAIT] }, [factureExtra]);

    expect(screen.getByText('✓ Facturé')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Facturer l'extra/i })).toBeNull();
  });

  it('deux extras — un facturé, un non — bouton présent seulement sur le non facturé', () => {
    const factureExtra1 = { id: 'f-ex1', chantierId: 'c1', extraId: 'ex1', type: 'standard', statut: 'payee', montantHT: 2500 };
    renderDetail({ ...CHANTIER_BASE, extras: [EXTRA_FORFAIT, EXTRA_HEURES] }, [factureExtra1]);

    expect(screen.getByText('✓ Facturé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Facturer l'extra/i })).toBeInTheDocument();
  });
});

// ── Suppression protégée d'un extra (principe "Rien ne se détruit") ──────────
describe('Étape 4 — suppression protégée d\'un extra', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // Le bouton de suppression d'un extra est le "✕" dans l'en-tête de l'extra.
  // (Le bouton du formulaire de facturation, lui, n'est pas un ✕.)
  const clicSupprExtra = () => {
    const btnSuppr = screen.getAllByRole('button').find(b => b.textContent === '✕');
    expect(btnSuppr).toBeDefined();
    fireEvent.click(btnSuppr);
  };

  it('extra NON facturé → suppression OK après confirmer (setChantiers appelé)', async () => {
    const confirmer = vi.fn().mockResolvedValue(true);
    const setChantiers = vi.fn();
    renderWithApp(
      <ChantierDetail
        chantier={{ ...CHANTIER_BASE, extras: [EXTRA_FORFAIT] }}
        detailOnglet="financier" setDetailOnglet={vi.fn()} modeCompleter={false}
        onRetour={vi.fn()} onModifier={vi.fn()} onSupprimer={vi.fn()} onPasserEnCours={vi.fn()}
      />,
      { devis: DEVIS, factures: [], clients: CLIENTS, parametres: { employes: [] }, setChantiers, naviguer: vi.fn(), agentState: {}, confirmer, afficherNotif: vi.fn() },
    );

    clicSupprExtra();
    await waitFor(() => expect(confirmer).toHaveBeenCalledOnce());
    await waitFor(() => expect(setChantiers).toHaveBeenCalledOnce());
  });

  it('extra FACTURÉ (facture non annulée) → BLOQUÉ : afficherNotif error, pas de setChantiers', async () => {
    const afficherNotif = vi.fn();
    const setChantiers = vi.fn();
    const factureExtra = { id: 'f-ex1', chantierId: 'c1', extraId: 'ex1', type: 'standard', statut: 'envoyee', montantHT: 2500 };
    renderWithApp(
      <ChantierDetail
        chantier={{ ...CHANTIER_BASE, extras: [EXTRA_FORFAIT] }}
        detailOnglet="financier" setDetailOnglet={vi.fn()} modeCompleter={false}
        onRetour={vi.fn()} onModifier={vi.fn()} onSupprimer={vi.fn()} onPasserEnCours={vi.fn()}
      />,
      { devis: DEVIS, factures: [factureExtra], clients: CLIENTS, parametres: { employes: [] }, setChantiers, naviguer: vi.fn(), agentState: {}, confirmer: vi.fn().mockResolvedValue(true), afficherNotif },
    );

    clicSupprExtra();
    await waitFor(() => expect(afficherNotif).toHaveBeenCalledOnce());
    expect(afficherNotif.mock.calls[0][1]).toBe('error');
    expect(setChantiers).not.toHaveBeenCalled();
  });

  it('extra dont la facture est ANNULÉE → redevient supprimable (OK)', async () => {
    const confirmer = vi.fn().mockResolvedValue(true);
    const setChantiers = vi.fn();
    const factureAnnulee = { id: 'f-ex1', chantierId: 'c1', extraId: 'ex1', type: 'standard', statut: 'annulee', montantHT: 2500 };
    renderWithApp(
      <ChantierDetail
        chantier={{ ...CHANTIER_BASE, extras: [EXTRA_FORFAIT] }}
        detailOnglet="financier" setDetailOnglet={vi.fn()} modeCompleter={false}
        onRetour={vi.fn()} onModifier={vi.fn()} onSupprimer={vi.fn()} onPasserEnCours={vi.fn()}
      />,
      { devis: DEVIS, factures: [factureAnnulee], clients: CLIENTS, parametres: { employes: [] }, setChantiers, naviguer: vi.fn(), agentState: {}, confirmer, afficherNotif: vi.fn() },
    );

    clicSupprExtra();
    await waitFor(() => expect(confirmer).toHaveBeenCalledOnce());
    await waitFor(() => expect(setChantiers).toHaveBeenCalledOnce());
  });
});
