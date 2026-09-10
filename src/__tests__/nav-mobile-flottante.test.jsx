/**
 * Barre de navigation MOBILE — FLOTTANTE + animée au défilement.
 *
 * • Flottante : marges latérales/basse (dont safe-area iOS), coins arrondis, ombre portée.
 * • Animée : défilement vers le BAS → se cache ; vers le HAUT → revient ; tout en haut → visible.
 * • prefers-reduced-motion : pas d'animation, la barre reste visible.
 * • Navigation/contenu inchangés ; PC non concerné (barre display:none en desktop).
 *
 * Preuve RTL RÉELLE : vrai composant MobileNav, vrai conteneur de défilement (.app-main).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, fireEvent, act } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { MobileNav } from '../components/Layout';
import { construireMaisons, filtrerMaisons, raccourcisMobileTerrain } from '../nav/maisons';

const TOUTES = ['dashboard', 'alertes', 'chantiers', 'planning', 'heures', 'finances', 'devis',
  'clients', 'employes', 'rapport', 'agents', 'calculs', 'parametres'];
const maisons = () => filtrerMaisons(construireMaisons(), TOUTES);

// matchMedia par défaut : aucune préférence "reduce" (animations actives).
function stubMatchMedia(reduce = false) {
  window.matchMedia = (q) => ({
    matches: reduce && /reduce/.test(q), media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false,
  });
}
beforeEach(() => stubMatchMedia(false));
afterEach(() => stubMatchMedia(false));

function renderNav(over = {}) {
  const naviguer = over.naviguer || vi.fn();
  const m = maisons();
  const utils = renderWithApp(
    <div>
      <div className="app-main" data-testid="scroller"><div style={{ height: 3000 }} /></div>
      <MobileNav maisons={m} raccourcis={raccourcisMobileTerrain(m)} page="dashboard"
        naviguer={naviguer} mobileMenuOuvert={over.ouvert ?? false} setMobileMenuOuvert={vi.fn()} />
    </div>, {},
  );
  const scroller = document.querySelector('.app-main');
  const nav = () => utils.container.querySelector('.bottom-nav');
  return { ...utils, naviguer, scroller, nav };
}

function scrollTo(scroller, y) {
  act(() => { scroller.scrollTop = y; fireEvent.scroll(scroller); });
}

describe('barre mobile — style FLOTTANT', () => {
  it('marges latérales/basse (safe-area), coins arrondis, ombre, visible au départ', () => {
    const { nav } = renderNav();
    const s = nav().style;
    expect(s.left).toBe('12px');
    expect(s.right).toBe('12px');
    const bas = s.getPropertyValue('--cyna-nav-bottom'); // marge basse + zone sûre iOS
    expect(bas).toContain('safe-area-inset-bottom');
    expect(bas).toContain('12px');
    expect(s.borderRadius).toBe('18px');
    expect(s.boxShadow).not.toBe('');                     // ombre portée présente
    expect(s.transform).toBe('translateY(0)');            // visible au départ
  });
});

describe('barre mobile — navigation inchangée', () => {
  it('4 raccourcis + Plus toujours présents, navigation fonctionnelle', () => {
    const { nav, naviguer } = renderNav();
    const barre = nav();
    ['Accueil', 'Chantiers', 'Heures', 'Planning', 'Plus'].forEach(l =>
      expect(within(barre).getByText(l)).toBeInTheDocument());
    fireEvent.click(within(barre).getByText('Heures'));
    expect(naviguer).toHaveBeenCalledWith('heures');
  });
});

describe('barre mobile — animation au défilement', () => {
  it('vers le bas → cachée ; vers le haut → visible ; tout en haut → visible', () => {
    const { nav, scroller } = renderNav();

    scrollTo(scroller, 100);                       // défilement vers le bas
    expect(nav().className).toContain('bottom-nav--cachee');
    expect(nav().style.transform).toBe('translateY(120px)');

    scrollTo(scroller, 40);                        // vers le haut
    expect(nav().className).not.toContain('bottom-nav--cachee');
    expect(nav().style.transform).toBe('translateY(0)');

    scrollTo(scroller, 200);                       // re-cache
    expect(nav().className).toContain('bottom-nav--cachee');
    scrollTo(scroller, 0);                         // tout en haut → toujours visible
    expect(nav().style.transform).toBe('translateY(0)');
  });

  it('l\'écouteur de défilement est retiré au démontage (pas de fuite)', () => {
    const { unmount, scroller } = renderNav();
    const spy = vi.spyOn(scroller, 'removeEventListener');
    unmount();
    expect(spy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});

describe('barre mobile — prefers-reduced-motion', () => {
  it('animations désactivées → pas de transition, barre reste visible même en défilant', () => {
    stubMatchMedia(true); // (prefers-reduced-motion: reduce) → matches
    const { nav, scroller } = renderNav();
    expect(nav().style.transition).toBe('none');
    scrollTo(scroller, 300);                       // défilement vers le bas
    expect(nav().style.transform).toBe('translateY(0)'); // reste visible (pas d'animation)
    expect(nav().className).not.toContain('bottom-nav--cachee');
  });
});
