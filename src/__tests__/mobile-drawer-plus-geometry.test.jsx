/**
 * Fix drawer « Plus » (bottom-sheet mobile) — test de GÉOMÉTRIE, pas de présence.
 *
 * Contexte : le JSX du drawer (MobileNav, Layout.js) existe depuis #135 mais les classes
 * .mobile-drawer-overlay / .mobile-drawer / .drawer-items / .drawer-item n'avaient jamais
 * été stylées → le panneau tombait hors écran (y≈1219 sur un viewport de 812), invisible.
 *
 * Ce test lit les VRAIES règles de src/index.css, les injecte (jsdom n'évalue pas les
 * @media, on les extrait donc à plat), rend le VRAI composant MobileNav (drawer ouvert),
 * puis vérifie la géométrie via getComputedStyle. Casser une propriété clé dans index.css
 * (ex. retirer `position: fixed` de l'overlay) fait ÉCHOUER ce test — c'est le garde-fou
 * qui manquait au Lot 0b (qui ne testait que la présence DOM).
 *
 * La preuve visuelle réelle (rect dans le viewport + captures) est faite au navigateur
 * (Playwright, viewport 375px) et consignée dans le message de commit.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HardHat, FileText } from 'lucide-react';
import { MobileNav } from '../components/Layout';

// Extrait le bloc de déclarations d'un sélecteur simple (règles à plat, sans accolade imbriquée).
const CSS = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
function blocDe(selecteur) {
  const re = new RegExp(selecteur.replace(/[.]/g, '\\.') + '\\s*\\{([^}]*)\\}');
  const m = CSS.match(re);
  return m ? m[1].trim() : null;
}

// Reconstitue une feuille PLATE (hors @media) à partir des vraies règles du fichier.
const SELECTEURS = ['.mobile-drawer-overlay', '.mobile-drawer', '.drawer-handle', '.drawer-header', '.drawer-items', '.drawer-item'];
const feuillePlate = SELECTEURS.map(s => {
  const b = blocDe(s);
  return b ? `${s}{${b}}` : '';
}).join('\n');

const MAISONS = [
  { id: 'maison_finances', label: 'Finances', labelCourt: 'Finances', Icon: FileText, page: 'finances',
    enfants: [{ id: 'devis', label: 'Devis', Icon: FileText }] },
  { id: 'maison_chantiers', label: 'Chantiers', labelCourt: 'Chantiers', Icon: HardHat, page: 'chantiers', enfants: [] },
];

const renderDrawer = () => render(
  <>
    <style>{feuillePlate}</style>
    <MobileNav maisons={MAISONS} raccourcis={[]} page="dashboard" naviguer={() => {}}
      mobileMenuOuvert setMobileMenuOuvert={() => {}} />
  </>
);

describe('Drawer « Plus » — géométrie bottom-sheet (règles réellement présentes dans index.css)', () => {
  it('les règles CSS du drawer existent dans src/index.css (sinon le drawer est invisible)', () => {
    // Garde-fou : si quelqu'un supprime les blocs, l'extraction est nulle → on le voit ici.
    SELECTEURS.forEach(s => expect(blocDe(s), `bloc CSS manquant pour ${s}`).toBeTruthy());
  });

  it("l'overlay couvre l'écran (position:fixed) au-dessus de la bottom-nav (#176, z-index 200)", () => {
    const { container } = renderDrawer();
    const overlay = container.querySelector('.mobile-drawer-overlay');
    const cs = getComputedStyle(overlay);
    expect(cs.position).toBe('fixed');                 // ← casser ceci fait échouer le test
    expect(parseInt(cs.zIndex, 10)).toBeGreaterThan(200);
    expect(cs.alignItems).toBe('flex-end');            // ancre la feuille en bas
  });

  it('le panneau est borné en hauteur avec défilement interne (pas de débordement écran)', () => {
    const { container } = renderDrawer();
    const panel = container.querySelector('.mobile-drawer');
    const csP = getComputedStyle(panel);
    expect(csP.maxHeight).not.toBe('none');            // hauteur bornée (80vh)
    expect(csP.maxHeight).toMatch(/vh|px|%/);
    const items = container.querySelector('.drawer-items');
    expect(getComputedStyle(items).overflowY).toBe('auto'); // liste défile à l'intérieur
  });

  it('les entrées ont une cible tactile ≥44px', () => {
    const { container } = renderDrawer();
    const item = container.querySelector('.drawer-item');
    expect(item).toBeTruthy();
    const min = parseInt(getComputedStyle(item).minHeight, 10);
    expect(min).toBeGreaterThanOrEqual(44);
  });
});
