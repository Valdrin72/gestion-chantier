/**
 * Centre IA — LOT 1 hero mobile (points 1, 2, 3). Preuve RÉELLE (vrai composant CentreIA).
 * Les onglets lourds (Agents/Claude/Audit) sont remplacés par des stubs : on teste le HERO,
 * pas leur contenu. Le stub Audit renvoie un résumé nbErreurs:0 pour prouver « ERREURS non
 * rouge à 0 » de façon déterministe.
 *  • desktop 1200 : « IA / 12 », icône de titre, « · IA / AGENTS IA », grille repeat(4,1fr),
 *    couleurs d'origine — tous présents ;
 *  • mobile 375 : triple en-tête retiré, grille repeat(2,1fr), valeurs blanches, ALERTES/ERREURS
 *    rouges seulement si > 0.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';

vi.mock('../Agents', () => ({ default: () => <div data-testid="agents-stub" />, NB_AGENTS: 20 }));
vi.mock('../components/ia/ClaudeIAPanel', () => ({ default: () => <div data-testid="claude-stub" /> }));
vi.mock('../AuditApp', () => ({
  default: ({ onSummary }) => {
    React.useEffect(() => { onSummary && onSummary({ score: 82, nbErreurs: 0, nbWarnings: 0, nbOk: 7 }); }, [onSummary]);
    return <div data-testid="audit-stub" />;
  },
}));

import CentreIA from '../pages/CentreIA';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const agentState = (alertes = []) => ({
  scoreGlobal: 60, alertes, memoire: { a: 1 }, running: false, forcerExecution: vi.fn(),
});
const render = (over = {}) => renderWithApp(<CentreIA />, { agentState: agentState(over.alertes || []), ouvrirMenu: vi.fn(), ...over });

const spanIA = (container) => [...container.querySelectorAll('span')].find(s => s.textContent.startsWith('· IA'));
const kpiVal = (container, testid) => container.querySelector(`[data-testid="${testid}"]`).children[1];
const rgb = (el) => getComputedStyle(el).color;

describe('Centre IA hero — desktop 1200 (non-régression PC)', () => {
  it('triple en-tête + grille 4 colonnes + couleurs d\'origine présents', () => {
    setLargeur(1200);
    const { container } = render();
    expect(screen.getByText('IA / 12')).toBeInTheDocument();          // index mono
    expect(container.querySelector('h1 svg')).toBeTruthy();            // icône de titre
    expect(spanIA(container).textContent).toBe('· IA / AGENTS IA');    // contexte complet
    expect(getComputedStyle(container.querySelector('[data-testid="hero-chiffres"]')).gridTemplateColumns)
      .toContain('repeat(4');
    // couleur d'origine : AGENTS ACTIFS = #8FBCE6
    expect(rgb(kpiVal(container, 'hero-kpi-agents-actifs'))).toBe('rgb(143, 188, 230)');
  });
});

describe('Centre IA hero — mobile 375 (points 1, 2, 3)', () => {
  it('triple en-tête retiré + grille 2×2', () => {
    setLargeur(375);
    const { container } = render();
    expect(screen.queryByText('IA / 12')).toBeNull();                  // point 1
    expect(container.querySelector('h1 svg')).toBeNull();              // point 1 (icône retirée)
    expect(spanIA(container).textContent).toBe('· IA');                // point 1 (contexte retiré)
    expect(getComputedStyle(container.querySelector('[data-testid="hero-chiffres"]')).gridTemplateColumns)
      .toContain('repeat(2');                                          // point 3
  });

  it('valeurs blanches ; ALERTES rouge seulement si > 0', () => {
    setLargeur(375);
    // 0 alerte → blanc
    const vide = render({ alertes: [] });
    expect(rgb(kpiVal(vide.container, 'hero-kpi-agents-actifs'))).toBe('rgb(255, 255, 255)');
    expect(rgb(kpiVal(vide.container, 'hero-kpi-alertes-actives'))).toBe('rgb(255, 255, 255)');
    vide.unmount();
    // alertes non lues → rouge
    const plein = render({ alertes: [{ id: 1, lu: false }, { id: 2, lu: false }] });
    expect(rgb(kpiVal(plein.container, 'hero-kpi-alertes-actives'))).toBe('rgb(255, 122, 107)');
  });

  it('ERREURS non rouge à 0 (onglet Audit)', () => {
    setLargeur(375);
    const { container } = render();
    fireEvent.click(screen.getByText('Audit'));                        // bascule onglet
    expect(rgb(kpiVal(container, 'hero-kpi-erreurs'))).toBe('rgb(255, 255, 255)'); // 0 erreur → blanc
  });

  it('bouton « Forcer exécution » présent et fonctionnel (aucune écriture métier)', () => {
    setLargeur(375);
    const forcer = vi.fn();
    render({ agentState: { ...agentState([]), forcerExecution: forcer } });
    fireEvent.click(screen.getByText('Forcer exécution'));
    expect(forcer).toHaveBeenCalledTimes(1);
  });
});

describe('Centre IA hero — desktop : ERREURS garde sa couleur rouge d\'origine', () => {
  it('ERREURS reste rouge sur desktop même à 0 (couleur d\'origine préservée)', () => {
    setLargeur(1200);
    const { container } = render();
    fireEvent.click(screen.getByText('Audit'));
    expect(rgb(kpiVal(container, 'hero-kpi-erreurs'))).toBe('rgb(255, 122, 107)'); // #FF7A6B d'origine
  });
});
