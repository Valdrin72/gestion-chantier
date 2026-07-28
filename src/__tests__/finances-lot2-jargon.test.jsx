/**
 * Finances Lot 2 — traduction du jargon. Tests RÉELS (vrais composants via renderWithApp).
 * On vérifie que les termes techniques ne s'affichent PLUS et que la version claire apparaît.
 * Aucun calcul testé ici (non-régression money couverte par les suites existantes).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';
import ChantierDetail from '../components/chantiers/ChantierDetail';
import Factures from '../Factures';
import Finances from '../pages/FinancesPage';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

// ── Fiche chantier ────────────────────────────────────────────────────────────
const EMP = { id: 1, nom: 'M', tarifJour: 400, tarifDejaCharge: true, actif: true };
const J = (dates) => dates.map(d => ({ date: d, employes: [{ employeId: 1, heuresTravaillees: 8 }] }));
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
const CH = { id: 'CH1', nom: 'T', statut: 'en cours', nombreJours: 20, devisId: 'd1', clientId: 'cl1',
  equipe: [{ employeId: 1, joursPlannifies: 20 }], dateDebut: '2026-03-02',
  journal: J(['2026-03-02','2026-03-03','2026-03-04','2026-03-05','2026-03-06','2026-03-09','2026-03-10','2026-03-11']),
  materielReel: 12000 };
const chCtx = {
  chantiers: [CH], devis: [{ id: 'd1', numero: 'D-1', montantHT: 40000, statut: 'Accepté', clientId: 'cl1' }],
  clients: [{ id: 'cl1', nom: 'C', entreprise: 'C SA' }],
  parametres: { employes: [EMP], localites: [], parametres: CFG },
  pointages: migrerJournalVersPointages([CH], [EMP]),
  profil: { id: 'cyna', pages: ['chantiers'] }, agentState: { alertes: [], patterns: {} },
};

const JARGON_FICHE = ['EAC', 'ratio efficacité', 'Ratio efficacité', 'Coût MO réel', 'Coût MO',
  'Marge estimée finale', 'Coût final estimé', 'RAD —', 'Projection à terminaison'];

describe('Fiche chantier — le jargon a disparu, la version claire est là', () => {
  it('onglet Analyse : plus d\'EAC / ratio efficacité / coût final estimé', () => {
    const { container } = renderWithApp(<ChantierDetail chantier={CH} detailOnglet="analyse" />, chCtx);
    const txt = container.textContent;
    JARGON_FICHE.forEach(j => expect(txt).not.toContain(j));
    // Version claire présente (projection)
    expect(txt).toContain('Ce que le chantier coûtera au total');
  });
  it('onglet Financier : plus de "Marge nette"/"MO réel"/"RAD" bruts', () => {
    const { container } = renderWithApp(<ChantierDetail chantier={CH} detailOnglet="financier" />, chCtx);
    const txt = container.textContent;
    JARGON_FICHE.forEach(j => expect(txt).not.toContain(j));
    // "Encaissé" remplacé par "Payé" dans le bloc financier
    expect(txt).not.toContain('Encaissé');
    expect(txt).toContain('Payé');
  });
});

// ── Factures : types traduits, clé technique intacte ─────────────────────────
describe('Factures — types de facture en clair (clé technique inchangée)', () => {
  const CLIENT = { id: '1', prenom: 'A', nom: 'Dupont', entreprise: 'Dupont SA' };
  const CH_F = { id: 'CH1', nom: 'Chantier', numero: 'C-1', statut: 'en cours', clientId: '1', devisId: 'D1' };
  const DEVIS_F = { id: 'D1', numero: 'D-1', clientId: '1', montantHT: 50000, statut: 'accepté' };
  const facture = (type) => ({ id: 'F1', numero: 'F-1', clientId: '1', chantierId: 'CH1', devisId: 'D1',
    type, statut: 'envoyee', dateEmission: '2026-03-01', dateEcheance: '2026-03-31',
    montantHT: 20000, tva: 8.1, montantTTC: 21620, montantPaye: 0, lignes: [] });
  const props = (type) => ({ factures: [facture(type)], onSave: vi.fn(), clients: [CLIENT], chantiers: [CH_F], devis: [DEVIS_F],
    paiementsData: {}, setPaiementsData: vi.fn(), naviguer: vi.fn(),
    profil: { id: 'cyna', pages: ['finances'], role: 'cyna' }, periodeGlobale: 'annee',
    parametres: { employes: [] }, preRemplir: null, onConsumePreRemplir: vi.fn() });

  it('type "situation" → "Facture d\'avancement", jamais "Situation"', () => {
    const { container } = renderWithApp(<Factures {...props('situation')} />, {});
    expect(screen.getAllByText('Facture d\'avancement').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('Situation');
  });
  it('type "finale" → "Facture de clôture", jamais "Finale"', () => {
    const { container } = renderWithApp(<Factures {...props('finale')} />, {});
    expect(screen.getAllByText('Facture de clôture').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('Finale');
  });
  it('la colonne "Progression" est devenue "Payé"', () => {
    const { container } = renderWithApp(<Factures {...props('situation')} />, {});
    expect(container.textContent).not.toContain('Progression');
  });
});

// ── Trésorerie/Performance : ticket moyen, pondérée, orpheline traduits ────────
describe('Trésorerie — plus de ticket moyen / pondérée par le CA', () => {
  // Facture rattachée à un chantier (non orpheline) → la section Performance s'affiche.
  const facture = { id: 'F1', numero: 'F-1', clientId: '1', chantierId: 'CH1', devisId: 'D1',
    type: 'standard', statut: 'envoyee', dateEmission: '2026-03-01', dateEcheance: '2026-03-31',
    montantHT: 10000, tva: 8.1, montantTTC: 10810, montantPaye: 0 };
  it('la section performance dit "Montant moyen par facture" et "Temps moyen avant paiement"', () => {
    const { container } = renderWithApp(<Finances
      factures={[facture]} onSave={vi.fn()} clients={[{ id: '1', nom: 'X', entreprise: 'X SA' }]}
      chantiers={[{ id: 'CH1', nom: 'Ch', numero: 'C-1', statut: 'en cours', clientId: '1', devisId: 'D1' }]}
      devis={[{ id: 'D1', numero: 'D-1', clientId: '1', montantHT: 30000, statut: 'accepté' }]}
      paiementsData={{}} setPaiementsData={vi.fn()} naviguer={vi.fn()}
      profil={{ id: 'cyna', pages: ['finances'] }} periodeGlobale="annee" parametres={{ employes: [] }} pointages={[]} />, {});
    const txt = container.textContent;
    expect(txt).not.toContain('Ticket moyen');
    expect(txt).not.toContain('pondérée par le CA');
    expect(txt).toContain('Montant moyen par facture');
    expect(txt).toContain('Temps moyen avant paiement');
  });
});
