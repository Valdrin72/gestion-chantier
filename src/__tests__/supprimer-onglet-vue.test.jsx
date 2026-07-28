/**
 * Suppression de l'onglet « Vue » — les 3 alertes uniques sont rapatriées sur Analyse,
 * Vue n'existe plus, Analyse devient l'onglet par défaut. Tests RÉELS (vrais composants).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';
import ChantierDetail from '../components/chantiers/ChantierDetail';
import Chantiers from '../pages/ChantiersPage';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
// Devis accepté APRÈS le début du chantier → déclenche l'alerte « démarrage avant signature ».
const DEVIS = { id: 'd1', numero: 'D-1', montantHT: 40000, statut: 'accepté', clientId: 'cl1', dateAcceptation: '2026-03-10' };
const jour = (dates) => dates.map(d => ({ date: d, employes: [{ employeId: 1, heuresTravaillees: 8 }] }));

// Chantier qui déclenche les 3 alertes uniques :
//  - MO élevée (matériel minuscule → MO > 60% du coût)
//  - samedi travaillé non inclus (2026-03-07 = samedi, inclusSamedi false)
//  - démarrage avant signature (dateDebut 02/03 < acceptation 10/03)
const CH_VIGILANCE = {
  id: 'CH1', nom: 'Vigilance', statut: 'en cours', nombreJours: 10, devisId: 'd1', clientId: 'cl1', canton: 'GE',
  equipe: [{ employeId: 1, joursPlannifies: 10 }], dateDebut: '2026-03-02', inclusSamedi: false,
  journal: jour(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07']),
  materielReel: 300,
};
const POINT = migrerJournalVersPointages([CH_VIGILANCE], [EMP]);
const ctxFor = (ch, pointages, over = {}) => ({
  chantiers: [ch], devis: [DEVIS], clients: [{ id: 'cl1', nom: 'C', entreprise: 'C SA' }],
  parametres: { employes: [EMP], localites: [], parametres: CFG }, pointages,
  profil: { id: 'cyna', pages: ['chantiers'] }, agentState: { alertes: [], patterns: {} }, ...over,
});

describe('Les 3 alertes uniques sont désormais sur ANALYSE (Points de vigilance)', () => {
  it('MO élevée, samedi non inclus, démarrage avant devis apparaissent sur l\'onglet Analyse', () => {
    renderWithApp(<ChantierDetail chantier={CH_VIGILANCE} detailOnglet="analyse" />, ctxFor(CH_VIGILANCE, POINT));
    expect(screen.getByText('Points de vigilance')).toBeInTheDocument();
    expect(screen.getByText(/Main d'œuvre élevée/)).toBeInTheDocument();
    expect(screen.getByText(/non inclus dans la durée planifiée/)).toBeInTheDocument();
    expect(screen.getByText(/Démarrage avant signature du devis/)).toBeInTheDocument();
  });

  it('conditionnel : un chantier sain n\'affiche pas les points de vigilance', () => {
    const CH_SAIN = { ...CH_VIGILANCE, id: 'CH2', inclusSamedi: true, materielReel: 20000,
      journal: jour(['2026-03-09', '2026-03-10', '2026-03-11']), dateDebut: '2026-03-11' };
    const P = migrerJournalVersPointages([CH_SAIN], [EMP]);
    renderWithApp(<ChantierDetail chantier={CH_SAIN} detailOnglet="analyse" />, ctxFor(CH_SAIN, P));
    expect(screen.queryByText('Points de vigilance')).toBeNull();
  });
});

describe('L\'onglet Vue n\'existe plus (2 onglets : Analyse, Financier)', () => {
  it('la barre d\'onglets ne contient plus « Vue »', () => {
    renderWithApp(<ChantierDetail chantier={CH_VIGILANCE} detailOnglet="analyse" />, ctxFor(CH_VIGILANCE, POINT));
    expect(screen.queryByRole('button', { name: 'Vue' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Analyse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Financier' })).toBeInTheDocument();
  });
});

describe('Analyse est l\'onglet par défaut à l\'ouverture d\'un chantier', () => {
  it('ouvrir un chantier tombe sur Analyse (pas de Vue), contenu Analyse visible', () => {
    renderWithApp(<Chantiers />, {
      chantiers: [CH_VIGILANCE], setChantiers: vi.fn(), clients: [{ id: 'cl1', nom: 'C', entreprise: 'C SA' }],
      setClients: vi.fn(), devis: [DEVIS], setDevis: vi.fn(), factures: [], setFactures: vi.fn(),
      pointages: POINT, setPointages: vi.fn(), parametres: { employes: [EMP], localites: [], parametres: CFG },
      naviguer: vi.fn(), afficherNotif: vi.fn(), confirmer: vi.fn().mockResolvedValue(true),
      agentState: {}, periodeGlobale: 'an', profil: { id: 'cyna', pages: ['chantiers'] },
      contexte: { chantierActif: 'CH1' }, // ouvre directement le chantier
    });
    // Onglet par défaut = Analyse : le bouton « Voir le détail » (propre à Analyse) est visible d'emblée.
    expect(screen.getByRole('button', { name: /Voir le détail/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vue' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Analyse' })).toBeInTheDocument();
  });
});
