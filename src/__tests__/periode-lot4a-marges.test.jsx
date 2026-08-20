/**
 * Cohérence des périodes — SOUS-LOT 4a : page MARGES (pilote des pages chantier).
 * ⚠ MONEY-CRITICAL : change la DÉFINITION du CA des pages de marge.
 *
 * Avant (obsolète) : CA = CA DEVISÉ HT rattaché à dateDebut, coûts = total de VIE du chantier.
 * Après (ce lot)   : CA = CA FACTURÉ HT de la période (Σ montantHT des factures, dateEmission ∈ période) ;
 *                    coûts = part de la période (MO datée exacte + forfait au prorata) ; un chantier qui a
 *                    des coûts mais AUCUNE facture affiche CA = 0 + un indicateur « à facturer » séparé
 *                    (JAMAIS une marge trompeuse de −100 %). Tout passe par le helper partagé
 *                    indicateursMargeChantier (source unique src/calculs/periode.js).
 *
 * Preuve RTL RÉELLE (vrai composant Marges via Analyse → vue Rentabilité, aucun logic-mirror) :
 *   1. KPI : CA FACTURÉ TOTAL = 100'000 (seul le chantier facturé compte), MARGE TOTALE 60'000 (60 %),
 *      À FACTURER = 20'000 (coûts engagés non facturés) ;
 *   2. chantier FACTURÉ (BPG) : marge 60 % affichée ;
 *   3. chantier SANS facture (Tech Park) : CA « CHF 0 », marge « — », à facturer « CHF 20'000 »
 *      — et surtout AUCUN « −100% » nulle part (le piège que ce lot élimine) ;
 *   4. la légende des seuils et la ligne TOTAL restent présentes (finition v1 conservée).
 */
import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Marges from '../Marges';
import Analyse from '../Analyse';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const ANNEE = new Date().getFullYear();
const PARAMETRES = {
  employes: [], localites: [], typesTravaux: [],
  parametres: { coefficientMainOeuvre: 1, tauxTVA: 8.1, tauxFraisGeneraux: 12 },
};
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' }];

// BPG : FACTURÉ 100'000 HT en février + 40'000 de matériel (forfait entièrement dans l'année) →
//       marge période = 100'000 − 40'000 = 60'000 → 60 %.
// Tech Park : 20'000 de matériel, AUCUNE facture → CA 0, marge N/D, à facturer 20'000 (pas −100 %).
const CHANTIERS = [
  { id: 'bpg', nom: 'BPG', statut: 'En cours', clientId: 'cl1',
    dateDebut: `${ANNEE}-02-01`, nombreJours: 10, materielReel: 40000, journal: [], equipe: [] },
  { id: 'tech', nom: 'Tech Park', statut: 'En cours', clientId: 'cl1',
    dateDebut: `${ANNEE}-03-01`, nombreJours: 5, materielReel: 20000, journal: [], equipe: [] },
];
const FACTURES = [
  { id: 'FB', numero: 'F-BPG', chantierId: 'bpg', clientId: 'cl1', statut: 'envoyee',
    montantHT: 100000, montantTTC: 108100, dateEmission: `${ANNEE}-02-15` },
];

// Rendu ISOLÉ du vrai composant Marges (les autres blocs de la vue Rentabilité — ex. « Prévu vs
// Réel » — ont leurs propres colonnes d'écart qui n'ont rien à voir avec la marge de Marges).
function renderMarges() {
  return renderWithApp(
    <Marges chantiers={CHANTIERS} clients={CLIENTS} devis={[]}
      parametres={PARAMETRES} periodeGlobale="annee" />,
    { pointages: [], factures: FACTURES },
  );
}

describe('KPI — CA FACTURÉ HT (pas devisé), marge de période, À FACTURER séparé', () => {
  it('CA FACTURÉ TOTAL = 100\'000, MARGE TOTALE 60\'000 (60 %), À FACTURER 20\'000', () => {
    renderMarges();
    expect(screen.getByText('CA FACTURÉ TOTAL')).toBeInTheDocument();
    // « À FACTURER » apparaît 2× (carte KPI + en-tête de colonne).
    expect(screen.getAllByText('À FACTURER').length).toBeGreaterThanOrEqual(1);
    // L'ancien libellé du modèle devisé a disparu.
    expect(screen.queryByText('CA SIGNÉ TOTAL')).toBeNull();
    // Valeurs réelles : seul BPG est facturé → CA 100'000, coûts 40'000, marge 60'000.
    expect(screen.getAllByText("CHF 100'000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CHF 60'000").length).toBeGreaterThanOrEqual(1);
    // À facturer total = coûts non facturés de Tech Park = 20'000.
    expect(screen.getAllByText("CHF 20'000").length).toBeGreaterThanOrEqual(1);
    // Marge moyenne 60 % (badge de la carte MARGE TOTALE + badge de ligne).
    expect(screen.getAllByText('60%').length).toBeGreaterThanOrEqual(1);
  });
});

describe('TABLEAU — chantier sans facture : CA 0 + à facturer, JAMAIS −100 %', () => {
  it('Tech Park affiche CA « CHF 0 », marge « — » et à facturer « CHF 20\'000 » — aucun −100%', () => {
    const { container } = renderMarges();
    // La ligne Tech Park existe (chantier avec coûts sur la période, donc actif).
    const ligne = screen.getAllByText('Tech Park').map(el => el.closest('tr')).find(Boolean);
    expect(ligne).toBeTruthy();
    // CA facturé de Tech Park = 0 (aucune facture).
    expect(within(ligne).getByText('CHF 0')).toBeInTheDocument();
    // Sans facture : coûts non couverts → COÛTS RÉELS = À FACTURER = 20'000 (les 2 cellules).
    expect(within(ligne).getAllByText("CHF 20'000").length).toBe(2);
    // Marge « — » (aucune marge % trompeuse quand il n'y a pas de facture).
    expect(within(ligne).getAllByText('—').length).toBeGreaterThanOrEqual(1);
    // LE PIÈGE ÉLIMINÉ : aucune marge de −100 % dans la page Marges (ni tiret ASCII, ni signe moins Unicode).
    expect(container.textContent).not.toContain('-100%');
    expect(container.textContent).not.toContain('−100%');
  });

  it('BPG (facturé) affiche sa marge 60 %', () => {
    renderMarges();
    const ligne = screen.getAllByText('BPG').map(el => el.closest('tr')).find(Boolean);
    expect(ligne).toBeTruthy();
    expect(within(ligne).getAllByText('60%').length).toBeGreaterThanOrEqual(1);
  });
});

describe('FINITION v1 conservée — légende + TOTAL + cohabitation cascade', () => {
  it('affiche la légende des seuils et la ligne TOTAL', () => {
    renderMarges();
    expect(screen.getByText('Rentable ≥ 20%')).toBeInTheDocument();
    expect(screen.getByText('Critique < 15%')).toBeInTheDocument();
    expect(screen.getByText('TOTAL (1 facturé)')).toBeInTheDocument();
  });

  it('cohabite avec la cascade dans la vue Rentabilité (intégration Analyse)', () => {
    renderWithApp(
      <Analyse chantiers={CHANTIERS} clients={CLIENTS} devis={[]}
        parametres={PARAMETRES} setParametres={() => {}} factures={FACTURES} periodeGlobale="annee" />,
      { pointages: [], factures: FACTURES },
    );
    // Intégration : le bloc Marges (avec ses nouveaux libellés) cohabite avec la cascade.
    expect(screen.getByText('Cascade de rentabilité')).toBeInTheDocument();
    expect(screen.getByText('Marges par chantier')).toBeInTheDocument();
    expect(screen.getByText('CA FACTURÉ TOTAL')).toBeInTheDocument();
  });
});
