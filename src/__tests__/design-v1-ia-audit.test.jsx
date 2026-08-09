/**
 * Design v1 — page IA, LOT 2 : onglet AUDIT (contenu habillé v1).
 * ⚠ L'onglet contient le moteur d'audit (25 règles code/données/BTP + score).
 *   ZÉRO logique touchée : rhabillage pur. La coquille hero/onglets (lot 1) est réutilisée.
 *
 * Preuve RTL RÉELLE (vrai CentreIA via renderWithApp, vrai composant AuditApp + vrai moteur) :
 *   1. onglet Audit : le hero affiche le score + les compteurs (Erreurs/Avert./OK) aux VRAIES
 *      valeurs remontées par le moteur ;
 *   2. les vérifications s'affichent groupées par section avec leurs statuts OK/Erreur ;
 *   3. le filtre par CATÉGORIE filtre la liste ;
 *   4. les compteurs du hero filtrent par NIVEAU (Erreurs) ;
 *   5. « Relancer l'audit » déclenche son action (le composant reste rendu).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import CentreIA from '../pages/CentreIA';

// L'onglet Claude AI importe useClaudeAI → lib/supabase (variables .env). On neutralise.
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })), auth: { getSession: vi.fn() } },
}));

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

// Données déclenchant AU MOINS une erreur réelle du moteur (facture orpheline) tout en
// laissant de nombreuses vérifications OK → compteurs Erreurs ≥ 1 et OK ≥ 1 garantis.
const FACTURE_ORPHELINE = { id: 'f1', numero: 'F-001', chantierId: '999', montantHT: 1000, montantTTC: 1081, tva: 8.1, statut: 'payé' };

function renderAudit(over = {}) {
  const res = renderWithApp(<CentreIA />, {
    chantiers: [], devis: [], factures: [FACTURE_ORPHELINE], clients: [], parametres: { employes: [] },
    agentState: {}, ouvrirMenu: vi.fn(), pointages: [], ...over.ctx,
  });
  // Aller sur l'onglet Audit via la coquille hero (lot 1)
  fireEvent.click(within(screen.getByTestId('hero-ia')).getByRole('button', { name: /^Audit$/i }));
  return res;
}

describe('HERO Audit — score + compteurs (vraies valeurs du moteur)', () => {
  it('affiche le score /100 et les 3 compteurs, Erreurs ≥ 1 et OK ≥ 1', () => {
    renderAudit();
    const chiffres = within(screen.getByTestId('hero-chiffres'));
    // Score cohérence sur 100
    expect(within(screen.getByTestId('hero-kpi-score-cohérence')).getByText(/\/100$/)).toBeInTheDocument();
    // Compteur Erreurs = vraie valeur (≥ 1 grâce à la facture orpheline)
    const nErr = parseInt(within(screen.getByTestId('hero-kpi-erreurs')).getByText(/^\d+$/).textContent, 10);
    expect(nErr).toBeGreaterThanOrEqual(1);
    // Compteur OK = vraie valeur (≥ 1)
    const nOk = parseInt(within(screen.getByTestId('hero-kpi-ok')).getByText(/^\d+$/).textContent, 10);
    expect(nOk).toBeGreaterThanOrEqual(1);
    expect(chiffres.getByText('AVERTISSEMENTS')).toBeInTheDocument();
  });
});

describe('VÉRIFICATIONS — groupées par section avec statuts', () => {
  it('affiche la vérification en erreur (facture orpheline) et une vérification OK', () => {
    renderAudit();
    // Erreur réelle : facture liée à un chantier valide
    expect(screen.getByText('Factures liées à un chantier valide')).toBeInTheDocument();
    // Vérif OK d'une autre section (Configuration)
    expect(screen.getByText('Au moins 1 employé actif configuré')).toBeInTheDocument();
    // Sections listées comme pastilles de filtre (Intégrité + Configuration)
    const filtres = within(screen.getByTestId('audit-filtres'));
    expect(filtres.getByRole('button', { name: /^Intégrité des liens/ })).toBeInTheDocument();
    expect(filtres.getByRole('button', { name: /^Configuration/ })).toBeInTheDocument();
    // Un badge « Erreur » est présent (statut du check orphelin)
    expect(screen.getAllByText(/^Erreur$/).length).toBeGreaterThanOrEqual(1);
  });
});

describe('FILTRE CATÉGORIE — filtre la liste', () => {
  it('cliquer la pastille « Configuration » masque les vérifications des autres sections', () => {
    renderAudit();
    // Avant filtre : la vérif Intégrité est visible
    expect(screen.getByText('Factures liées à un chantier valide')).toBeInTheDocument();
    // Filtrer sur Configuration
    fireEvent.click(within(screen.getByTestId('audit-filtres')).getByRole('button', { name: /^Configuration/ }));
    // La vérif Intégrité disparaît, une vérif Configuration reste
    expect(screen.queryByText('Factures liées à un chantier valide')).toBeNull();
    expect(screen.getByText('Au moins 1 employé actif configuré')).toBeInTheDocument();
  });
});

describe('COMPTEURS HERO — filtre par niveau', () => {
  it('cliquer le compteur « Erreurs » ne garde que les vérifications en erreur', () => {
    renderAudit();
    // Une vérif OK visible avant filtre
    expect(screen.getByText('Factures liées à un client valide')).toBeInTheDocument();
    // Cliquer le compteur Erreurs du hero
    fireEvent.click(within(screen.getByTestId('hero-kpi-erreurs')).getByText(/^\d+$/));
    // Les vérifs OK disparaissent, l'erreur reste
    expect(screen.queryByText('Factures liées à un client valide')).toBeNull();
    expect(screen.getByText('Factures liées à un chantier valide')).toBeInTheDocument();
  });
});

describe('RELANCER L\'AUDIT — action inchangée', () => {
  it('le bouton du hero relance l\'audit sans casser l\'affichage', () => {
    renderAudit();
    const hero = within(screen.getByTestId('hero-ia'));
    fireEvent.click(hero.getByRole('button', { name: /Relancer l'audit/i }));
    // Le composant Audit reste rendu et cohérent
    expect(screen.getByTestId('audit-app')).toBeInTheDocument();
    expect(within(screen.getByTestId('hero-kpi-score-cohérence')).getByText(/\/100$/)).toBeInTheDocument();
  });
});
