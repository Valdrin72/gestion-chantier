/**
 * Directeur du matin — ÉTAPE 2 : mordants.
 *
 * Chaîne RÉELLE exercée (zéro logic-mirror) :
 *   - RYTHME : les vraies fonctions dateBriefing / doitRecalculerBriefing (une fois/jour + cache).
 *   - BLOC : le VRAI composant DirecteurMatin nourri par le VRAI simulerRapportLundi.
 *   - ANTI-CRASH : base vide → état neutre digne, jamais de NaN/undefined.
 *   - ACCUEIL INTACT : le VRAI Dashboard rend le nouveau bloc SANS supprimer les blocs existants.
 *   - BOUTON SIMULER : le VRAI composant Agents, clic réel → le briefing lundi s'affiche.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, act, cleanup } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { simulerRapportLundi } from '../AgentEngine';
import { dateBriefing, doitRecalculerBriefing } from '../useAgents';
import DirecteurMatin from '../components/DirecteurMatin';
import Dashboard from '../pages/Dashboard';
import Agents from '../Agents';

afterEach(() => cleanup());

const jours = (n) => new Date(Date.now() - n * 86400000).toISOString();

// Briefing réaliste : une facture impayée > 60j (action URGENT) + trésorerie J+30 négative (signal rouge).
function briefingReel() {
  return simulerRapportLundi({
    chantiers: [],
    factures: [{ numero: 'F-2026-1', clientId: 'c1', statut: 'envoyee', montantTTC: 12000, dateEmission: jours(70) }],
    devis: [],
    clients: [{ id: 'c1', prenom: 'Jean', nom: 'Dupont' }],
    parametres: {},
    rapports: [],
    agentData: { TresoreriePredictor: { solde30: -5000 } },
    alertes: [],
  });
}

describe('ÉTAPE 2 — RYTHME : calcul une fois par jour, persisté avec sa date', () => {
  it('dateBriefing renvoie la date locale au format YYYY-MM-DD', () => {
    const d = new Date(2026, 6, 27); // 27 juillet 2026 (mois 0-indexé)
    expect(dateBriefing(d)).toBe('2026-07-27');
  });

  it('aucun briefing stocké → il faut (re)calculer', () => {
    expect(doitRecalculerBriefing(null)).toBe(true);
    expect(doitRecalculerBriefing(undefined)).toBe(true);
    expect(doitRecalculerBriefing({ rapport: {} })).toBe(true); // pas de date
  });

  it('briefing déjà calculé AUJOURD\'HUI → 2ᵉ chargement lit le cache (pas de recalcul)', () => {
    const now = new Date(2026, 6, 27, 15, 0, 0);
    const stocke = { date: dateBriefing(now), rapport: {} };
    expect(doitRecalculerBriefing(stocke, now)).toBe(false);
  });

  it('briefing daté d\'HIER → le lendemain recalcule automatiquement', () => {
    const hier = new Date(2026, 6, 26);
    const aujourdhui = new Date(2026, 6, 27, 8, 0, 0);
    const stocke = { date: dateBriefing(hier), rapport: {} };
    expect(doitRecalculerBriefing(stocke, aujourdhui)).toBe(true);
  });
});

describe('ÉTAPE 2 — BLOC affiché avec de vraies données', () => {
  it('synthèse (score) + actions prioritaires + signal à surveiller sont rendus', () => {
    renderWithApp(<DirecteurMatin briefing={briefingReel()} scoreSante={82} />);

    // (a) Phrase de synthèse basée sur le score santé corrigé (82 → bonne santé)
    expect(screen.getByText(/bonne santé/i)).toBeInTheDocument();
    expect(screen.getByText(/82\/100/)).toBeInTheDocument();

    // (b) Action prioritaire réelle (relance facture impayée) + badge URGENT
    expect(screen.getByText(/Relancer Jean Dupont/i)).toBeInTheDocument();
    expect(screen.getByText('URGENT')).toBeInTheDocument();

    // (c) Signal à surveiller = trésorerie J+30 (l'anticipation rouge la plus importante)
    expect(screen.getByText('Signal à surveiller')).toBeInTheDocument();
    expect(screen.getByText('Trésorerie J+30')).toBeInTheDocument();
  });

  it('score bas (<50) → la synthèse bascule en vigilance', () => {
    renderWithApp(<DirecteurMatin briefing={briefingReel()} scoreSante={35} />);
    expect(screen.getByText(/vigilance/i)).toBeInTheDocument();
    expect(screen.getByText(/35\/100/)).toBeInTheDocument();
  });
});

describe('ÉTAPE 2 — ANTI-CRASH : base vide → état neutre, jamais de NaN', () => {
  it('briefing null + score null → message neutre digne, aucun NaN/undefined', () => {
    const { container } = renderWithApp(<DirecteurMatin briefing={null} scoreSante={null} />);
    expect(screen.getByText(/Pas encore assez d'historique/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|undefined/);
  });

  it('briefing RÉEL mais base totalement vide → état neutre (rien à annoncer)', () => {
    const briefingVide = simulerRapportLundi({
      chantiers: [], factures: [], devis: [], clients: [], parametres: {}, rapports: [], agentData: {}, alertes: [],
    });
    const { container } = renderWithApp(<DirecteurMatin briefing={briefingVide} scoreSante={null} />);
    expect(screen.getByText(/Pas encore assez d'historique/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|undefined/);
  });
});

describe('ÉTAPE 2 — ACCUEIL INTACT : le bloc s\'ajoute sans rien casser', () => {
  it('Dashboard rend le bloc "Directeur du matin" ET conserve les blocs existants', () => {
    const agentState = {
      alertes: [],
      priorites: [],
      scoreGlobal: 78,
      agentData: {},
      briefingMatin: briefingReel(),
    };
    renderWithApp(<Dashboard />, { agentState, chantiers: [], factures: [], devis: [], clients: [], parametres: { employes: [], localites: [], parametres: {} } });

    // IA2 : le bloc Directeur affiche le RENDEZ-VOUS DU MOMENT (matin avant 14h,
    // débrief ensuite). Le briefing du matin reste à un clic via l'onglet « Matin ».
    expect(screen.getByTestId('directeur-bloc')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /^Matin$/i })[0]);
    expect(screen.getByTestId('directeur-matin')).toBeInTheDocument();
    expect(screen.getByText('Directeur du matin')).toBeInTheDocument();

    // Blocs existants de l'accueil TOUJOURS là (preuve qu'on n'a rien supprimé)
    expect(screen.getByText('Bonjour,')).toBeInTheDocument();
    expect(screen.getByText('Mes chantiers')).toBeInTheDocument();
    expect(screen.getByText('Briefing IA du Directeur')).toBeInTheDocument();
  });
});

describe('ÉTAPE 2 — BOUTON SIMULER du Centre IA toujours fonctionnel', () => {
  it('clic sur "Lancer l\'analyse" → le briefing lundi matin s\'affiche', () => {
    vi.useFakeTimers();
    try {
      const simulerRapport = () => simulerRapportLundi({
        chantiers: [], factures: [], devis: [], clients: [], parametres: {}, rapports: [], agentData: {}, alertes: [],
      });
      renderWithApp(<Agents simulerRapport={simulerRapport} />);

      // Aller sur l'onglet Rapports (où vit le briefing lundi)
      fireEvent.click(screen.getByRole('button', { name: 'Rapports' }));
      // Le bloc briefing est présent, non encore généré
      expect(screen.getByText(/Briefing intelligent — Lundi matin/i)).toBeInTheDocument();

      // Lancer la simulation (setTimeout 600ms interne)
      fireEvent.click(screen.getByRole('button', { name: /Lancer l'analyse/i }));
      act(() => { vi.advanceTimersByTime(600); });

      // Le rapport simulé s'affiche (score /100 + libellé semaine)
      expect(screen.getByText(/Semaine favorable|Vigilance requise|Semaine difficile/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
