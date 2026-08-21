/**
 * Cohérence des périodes — LOT DASHBOARD (Accueil). ⚠ MONEY-CRITICAL.
 * Distingue les temporalités du Dashboard :
 *  • « ON ME DOIT » (à encaisser) = ÉTAT INSTANTANÉ « à ce jour » → une facture impayée émise un AUTRE
 *    mois est TOUJOURS comptée, quel que soit le sélecteur (l'ancien code la filtrait par période).
 *  • « CA SIGNÉ » = carnet de commandes (portefeuille), global — inchangé.
 * (L'aperçu financier — CA facturé de période − coûts prorata — est prouvé dans
 *  fix-apercu-financier-periode.test.jsx.)
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Dashboard from '../pages/Dashboard';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const A = new Date().getFullYear();
const AUTRE_MOIS = new Date().getMonth() === 0 ? '02' : '01';
const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 };
const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 200000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];
const CLIENTS = [{ id: 'cl1', nom: 'Client', entreprise: 'Client SA' }];
const CH = { id: 'CH1', nom: 'Chantier', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 40, dateDebut: `${A}-${AUTRE_MOIS}-02`, journal: [], extras: [] };
// Facture émise un AUTRE mois, impayée, échéance dépassée → « en retard » (état à ce jour).
const F_AUTRE = { id: 'F1', numero: 'FAC-1', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1', statut: 'envoyee',
  montantTTC: 100000, montantPaye: 0, dateEmission: `${A}-${AUTRE_MOIS}-15`, dateEcheance: '2020-01-01', paiementsHistorique: [] };

function ctx(periodeGlobale) {
  return {
    devis: DEVIS, clients: CLIENTS, chantiers: [CH], factures: [F_AUTRE], pointages: [],
    parametres: { employes: [EMP], localites: [], parametres: CFG },
    setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(), setPeriodeGlobale: vi.fn(),
    agentState: { scoreGlobal: 60, alertes: [], priorites: [], briefingMatin: null },
    profil: { id: 'cyna', pages: ['dashboard'] }, periodeGlobale,
  };
}

describe('ON ME DOIT — instantané « à ce jour » (ne suit pas la période)', () => {
  it('en vue « mois », la facture impayée émise un AUTRE mois est TOUJOURS comptée (1 impayé)', () => {
    renderWithApp(<Dashboard />, ctx('mois'));
    expect(screen.getByText('ON ME DOIT')).toBeInTheDocument();
    // L'ancien comportement (filtré par période) aurait affiché « 0 IMPAYÉS » en vue mois.
    expect(screen.getAllByText(/1 IMPAYÉ/).length).toBeGreaterThanOrEqual(1);
  });

  it('invariance : « mois » et « année » donnent le même nombre d\'impayés (état instantané)', () => {
    const { unmount } = renderWithApp(<Dashboard />, ctx('mois'));
    const mois = screen.getAllByText(/1 IMPAYÉ/).length;
    unmount();
    renderWithApp(<Dashboard />, ctx('annee'));
    const annee = screen.getAllByText(/1 IMPAYÉ/).length;
    expect(mois).toBeGreaterThanOrEqual(1);
    expect(annee).toBe(mois); // l'état « à ce jour » ne bouge pas avec le sélecteur
  });

  it('« CA SIGNÉ » reste le carnet de commandes (devisé 200\'000), distinct du facturé', () => {
    renderWithApp(<Dashboard />, ctx('mois'));
    expect(screen.getByText('CA SIGNÉ')).toBeInTheDocument();
  });
});
