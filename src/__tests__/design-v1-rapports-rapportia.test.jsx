/**
 * Design v1 — page RAPPORTS, LOT 1 : coquille hero + 4 onglets + onglet Rapport IA.
 * ⚠ Les données du résumé exécutif (agentData.RapportNaturel : paras, score, action) et le
 *   sélecteur de période sont de la logique métier → ZÉRO touché. Rhabillage pur (JSX + styles).
 *   Les onglets Analyse / Simulateur / Benchmark gardent leur rendu (lots 2/3/4).
 *
 * Preuve RTL RÉELLE (vrai RapportsPage via renderWithApp) :
 *   1. le hero affiche les 4 onglets (Rapport IA / Analyse / Simulateur / Benchmark) ; ☰ ↦ ouvrirMenu ;
 *   2. le sélecteur de période a été RETIRÉ (Rapports = vue annuelle globale) — le hero n'en a plus ;
 *   3. onglet Rapport IA : score /100 + points numérotés + action prioritaire aux VRAIES valeurs ;
 *   4. bascule d'onglet : Analyse s'affiche (rendu conservé), le résumé IA disparaît.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import RapportsPage from '../pages/RapportsPage';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const RAPPORT = {
  date: 'Semaine du 08.06', scoreEntreprise: 72,
  paras: ['La semaine a été solide.', 'Deux chantiers en retard.'],
  actionPrincipale: { action: 'Relancer la facture F-12', detail: 'En retard de 45 jours' },
};

const PARAMETRES = {
  employes: [], localites: [], typesTravaux: [],
  parametres: { tauxTVA: 8.1, tauxFraisGeneraux: 12, tauxChargesSociales: 25, tauxImpots: 15 },
};

function renderRapports(over = {}) {
  return renderWithApp(
    <RapportsPage chantiers={[]} clients={[]} devis={[]} parametres={PARAMETRES}
      setParametres={vi.fn()} periodeGlobale={over.periodeGlobale || 'annee'} naviguer={vi.fn()} factures={[]} />,
    { agentState: over.agentState || {}, ouvrirMenu: over.ouvrirMenu || vi.fn(),
      setPeriodeGlobale: over.setPeriodeGlobale || vi.fn(), ...over.ctx },
  );
}

describe('HERO Rapports — 4 onglets + ☰', () => {
  it('affiche les 4 onglets dans le hero et le titre « Rapports »', () => {
    renderRapports();
    const hero = within(screen.getByTestId('hero-rapports'));
    expect(hero.getByRole('button', { name: /Rapport IA/i })).toBeInTheDocument();
    expect(hero.getByRole('button', { name: /^Analyse$/i })).toBeInTheDocument();
    expect(hero.getByRole('button', { name: /Simulateur/i })).toBeInTheDocument();
    expect(hero.getByRole('button', { name: /Benchmark/i })).toBeInTheDocument();
    expect(hero.getByRole('heading', { name: 'Rapports' })).toBeInTheDocument();
  });

  it('le bouton ☰ du hero appelle ouvrirMenu', () => {
    const ouvrirMenu = vi.fn();
    renderRapports({ ouvrirMenu });
    fireEvent.click(within(screen.getByTestId('hero-rapports')).getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });
});

describe('SÉLECTEUR DE PÉRIODE — retiré (Rapports = vue annuelle globale)', () => {
  // Décision patron (cohérence périodes, lot 1) : Rapports est une vue d'ensemble ANNUELLE et son
  // contenu ne réagit pas à la période → le sélecteur Semaine/Mois/Année, trompeur, a été retiré du hero.
  it('le hero ne contient plus de bouton Semaine/Mois/Année', () => {
    renderRapports({ periodeGlobale: 'annee' });
    const hero = within(screen.getByTestId('hero-rapports'));
    expect(hero.queryByRole('button', { name: /^Semaine$/ })).toBeNull();
    expect(hero.queryByRole('button', { name: /^Mois$/ })).toBeNull();
    expect(hero.queryByRole('button', { name: /^Année$/ })).toBeNull();
  });
});

describe('ONGLET RAPPORT IA — résumé exécutif (vraies valeurs)', () => {
  it('affiche le score /100, les points numérotés et l\'action prioritaire', () => {
    renderRapports({ agentState: { agentData: { RapportNaturel: RAPPORT } } });
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('SCORE /100')).toBeInTheDocument();
    expect(screen.getByText('La semaine a été solide.')).toBeInTheDocument();
    expect(screen.getByText('Deux chantiers en retard.')).toBeInTheDocument();
    expect(screen.getByText('Action prioritaire recommandée')).toBeInTheDocument();
    expect(screen.getByText('Relancer la facture F-12')).toBeInTheDocument();
  });

  it('sans rapport généré → message d\'attente (garde inchangée)', () => {
    renderRapports({ agentState: {} });
    expect(screen.getByText(/Rapport IA non encore généré/i)).toBeInTheDocument();
  });
});

describe('BASCULE d\'onglet — Analyse conserve son rendu', () => {
  it('cliquer « Analyse » affiche la vue Analyse et masque le résumé IA', () => {
    renderRapports({ agentState: { agentData: { RapportNaturel: RAPPORT } } });
    expect(screen.getByText('La semaine a été solide.')).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('hero-rapports')).getByRole('button', { name: /^Analyse$/i }));
    // Vue Analyse (4 vues regroupées) présente, résumé IA disparu
    expect(screen.getByRole('button', { name: 'Rentabilité' })).toBeInTheDocument();
    expect(screen.queryByText('La semaine a été solide.')).toBeNull();
  });
});
