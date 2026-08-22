/**
 * Cohérence des périodes — LOT 2/7 : DevisPage adopte periode.js pour le CA signé.
 * ⚠ Money-critical. Le « CA signé » = Σ des devis ACCEPTÉS dont la date ∈ période
 *   (caSigneDevisDansPeriode : base HT + avenants + régie) — DISTINCT du CA facturé (TTC/dateEmission).
 *   Valeur inchangée (équivalence prouvée), mais désormais issue de la source unique + sans bug UTC.
 *
 * Preuve RTL RÉELLE (vrai DevisPage via renderWithApp) :
 *   1. le CA signé RÉAGIT à la période (année ⊃ mois) et affiche la bonne valeur ;
 *   2. EN ATTENTE / DÉLAI portent le libellé global explicite « · EN COURS » (état du pipeline) ;
 *   3. INVARIANT d'emboîtement du CA signé : Σ(12 mois) == année (via caSigneDevisDansPeriode).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../../test-utils/renderWithApp.jsx';
import DevisPage from '../DevisPage.js';
import { caSigneDevisDansPeriode } from '../../calculs/periode';

vi.mock('../../ExportPDF', () => ({ exportDevis: vi.fn() }));
vi.mock('../../utils/exportCSV', () => ({ exportCSV: vi.fn() }));
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })), auth: { getSession: vi.fn() } },
}));

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const now = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const Y = now.getFullYear();
const M = now.getMonth();                       // 0-11
const DATE_MOIS_COURANT = `${Y}-${p2(M + 1)}-10`;        // dans le mois ET l'année courants
const M_AUTRE = M === 2 ? 5 : 2;                          // un autre mois de la MÊME année (mars, sinon juin)
const DATE_AUTRE_MOIS = `${Y}-${p2(M_AUTRE + 1)}-10`;

const CLIENT = { id: 1, prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA' };
// devA : accepté ce mois-ci (30k) ; devB : accepté un autre mois de l'année (40k) ; devC : envoyé (pipeline).
const DEVIS = [
  { id: 'da', numero: 'DEV-A', clientId: 1, statut: 'accepté', montantHT: '30000', date: DATE_MOIS_COURANT, avenants: [], heuresRegie: [] },
  { id: 'db', numero: 'DEV-B', clientId: 1, statut: 'accepté', montantHT: '40000', date: DATE_AUTRE_MOIS, avenants: [], heuresRegie: [] },
  { id: 'dc', numero: 'DEV-C', clientId: 1, statut: 'envoyé', montantHT: '20000', date: DATE_AUTRE_MOIS, avenants: [], heuresRegie: [] },
];

function renderDevis(periodeGlobale) {
  return renderWithApp(<DevisPage />, {
    clients: [CLIENT], devis: DEVIS, chantiers: [], factures: [],
    parametres: { employes: [], typesTravaux: [] }, periodeGlobale,
    setDevis: vi.fn(), setChantiers: vi.fn(), setFactures: vi.fn(),
    confirmer: vi.fn().mockResolvedValue(true), afficherNotif: vi.fn(), naviguer: vi.fn(), ouvrirMenu: vi.fn(),
    setPeriodeGlobale: vi.fn(),
  });
}

describe('DEVISPAGE — CA signé réactif à la période (source unique periode.js)', () => {
  it('année = 30k + 40k = 70k ; mois courant = 30k seulement', () => {
    const { unmount } = renderDevis('annee');
    expect(screen.getByTestId('hero-kpi-ca-signé').textContent).toMatch(/70\D?000/);
    unmount();
    renderDevis('mois');
    // Seul devA (mois courant) compte ; devB (autre mois) sort → le KPI a BOUGÉ (n'était pas figé).
    expect(screen.getByTestId('hero-kpi-ca-signé').textContent).toMatch(/30\D?000/);
    expect(screen.getByTestId('hero-kpi-ca-signé').textContent).not.toMatch(/70\D?000/);
  });
});

describe('DEVISPAGE — CA signé (HT) distinct, KPI pipeline libellés « en cours »', () => {
  it('le hero montre « CA SIGNÉ » (pas « facturé ») et les 2 KPI globaux « · EN COURS »', () => {
    renderDevis('annee');
    const chiffres = screen.getByTestId('hero-chiffres');
    expect(screen.getByText('CA SIGNÉ')).toBeInTheDocument();
    expect(chiffres.textContent).not.toMatch(/factur/i);        // pas de confusion avec le CA facturé
    expect(screen.getByText('EN ATTENTE · EN COURS')).toBeInTheDocument();
    expect(screen.getByText('DÉLAI MOYEN · EN COURS')).toBeInTheDocument();
    // 1 seul devis « envoyé » → EN ATTENTE = 1 (global, ne suit pas la période)
    expect(screen.getByTestId('hero-kpi-en-attente-en-cours').textContent).toMatch(/1/);
  });
});

describe('DEVISPAGE — INVARIANT d\'emboîtement du CA signé', () => {
  it('Σ(12 mois) == année (via caSigneDevisDansPeriode, ref 2026 déterministe)', () => {
    const D = [
      { id: 'x', statut: 'accepté', montantHT: '30000', date: '2026-08-10', avenants: [], heuresRegie: [] },
      { id: 'y', statut: 'accepté', montantHT: '40000', date: '2026-03-10', avenants: [], heuresRegie: [] },
      { id: 'z', statut: 'envoyé',  montantHT: '99999', date: '2026-05-10', avenants: [], heuresRegie: [] }, // exclu (pas accepté)
    ];
    const somme = Array.from({ length: 12 }, (_, m) => caSigneDevisDansPeriode(D, 'mois', new Date(2026, m, 15)))
      .reduce((a, b) => a + b, 0);
    expect(somme).toBe(caSigneDevisDansPeriode(D, 'annee', new Date(2026, 5, 15)));
    expect(somme).toBe(70000); // 30k + 40k, le devis envoyé ne compte pas
  });
});
