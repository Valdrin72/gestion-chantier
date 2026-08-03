/**
 * Plan directeur C8 — les TROIS ÉTATS du chantier :
 *   En cours → Travaux terminés/Attente paiement → Terminé (tout encaissé).
 * Un chantier n'est vraiment fini que quand l'argent est rentré.
 * + C9 (jamais jeté), C10 (bilan de clôture), IA1c (directeur relance).
 * Tests RÉELS : vrais composants (ChantierDetail, DirecteurMatin), vraies
 * fonctions (migrerStatutsC8, resteDuChantier, simulerRapportLundi).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { migrerStatutsC8, resteDuChantier } from '../donnees';
import { resolveDataFromBlob } from '../hooks/useSupabaseData';
import { simulerRapportLundi } from '../AgentEngine';
import { badgeStatut } from '../ds';
import ChantierDetail from '../components/chantiers/ChantierDetail';
import DirecteurMatin from '../components/DirecteurMatin';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })), auth: { getSession: vi.fn() } },
}));
vi.mock('../components/chantiers/detail/DetailVelocite',        () => ({ default: () => null }));
vi.mock('../components/chantiers/detail/DetailProjection',      () => ({ default: () => null }));
vi.mock('../components/chantiers/detail/DetailRecommandations', () => ({ default: () => null }));
vi.mock('../components/chantiers/detail/DetailEcarts',          () => ({ default: () => null }));

const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 50000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', prenom: 'Jean', entreprise: 'Dupont SA' }];
const CHANTIER_EN_COURS = {
  id: 'c1', nom: 'Réno Dupont', devisId: 'd1', clientId: 'cl1',
  statut: 'En cours', avancement: 90, journal: [], extras: [],
};
const FACT_IMPAYEE = { id: 'F1', numero: 'FAC-1', chantierId: 'c1', clientId: 'cl1', devisId: 'd1',
  statut: 'envoyee', montantTTC: 30000, montantPaye: 0, dateEmission: '2026-06-01', dateEcheance: '2026-07-01' };
const FACT_PAYEE = { ...FACT_IMPAYEE, id: 'F2', numero: 'FAC-2', statut: 'payee', montantPaye: 30000 };

function renderDetail(chantier, overrides = {}) {
  const setChantiers = overrides.setChantiers || vi.fn();
  const confirmer = overrides.confirmer || vi.fn().mockResolvedValue(true);
  const result = renderWithApp(
    <ChantierDetail chantier={chantier} detailOnglet={overrides.onglet || 'financier'} setDetailOnglet={vi.fn()}
      modeCompleter={false} onRetour={vi.fn()} onModifier={vi.fn()} onSupprimer={vi.fn()} onPasserEnCours={vi.fn()} />,
    {
      devis: DEVIS, clients: CLIENTS, parametres: { employes: [] },
      factures: overrides.factures ?? [], setChantiers, confirmer,
      afficherNotif: vi.fn(), agentState: {}, naviguer: vi.fn(),
    },
  );
  return { ...result, setChantiers, confirmer };
}

beforeEach(() => { vi.clearAllMocks(); });

// ════════════════════════════════════════════════════════════════════════════
// MORDANT 1 — CYCLE COMPLET : en cours → attente paiement → terminé (payé)
// ════════════════════════════════════════════════════════════════════════════
describe('MORDANT cycle C8 — un chantier non payé ne peut JAMAIS être « Terminé »', () => {
  it('étape 1 : « Travaux terminés » sur un chantier en cours → statut « Attente paiement »', async () => {
    const { setChantiers } = renderDetail(CHANTIER_EN_COURS, { factures: [FACT_IMPAYEE] });
    fireEvent.click(screen.getByRole('button', { name: /Travaux terminés/i }));
    await waitFor(() => expect(setChantiers).toHaveBeenCalledOnce());
    const updater = setChantiers.mock.calls[0][0];
    const apres = updater([CHANTIER_EN_COURS]);
    expect(apres[0].statut).toBe('Attente paiement');
    expect(apres[0].dateFinTravaux).toBeTruthy();
  });

  it('étape 2 : ATTENTE PAIEMENT avec facture impayée → bandeau « pas encore encaissés », bouton « Passer en Terminé » ABSENT', () => {
    const enAttente = { ...CHANTIER_EN_COURS, statut: 'Attente paiement' };
    renderDetail(enAttente, { factures: [FACT_IMPAYEE] });
    // Le reste dû est affiché…
    expect(screen.getByText(/Travaux terminés — en attente de paiement/)).toBeInTheDocument();
    expect(screen.getByText(/30'000 pas encore encaissés/)).toBeInTheDocument();
    // …et il est IMPOSSIBLE de terminer : pas de bouton tant que ce n'est pas payé.
    expect(screen.queryByRole('button', { name: /Passer en Terminé/i })).toBeNull();
  });

  it('étape 3 : dernier paiement reçu (reste dû 0) → passage à Terminé PROPOSÉ, clic → statut « Terminé »', async () => {
    const enAttente = { ...CHANTIER_EN_COURS, statut: 'Attente paiement' };
    const { setChantiers } = renderDetail(enAttente, { factures: [FACT_PAYEE] });
    expect(screen.getByText(/Tout est payé/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Passer en Terminé/i }));
    await waitFor(() => expect(setChantiers).toHaveBeenCalledOnce());
    const apres = setChantiers.mock.calls[0][0]([enAttente]);
    expect(apres[0].statut).toBe('Terminé');
  });

  it('resteDuChantier : source unique factures (paiement partiel compté au franc près)', () => {
    const partielle = { ...FACT_IMPAYEE, statut: 'partielle', montantPaye: 12000 };
    expect(resteDuChantier([partielle], 'c1')).toBe(18000);
    expect(resteDuChantier([FACT_PAYEE], 'c1')).toBe(0);
    // annulées et brouillons ne comptent pas dans le reste dû
    expect(resteDuChantier([{ ...FACT_IMPAYEE, statut: 'annulee' }], 'c1')).toBe(0);
    expect(resteDuChantier([{ ...FACT_IMPAYEE, statut: 'brouillon' }], 'c1')).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MORDANT 2 — DIRECTEUR : « chantier fini, X CHF pas encaissés → relancer »
// ════════════════════════════════════════════════════════════════════════════
describe('MORDANT directeur (IA1c) — l\'attente de paiement remonte dans les actions du briefing', () => {
  const CH_ATTENTE = { ...CHANTIER_EN_COURS, statut: 'Attente paiement', dateFinTravaux: '2026-06-15' };

  it('simulerRapportLundi génère l\'action de relance avec le montant', () => {
    const data = simulerRapportLundi({
      chantiers: [CH_ATTENTE], factures: [FACT_IMPAYEE], devis: DEVIS,
      parametres: { employes: [] }, clients: CLIENTS, rapports: [], agentData: {}, alertes: [],
    });
    const action = (data.actionsAvantLundi || []).find(a => /fini/.test(a.action) && /encaissés/.test(a.action));
    expect(action).toBeDefined();
    expect(action.action).toContain("30'000");
    expect(['URGENT', 'IMPORTANT']).toContain(action.priorite);
    expect(action.detail).toMatch(/relancer/i);
  });

  it('le briefing du matin AFFICHE cette action (vrai composant DirecteurMatin)', () => {
    const data = simulerRapportLundi({
      chantiers: [CH_ATTENTE], factures: [FACT_IMPAYEE], devis: DEVIS,
      parametres: { employes: [] }, clients: CLIENTS, rapports: [], agentData: {}, alertes: [],
    });
    renderWithApp(<DirecteurMatin briefing={data} scoreSante={60} naviguer={vi.fn()} />, {});
    expect(screen.getByText(/fini — CHF 30'000 pas encore encaissés/)).toBeInTheDocument();
  });

  it('conditionnel : chantier en attente TOUT PAYÉ → aucune action de relance', () => {
    const data = simulerRapportLundi({
      chantiers: [CH_ATTENTE], factures: [FACT_PAYEE], devis: DEVIS,
      parametres: { employes: [] }, clients: CLIENTS, rapports: [], agentData: {}, alertes: [],
    });
    expect((data.actionsAvantLundi || []).some(a => /pas encore encaissés/.test(a.action))).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MORDANT 3 — MIGRATION : « terminé » avec facture impayée → requalifié
// ════════════════════════════════════════════════════════════════════════════
describe('MORDANT migration C8 — un « terminé » pas payé est requalifié « Attente paiement »', () => {
  const TERMINE_IMPAYE = { ...CHANTIER_EN_COURS, id: 'cT', statut: 'terminé' };
  const FACT_IMPAYEE_T = { ...FACT_IMPAYEE, id: 'FT', chantierId: 'cT' };
  const FACT_PAYEE_T = { ...FACT_PAYEE, id: 'FP', chantierId: 'cT' };

  it('terminé + facture impayée → « Attente paiement » ; terminé tout payé → INCHANGÉ', () => {
    const [requalifie] = migrerStatutsC8([TERMINE_IMPAYE], [FACT_IMPAYEE_T]);
    expect(requalifie.statut).toBe('Attente paiement');
    const [intact] = migrerStatutsC8([TERMINE_IMPAYE], [FACT_PAYEE_T]);
    expect(intact.statut).toBe('terminé');
  });

  it('garde-fous : en cours jamais requalifié ; terminé SANS facture jamais réveillé ; idempotente', () => {
    expect(migrerStatutsC8([CHANTIER_EN_COURS], [FACT_IMPAYEE])[0].statut).toBe('En cours');
    expect(migrerStatutsC8([TERMINE_IMPAYE], [])[0].statut).toBe('terminé');
    const une = migrerStatutsC8([TERMINE_IMPAYE], [FACT_IMPAYEE_T]);
    const deux = migrerStatutsC8(une, [FACT_IMPAYEE_T]);
    expect(deux[0].statut).toBe('Attente paiement');
  });

  it('vrai chemin de chargement (resolveDataFromBlob) : la requalification s\'applique au blob', () => {
    const blob = { chantiers: [TERMINE_IMPAYE], factures: [FACT_IMPAYEE_T], devis: [], clients: [], parametres: {} };
    const { chantiers } = resolveDataFromBlob(blob, false);
    expect(chantiers.find(c => c.id === 'cT').statut).toBe('Attente paiement');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C10 + visibilité — bilan de clôture et badge distinct
// ════════════════════════════════════════════════════════════════════════════
describe('C10 — bilan de clôture + badge distinct « Attente paiement »', () => {
  it('un chantier Terminé affiche le bilan : marge prévue au devis vs marge réelle', () => {
    const termine = { ...CHANTIER_EN_COURS, statut: 'Terminé', coutMaterielPrevu: 30000, materielReel: 28000 };
    renderDetail(termine, { factures: [FACT_PAYEE], onglet: 'analyse' });
    expect(screen.getByText('Bilan de clôture')).toBeInTheDocument();
    expect(screen.getByText(/Marge prévue au devis/i)).toBeInTheDocument();
    expect(screen.getByText(/Marge réelle/i)).toBeInTheDocument();
  });

  it('le badge « Attente paiement » a sa couleur propre (ambre), distincte de Terminé', () => {
    const attente = badgeStatut('Attente paiement');
    const termine = badgeStatut('Terminé');
    expect(attente.color).toBe('#b45309');
    expect(attente.color).not.toBe(termine.color);
  });
});
