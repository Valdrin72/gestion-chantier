/**
 * Cohérence des périodes — SOUS-LOT 4e (dernier d'Analyse) : Clients + Corps de métier.
 * ⚠ MONEY-CRITICAL. Ces deux répartitions passent du DEVISÉ au CA FACTURÉ HT (helper partagé).
 * Le bloc « Analyse m² » est VOLONTAIREMENT EXCLU (reste sur le devisé — chantier m² futur).
 *
 * Preuve RTL RÉELLE (vrai composant Analyse + helper periode.js) :
 *   1. Clients : « Top clients par CA facturé », valeur facturé (100'000) et NON devisé (120'000) ;
 *      client sans facture (Tech Park) exclu → aucune marge -100% ;
 *   2. Corps de métier : en-tête « CA facturé/m² » ;
 *   3. ISOLATION : le bloc « Analyse m² » affiche encore « CA signé moyen / m² » et son total DEVISÉ
 *      (162'000), preuve qu'il n'a PAS été migré ;
 *   4. CONSERVATION : Σ(CA facturé par client) == CA facturé HT total == 171'500 (année démo) ;
 *      + conservation par type sur une fixture mono-type.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Analyse from '../Analyse';
import { caFactureHTParChantier, caFactureHTDansPeriode } from '../calculs/periode';
import { donneesDemo } from '../donnees-demo';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const ANNEE = new Date().getFullYear();
const PARAMETRES = { employes: [], localites: [], typesTravaux: [{ nom: 'Cloisons' }, { nom: 'Plafonds' }],
  parametres: { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12, tauxChargesSociales: 25, tauxImpots: 15 } };
// BPG : DEVISÉ 120'000 mais FACTURÉ 100'000 (l'écart prouve la migration). Tech Park : coûts, aucune facture.
const DEVIS = [
  { id: 'dvBpg',  montantHT: 120000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] },
  { id: 'dvTech', montantHT: 42000,  statut: 'accepté', clientId: 'cl2', avenants: [], heuresRegie: [] },
];
const CLIENTS = [{ id: 'cl1', nom: 'BPG', entreprise: 'BPG SA' }, { id: 'cl2', nom: 'Tech', entreprise: 'Tech Park' }];
const CHANTIERS = [
  { id: 'bpg',  nom: 'BPG',  statut: 'En cours', clientId: 'cl1', devisId: 'dvBpg',
    dateDebut: `${ANNEE}-02-01`, nombreJours: 10, surface: 100, typesTravaux: ['Cloisons'], journal: [], equipe: [] },
  { id: 'tech', nom: 'Tech', statut: 'En cours', clientId: 'cl2', devisId: 'dvTech',
    dateDebut: `${ANNEE}-03-01`, nombreJours: 5, surface: 50, materielReel: 20000, typesTravaux: ['Plafonds'], journal: [], equipe: [] },
];
const FACTURES = [{ id: 'fB', chantierId: 'bpg', clientId: 'cl1', statut: 'envoyee',
  montantHT: 100000, montantTTC: 108100, dateEmission: `${ANNEE}-02-15` }];

function renderAnalyse() {
  return renderWithApp(
    <Analyse chantiers={CHANTIERS} clients={CLIENTS} devis={DEVIS}
      parametres={PARAMETRES} setParametres={vi.fn()} factures={FACTURES} periodeGlobale="annee" />,
    { pointages: [] },
  );
}

describe('CLIENTS — CA FACTURÉ HT (pas devisé), client sans facture exclu', () => {
  it('« Top clients par CA facturé » = 100\'000 (facturé), pas 120\'000 (devisé) ; Tech Park sans facture exclu', () => {
    renderAnalyse();
    fireEvent.click(screen.getByRole('button', { name: 'Clients' }));
    expect(screen.getByText('Meilleur CA facturé')).toBeInTheDocument();
    // Le bloc « Top clients par CA facturé » : on cible sa carte (le -100% de la Dérive du devisé,
    // jours réels vs prévus, est un autre bloc — devisé, non concerné).
    const carte = screen.getByText('Top clients par CA facturé').parentElement;
    // Valeur facturé de BPG = 100'000 ; le devisé 120'000 ne doit PAS apparaître dans la carte clients.
    expect(within(carte).getAllByText(/CHF 100'000/).length).toBeGreaterThanOrEqual(1);
    expect(within(carte).queryByText(/CHF 120'000/)).toBeNull();
    // Tech Park (sans facture, CA facturé 0) est EXCLU du classement → aucune marge -100% trompeuse.
    expect(within(carte).queryByText('Tech Park')).toBeNull();
    expect(within(carte).queryByText('Tech')).toBeNull();
    expect(carte.textContent).not.toContain('-100%');
  });
});

describe('CORPS DE MÉTIER — en-tête « CA facturé/m² » + ISOLATION du bloc m²', () => {
  it('Corps de métier passe en facturé ; « Analyse m² » reste sur le DEVISÉ (162\'000)', () => {
    renderAnalyse();
    fireEvent.click(screen.getByRole('button', { name: 'Par type & surface' }));
    // Corps de métier migré : en-tête « CA facturé/m² ».
    expect(screen.getByText('CA facturé/m²')).toBeInTheDocument();
    // ISOLATION : le bloc Analyse m² garde son libellé DEVISÉ et son total devisé (120'000 + 42'000 = 162'000).
    expect(screen.getByText('CA signé moyen / m²')).toBeInTheDocument();
    expect(screen.getByText(/CA signé total CHF 162'000/)).toBeInTheDocument();
  });
});

describe('CONSERVATION — aucune part perdue ni doublée', () => {
  it('CLIENTS démo : Σ(CA facturé par chantier) == année == 171\'500 (clientId partitionne)', () => {
    const factures = donneesDemo.factures;
    const chantiers = donneesDemo.chantiers;
    const ref = new Date(2026, 5, 15);
    const total = caFactureHTDansPeriode(factures, 'annee', ref);
    // Somme par chantier (== somme par client, chaque chantier ayant un unique clientId).
    const sommeParChantier = chantiers.reduce((s, c) => s + caFactureHTParChantier(factures, c.id, 'annee', ref), 0);
    expect(total).toBeCloseTo(171500, 4);
    expect(sommeParChantier).toBeCloseTo(171500, 4);
  });

  it('CORPS DE MÉTIER : Σ(CA facturé par type) == total sur une fixture mono-type', () => {
    const ref = new Date(ANNEE, 5, 15);
    // BPG (type Cloisons) facturé 100'000, Tech (type Plafonds) 0 → Σ types == 100'000 == total.
    const parType = { Cloisons: 0, Plafonds: 0 };
    CHANTIERS.forEach(c => { parType[c.typesTravaux[0]] += caFactureHTParChantier(FACTURES, c.id, 'annee', ref); });
    const total = caFactureHTDansPeriode(FACTURES, 'annee', ref);
    expect(parType.Cloisons + parType.Plafonds).toBeCloseTo(total, 4);
    expect(total).toBeCloseTo(100000, 4);
  });
});
