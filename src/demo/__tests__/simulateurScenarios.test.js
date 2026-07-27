/**
 * Simulateur de scénarios — Directeur du matin : mordants.
 *
 * Chaîne RÉELLE (zéro logic-mirror) :
 *   construireScenario(id) → runAllAgents (vrai moteur d'agents) + simulerRapportLundi
 *     + runCoachDirecteur (via agentData) + calculerCoutsChantier (vrai moteur de coûts).
 *   On truque UNIQUEMENT l'entrée (données fictives), jamais le résultat : les moteurs
 *   calculent normalement, et on asserte l'état attendu du Directeur pour chaque scénario.
 *   + Isolation démo (le panneau n'existe qu'en mode démo) et réversibilité (reset).
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { renderWithApp } from '../../test-utils/renderWithApp';
import { SCENARIOS, construireScenario, donneesDemoStandard } from '../scenariosDirecteur';
import { runAllAgents, simulerRapportLundi } from '../../AgentEngine';
import { calculerCoutsChantier } from '../../donnees';
import { donneesDemo } from '../../donnees-demo';
import SimulateurScenarios from '../SimulateurScenarios';

afterEach(() => cleanup());

const NOW = new Date(2026, 6, 22, 9, 0, 0); // mercredi 22 juillet 2026 (déterministe)

// Exécute la VRAIE chaîne moteur sur un scénario.
function moteur(id) {
  const data = construireScenario(id, NOW);
  const result = runAllAgents({
    chantiers: data.chantiers, devis: data.devis, factures: data.factures,
    clients: data.clients, parametres: data.parametres, pointages: data.pointages,
    agentsActifs: {}, memoire: {},
  });
  const coach = result.agentData.CoachDirecteur;
  const briefing = simulerRapportLundi({
    chantiers: data.chantiers, factures: data.factures, devis: data.devis,
    clients: data.clients, parametres: data.parametres, rapports: [],
    agentData: result.agentData, alertes: result.alertes,
  });
  return { data, result, coach, briefing };
}

// Cache : chaque scénario calculé une seule fois.
const M = Object.fromEntries(SCENARIOS.map(s => [s.id, moteur(s.id)]));

describe('Scénario 🟢 Tout roule → score vert, pas de survie', () => {
  const { coach } = M['tout-roule'];
  it('score santé ≥ 75 (vert) et aucune pénalité trésorerie', () => {
    expect(coach.scoreGlobal).toBeGreaterThanOrEqual(75);
    expect(coach.penaliteTreso).toBe(0);
  });
  it('aucune priorité de survie/trésorerie', () => {
    expect(coach.priorites.some(p => p.categorie === 'SURVIE')).toBe(false);
    expect(coach.tresorerie30j.soldeProjete).toBeGreaterThanOrEqual(coach.tresorerie30j.seuil);
  });
});

describe('Scénario 🟠 Trésorerie qui se tend → belt anti-faillite', () => {
  const { coach } = M['tresorerie-tendue'];
  it('le score BAISSE à cause de la trésorerie, malgré des chantiers rentables', () => {
    expect(coach.penaliteTreso).toBeGreaterThan(0);
    expect(coach.scoreGlobal).toBeLessThan(M['tout-roule'].coach.scoreGlobal);
  });
  it('la trésorerie est en tête des priorités et projetée sous le seuil', () => {
    expect(coach.priorites[0].categorie).toBe('TRÉSORERIE');
    expect(coach.tresorerie30j.soldeProjete).toBeLessThan(coach.tresorerie30j.seuil);
  });
});

describe('Scénario 🔴 Chantier qui dérape → chantier en perte pointé', () => {
  const { data, result, coach } = M['chantier-derape'];
  it('le chantier en perte a une marge NÉGATIVE (vrai moteur de coûts)', () => {
    const perte = data.chantiers.find(c => c.nom.includes('EN PERTE'));
    const co = calculerCoutsChantier(perte, data.parametres.employes, data.parametres.localites, data.parametres.parametres, data.devis, data.pointages);
    expect(co.margeActuellePct).toBeLessThan(0);
  });
  it('le radar le classe en danger et le Coach le nomme dans une action URGENTE', () => {
    const risques = result.agentData.RadarPrecoce?.risques || [];
    expect(risques.some(r => r.nom.includes('EN PERTE') && ['DANGER', 'CRITIQUE'].includes(r.niveau))).toBe(true);
    expect(coach.priorites.some(p => p.categorie === 'URGENT' && p.action.includes('EN PERTE'))).toBe(true);
  });
});

describe('Scénario 🟡 Retards d\'encaissement → relances prioritaires', () => {
  const { result, briefing, coach } = M['retards-encaissement'];
  it('au moins une facture en retard > 90 jours détectée', () => {
    expect(result.agentData.RelancePaiements.nb90).toBeGreaterThanOrEqual(1);
    expect(result.agentData.RelancePaiements.montant90).toBeGreaterThan(5000);
  });
  it('le briefing propose au moins 2 relances URGENTES chiffrées', () => {
    const relances = briefing.actionsAvantLundi.filter(a => a.priorite === 'URGENT' && a.icone === '💰');
    expect(relances.length).toBeGreaterThanOrEqual(2);
  });
  it('🔴 FIX : le score BAISSE (sort de « bonne santé ») à cause des impayés anciens', () => {
    expect(coach.penaliteCreances).toBeGreaterThan(0);
    expect(coach.scoreGlobal).toBeLessThan(75); // n'est plus « bonne santé »
  });
  it('le signal trésorerie chiffre le cash bloqué chez les retardataires', () => {
    const treso = briefing.anticipations.find(a => a.label === 'Trésorerie J+30');
    expect(treso.detail).toMatch(/à risque \(retards de paiement\)/);
  });
});

describe('Scénario ⚫ Plusieurs problèmes → hiérarchisation claire', () => {
  const { coach } = M['plusieurs-problemes'];
  it('la survie (trésorerie négative) passe en TÊTE des priorités', () => {
    expect(coach.priorites[0].categorie).toBe('SURVIE');
    expect(coach.tresorerie30j.soldeProjete).toBeLessThan(0);
  });
  it('plusieurs priorités hiérarchisées : trésorerie, chantier en perte, relance', () => {
    expect(coach.priorites.length).toBeGreaterThanOrEqual(3);
    expect(coach.priorites.some(p => p.categorie === 'URGENT' && p.action.includes('EN PERTE'))).toBe(true);
    expect(coach.priorites.some(p => p.categorie === 'TRÉSORERIE')).toBe(true);
    expect(coach.scoreGlobal).toBeLessThan(50);
  });
});

describe('ANTI-CRASH : chaque scénario produit un briefing valide, jamais de NaN', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.emoji} ${sc.id} → briefing non nul, score fini`, () => {
      const { coach, briefing } = M[sc.id];
      expect(briefing).toBeTruthy();
      expect(Number.isFinite(coach.scoreGlobal)).toBe(true);
      expect(Number.isNaN(coach.scoreGlobal)).toBe(false);
      expect(Array.isArray(briefing.actionsAvantLundi)).toBe(true);
    });
  }
});

describe('ISOLATION DÉMO : le simulateur n\'existe qu\'en mode démo', () => {
  it('hors démo (isDemo=false) → aucun rendu, aucun bouton', () => {
    renderWithApp(<SimulateurScenarios />, { isDemo: false });
    expect(screen.queryByTestId('simulateur-scenarios')).toBeNull();
    expect(screen.queryByText(/Charger ce scénario/i)).toBeNull();
  });
  it('en démo (isDemo=true) → les 5 scénarios + le reset sont présents', () => {
    renderWithApp(<SimulateurScenarios />, { isDemo: true });
    expect(screen.getByTestId('simulateur-scenarios')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Charger ce scénario/i })).toHaveLength(5);
    expect(screen.getByRole('button', { name: /Réinitialiser la démo/i })).toBeInTheDocument();
  });
});

describe('RÉVERSIBILITÉ : charger un scénario puis réinitialiser', () => {
  it('charger applique des données FICTIVES marquées SIMULATION via les setters', () => {
    const calls = { chantiers: null, parametres: null };
    const { ctx } = renderWithApp(<SimulateurScenarios />, {
      isDemo: true,
      setChantiers: (v) => { calls.chantiers = v; },
      setParametres: (v) => { calls.parametres = v; },
    });
    // Scénario 2 (trésorerie tendue) = 2ᵉ carte
    fireEvent.click(screen.getAllByRole('button', { name: /Charger ce scénario/i })[1]);
    expect(Array.isArray(calls.chantiers)).toBe(true);
    expect(calls.chantiers.every(c => c.nom.includes('SIMULATION'))).toBe(true);
    expect(calls.parametres.parametres.soldeBancaire).toBe(40000);
    expect(ctx.afficherNotif).toHaveBeenCalled();
  });

  it('réinitialiser restaure le jeu de démo standard (aucune donnée de scénario ne subsiste)', () => {
    let chantiersReset = null;
    let pointagesReset = null;
    renderWithApp(<SimulateurScenarios />, {
      isDemo: true,
      setChantiers: (v) => { chantiersReset = v; },
      setPointages: (v) => { pointagesReset = v; },
    });
    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser la démo/i }));
    expect(chantiersReset).toHaveLength(donneesDemo.chantiers.length);
    expect(chantiersReset.some(c => c.nom.includes('SIMULATION'))).toBe(false);
    expect(pointagesReset).toEqual([]);
  });

  it('donneesDemoStandard() est bien le jeu de démo d\'origine', () => {
    const std = donneesDemoStandard();
    expect(std.chantiers).toHaveLength(donneesDemo.chantiers.length);
    expect(std.pointages).toEqual([]);
    expect(std.parametres.employes).toBe(donneesDemo.employes);
  });
});
