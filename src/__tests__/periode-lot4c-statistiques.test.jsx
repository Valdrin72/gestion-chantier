/**
 * Cohérence des périodes — SOUS-LOT 4c : STATISTIQUES.
 * ⚠ MONEY-CRITICAL : les KPI/tableaux de CA passent au CA FACTURÉ HT (helper partagé, même source
 *   que Marges 4a et Chantiers 4b) et le SÉLECTEUR D'ANNÉE LOCAL est supprimé.
 *
 * Décision patron (Option A) : le graphe « CA par mois » (12 barres) et les prévisions sont ANNUELS
 *   par nature — ils affichent TOUJOURS l'année de référence (année en cours), NE suivent PAS le
 *   sélecteur global, et portent un libellé explicite « — Année {X} ». Les KPI de période (CA
 *   facturé HT, marge, à-facturer) suivent, eux, periodeGlobale.
 *
 * Preuve RTL RÉELLE (vrai composant Statistiques) :
 *   1. KPI « CA FACTURÉ » = CA facturé HT de la période, réactif à periodeGlobale (== helper) ;
 *   2. le sélecteur d'année LOCAL n'existe plus (aucun combobox) ;
 *   3. graphe mensuel ANNUEL : libellé « — Année {X} » présent même en vue « semaine » (stable) ;
 *   4. chantier sans facture → bandeau « à facturer », aucun −100 % ;
 *   5. COHÉRENCE INTER-ÉCRANS + EMBOÎTEMENT sur données démo : CA facturé HT année 2026 = 171'500
 *      (== Marges 4a == Chantiers 4b) et Σ(12 mois) == année.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AppProvider } from '../context/AppContext';
import Statistiques from '../Statistiques';
import { caFactureHTDansPeriode } from '../calculs/periode';
import { fmtN } from '../donnees';
import { donneesDemo } from '../donnees-demo';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 300 });
});

const ANNEE = new Date().getFullYear();
const PARAMETRES = {
  employes: [{ id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true }],
  localites: [], typesTravaux: [{ nom: 'Gros œuvre' }],
  parametres: { coefficientMainOeuvre: 1, tauxTVA: 8.1, tauxFraisGeneraux: 12 },
};
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA', prenom: 'Jean' }];
// BPG facturé 100'000 HT (février) + 40'000 matériel → CA facturé 100'000.
// Tech Park : 20'000 matériel, AUCUNE facture → à facturer 20'000 (jamais −100 %).
const CHANTIERS = [
  { id: 'bpg', nom: 'BPG', numero: 'C-BPG', statut: 'En cours', clientId: 'cl1',
    dateDebut: `${ANNEE}-02-01`, nombreJours: 10, surface: 100, typesTravaux: ['Gros œuvre'],
    materielReel: 40000, journal: [], equipe: [] },
  { id: 'tech', nom: 'Tech Park', numero: 'C-TECH', statut: 'En cours', clientId: 'cl1',
    dateDebut: `${ANNEE}-03-01`, nombreJours: 5, surface: 50, typesTravaux: ['Gros œuvre'],
    materielReel: 20000, journal: [], equipe: [] },
];
const FACTURES = [{ id: 'FB', numero: 'F-BPG', chantierId: 'bpg', clientId: 'cl1', statut: 'envoyee',
  montantHT: 100000, montantTTC: 108100, dateEmission: `${ANNEE}-02-15` }];

function renderStats(periodeGlobale = 'annee') {
  const ctx = {
    chantiers: CHANTIERS, clients: CLIENTS, devis: [], factures: FACTURES,
    parametres: PARAMETRES, pointages: [],
    setChantiers: vi.fn(), naviguer: vi.fn(), contexte: {}, agentState: {},
    afficherNotif: vi.fn(), confirmer: vi.fn(),
  };
  return render(
    <AppProvider value={ctx}>
      <Statistiques chantiers={CHANTIERS} clients={CLIENTS} parametres={PARAMETRES} periodeGlobale={periodeGlobale} />
    </AppProvider>
  );
}

describe('KPI CA FACTURÉ HT — suit periodeGlobale + sélecteur d\'année local supprimé', () => {
  it('KPI = CA facturé HT (100\'000 en « année ») et AUCUN sélecteur d\'année local', () => {
    renderStats('annee');
    const carte = screen.getByText('CA FACTURÉ').parentElement;
    expect(within(carte).getByText("CHF 100'000")).toBeInTheDocument();
    // L'ancien libellé devisé a disparu.
    expect(screen.queryByText('CA SIGNÉ ANNÉE')).toBeNull();
    // Le sélecteur d'année LOCAL (doublon) n'existe plus.
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('le KPI réagit au sélecteur global : « année » ≠ « semaine » (== helper, date-robuste)', () => {
    const ref = new Date();
    const attenduAnnee = caFactureHTDansPeriode(FACTURES, 'annee', ref);   // 100'000
    const attenduSemaine = caFactureHTDansPeriode(FACTURES, 'semaine', ref); // 0 hors semaine du 15/02
    const rA = renderStats('annee');
    expect(within(screen.getByText('CA FACTURÉ').parentElement).getByText(`CHF ${fmtN(attenduAnnee)}`)).toBeInTheDocument();
    rA.unmount();
    renderStats('semaine');
    expect(within(screen.getByText('CA FACTURÉ').parentElement).getByText(`CHF ${fmtN(attenduSemaine)}`)).toBeInTheDocument();
    expect(attenduAnnee).toBe(100000);
    expect(attenduAnnee).toBeGreaterThanOrEqual(attenduSemaine);
  });
});

describe('Graphe mensuel + prévisions — ANNUELS (Option A) : stables et libellés', () => {
  it('le libellé « — Année {X} » est présent en vue « année » ET en vue « semaine » (ne suit pas la période)', () => {
    const rA = renderStats('annee');
    expect(screen.getByText(new RegExp(`CA facturé mensuel — Année ${ANNEE}`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Prévisions — Année ${ANNEE}`))).toBeInTheDocument();
    rA.unmount();
    // En « semaine », le graphe mensuel reste annuel (libellé toujours présent) → stable.
    renderStats('semaine');
    expect(screen.getByText(new RegExp(`CA facturé mensuel — Année ${ANNEE}`))).toBeInTheDocument();
  });
});

describe('Chantier sans facture — bandeau « à facturer », aucun −100 %', () => {
  it('Tech Park (coûts, sans facture) → bandeau à facturer + aucune marge −100 %', () => {
    const { container } = renderStats('annee');
    // Bandeau qui surface les coûts engagés non facturés.
    expect(screen.getByText(/à facturer sur la période/)).toBeInTheDocument();
    expect(container.textContent).not.toContain('-100%');
    expect(container.textContent).not.toContain('−100%');
  });
});

describe('COHÉRENCE INTER-ÉCRANS + EMBOÎTEMENT (données démo, année 2026)', () => {
  it('CA facturé HT année = 171\'500 (== Marges 4a == Chantiers 4b) et Σ(12 mois) == année', () => {
    const F = donneesDemo.factures;
    const annee = caFactureHTDansPeriode(F, 'annee', new Date(2026, 5, 15));
    const somme = Array.from({ length: 12 }, (_, m) => caFactureHTDansPeriode(F, 'mois', new Date(2026, m, 15)))
      .reduce((a, b) => a + b, 0);
    expect(annee).toBe(171500);   // même total que les autres écrans (même helper)
    expect(somme).toBe(annee);    // le graphe mensuel s'emboîte dans l'année
  });
});
