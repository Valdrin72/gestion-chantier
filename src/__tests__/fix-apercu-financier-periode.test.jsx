/**
 * Fix Aperçu financier — suit le SÉLECTEUR DE PÉRIODE + dépenses COMPLÈTES.
 *  - CA encaissé = paiements reçus DANS la période (datable).
 *  - Dépenses = coûts réels engagés via l'ENGINE (calculerCoutsChantier.totalCoutsReel :
 *    MO + matériel + sous-traitance + imprévus ; déplacement EXCLU — règle F2).
 *  - Garde-fou : période sans activité → « Aucune activité », pas « CHF 0 ».
 * Tests RÉELS : vrai Dashboard rendu + vrai engine calculerCoutsChantier.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { fmtCH } from '../design/v1';
import { calculerCoutsChantier } from '../donnees';
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
// Un autre mois de la MÊME année, garanti différent du mois courant.
const AUTRE_MOIS = new Date().getMonth() === 0 ? '02' : '01';

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 };
const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 200000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];
const CLIENTS = [{ id: 'cl1', nom: 'Client', entreprise: 'Client SA' }];

function baseCtx(over = {}) {
  return {
    devis: DEVIS, clients: CLIENTS,
    parametres: { employes: [EMP], localites: [], parametres: CFG },
    setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(),
    setPeriodeGlobale: vi.fn(),
    agentState: { scoreGlobal: 60, alertes: [], priorites: [], briefingMatin: null },
    profil: { id: 'cyna', pages: ['dashboard'] },
    pointages: [], factures: [], chantiers: [],
    ...over,
  };
}
const apercu = () => within(screen.getByTestId('apercu-financier'));

// ════════════════════════════════════════════════════════════════════════════
// MORDANT 1 — PÉRIODE : le CA encaissé suit le sélecteur
// ════════════════════════════════════════════════════════════════════════════
describe('MORDANT période — CA encaissé filtré par le sélecteur (mois vs année)', () => {
  const CH = { id: 'CH1', nom: 'Chantier P', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 40, dateDebut: `${A}-${AUTRE_MOIS}-02`, journal: [], extras: [] };
  const FACT = {
    id: 'F1', numero: 'FAC-1', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1', statut: 'partielle',
    montantTTC: 100000, montantPaye: 35000, dateEmission: `${A}-${AUTRE_MOIS}-02`, dateEcheance: `${A + 1}-01-01`,
    paiementsHistorique: [
      { id: 'p1', montant: 10000, date: `${A}-${MOIS}-05` },        // mois COURANT
      { id: 'p2', montant: 25000, date: `${A}-${AUTRE_MOIS}-15` },  // autre mois, même année
    ],
  };

  it('« Ce mois » → CA encaissé = 10\'000 (seul le paiement du mois courant), PAS 35\'000', () => {
    renderWithApp(<Dashboard />, baseCtx({ chantiers: [CH], factures: [FACT], periodeGlobale: 'mois' }));
    expect(apercu().getAllByText(fmtCH(10000)).length).toBeGreaterThan(0);
    expect(apercu().queryByText(fmtCH(35000))).toBeNull(); // le paiement de l'autre mois est exclu
  });

  it('« Cette année » → CA encaissé = 35\'000 (les deux paiements de l\'année)', () => {
    renderWithApp(<Dashboard />, baseCtx({ chantiers: [CH], factures: [FACT], periodeGlobale: 'annee' }));
    expect(apercu().getAllByText(fmtCH(35000)).length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MORDANT 2 + 4 — DÉPENSES COMPLÈTES via l'engine (MO + matériel + sous-traitance)
// ════════════════════════════════════════════════════════════════════════════
describe('MORDANT dépenses complètes + cohérence MO (engine calculerCoutsChantier)', () => {
  // Pointages en semaine (mars, hors fériés GE) → MO sans majoration.
  const POINTAGES = ['2026-03-02', '2026-03-03', '2026-03-04'].map((date, i) => ({
    id: `pt${i}`, date, employeId: 1, repartitions: [{ chantierId: 'CH1', categorie: 'production', heures: 8 }],
  })).map(p => ({ ...p, date: `${A}-03-${p.date.slice(-2)}` }));
  const CH = {
    id: 'CH1', nom: 'Chantier D', statut: 'en cours', clientId: 'cl1', devisId: 'd1',
    nombreJours: 40, dateDebut: `${A}-03-02`, journal: [], extras: [],
    materielReel: 5000, sousTraitanceReelle: 3000,
  };
  const FACT = { id: 'F1', numero: 'FAC-1', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1', statut: 'envoyee',
    montantTTC: 50000, montantPaye: 0, dateEmission: `${A}-03-05`, dateEcheance: `${A + 1}-01-01`, paiementsHistorique: [] };

  // Oracle : l'engine lui-même (source de vérité MO + coûts).
  const ORACLE = calculerCoutsChantier(CH, [EMP], [], CFG, DEVIS, POINTAGES);

  it('l\'engine : totalCoutsReel = MO + matériel(5000) + sous-traitance(3000) — déplacement exclu', () => {
    expect(ORACLE.coutMaterielReel).toBe(5000);
    expect(ORACLE.coutSousTraitanceReel).toBe(3000);
    expect(ORACLE.coutEquipeReel).toBeGreaterThan(0); // MO réelle des pointages
    // Complétude : le total = MO + matériel + sous-traitance (pas seulement la MO).
    expect(ORACLE.totalCoutsReel).toBe(ORACLE.coutEquipeReel + 5000 + 3000);
    expect(ORACLE.totalCoutsReel).toBeGreaterThan(ORACLE.coutEquipeReel); // matériel+ST bien ajoutés
  });

  it('le Dashboard affiche DÉPENSES = totalCoutsReel de l\'engine (MO identique, complet)', () => {
    renderWithApp(<Dashboard />, baseCtx({ chantiers: [CH], factures: [FACT], pointages: POINTAGES, periodeGlobale: 'annee' }));
    // Dépenses affichées = le total de l'engine (au franc près), pas la MO seule.
    expect(apercu().getByText(fmtCH(Math.round(ORACLE.totalCoutsReel)))).toBeInTheDocument();
    // La MO seule NE serait PAS le montant affiché (preuve que matériel+ST comptent).
    expect(apercu().queryByText(fmtCH(Math.round(ORACLE.coutEquipeReel)))).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MORDANT 3 — GARDE-FOU : période vide → « Aucune activité »
// ════════════════════════════════════════════════════════════════════════════
describe('MORDANT garde-fou — période sans activité', () => {
  const CH = { id: 'CH1', nom: 'Chantier V', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 40, dateDebut: '2025-10-01', journal: [], extras: [] };
  // Facture + paiement ANCIENS (année précédente) → hors semaine courante.
  const FACT_VIEILLE = { id: 'F1', numero: 'FAC-OLD', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1', statut: 'partielle',
    montantTTC: 40000, montantPaye: 15000, dateEmission: '2025-10-20', dateEcheance: '2025-11-20',
    paiementsHistorique: [{ id: 'p1', montant: 15000, date: '2025-11-01' }] };

  it('« Cette semaine » sans aucune activité → « Aucune activité sur cette période » (pas « CHF 0 »)', () => {
    renderWithApp(<Dashboard />, baseCtx({ chantiers: [CH], factures: [FACT_VIEILLE], pointages: [], periodeGlobale: 'semaine' }));
    expect(apercu().getByText(/Aucune activité sur cette période/)).toBeInTheDocument();
    // Pas de faux « RÉSULTAT DE TRÉSORERIE » chiffré ni de ligne CA ENCAISSÉ.
    expect(apercu().queryByText('CA ENCAISSÉ')).toBeNull();
  });
});
