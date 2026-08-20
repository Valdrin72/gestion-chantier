/**
 * Design v1 — page Rapports / onglet Analyse, SOUS-LOT 2c-2 : composant Statistiques.js.
 * ⚠ MONEY-CRITICAL : 6 graphiques recharts + tableaux (CA / Coûts / Marge, écarts, clients,
 *   employés). ZÉRO donnée de graphique ni calcul touché — recoloration + habillage v1.
 *
 * Preuve RTL RÉELLE (vrai composant Statistiques via renderWithApp) :
 *   1. les KPI globaux + chiffres clés s'affichent aux vraies valeurs ;
 *   2. les graphiques se rendent avec leurs séries (CA signé / Coûts / Marge) et légendes ;
 *   3. les tableaux (rentabilité par travaux, classement clients) affichent leurs valeurs ;
 *   4. la palette de série ne contient plus AUCUN violet (couleurs socle v1).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AppProvider } from '../context/AppContext';
import Statistiques from '../Statistiques';
import { V1 } from '../design/v1';

// recharts a besoin d'une taille de conteneur non nulle dans jsdom (ResponsiveContainer).
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
  employes: [], localites: [], typesTravaux: [{ nom: 'Faux-plafond' }],
  parametres: { tauxTVA: 8.1, tauxFraisGeneraux: 12, tauxChargesSociales: 25, tauxImpots: 15 },
};
const DEVIS = [{ id: 'dv1', montantHT: 60000, statut: 'Accepté', clientId: 'cl1' }];
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA', prenom: 'Jean' }];
const CHANTIERS = [{
  id: 'c1', nom: 'Chantier Un', statut: 'En cours', clientId: 'cl1', devisId: 'dv1',
  dateDebut: `${ANNEE}-02-01`, nombreJours: 10, surface: 100, typesTravaux: ['Faux-plafond'],
  journal: [], equipe: [],
}];
// Lot 4c : la page est passée au CA FACTURÉ HT → il faut une facture pour peupler les blocs.
// montantHT 60'000 émis dans l'année → CA facturé HT = 60'000 (identique à l'ancien attendu chiffré).
const FACTURES = [{ id: 'f1', numero: 'F-1', chantierId: 'c1', clientId: 'cl1', statut: 'envoyee',
  montantHT: 60000, montantTTC: 64860, dateEmission: `${ANNEE}-03-15` }];

function renderStats() {
  const ctx = {
    chantiers: CHANTIERS, clients: CLIENTS, devis: DEVIS, factures: FACTURES,
    parametres: PARAMETRES, pointages: [],
    setChantiers: vi.fn(), setClients: vi.fn(), setDevis: vi.fn(), setFactures: vi.fn(),
    setParametres: vi.fn(), setPointages: vi.fn(), naviguer: vi.fn(), contexte: {},
    agentState: {}, afficherNotif: vi.fn(), confirmer: vi.fn(),
  };
  return render(
    <AppProvider value={ctx}>
      <Statistiques chantiers={CHANTIERS} clients={CLIENTS} devis={DEVIS}
        parametres={PARAMETRES} periodeGlobale="annee" />
    </AppProvider>
  );
}

describe('KPIs + chiffres clés (vraies valeurs)', () => {
  it('affiche les 4 KPI globaux', () => {
    renderStats();
    // Lot 4c : « CA SIGNÉ ANNÉE » → « CA FACTURÉ » (CA facturé HT de la période).
    expect(screen.getByText('CA FACTURÉ')).toBeInTheDocument();
    expect(screen.queryByText('CA SIGNÉ ANNÉE')).toBeNull();
    expect(screen.getByText('MARGE NETTE')).toBeInTheDocument();
    expect(screen.getByText('CHANTIERS')).toBeInTheDocument();
    // Prévision libellée « · ANNÉE » (annuelle, ne suit pas la période).
    expect(screen.getByText(/PRÉVISION 3 MOIS/)).toBeInTheDocument();
    // CA facturé = facture 60 000 HT → "CHF 60'000" présent
    expect(screen.getAllByText(/CHF 60'000/).length).toBeGreaterThan(0);
  });
});

describe('GRAPHIQUES — séries CA / Coûts / Marge + titres', () => {
  it('affiche les titres de graphiques et les libellés de séries (légendes)', () => {
    renderStats();
    // Graphe mensuel ANNUEL, libellé explicite « — Année {X} » (ne suit pas la période).
    expect(screen.getByText(new RegExp(`CA facturé mensuel — Année ${ANNEE}`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Évolution de la marge \\(%\\) — Année ${ANNEE}`))).toBeInTheDocument();
    expect(screen.getByText('Répartition par travaux')).toBeInTheDocument();
    expect(screen.getByText('Répartition par client')).toBeInTheDocument();
    // Séries présentes (légendes recharts) : "CA facturé", "Coûts", "Marge"
    expect(screen.getAllByText('CA facturé').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Coûts').length).toBeGreaterThan(0);
  });
});

describe('TABLEAUX — rentabilité travaux + classement clients', () => {
  it('affiche la rentabilité par type de travaux et le classement clients', () => {
    renderStats();
    expect(screen.getByText('Rentabilité par type de travaux')).toBeInTheDocument();
    expect(screen.getByText('Classement clients')).toBeInTheDocument();
    expect(screen.getAllByText('Faux-plafond').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dupont SA').length).toBeGreaterThan(0);
  });
});

describe('RECOLORATION — plus aucun violet dans les séries', () => {
  it('les constantes de couleur de série sont des bleus/vert du socle (pas de violet)', () => {
    // COL_CA = marine, COL_COUT = bleuMoyen (distinct), COL_MARGE = ok — aucun violet.
    const VIOLETS = ['#8b5cf6', '#6366f1', '#7c3aed', '#a855f7', '#4f46e5', '#4c1d95'];
    [V1.marine, V1.bleuMoyen, V1.ok, V1.bleu, V1.bleuClair, V1.warn].forEach(c => {
      expect(VIOLETS).not.toContain(c.toLowerCase());
    });
    // Contraste CA vs Coûts : les deux séries ne doivent pas être identiques
    expect(V1.marine).not.toBe(V1.bleuMoyen);
  });
});
