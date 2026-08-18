/**
 * Design v1 — dé-violetisation résiduelle, LOT 5/5 (LE DERNIER) : accent IA/Bot.
 * ⚠ ZÉRO logique métier touchée : blocs IA, alertes, tendance CA, nombre de chantiers
 *   en dérive — inchangés. Diff = couleurs.
 *   Accent IA (Dashboard Bot + AgentEngine fallback) : violet → V1.bleu (#1E5FAF).
 *   EXCEPTION patron : badge « N chantiers en dérive » → V1.warn ambre (c'est une alerte).
 *
 * Preuve RTL RÉELLE (vrai Dashboard via renderWithApp) :
 *   1. le bloc « Intelligence IA » affiche son icône Bot en V1.bleu, plus en violet ;
 *   2. le badge « N chantiers en dérive » est en V1.warn (ambre).
 * (AgentEngine:482 — fallback tendance quand null : swap de littéral prouvé par grep exact
 *  + non-régression ; couleur de données non assertable proprement en RTL.)
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Dashboard from '../pages/Dashboard';

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

const BLEU   = 'rgb(30, 95, 175)';   // #1E5FAF = V1.bleu
const AMBRE  = 'rgb(232, 145, 43)';  // #E8912B = V1.warn
const VIOLET = 'rgb(139, 92, 246)';  // #8b5cf6

// agentState peuplé → le bloc IA + le badge « en dérive » s'affichent.
const AGENT_STATE = {
  scoreGlobal: 72,
  agentData: { DerivePredictor: { resultats: [{ statut: 'rouge', chantier: 'Chantier X' }, { statut: 'vert' }] } },
};

function renderDashboard() {
  return renderWithApp(<Dashboard />, { agentState: AGENT_STATE, profil: { id: 'cyna', pages: ['dashboard'] } });
}

describe('DASHBOARD — accent IA en bleu + badge « en dérive » en ambre', () => {
  it('l\'icône Bot du bloc Intelligence IA est en V1.bleu (plus en violet)', () => {
    renderDashboard();
    const titres = screen.getAllByText('Intelligence IA');
    expect(titres.length).toBeGreaterThanOrEqual(1);
    // Remonter au conteneur du bloc, y trouver l'icône Bot (svg).
    let node = titres[0];
    while (node && !(node.querySelector && node.querySelector('svg'))) node = node.parentElement;
    const svg = node.querySelector('svg');
    expect(svg).toBeTruthy();
    // lucide passe `color=` en attribut `stroke` (hex) ; `style={{color}}` en style.color.
    const stroke = svg.getAttribute('stroke');
    const couleur = (stroke && stroke !== 'currentColor') ? stroke : svg.style.color;
    expect(['#1E5FAF', BLEU]).toContain(couleur);
    expect(couleur).not.toBe(VIOLET);
    expect(couleur.toLowerCase()).not.toBe('#8b5cf6');
  });

  it('le badge « N chantiers en dérive » est en V1.warn (ambre), pas en violet', () => {
    renderDashboard();
    // 1 seule dérive (statut rouge) → « 1 chantier en dérive »
    const badge = screen.getByText(/chantier.* en dérive/);
    expect(badge.style.color).toBe(AMBRE);
    expect(badge.style.color).not.toBe(VIOLET);
  });
});
