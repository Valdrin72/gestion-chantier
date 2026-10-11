/**
 * Centre IA — LOT 2a : menu Claude AI en rangée de pilules (mobile). Preuve RÉELLE (vrai ClaudeIAPanel).
 *  • desktop 1200 : menu data-testid="ia-menu" = colonne verticale (carte, indicateur mémoire) ;
 *  • mobile 375 : rangée horizontale de pilules (overflowX auto, sticky), 9 entrées atteignables,
 *    pilule active fond #0D3D6E ; changer de pilule affiche le panneau correspondant.
 * Refonte de présentation : mêmes 9 libellés/handlers.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { within, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) } }));

import ClaudeIAPanel from '../components/ia/ClaudeIAPanel';

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = () => {}; // jsdom ne l'implémente pas (panneau Chat)
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

// iaConsentement:true → on dépasse l'écran de consentement et le vrai menu s'affiche.
const render = () => renderWithApp(<ClaudeIAPanel onInsights={vi.fn()} />, {
  parametres: { parametres: { iaActivee: true, iaConsentement: true } },
});
const LABELS = ['Anticiper', 'Analyser un chantier', 'Suggestion de devis', 'Expliquer les alertes',
  'Analyse globale', 'Chat libre', 'Générer email', 'Comparer devis', 'Analyser PDF'];

describe('Menu Claude — desktop 1200 (colonne, non-régression)', () => {
  it('menu en colonne : indicateur mémoire + 9 entrées, pas de rangée défilante', () => {
    setLargeur(1200);
    const { container } = render();
    const menu = container.querySelector('[data-testid="ia-menu"]');
    expect(menu).toBeTruthy();
    expect(within(menu).getByText(/Mémoire vide|insight/)).toBeInTheDocument(); // indicateur présent (desktop only)
    LABELS.forEach(l => expect(within(menu).getByText(l)).toBeInTheDocument());
    expect(getComputedStyle(menu).overflowX).not.toBe('auto'); // pas une rangée défilante
    expect(getComputedStyle(menu).position).not.toBe('sticky');
  });
});

describe('Menu Claude — mobile 375 (rangée de pilules)', () => {
  it('rangée horizontale collante, défilante, sans indicateur mémoire', () => {
    setLargeur(375);
    const { container } = render();
    const menu = container.querySelector('[data-testid="ia-menu"]');
    expect(getComputedStyle(menu).overflowX).toBe('auto');   // défilement horizontal
    expect(getComputedStyle(menu).position).toBe('sticky');  // collante
    expect(within(menu).queryByText('Mémoire vide')).toBeNull(); // indicateur retiré sur mobile
    LABELS.forEach(l => expect(within(menu).getByText(l)).toBeInTheDocument()); // 9 atteignables
  });

  it('pilule active en #0D3D6E (rgb 13,61,110) ; changer de pilule change le panneau', () => {
    setLargeur(375);
    const { container } = render();
    const menu = container.querySelector('[data-testid="ia-menu"]');
    // active par défaut = Anticiper
    const pillActive = within(menu).getByText('Anticiper').closest('button');
    expect(getComputedStyle(pillActive).background).toContain('rgb(13, 61, 110)');
    // changer → Chat libre : le panneau affiche son titre
    fireEvent.click(within(menu).getByText('Chat libre'));
    const panneau = container.querySelector('[data-testid="ia-panneau"]');
    expect(within(panneau).getByText('Chat libre')).toBeInTheDocument();
    // et Analyser PDF (dernière entrée) reste atteignable
    fireEvent.click(within(menu).getByText('Analyser PDF'));
    expect(within(container.querySelector('[data-testid="ia-panneau"]')).getByText('Analyser PDF')).toBeInTheDocument();
  });
});
