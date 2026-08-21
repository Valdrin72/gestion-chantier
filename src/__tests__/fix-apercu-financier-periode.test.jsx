/**
 * Aperçu financier du Dashboard — RÉSULTAT DE PÉRIODE (fix MOYEN 8).
 * Correction : numérateur ET dénominateur sur la MÊME base de période.
 *  - CA FACTURÉ HT de la période (caFactureHTDansPeriode, dateEmission ∈ période) ;
 *  - DÉPENSES = coûts de la période au PRORATA (coutChantierDansPeriode), PLUS le total
 *    « vie-entière » (calculerCoutsChantier.totalCoutsReel) qu'on mélangeait avant à un CA de période ;
 *  - garde-fou : période sans activité → « Aucune activité », pas « CHF 0 ».
 * Tests RÉELS : vrai Dashboard rendu + vrais helpers periode.js.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { fmtCH } from '../design/v1';
import { calculerCoutsChantier } from '../donnees';
import { coutChantierDansPeriode, caFactureHTDansPeriode } from '../calculs/periode';
import { donneesDemo } from '../donnees-demo';
import Dashboard from '../pages/Dashboard';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const A = new Date().getFullYear();
const MOIS = String(new Date().getMonth() + 1).padStart(2, '0');
const AUTRE_MOIS = new Date().getMonth() === 0 ? '02' : '01';

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 };
const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 200000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];
const CLIENTS = [{ id: 'cl1', nom: 'Client', entreprise: 'Client SA' }];

function baseCtx(over = {}) {
  return {
    devis: DEVIS, clients: CLIENTS,
    parametres: { employes: [EMP], localites: [], parametres: CFG },
    setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(), setPeriodeGlobale: vi.fn(),
    agentState: { scoreGlobal: 60, alertes: [], priorites: [], briefingMatin: null },
    profil: { id: 'cyna', pages: ['dashboard'] },
    pointages: [], factures: [], chantiers: [],
    ...over,
  };
}
const apercu = () => within(screen.getByTestId('apercu-financier'));

// ── 1. CA FACTURÉ HT suit la période (dateEmission) ──────────────────────────
describe('CA FACTURÉ de l\'aperçu suit le sélecteur (mois vs année)', () => {
  const CH = { id: 'CH1', nom: 'Chantier P', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 40, dateDebut: `${A}-${AUTRE_MOIS}-02`, journal: [], extras: [] };
  const F_CUR   = { id: 'FC', numero: 'FAC-C', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1', statut: 'envoyee', montantHT: 10000,  montantTTC: 10810,  dateEmission: `${A}-${MOIS}-15`, paiementsHistorique: [] };
  const F_AUTRE = { id: 'FO', numero: 'FAC-O', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1', statut: 'envoyee', montantHT: 100000, montantTTC: 108100, dateEmission: `${A}-${AUTRE_MOIS}-15`, paiementsHistorique: [] };

  it('« Ce mois » → CA facturé = 10\'000 HT (facture du mois), PAS 110\'000', () => {
    renderWithApp(<Dashboard />, baseCtx({ chantiers: [CH], factures: [F_CUR, F_AUTRE], periodeGlobale: 'mois' }));
    expect(apercu().getAllByText(fmtCH(10000)).length).toBeGreaterThan(0);
    expect(apercu().queryByText(fmtCH(110000))).toBeNull();
  });

  it('« Cette année » → CA facturé = 110\'000 HT (les deux factures de l\'année)', () => {
    renderWithApp(<Dashboard />, baseCtx({ chantiers: [CH], factures: [F_CUR, F_AUTRE], periodeGlobale: 'annee' }));
    expect(apercu().getAllByText(fmtCH(110000)).length).toBeGreaterThan(0);
  });
});

// ── 2. DÉPENSES = coûts de la période au prorata (PAS le total vie-entière) ───
describe('DÉPENSES de l\'aperçu = coûts de la PÉRIODE au prorata (fix MOYEN 8)', () => {
  // Chantier démarré l'AN DERNIER, matériel 12'000 : sur l'année COURANTE seule une part au prorata
  // tombe → coût de période < coût vie-entière. L'aperçu doit montrer la part de période, pas le total.
  const CH = { id: 'CH1', nom: 'Chantier D', statut: 'en cours', clientId: 'cl1', devisId: 'd1',
    nombreJours: 250, dateDebut: `${A - 1}-11-03`, journal: [], extras: [], materielReel: 12000 };
  const FACT = { id: 'F1', numero: 'FAC-1', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1', statut: 'envoyee',
    montantHT: 50000, montantTTC: 54050, dateEmission: `${A}-${MOIS}-10`, paiementsHistorique: [] };

  const ORACLE_PERIODE  = Math.round(coutChantierDansPeriode(CH, [EMP], CFG, [], [FACT], 'annee'));
  const ORACLE_LIFETIME = Math.round(calculerCoutsChantier(CH, [EMP], [], CFG, DEVIS, []).totalCoutsReel);

  it('le prorata de période est STRICTEMENT inférieur au total vie-entière (12\'000 étalé)', () => {
    expect(ORACLE_PERIODE).toBeGreaterThan(0);
    expect(ORACLE_PERIODE).toBeLessThan(ORACLE_LIFETIME); // sinon le fix ne prouverait rien
  });

  it('le Dashboard affiche les DÉPENSES de PÉRIODE (prorata), PAS le total vie-entière', () => {
    renderWithApp(<Dashboard />, baseCtx({ chantiers: [CH], factures: [FACT], pointages: [], periodeGlobale: 'annee' }));
    expect(apercu().getAllByText(fmtCH(ORACLE_PERIODE)).length).toBeGreaterThan(0);
    expect(apercu().queryByText(fmtCH(ORACLE_LIFETIME))).toBeNull(); // l'ancien mélange vie-entière a disparu
  });
});

// ── 3. Cohérence inter-écrans : CA facturé HT année démo == 171'500 (== Marges/Finances) ──
describe('COHÉRENCE — le CA facturé de l\'aperçu partage la base des autres écrans', () => {
  it('caFactureHTDansPeriode(démo, année) == 171\'500 (même helper que Marges/Chantiers/Statistiques)', () => {
    expect(caFactureHTDansPeriode(donneesDemo.factures, 'annee', new Date(2026, 5, 15))).toBeCloseTo(171500, 2);
  });
});

// ── 4. Garde-fou : période sans activité → « Aucune activité » ───────────────
describe('Garde-fou — période sans activité', () => {
  const CH = { id: 'CH1', nom: 'Chantier V', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 40, dateDebut: '2025-10-01', journal: [], extras: [] };
  const FACT_VIEILLE = { id: 'F1', numero: 'FAC-OLD', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1', statut: 'partielle',
    montantHT: 37000, montantTTC: 40000, montantPaye: 15000, dateEmission: '2025-10-20', dateEcheance: '2025-11-20',
    paiementsHistorique: [{ id: 'p1', montant: 15000, date: '2025-11-01' }] };

  it('« Cette semaine » sans activité → « Aucune activité sur cette période » (pas « CHF 0 »)', () => {
    renderWithApp(<Dashboard />, baseCtx({ chantiers: [CH], factures: [FACT_VIEILLE], pointages: [], periodeGlobale: 'semaine' }));
    expect(apercu().getByText(/Aucune activité sur cette période/)).toBeInTheDocument();
    expect(apercu().queryByText('CA FACTURÉ')).toBeNull();
  });
});
