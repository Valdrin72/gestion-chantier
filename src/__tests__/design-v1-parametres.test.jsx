/**
 * Design v1 — page PARAMÈTRES. Maquette validée patron. Rhabillage pur.
 * ⚠ Mécaniques sensibles (backups, simulateur démo, réglages) : ZÉRO logique touchée.
 *
 * Preuve RTL RÉELLE (vrai composant Parametres rendu via renderWithApp) :
 *   1. le hero affiche le titre + les 3 boutons de backup ; ☰ ouvre le drawer ;
 *   2. le menu latéral liste les 10 catégories ; cliquer une catégorie change le contenu ;
 *   3. la section « Réglages tableau de bord » affiche le simulateur (mode démo) + les params dashboard ;
 *   4. modifier un réglage persiste (setParametres) ; « Charger ce scénario » déclenche l'action.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Parametres from '../pages/ParametresPage';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const PARAMS = { parametres: { joursAlerte: 5, tauxFraisGeneraux: 12, coefficientMainOeuvre: 1.35, tauxTVA: 8.1 }, employes: [], typesTravaux: [], localites: [] };

function renderParams(over = {}) {
  const setParametres = over.setParametres || vi.fn();
  return renderWithApp(
    <Parametres parametres={over.parametres || PARAMS} setParametres={setParametres}
      clients={[]} setClients={vi.fn()} chantiers={[]} setChantiers={over.setChantiers || vi.fn()}
      devis={[]} setDevis={over.setDevis || vi.fn()} factures={[]} setFactures={over.setFactures || vi.fn()}
      pointages={[]} setPointages={over.setPointages || vi.fn()} naviguer={over.naviguer || vi.fn()} />,
    { confirmer: vi.fn().mockResolvedValue(true), afficherNotif: vi.fn(),
      ouvrirMenu: over.ouvrirMenu || vi.fn(), isDemo: over.isDemo || false, ...over.ctx },
  );
}

describe('HERO — titre + boutons backup + ☰', () => {
  it('affiche « Paramètres » et les 3 boutons de backup', () => {
    renderParams();
    const hero = within(screen.getByTestId('hero-parametres'));
    expect(hero.getByRole('heading', { name: 'Paramètres' })).toBeInTheDocument();
    expect(hero.getByRole('button', { name: /Restaurer backup/i })).toBeInTheDocument();
    expect(hero.getByRole('button', { name: /Exporter backup/i })).toBeInTheDocument();
    expect(hero.getByRole('button', { name: /Sauvegarder tout/i })).toBeInTheDocument();
  });

  it('le bouton ☰ du hero appelle ouvrirMenu', () => {
    const ouvrirMenu = vi.fn();
    renderParams({ ouvrirMenu });
    fireEvent.click(within(screen.getByTestId('hero-parametres')).getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });
});

describe('MENU latéral — 8 catégories + navigation', () => {
  it('liste les 8 catégories et cliquer « Devis » puis « Travaux » change le contenu', () => {
    renderParams();
    // Localités + Zones géo. retirées (ménage Réglages) : la ville chantier est en saisie libre,
    // aucun tarif de zone/déplacement n'était consommé par l'app.
    ['Réglages tableau de bord', 'Légende des statuts', 'Devis', 'Travaux',
     'Société', 'Paiements', 'Rapport', 'Agents IA'].forEach(cat => {
      expect(screen.getByText(cat)).toBeInTheDocument();
    });
    // Onglets retirés → plus affichés.
    expect(screen.queryByText('Localités')).toBeNull();
    expect(screen.queryByText('Zones géo.')).toBeNull();
    // Défaut = Dashboard
    expect(screen.getByText('Paramètres du Dashboard')).toBeInTheDocument();
    // → Devis
    fireEvent.click(screen.getByText('Devis'));
    expect(screen.getByText('Frais généraux (%)')).toBeInTheDocument();
    // → Travaux
    fireEvent.click(screen.getByText('Travaux'));
    expect(screen.getByPlaceholderText('Ex: Bardage')).toBeInTheDocument();
  });
});

describe('RÉGLAGES DASHBOARD — persistance (action inchangée)', () => {
  it('modifier « Alerte jours restants » appelle setParametres', () => {
    const setParametres = vi.fn();
    renderParams({ setParametres });
    const card = screen.getByText('Alerte jours restants').closest('div');
    fireEvent.change(within(card).getByRole('spinbutton'), { target: { value: '9' } });
    expect(setParametres).toHaveBeenCalled();
  });
});

describe('SIMULATEUR (mode démo) — 5 scénarios + Charger', () => {
  it('affiche le simulateur avec les 5 scénarios et « Charger » applique le jeu de données', () => {
    // Le SimulateurScenarios lit les setters depuis le contexte (useApp), pas les props.
    const setChantiers = vi.fn();
    renderParams({ isDemo: true, ctx: { isDemo: true, setChantiers, setDevis: vi.fn(), setFactures: vi.fn(), setClients: vi.fn(), setPointages: vi.fn(), setParametres: vi.fn() } });
    const simu = within(screen.getByTestId('simulateur-scenarios'));
    expect(simu.getByText(/Simulateur de scénarios/i)).toBeInTheDocument();
    // 5 boutons « Charger ce scénario »
    const boutons = simu.getAllByRole('button', { name: /Charger ce scénario/i });
    expect(boutons).toHaveLength(5);
    // Charger le 1er → applique un jeu de démo (setChantiers appelé) — action inchangée
    fireEvent.click(boutons[0]);
    expect(setChantiers).toHaveBeenCalled();
  });

  it('hors mode démo, le simulateur n\'apparaît pas (garde-fou inchangé)', () => {
    renderParams({ isDemo: false });
    expect(screen.queryByTestId('simulateur-scenarios')).toBeNull();
  });
});
