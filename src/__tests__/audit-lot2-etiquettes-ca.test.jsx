/**
 * Audit Lot 2 — étiquettes « CA » (Règle 18 du Plan directeur).
 * « CA » seul est réservé à l'ENCAISSÉ ; un chiffre SIGNÉ doit dire « CA signé »,
 * un chiffre FACTURÉ doit dire « CA facturé ». Ce lot ne change AUCUN calcul —
 * on prouve ici que les écrans clés portent le bon mot pour le bon chiffre.
 * Tests RÉELS : vrais composants rendus via renderWithApp (aucun logic-mirror).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';
import Rapport from '../Rapport';
import Marges from '../Marges';
import Finances from '../pages/FinancesPage';
import ChantiersListe from '../components/chantiers/ChantiersListe';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

// Fixture minimale : 1 chantier signé 80'000 avec heures réelles + 1 facture payée.
const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CHANTIER = {
  id: 'CH1', nom: 'Chantier Étiquettes', statut: 'en cours', nombreJours: 23,
  devisId: 'd1', clientId: 'cl1', equipe: [{ employeId: 1, joursPlannifies: 23 }],
  dateDebut: '2026-03-02',
  journal: [{ date: '2026-03-02', employes: [{ employeId: 1, heuresTravaillees: 8 }] }],
};
const DEVIS = { id: 'd1', numero: 'D-1', montantHT: 80000, statut: 'Accepté', clientId: 'cl1' };
const CLIENT = { id: 'cl1', nom: 'Client', entreprise: 'Client SA', type: 'prive' };
const FACTURE_PAYEE = {
  id: 'F1', numero: 'FAC-001', clientId: 'cl1', chantierId: 'CH1', devisId: 'd1',
  statut: 'payee', montantHT: 9250, montantTTC: 10000, montantPaye: 10000,
  dateEmission: '2026-03-01', dateEcheance: '2026-03-31',
};
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
const PARAMS = { employes: [EMP], localites: [], parametres: CFG };
const POINTAGES = migrerJournalVersPointages([CHANTIER], [EMP]);
const CTX = {
  chantiers: [CHANTIER], devis: [DEVIS], clients: [CLIENT], factures: [FACTURE_PAYEE],
  parametres: PARAMS, pointages: POINTAGES,
  profil: { id: 'cyna', pages: ['dashboard', 'chantiers', 'finances', 'rapport'] },
  agentState: { alertes: [], patterns: {} },
};

describe('Écrans du SIGNÉ : le label dit « CA signé », plus jamais « CA » nu', () => {
  it('Rapport hebdo : « CA SIGNÉ TOUS CHANTIERS » (l\'ancien « CA TOUS CHANTIERS » nu a disparu)', () => {
    renderWithApp(
      <Rapport chantiers={[CHANTIER]} clients={[CLIENT]} devis={[DEVIS]} parametres={PARAMS} paiementsData={{}} />,
      CTX,
    );
    expect(screen.getByText('CA SIGNÉ TOUS CHANTIERS')).toBeInTheDocument();
    expect(screen.queryByText('CA TOUS CHANTIERS')).toBeNull();
  });

  it('Liste chantiers : « CA SIGNÉ CHANTIERS » (chiffre = Σ calculerCA)', () => {
    renderWithApp(
      <ChantiersListe chantiersFiltres={[CHANTIER]} joursParChantier={{ CH1: 5 }} filtre="" setFiltre={vi.fn()}
        onSelect={vi.fn()} onModifier={vi.fn()} onSupprimer={vi.fn()}
        onArchiver={vi.fn()} onRestaurer={vi.fn()} formSlot={null} />,
      {
        ...CTX,
        setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(),
        confirmer: vi.fn().mockResolvedValue(true), periodeGlobale: 'annee',
        contexte: {},
      },
    );
    // Design v1 : la tuile CA du hero Chantiers porte le label explicite « CA SIGNÉ »
    // (règle 18 respectée — jamais « CA » nu).
    expect(within(screen.getByTestId('kpi-ca-signé')).getByText('CA SIGNÉ')).toBeInTheDocument();
    expect(screen.queryByText('CA CHANTIERS')).toBeNull();
  });
});

describe('Écrans du FACTURÉ : le label dit « CA facturé »', () => {
  it('Finances (performance) : « Top clients par CA facturé » + « % du CA facturé » (chiffre = Σ montantTTC)', () => {
    renderWithApp(
      <Finances factures={[FACTURE_PAYEE]} onSave={vi.fn()} clients={[CLIENT]} chantiers={[CHANTIER]}
        devis={[DEVIS]} naviguer={vi.fn()} contexte={{}} profil={{ id: 'cyna', pages: ['finances'] }}
        periodeGlobale="annee" parametres={PARAMS} pointages={POINTAGES} />,
      CTX,
    );
    expect(screen.getByText('Top clients par CA facturé')).toBeInTheDocument();
    // Plus de « % du CA » nu : chaque part dit de quel CA elle parle.
    expect(screen.getAllByText(/% du CA facturé/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/% du CA$/)).toBeNull();
  });

  // Lot 4a périodes : la page Marges est désormais un écran du FACTURÉ (le CA = Σ montantHT des
  // factures de la période, plus le devisé). L'ancien libellé « CA SIGNÉ TOTAL » a donc disparu.
  it('Marges : le KPI dit « CA FACTURÉ TOTAL » (chiffre = Σ montantHT facturé de la période = 9\'250)', () => {
    renderWithApp(
      <Marges chantiers={[CHANTIER]} clients={[CLIENT]} devis={[DEVIS]} parametres={PARAMS} periodeGlobale="annee" />,
      CTX,
    );
    expect(screen.getByText('CA FACTURÉ TOTAL')).toBeInTheDocument();
    expect(screen.queryByText('CA SIGNÉ TOTAL')).toBeNull();
    // FACTURE_PAYEE.montantHT = 9250 (dateEmission 2026-03-01 ∈ année) → CA facturé HT = 9'250.
    expect(screen.getAllByText("CHF 9'250").length).toBeGreaterThanOrEqual(1);
  });
});
