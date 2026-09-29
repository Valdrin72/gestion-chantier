/**
 * Garde-fou GÉOMÉTRIE du CSS de la bottom-sheet « Plus » (#197).
 *
 * Le tiroir « Plus » est désormais DORMANT (flag DRAWER_PLUS_ACTIF=false dans MobileNav) —
 * décision patron : un seul menu mobile, le ☰. Mais son CSS reste LIVRÉ pour un rollback
 * facile. Ce test continue donc de garder la géométrie : il lit les VRAIES règles de
 * src/index.css, les injecte (jsdom n'évalue pas les @media, on extrait à plat), rend la
 * structure DOM du tiroir directement (indépendamment du flag), puis vérifie getComputedStyle.
 * Casser une propriété clé (ex. retirer `position: fixed` de l'overlay) fait échouer ce test.
 *
 * NB : géométrie réelle (rect dans le viewport) prouvée au navigateur — jsdom n'a pas de layout.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

// Extrait le bloc de déclarations d'un sélecteur simple (règles à plat, sans accolade imbriquée).
const CSS = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
function blocDe(selecteur) {
  const re = new RegExp(selecteur.replace(/[.]/g, '\\.') + '\\s*\\{([^}]*)\\}');
  const m = CSS.match(re);
  return m ? m[1].trim() : null;
}

const SELECTEURS = ['.mobile-drawer-overlay', '.mobile-drawer', '.drawer-handle', '.drawer-header', '.drawer-items', '.drawer-item'];
const feuillePlate = SELECTEURS.map(s => {
  const b = blocDe(s);
  return b ? `${s}{${b}}` : '';
}).join('\n');

// Structure DOM du tiroir (mêmes classes que MobileNav, Layout.js) — rendue directement pour
// garder le CSS même quand le tiroir est dormant (flag off).
const renderDrawer = () => render(
  <>
    <style>{feuillePlate}</style>
    <div className="mobile-drawer-overlay">
      <div className="mobile-drawer">
        <div className="drawer-handle" />
        <div className="drawer-header"><span>Navigation</span><button aria-label="Fermer">×</button></div>
        <div className="drawer-items">
          <button className="drawer-item"><span className="drawer-item-icon" /><span className="drawer-item-label">Finances</span></button>
        </div>
      </div>
    </div>
  </>
);

describe('CSS bottom-sheet « Plus » (#197) — conservé pour rollback, géométrie gardée', () => {
  it('les règles CSS du drawer existent toujours dans src/index.css', () => {
    SELECTEURS.forEach(s => expect(blocDe(s), `bloc CSS manquant pour ${s}`).toBeTruthy());
  });

  it("l'overlay couvre l'écran (position:fixed) au-dessus de la bottom-nav (#176, z-index 200)", () => {
    const { container } = renderDrawer();
    const cs = getComputedStyle(container.querySelector('.mobile-drawer-overlay'));
    expect(cs.position).toBe('fixed');                 // ← casser ceci fait échouer le test
    expect(parseInt(cs.zIndex, 10)).toBeGreaterThan(200);
    expect(cs.alignItems).toBe('flex-end');            // ancre la feuille en bas
  });

  it('le panneau est borné en hauteur avec défilement interne (pas de débordement écran)', () => {
    const { container } = renderDrawer();
    const csP = getComputedStyle(container.querySelector('.mobile-drawer'));
    expect(csP.maxHeight).not.toBe('none');
    expect(csP.maxHeight).toMatch(/vh|px|%/);
    expect(getComputedStyle(container.querySelector('.drawer-items')).overflowY).toBe('auto');
  });

  it('les entrées ont une cible tactile ≥44px', () => {
    const { container } = renderDrawer();
    const min = parseInt(getComputedStyle(container.querySelector('.drawer-item')).minHeight, 10);
    expect(min).toBeGreaterThanOrEqual(44);
  });
});
