/**
 * Dashboard — le KPI trésorerie affiche l'ENCAISSÉ RÉEL de la période (plus la projection 30j).
 *
 * Preuve RTL RÉELLE (vrai Dashboard via renderWithApp) :
 *  1. sur une période contenant une facture payée → le KPI « ENCAISSÉ » == caPayeDansPeriode
 *     (MÊME fonction que Finances « Payé TTC » → cohérence Dashboard ↔ Finances) ;
 *  2. sur une période SANS facture payée → 0 correct (pas d'encaissé), pas un 0 de projection ;
 *  3. l'ancien libellé de projection (« PRÉVISION 30 J ») a disparu du KPI.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Dashboard from '../pages/Dashboard';
import { caPayeDansPeriode } from '../calculs/periode';
import { fmtCH } from '../design/v1';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const A = new Date().getFullYear();
// Un mois GARANTI différent du mois courant (comme periode-dashboard.test.jsx).
const AUTRE_MOIS = new Date().getMonth() === 0 ? '02' : '01';
const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 };
const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 200000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];
const CLIENTS = [{ id: 'cl1', nom: 'Client', entreprise: 'Client SA' }];
const CH = { id: 'CH1', nom: 'Chantier', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 40, dateDebut: `${A}-${AUTRE_MOIS}-02`, journal: [], extras: [] };
// Facture PAYÉE, émise AUTRE_MOIS de l'année courante. caPayeDansPeriode compte min(montantPaye, montantTTC).
const F_PAYEE = { id: 'FP', numero: 'FAC-P', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1', statut: 'payee',
  montantHT: 46253, montantTTC: 50000, montantPaye: 50000, dateEmission: `${A}-${AUTRE_MOIS}-15`,
  dateEcheance: `${A}-${AUTRE_MOIS}-28`, paiementsHistorique: [{ date: `${A}-${AUTRE_MOIS}-20`, montant: 50000 }] };
const FACTURES = [F_PAYEE];

function ctx(periodeGlobale) {
  return {
    devis: DEVIS, clients: CLIENTS, chantiers: [CH], factures: FACTURES, pointages: [],
    parametres: { employes: [EMP], localites: [], parametres: CFG },
    setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(), setPeriodeGlobale: vi.fn(),
    agentState: { scoreGlobal: 60, alertes: [], priorites: [], briefingMatin: null },
    profil: { id: 'cyna', pages: ['dashboard'] }, periodeGlobale,
  };
}

// La valeur du KPI est le <div> frère juste après le <div> du libellé (cf. KpiStripV1).
function valeurKpi(label) {
  return screen.getByText(label).nextElementSibling.textContent;
}

describe('Dashboard — KPI « ENCAISSÉ » = encaissé réel de la période (source unique Finances)', () => {
  it('période « année » avec une facture payée → KPI ENCAISSÉ == caPayeDansPeriode (== Finances « Payé TTC »)', () => {
    renderWithApp(<Dashboard />, ctx('annee'));
    const attendu = caPayeDansPeriode(FACTURES, 'annee'); // 50'000 (payée dans l'année)
    expect(attendu).toBe(50000);
    expect(screen.getByText('ENCAISSÉ')).toBeInTheDocument();
    // Le KPI affiche exactement l'encaissé de la période, formaté comme Finances (TTC).
    expect(valeurKpi('ENCAISSÉ')).toBe(fmtCH(attendu)); // "50'000"
    // Unité explicite dans la sous-ligne.
    expect(screen.getByText(/TTC ·/)).toBeInTheDocument();
  });

  it('période « mois » (aucune payée ce mois-ci) → 0 CORRECT (pas d\'encaissé), pas un 0 de projection', () => {
    renderWithApp(<Dashboard />, ctx('mois'));
    const attendu = caPayeDansPeriode(FACTURES, 'mois'); // 0 : la payée est émise un AUTRE mois
    expect(attendu).toBe(0);
    expect(valeurKpi('ENCAISSÉ')).toBe(fmtCH(0)); // "0"
  });

  it('l\'ancien KPI de projection (« PRÉVISION 30 J ») a disparu', () => {
    renderWithApp(<Dashboard />, ctx('annee'));
    expect(screen.queryByText('PRÉVISION 30 J')).toBeNull();
    // Et le nouveau KPI n'est plus intitulé « TRÉSORERIE » (le tile porte « ENCAISSÉ »).
    const strip = within(screen.getByTestId('kpi-strip'));
    expect(strip.queryByText('TRÉSORERIE')).toBeNull();
    expect(strip.getByText('ENCAISSÉ')).toBeInTheDocument();
  });
});
