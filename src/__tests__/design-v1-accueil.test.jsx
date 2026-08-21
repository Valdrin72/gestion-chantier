/**
 * Design v1 — Accueil « instrument de précision » (Phases A+B).
 * Preuve RTL : le hero affiche score + actions du directeur, les 4 KPI montrent
 * les VRAIES valeurs calculées, les chantiers listent les vrais chantiers,
 * la timeline affiche les vraies activités (sources réelles). Zéro logique testée
 * en miroir — on rend le VRAI Dashboard.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { fmtCH } from '../design/v1';
import Dashboard from '../pages/Dashboard';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const EMPLOYES = [
  { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true },
  { id: 2, nom: 'Rossi', tarifJour: 350, tarifDejaCharge: true, actif: true },
];
const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 120000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];
const CHANTIER = {
  id: 'CH1', nom: 'Bureaux Grand-Pré', statut: 'en cours', clientId: 'cl1', devisId: 'd1',
  nombreJours: 20, dateDebut: '2026-07-01', canton: 'GE',
  equipe: [{ employeId: 1, joursPlannifies: 20 }], journal: [], extras: [],
};
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const FACTURE = {
  id: 'F1', numero: 'FAC-100', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1',
  statut: 'partielle', montantTTC: 50000, montantPaye: 18900,
  dateEmission: AUJOURDHUI, dateEcheance: '2027-01-31',
  paiementsHistorique: [{ id: 'h1', montant: 18900, date: AUJOURDHUI, mode: 'Virement' }],
};
const CTX = {
  chantiers: [CHANTIER], factures: [FACTURE], devis: DEVIS,
  clients: [{ id: 'cl1', nom: 'Client', entreprise: 'Client SA' }],
  parametres: { employes: EMPLOYES, localites: [], parametres: { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 } },
  pointages: [], setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(),
  periodeGlobale: 'annee', setPeriodeGlobale: vi.fn(),
  agentState: {
    scoreGlobal: 60, alertes: [], priorites: [],
    briefingMatin: { actionsAvantLundi: [
      { priorite: 'URGENT', icone: '💰', action: 'Relancer Client SA — FAC-100', detail: 'Impayée depuis 40 jours' },
    ], anticipations: [] },
  },
  profil: { id: 'cyna', pages: ['dashboard'] },
};

describe('HERO — score santé + actions du directeur (vraies données agentState)', () => {
  it('affiche « Bonjour Valdrin », le score 60/100 et l\'action 01 du jour', () => {
    renderWithApp(<Dashboard />, CTX);
    // Le hero (Actions du jour) et le DirecteurBloc (onglets matin/soir/lundi) coexistent
    // volontairement : on scope les assertions au hero plutôt qu'au DOM entier.
    const hero = within(screen.getByTestId('hero-direction'));
    expect(hero.getByText(/Bonjour Valdrin/)).toBeInTheDocument();
    expect(hero.getByText('60')).toBeInTheDocument();               // anneau score
    expect(hero.getByText(/SANTÉ ENTREPRISE · À SURVEILLER/)).toBeInTheDocument();
    expect(hero.getByText('ACTIONS DU JOUR')).toBeInTheDocument();
    expect(hero.getByText('Relancer Client SA — FAC-100')).toBeInTheDocument();
    // Ligne mono : 1 chantier actif – 2 collaborateurs (vraies données)
    expect(hero.getByText(/1 CHANTIER ACTIF – 2 COLLABORATEURS/)).toBeInTheDocument();
  });
});

describe('KPI — les 4 cartes affichent les VRAIES valeurs calculées', () => {
  it('CA SIGNÉ = 120\'000 (devis lié) · ON ME DOIT = 31\'100 (50\'000 − 18\'900)', () => {
    renderWithApp(<Dashboard />, CTX);
    expect(screen.getByText('CA SIGNÉ')).toBeInTheDocument();
    expect(screen.getByText(fmtCH(120000))).toBeInTheDocument();      // 120'000
    expect(screen.getByText('ON ME DOIT')).toBeInTheDocument();
    expect(screen.getByText(fmtCH(50000 - 18900))).toBeInTheDocument(); // 31'100
    expect(screen.getByText('MARGE MOYENNE')).toBeInTheDocument();
    expect(screen.getByText('TRÉSORERIE')).toBeInTheDocument();
  });

  it('montants au format suisse avec apostrophe (fmtCH)', () => {
    expect(fmtCH(263800)).toBe("263'800");
    expect(fmtCH(31100)).toBe("31'100");
    expect(fmtCH(-4500)).toBe("−4'500");
  });
});

describe('MES CHANTIERS — vrais chantiers, état C8 visible', () => {
  it('la carte chantier affiche le nom, la sous-ligne mono GENÈVE — MARGE, et le cartouche FIN', () => {
    renderWithApp(<Dashboard />, CTX);
    expect(screen.getByText('Mes chantiers')).toBeInTheDocument();
    expect(screen.getByText('Bureaux Grand-Pré')).toBeInTheDocument();
    expect(screen.getByText(/GENÈVE — MARGE/)).toBeInTheDocument();
    expect(screen.getByText(/FIN \d{2}\.\d{2}\.\d{4}/)).toBeInTheDocument(); // cartouche échéance
  });

  it('clic sur la carte → navigation vers la fiche chantier (action conservée)', () => {
    const naviguer = vi.fn();
    renderWithApp(<Dashboard />, { ...CTX, naviguer });
    fireEvent.click(screen.getByText('Bureaux Grand-Pré'));
    expect(naviguer).toHaveBeenCalledWith('chantiers', { chantierActif: 'CH1' });
  });
});

describe('APERÇU FINANCIER + TIMELINE — vraies sources', () => {
  it('l\'aperçu financier (résultat de PÉRIODE) affiche CA facturé + dépenses de la période', () => {
    renderWithApp(<Dashboard />, CTX);
    expect(screen.getByTestId('apercu-financier')).toBeInTheDocument();
    // Lot Dashboard : le bloc est désormais un résultat de PÉRIODE (CA facturé − coûts prorata),
    // numérateur et dénominateur sur la même base (fix MOYEN 8), plus « encaissé − coûts vie-entière ».
    expect(screen.getByText('RÉSULTAT DE PÉRIODE')).toBeInTheDocument();
    expect(screen.getByText('CA FACTURÉ')).toBeInTheDocument();
    expect(screen.getByText('DÉPENSES')).toBeInTheDocument();
  });

  it('la timeline affiche l\'encaissement réel du jour (+ CHF 18\'900) et la facture émise', () => {
    renderWithApp(<Dashboard />, CTX);
    expect(screen.getByTestId('timeline-activite')).toBeInTheDocument();
    expect(screen.getByText('JOURNAL DE BORD')).toBeInTheDocument();
    expect(screen.getByText(/Encaissement — FAC-100/)).toBeInTheDocument();
    expect(screen.getAllByText(`+ CHF ${fmtCH(18900)}`).length).toBeGreaterThan(0); // (aussi visible au débrief du soir)
    expect(screen.getByText(/Facture émise — FAC-100/)).toBeInTheDocument();
    expect(screen.getAllByText("AUJOURD'HUI").length).toBeGreaterThan(0); // horodatage mono
  });
});

describe('Rendez-vous du directeur toujours fonctionnels (onglets Matin/Soir/Hebdo)', () => {
  it('le DirecteurBloc reste rendu avec ses 3 onglets', () => {
    renderWithApp(<Dashboard />, CTX);
    expect(screen.getByTestId('directeur-bloc')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Matin$/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Soir$/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Hebdo$/ }).length).toBeGreaterThan(0);
  });
});
