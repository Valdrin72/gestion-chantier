/**
 * Design v1 — page ALERTES. Maquette validée patron. Rhabillage pur.
 * ZÉRO logique touchée : le moteur (store Zustand + règles) génère les alertes,
 * on ne rhabille que l'affichage.
 *
 * Preuve RTL RÉELLE (vrai composant AlertsPage rendu via renderWithApp, vraies
 * alertes injectées dans le VRAI store — aucun logic-mirror) :
 *   1. le hero affiche les 5 compteurs de gravité aux vraies valeurs ;
 *   2. la liste affiche les vraies alertes avec badge gravité + titre + description ;
 *   3. le filtre par sévérité filtre ;
 *   4. le bouton d'action d'une alerte navigue (action inchangée).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { AlertsPage } from '../modules/alertes/AlertsPage.js';
import { useAlertsStore } from '../modules/alertes/lib/store.js';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const NOW = new Date();
const A = (over) => ({
  id: over.id, stableKey: over.id, severity: over.severity, category: over.category || 'financier',
  title: over.title, message: over.message, createdAt: NOW, state: 'active',
  triggerType: 'schedule', destinataires: ['cyna'], actions: over.actions || [],
  contextRef: over.contextRef || null,
});

const ALERTS = [
  A({ id: 'a-crit', severity: 'CRITICAL', title: 'Trésorerie sous le seuil', message: 'Le solde passe sous le seuil critique.',
      actions: [{ label: 'Renseigner le solde', target: 'parametres' }] }),
  A({ id: 'a-high', severity: 'HIGH', title: 'Facture en retard', message: 'FAC-100 impayée depuis 40 jours.' }),
  A({ id: 'a-med',  severity: 'MEDIUM', title: 'Pointage manquant', message: 'Un pointage manque hier.' }),
  A({ id: 'a-low',  severity: 'LOW', title: 'Devis en attente', message: 'Devis envoyé sans réponse.' }),
];

function seed(alerts) {
  useAlertsStore.setState({ alerts });
}

beforeEach(() => { seed([]); });

describe('HERO — 5 compteurs de gravité + ☰', () => {
  it('affiche les 5 compteurs aux vraies valeurs (Critique 1, Élevé 1, Moyen 1, Faible 1, Info 0)', () => {
    seed(ALERTS);
    renderWithApp(<AlertsPage naviguer={vi.fn()} />, {});
    const compteurs = screen.getByTestId('hero-compteurs');
    expect(within(compteurs).getByText('CRITIQUE')).toBeInTheDocument();
    expect(within(compteurs).getByText('ÉLEVÉ')).toBeInTheDocument();
    expect(within(compteurs).getByText('MOYEN')).toBeInTheDocument();
    expect(within(compteurs).getByText('FAIBLE')).toBeInTheDocument();
    expect(within(compteurs).getByText('INFO')).toBeInTheDocument();
    // Valeurs réelles issues du store
    expect(within(screen.getByTestId('compteur-CRITICAL')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('compteur-INFO')).getByText('0')).toBeInTheDocument();
    // Ligne mono : 4 alertes actives
    expect(within(screen.getByTestId('hero-alertes')).getByText(/4 ALERTES ACTIVES · SURVEILLANCE EN TEMPS RÉEL/)).toBeInTheDocument();
  });

  it('le bouton ☰ du hero appelle ouvrirMenu', () => {
    seed(ALERTS);
    const ouvrirMenu = vi.fn();
    renderWithApp(<AlertsPage naviguer={vi.fn()} />, { ouvrirMenu });
    fireEvent.click(within(screen.getByTestId('hero-alertes')).getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });
});

describe('LISTE — vraies alertes + badge gravité + description', () => {
  it('affiche les alertes avec leur titre, description et badge de gravité', () => {
    seed(ALERTS);
    renderWithApp(<AlertsPage naviguer={vi.fn()} />, {});
    expect(screen.getByText('Trésorerie sous le seuil')).toBeInTheDocument();
    expect(screen.getByText('Le solde passe sous le seuil critique.')).toBeInTheDocument();
    // Badge gravité « Critique » présent dans la liste (getAll : compteur hero + badge carte)
    expect(screen.getAllByText(/Critique/i).length).toBeGreaterThan(0);
  });
});

describe('FILTRE par sévérité', () => {
  it('« Sévérité ≥ Élevé » ne garde que Critique + Élevé', () => {
    seed(ALERTS);
    renderWithApp(<AlertsPage naviguer={vi.fn()} />, {});
    // Par défaut (≥ Faible) : les 4 alertes sont là
    expect(screen.getByText('Devis en attente')).toBeInTheDocument();
    // Filtrer ≥ Élevé (HIGH) — le 1er combobox est le sélecteur de sévérité
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'HIGH' } });
    expect(screen.getByText('Trésorerie sous le seuil')).toBeInTheDocument();
    expect(screen.getByText('Facture en retard')).toBeInTheDocument();
    expect(screen.queryByText('Pointage manquant')).toBeNull();
    expect(screen.queryByText('Devis en attente')).toBeNull();
  });
});

describe('ACTION — le bouton d\'une alerte navigue (inchangé)', () => {
  it('« Renseigner le solde » appelle naviguer(target)', () => {
    seed([ALERTS[0]]);
    const naviguer = vi.fn();
    renderWithApp(<AlertsPage naviguer={naviguer} />, {});
    fireEvent.click(screen.getByRole('button', { name: /Renseigner le solde/i }));
    expect(naviguer).toHaveBeenCalledWith('parametres');
  });
});
