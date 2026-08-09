/**
 * Design v1 — page Rapports / onglet Benchmark (BenchmarkMarche.js). DERNIER lot de la page.
 * ⚠ MONEY-CRITICAL : agrégats par type/client/taille, marges, tri, performance,
 *   recommandations. ZÉRO calcul touché — rhabillage pur (JSX + styles).
 *
 * Preuve RTL RÉELLE (vrai composant BenchmarkMarche via renderWithApp) :
 *   1. les 4 indicateurs s'affichent aux vraies valeurs ;
 *   2. le tableau affiche les statuts de performance (Rentable / Non rentable) ;
 *   3. changer de filtre (Par client / Par taille) recompose le tableau ;
 *   4. changer le tri (Nb chantiers) réordonne réellement les lignes ;
 *   5. les 2 encarts de conseil (plus rentable / à améliorer) s'affichent.
 */
import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import BenchmarkMarche from '../BenchmarkMarche';

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
  parametres: { tauxFraisGeneraux: 12 },
};
const DEVIS = [
  { id: 'dv1', montantHT: 60000, statut: 'Accepté', clientId: 'cl1' },
  { id: 'dv2', montantHT: 20000, statut: 'Accepté', clientId: 'cl1' },
  { id: 'dv3', montantHT: 20000, statut: 'Accepté', clientId: 'cl1' },
];
// 1 chantier Faux-plafond sans coût (marge 100%) + 2 chantiers Carrelage avec gros
// coûts matériel (marge faible → Non rentable) → insights + tri exerçables.
const CHANTIERS = [
  { id: 'c1', nom: 'FP Un', statut: 'Terminé', clientId: 'cl1', devisId: 'dv1',
    dateDebut: `${ANNEE}-02-01`, nombreJours: 10, typesTravaux: ['Faux-plafond'], journal: [], equipe: [] },
  { id: 'c2', nom: 'Car Un', statut: 'Terminé', clientId: 'cl1', devisId: 'dv2',
    dateDebut: `${ANNEE}-03-01`, nombreJours: 5, typesTravaux: ['Carrelage'], materielReel: 18000, journal: [], equipe: [] },
  { id: 'c3', nom: 'Car Deux', statut: 'Terminé', clientId: 'cl1', devisId: 'dv3',
    dateDebut: `${ANNEE}-04-01`, nombreJours: 5, typesTravaux: ['Carrelage'], materielReel: 19000, journal: [], equipe: [] },
];

function renderBench() {
  return renderWithApp(
    <BenchmarkMarche chantiers={CHANTIERS} devis={DEVIS} parametres={PARAMETRES} />,
    { pointages: [] },
  );
}

const premiereLigne = () => screen.getAllByRole('row')[1].textContent;

describe('INDICATEURS — 4 cartes (vraies valeurs)', () => {
  it('affiche chantiers analysés, CA total, marge max/min', () => {
    renderBench();
    expect(screen.getByText('Chantiers analysés')).toBeInTheDocument();
    expect(screen.getByText('CA total réalisé')).toBeInTheDocument();
    expect(screen.getByText('Marge max (type)')).toBeInTheDocument();
    expect(screen.getByText('Marge min (type)')).toBeInTheDocument();
    // 3 chantiers terminés · CA = (60k + 20k + 20k)/1000 = 100k
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText("CHF 100k")).toBeInTheDocument();
    // Valeurs réelles des marges max/min : Faux-plafond 100% (sans coût),
    // Carrelage (18k+19k de matériel sur 40k de CA) → 7.5% (les badges du
    // tableau portent un préfixe « + », les KPI non → textes uniques).
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('7.5%')).toBeInTheDocument();
  });
});

describe('TABLEAU — performances + types réels', () => {
  it('affiche les types avec leurs statuts Rentable / Non rentable', () => {
    renderBench();
    expect(screen.getAllByText('Faux-plafond').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Carrelage').length).toBeGreaterThan(0);
    expect(screen.getByText('Rentable')).toBeInTheDocument();
    expect(screen.getByText('Non rentable')).toBeInTheDocument();
  });
});

describe('FILTRES + TRI — recomposition réelle', () => {
  it('« Par client » puis « Par taille » recomposent le tableau (comportement inchangé)', () => {
    renderBench();
    // → Par client (pas de clientNom → fallback "Client #cl1")
    fireEvent.click(screen.getByRole('button', { name: 'Par client' }));
    expect(screen.getByText('Client #cl1')).toBeInTheDocument();
    // → Par taille (60k et 20k tombent dans "Moyen (20–80k)")
    fireEvent.click(screen.getByRole('button', { name: 'Par taille' }));
    expect(screen.getByText('Moyen (20–80k)')).toBeInTheDocument();
  });

  it('trier par « Nb chantiers » réordonne les lignes (Carrelage ×2 passe premier)', () => {
    renderBench();
    // Tri par défaut = marge → Faux-plafond (100%) en tête
    expect(premiereLigne()).toContain('Faux-plafond');
    fireEvent.click(screen.getByRole('button', { name: 'Nb chantiers' }));
    // Carrelage a 2 chantiers → passe en tête
    expect(premiereLigne()).toContain('Carrelage');
  });
});

describe('ENCARTS DE CONSEIL', () => {
  it('affiche « Type le plus rentable » et « Type à améliorer »', () => {
    renderBench();
    expect(screen.getByText('Type le plus rentable')).toBeInTheDocument();
    expect(screen.getByText('Type à améliorer')).toBeInTheDocument();
  });
});
