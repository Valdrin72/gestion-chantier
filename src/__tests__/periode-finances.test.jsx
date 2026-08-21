/**
 * Cohérence des périodes — LOT FINANCES (cœur trésorerie). ⚠ MONEY-CRITICAL.
 * Décisions patron : Finances reste en TTC. Le hero est coupé en deux temporalités :
 *   • FACTURÉ TTC (#1) + PAYÉ TTC (#2)  → SUIVENT la période (dateEmission ∈ période) ;
 *   • EN ATTENTE (#3) + EN RETARD (#4)  → ÉTATS INSTANTANÉS « à ce jour » (dateEcheance vs today),
 *                                          ne bougent PAS avec la période.
 * L'onglet Factures est migré sur periode.js (bornes correctes, dimanche inclus).
 *
 * Preuve RTL RÉELLE (vrai composant Finances + vrai Factures, aucun logic-mirror) :
 *   1. FACTURÉ TTC / PAYÉ TTC réagissent au sélecteur (année ⊃ mois) ;
 *   2. EN RETARD ne bouge PAS entre année et mois (instantané) ;
 *   3. l'onglet Factures cache une facture émise hors période ;
 *   4. emboîtement Σ(12 mois) == année pour Facturé ET Payé (données démo) ;
 *   5. cohérence TTC↔HT : Facturé TTC == CA facturé HT × 1.081 (== 185'391.5 ↔ 171'500 sur l'année démo).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Finances from '../pages/FinancesPage';
import { caFactureDansPeriode, caPayeDansPeriode, caFactureHTDansPeriode } from '../calculs/periode';
import { donneesDemo } from '../donnees-demo';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })), auth: { getSession: vi.fn() } },
}));

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const p2 = (n) => String(n).padStart(2, '0');
const ANNEE = new Date().getFullYear();
const MOIS = new Date().getMonth();
const AUTRE = MOIS === 0 ? 1 : 0;
const DATE_MOIS  = `${ANNEE}-${p2(MOIS + 1)}-15`;
const DATE_AUTRE = `${ANNEE}-${p2(AUTRE + 1)}-15`;

const CLIENT = { id: 'cl1', prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA' };
const DEVIS = { id: 'd1', numero: 'D-1', chantierId: 'CH1', clientId: 'cl1', statut: 'accepté', montantHT: 200000, avenants: [], lignes: [] };
const CHANTIER = { id: 'CH1', nom: 'Rénovation Dupont', numero: 'C-001', statut: 'en cours', clientId: 'cl1', devisId: 'd1', avancement: 50, extras: [] };

// F_MOIS : émise ce mois-ci, 30'000 TTC, payée en plein.
const F_MOIS = { id: 'FM', numero: 'FAC-M', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1',
  statut: 'payee', type: 'situation', montantHT: 27752, montantTTC: 30000, montantPaye: 30000,
  dateEmission: DATE_MOIS, dateEcheance: `${ANNEE}-12-31`, paiementsHistorique: [{ id: 'p', montant: 30000, date: DATE_MOIS }] };
// F_AUTRE : émise un autre mois, 100'000 TTC, impayée + échéance dépassée → EN RETARD (instantané).
const F_AUTRE = { id: 'FA', numero: 'FAC-A', chantierId: 'CH1', clientId: 'cl1', devisId: 'd1',
  statut: 'envoyee', type: 'situation', montantHT: 92507, montantTTC: 100000, montantPaye: 0,
  dateEmission: DATE_AUTRE, dateEcheance: '2020-01-01', rappels: [], paiementsHistorique: [] };

function renderFinances(periodeGlobale) {
  return renderWithApp(
    <Finances factures={[F_MOIS, F_AUTRE]} onSave={vi.fn()} clients={[CLIENT]} chantiers={[CHANTIER]} devis={[DEVIS]}
      naviguer={vi.fn()} contexte={{}} profil={{ id: 'cyna', pages: ['finances'] }}
      periodeGlobale={periodeGlobale} parametres={{ employes: [] }} pointages={[]} />,
    { afficherNotif: vi.fn(), confirmer: vi.fn().mockResolvedValue(true), ouvrirMenu: vi.fn(), setPeriodeGlobale: vi.fn() },
  );
}
const RETARD_TESTID = 'hero-kpi-en-retard-·-à-ce-jour';

describe('HERO — Facturé/Payé suivent la période ; En retard reste instantané', () => {
  it('vue ANNÉE : Facturé 130\'000, Payé 30\'000 ; En retard 100\'000 (à ce jour)', () => {
    renderFinances('annee');
    expect(screen.getByTestId('hero-kpi-facturé-ttc').textContent).toMatch(/130\D?000/); // 30k + 100k
    expect(screen.getByTestId('hero-kpi-payé-ttc').textContent).toMatch(/30\D?000/);
    expect(screen.getByTestId(RETARD_TESTID).textContent).toMatch(/100\D?000/);
  });

  it('vue MOIS : Facturé retombe à 30\'000 (réactif) ; En retard reste 100\'000 (instantané, inchangé)', () => {
    renderFinances('mois');
    // Facturé a RÉAGI : seule la facture du mois courant compte.
    expect(screen.getByTestId('hero-kpi-facturé-ttc').textContent).toMatch(/30\D?000/);
    expect(screen.getByTestId('hero-kpi-facturé-ttc').textContent).not.toMatch(/130\D?000/);
    // En retard n'a PAS bougé (état à ce jour, la facture hors-période reste en retard).
    expect(screen.getByTestId(RETARD_TESTID).textContent).toMatch(/100\D?000/);
  });
});

describe('ONGLET FACTURES — filtré via periode.js (bornes correctes)', () => {
  it('en vue MOIS, la facture émise un autre mois est masquée de la liste', () => {
    renderFinances('mois');
    fireEvent.click(screen.getByRole('button', { name: /^Factures/i }));
    expect(screen.getByText('FAC-M')).toBeInTheDocument();      // émise ce mois → visible
    expect(screen.queryByText('FAC-A')).toBeNull();             // émise un autre mois → masquée
  });
});

describe('EMBOÎTEMENT + COHÉRENCE TTC↔HT (données démo 2026)', () => {
  const factures = donneesDemo.factures;
  const ref = new Date(2026, 5, 15);

  it('Facturé TTC : Σ(12 mois) == année == 185\'391.5 (== 171\'500 HT × 1.081)', () => {
    const annee = caFactureDansPeriode(factures, 'annee', ref);
    const somme = Array.from({ length: 12 }, (_, m) => caFactureDansPeriode(factures, 'mois', new Date(2026, m, 15)))
      .reduce((a, b) => a + b, 0);
    expect(annee).toBeCloseTo(185391.5, 2);
    expect(somme).toBeCloseTo(annee, 2);
    // Cohérence inter-écrans : le TTC de Finances == le HT des pages de marge × 1.081.
    expect(annee).toBeCloseTo(caFactureHTDansPeriode(factures, 'annee', ref) * 1.081, 2);
    expect(caFactureHTDansPeriode(factures, 'annee', ref)).toBeCloseTo(171500, 2);
  });

  it('Payé TTC : Σ(12 mois) == année, et payé ≤ facturé sur chaque mois', () => {
    const annee = caPayeDansPeriode(factures, 'annee', ref);
    const somme = Array.from({ length: 12 }, (_, m) => caPayeDansPeriode(factures, 'mois', new Date(2026, m, 15)))
      .reduce((a, b) => a + b, 0);
    expect(somme).toBeCloseTo(annee, 2);
    for (let m = 0; m < 12; m++) {
      expect(caPayeDansPeriode(factures, 'mois', new Date(2026, m, 15)))
        .toBeLessThanOrEqual(caFactureDansPeriode(factures, 'mois', new Date(2026, m, 15)) + 0.001);
    }
  });
});
