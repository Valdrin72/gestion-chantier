/**
 * Cohérence des périodes — SOUS-LOT 4b : liste CHANTIERS (ChantiersListe).
 * ⚠ MONEY-CRITICAL : le hero adopte le MÊME modèle que la page Marges (pilote 4a).
 *
 * Avant (obsolète) : tuile « CA SIGNÉ » = Σ CA DEVISÉ des chantiers rattachés par CHEVAUCHEMENT
 *   `dateDebut` (chantiersInPeriode) → un chantier était compté à 100 % dans CHAQUE mois traversé.
 * Après (ce lot)   : tuile « CA FACTURÉ » = Σ montantHT des factures de la période (helper partagé
 *   indicateursMargeChantier) ; « MARGE » = facturé HT − coûts prorata ; « À FACTURER » = coûts
 *   engagés non facturés (chantier sans facture → 0 + à facturer, jamais −100 %).
 *   nbEnCours reste un indicateur de PORTEFEUILLE (global, pas « de la période »).
 *
 * Preuve RTL RÉELLE (vrais composants ChantiersListe + Marges) :
 *   1. hero : CA FACTURÉ 100'000, MARGE 60 %, À FACTURER 20'000, EN COURS 2 (global) ;
 *   2. chantier sans facture (Tech Park) → à facturer, AUCUN −100 % dans le hero ;
 *   3. COHÉRENCE INTER-ÉCRANS : CA facturé HT de ChantiersListe == celui de Marges (même chantier/période) ;
 *   4. le hero == le helper pour deux périodes différentes (réagit au sélecteur) + emboîtement Σ12 mois == année.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import ChantiersListe from '../components/chantiers/ChantiersListe';
import Marges from '../Marges';
import { caFactureHTDansPeriode } from '../calculs/periode';
import { fmtN } from '../donnees';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const ANNEE = new Date().getFullYear();
const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' }];
// BPG : facturé 100'000 HT en février + 40'000 matériel (forfait dans l'année) → marge 60 %.
// Tech Park : 20'000 matériel, AUCUNE facture → CA 0, marge N/D, à facturer 20'000 (pas −100 %).
const CH_BPG = { id: 'bpg', nom: 'BPG', numero: 'C-BPG', ville: 'Genève', statut: 'En cours', clientId: 'cl1',
  dateDebut: `${ANNEE}-02-01`, nombreJours: 10, materielReel: 40000, journal: [], extras: [] };
const CH_TECH = { id: 'tech', nom: 'Tech Park', numero: 'C-TECH', ville: 'Lausanne', statut: 'En cours', clientId: 'cl1',
  dateDebut: `${ANNEE}-03-01`, nombreJours: 5, materielReel: 20000, journal: [], extras: [] };
const CHANTIERS = [CH_BPG, CH_TECH];
const FACTURES = [
  { id: 'FB', numero: 'F-BPG', chantierId: 'bpg', clientId: 'cl1', statut: 'envoyee',
    montantHT: 100000, montantTTC: 108100, dateEmission: `${ANNEE}-02-15` },
];
const PARAMS = { employes: [EMP], localites: [], parametres: { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 } };

function renderListe(periodeGlobale = 'annee') {
  return renderWithApp(
    <ChantiersListe chantiersFiltres={CHANTIERS} chantiersArchives={[]} joursParChantier={{ bpg: 5, tech: 3 }}
      filtre="Tous" setFiltre={vi.fn()} onSelect={vi.fn()} onModifier={vi.fn()} onSupprimer={vi.fn()}
      onArchiver={vi.fn()} onRestaurer={vi.fn()} formSlot={null} />,
    { chantiers: CHANTIERS, clients: CLIENTS, devis: [], factures: FACTURES, pointages: [],
      parametres: PARAMS, naviguer: vi.fn(), afficherNotif: vi.fn(), confirmer: vi.fn().mockResolvedValue(true),
      agentState: {}, contexte: {}, periodeGlobale, setPeriodeGlobale: vi.fn(), ouvrirMenu: vi.fn() },
  );
}

describe('HERO — modèle FACTURÉ (CA facturé HT + marge période + à facturer)', () => {
  it('CA FACTURÉ 100\'000, MARGE 60 %, À FACTURER 20\'000, EN COURS 2 (portefeuille)', () => {
    renderListe('annee');
    expect(within(screen.getByTestId('kpi-ca-facturé')).getByText("CHF 100'000")).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-marge')).getByText('60%')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-à-facturer')).getByText("CHF 20'000")).toBeInTheDocument();
    // EN COURS = 2 : indicateur de portefeuille (global), pas « de la période ».
    expect(within(screen.getByTestId('kpi-en-cours')).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-en-cours')).getByText('PORTEFEUILLE')).toBeInTheDocument();
    // Les tuiles du modèle devisé ont disparu.
    expect(screen.queryByTestId('kpi-ca-signé')).toBeNull();
    expect(screen.queryByTestId('kpi-jours-planifiés')).toBeNull();
  });

  it('chantier sans facture (Tech Park) : à facturer 20\'000, AUCUN −100 % dans le hero', () => {
    renderListe('annee');
    const hero = screen.getByTestId('hero-chantiers');
    // Le piège éliminé : pas de marge −100 % (ni tiret ASCII, ni signe moins Unicode) dans le hero.
    expect(hero.textContent).not.toContain('-100%');
    expect(hero.textContent).not.toContain('−100%');
    // Le coût engagé non facturé de Tech Park est surfacé.
    expect(within(screen.getByTestId('kpi-à-facturer')).getByText("CHF 20'000")).toBeInTheDocument();
  });
});

describe('COHÉRENCE INTER-ÉCRANS — CA facturé ChantiersListe == Marges', () => {
  it('BPG affiche le même CA facturé HT (100\'000) sur les deux écrans (même helper)', () => {
    // 1) ChantiersListe
    const { unmount } = renderListe('annee');
    expect(within(screen.getByTestId('kpi-ca-facturé')).getByText("CHF 100'000")).toBeInTheDocument();
    unmount();
    // 2) Marges, même chantier/période
    renderWithApp(
      <Marges chantiers={CHANTIERS} clients={CLIENTS} devis={[]} parametres={PARAMS} periodeGlobale="annee" />,
      { pointages: [], factures: FACTURES },
    );
    // Total CA facturé Marges == total ChantiersListe (100'000) ; ligne BPG == 100'000.
    const ligneBpg = screen.getAllByText('BPG').map(el => el.closest('tr')).find(Boolean);
    expect(within(ligneBpg).getByText("CHF 100'000")).toBeInTheDocument();
    expect(screen.getAllByText("CHF 100'000").length).toBeGreaterThanOrEqual(1);
  });
});

describe('RÉACTIVITÉ à la période + emboîtement (données de la liste)', () => {
  it('le hero == le helper pour « année » ET « semaine » (réagit au sélecteur)', () => {
    const ref = new Date();
    const attenduAnnee = caFactureHTDansPeriode(FACTURES, 'annee', ref);
    const attenduSemaine = caFactureHTDansPeriode(FACTURES, 'semaine', ref);
    // année : la facture de février est comptée.
    const rA = renderListe('annee');
    expect(within(screen.getByTestId('kpi-ca-facturé')).getByText(`CHF ${fmtN(attenduAnnee)}`)).toBeInTheDocument();
    rA.unmount();
    // semaine courante : le hero reflète EXACTEMENT le helper (== 0 hors de la semaine du 15/02).
    renderListe('semaine');
    expect(within(screen.getByTestId('kpi-ca-facturé')).getByText(`CHF ${fmtN(attenduSemaine)}`)).toBeInTheDocument();
    // Le hero suit le sélecteur : l'année inclut toujours la facture de février (100'000) et la
    // couvre au moins autant que la semaine courante (date-robuste, aucun ancrage sur « aujourd'hui »).
    expect(attenduAnnee).toBe(100000);
    expect(attenduAnnee).toBeGreaterThanOrEqual(attenduSemaine);
  });

  it('INVARIANT d\'emboîtement : Σ(12 mois) == année sur les factures de la liste', () => {
    const somme = Array.from({ length: 12 }, (_, m) => caFactureHTDansPeriode(FACTURES, 'mois', new Date(ANNEE, m, 15)))
      .reduce((a, b) => a + b, 0);
    expect(somme).toBe(caFactureHTDansPeriode(FACTURES, 'annee', new Date(ANNEE, 5, 15)));
    expect(somme).toBe(100000);
  });
});
