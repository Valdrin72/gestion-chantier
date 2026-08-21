/**
 * Cohérence des périodes — SOUS-LOT 4d (Analyse, cœur money).
 * ⚠ MONEY-CRITICAL. Portée resserrée : cascade de rentabilité + seuil + projections + objectifs
 * basculent sur le CA FACTURÉ HT (helper partagé indicateursMargeChantier / caFactureHTDansPeriode).
 * Les blocs « Prévu vs Réel » et « Dérive du devisé » RESTENT sur le devisé (mesure d'estimation) —
 * on prouve qu'ils ne bougent pas. Les blocs #6/#7/#8 (Corps de métier / Clients / m²) sont HORS 4d.
 *
 * Preuve RTL RÉELLE (vrai composant Analyse + Marges via renderWithApp) :
 *   1. Cascade = CA FACTURÉ HT (Σ factures HT de la période), pas le devisé ;
 *   2. réactivité : la cascade change entre vue « année » et vue « mois » ;
 *   3. « Prévu vs Réel » garde la colonne « Devisé » = montant DEVISÉ (≠ CA facturé) ;
 *   4. cohérence inter-écrans : cascade Analyse == Marges (même helper, même chantier/période) ;
 *   5. projections/objectifs annuels + libellés « CA facturé — Année X » ;
 *   6. emboîtement + nombre démo : Σ(12 mois) == année == 171'500 (== Marges 4a == Stats 4c).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Analyse from '../Analyse';
import Marges from '../Marges';
import { caFactureHTDansPeriode } from '../calculs/periode';
import { donneesDemo } from '../donnees-demo';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const p2 = (n) => String(n).padStart(2, '0');
const ANNEE = new Date().getFullYear();
const MOIS = new Date().getMonth();               // mois courant (0-11)
const AUTRE = MOIS === 0 ? 1 : 0;                  // un autre mois de la même année
const DATE_MOIS  = `${ANNEE}-${p2(MOIS + 1)}-15`;  // facture du mois courant
const DATE_AUTRE = `${ANNEE}-${p2(AUTRE + 1)}-15`; // facture d'un autre mois

// BPG : DEVISÉ 120'000, mais FACTURÉ 30'000 (mois courant) + 100'000 (autre mois) = 130'000 sur l'année.
// Tech Park : devisé 42'000, coûts engagés, AUCUNE facture → 0 au CA facturé.
const DEVIS = [
  { id: 'dvBpg',  montantHT: 120000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] },
  { id: 'dvTech', montantHT: 42000,  statut: 'accepté', clientId: 'cl2', avenants: [], heuresRegie: [] },
];
const CLIENTS = [{ id: 'cl1', nom: 'BPG', entreprise: 'BPG SA' }, { id: 'cl2', nom: 'Tech', entreprise: 'Tech Park' }];
const CHANTIERS = [
  { id: 'bpg',  nom: 'BPG',       statut: 'En cours', clientId: 'cl1', devisId: 'dvBpg',
    dateDebut: `${ANNEE}-02-01`, nombreJours: 10, materielReel: 40000, journal: [], equipe: [] },
  { id: 'tech', nom: 'Tech Park', statut: 'En cours', clientId: 'cl2', devisId: 'dvTech',
    dateDebut: `${ANNEE}-03-01`, nombreJours: 5, materielReel: 20000, journal: [], equipe: [] },
];
const FACTURES = [
  { id: 'fA', chantierId: 'bpg', clientId: 'cl1', statut: 'envoyee', montantHT: 30000,  montantTTC: 32430,  dateEmission: DATE_MOIS },
  { id: 'fB', chantierId: 'bpg', clientId: 'cl1', statut: 'envoyee', montantHT: 100000, montantTTC: 108100, dateEmission: DATE_AUTRE },
];
const PARAMETRES = { employes: [], localites: [], typesTravaux: [],
  parametres: { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12, tauxChargesSociales: 25, tauxImpots: 15 } };

function renderAnalyse(periodeGlobale = 'annee') {
  return renderWithApp(
    <Analyse chantiers={CHANTIERS} clients={CLIENTS} devis={DEVIS}
      parametres={PARAMETRES} setParametres={vi.fn()} factures={FACTURES} periodeGlobale={periodeGlobale} />,
    { pointages: [] },
  );
}
const cascadeCard = () => screen.getByText('Cascade de rentabilité').parentElement;

describe('CASCADE — CA FACTURÉ HT (pas le devisé)', () => {
  it('vue année : CA facturé = 30\'000 + 100\'000 = 130\'000 (Tech Park sans facture = 0)', () => {
    renderAnalyse('annee');
    const card = cascadeCard();
    expect(within(card).getByText("Chiffre d'affaires facturé")).toBeInTheDocument();
    // 130'000 = Σ factures HT BPG ; PAS 120'000 (devisé) ni 162'000 (devisé BPG+Tech).
    expect(within(card).getAllByText(/CHF 130'000/).length).toBeGreaterThanOrEqual(1);
    expect(within(card).queryByText(/CHF 120'000/)).toBeNull();
    expect(within(card).queryByText(/CHF 162'000/)).toBeNull();
  });

  it('réactivité : vue mois → cascade = 30\'000 (seule la facture du mois courant compte)', () => {
    renderAnalyse('mois');
    const card = cascadeCard();
    expect(within(card).getAllByText(/CHF 30'000/).length).toBeGreaterThanOrEqual(1);
    expect(within(card).queryByText(/CHF 130'000/)).toBeNull(); // la cascade a bien réagi à la période
  });
});

describe('PRÉVU vs RÉEL — reste sur le DEVISÉ (logique inchangée, libellé clarifié)', () => {
  it('la colonne « Devisé » montre le devis (120\'000), distinct du CA facturé (130\'000)', () => {
    renderAnalyse('annee');
    expect(screen.getByText('Comparaison Devisé vs Réel par chantier')).toBeInTheDocument();
    // Le tableau devisé affiche le montant DEVISÉ de BPG = 120'000 (≠ facturé 130'000).
    expect(screen.getAllByText(/CHF 120'000/).length).toBeGreaterThanOrEqual(1);
  });
});

describe('COHÉRENCE INTER-ÉCRANS — cascade Analyse == Marges (même helper)', () => {
  it('Marges affiche le même CA FACTURÉ TOTAL que la cascade : 130\'000', () => {
    renderWithApp(
      <Marges chantiers={CHANTIERS} clients={CLIENTS} devis={DEVIS} parametres={PARAMETRES} periodeGlobale="annee" />,
      { pointages: [], factures: FACTURES },
    );
    expect(screen.getByText('CA FACTURÉ TOTAL')).toBeInTheDocument();
    expect(screen.getAllByText(/CHF 130'000/).length).toBeGreaterThanOrEqual(1);
  });
});

describe('PROJECTIONS / OBJECTIFS — annuels + libellés explicites « Année X »', () => {
  it('projections et objectifs portent le libellé CA facturé annuel', () => {
    renderAnalyse('annee');
    // On bascule sur la vue Tendances & objectifs.
    fireEvent.click(screen.getByRole('button', { name: 'Tendances & objectifs' }));
    expect(screen.getByText(new RegExp(`Projections CA facturé — Année ${ANNEE}`))).toBeInTheDocument();
    expect(screen.getByText('CA facturé annuel')).toBeInTheDocument();
  });
});

describe('EMBOÎTEMENT + nombre démo (== Marges 4a == Statistiques 4c)', () => {
  it('Σ(12 mois) == année == 171\'500 sur les factures démo 2026', () => {
    const factures = donneesDemo.factures;
    const ref = new Date(2026, 5, 15);
    const annee = caFactureHTDansPeriode(factures, 'annee', ref);
    const somme = Array.from({ length: 12 }, (_, m) => caFactureHTDansPeriode(factures, 'mois', new Date(2026, m, 15)))
      .reduce((a, b) => a + b, 0);
    expect(annee).toBeCloseTo(171500, 4);
    expect(somme).toBeCloseTo(annee, 4);
  });
});
