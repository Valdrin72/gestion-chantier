/**
 * Barre de navigation MOBILE (bottom-nav) — raccourcis « terrain ».
 *
 * Décision patron : un SEUL menu de navigation mobile — le ☰ (Sidebar). La bottom-nav ne garde
 * que ses 4 raccourcis terrain (Accueil · Chantiers · Heures · Planning) ; le bouton « Plus » et
 * son tiroir sont mis hors service (flag DRAWER_PLUS_ACTIF=false), code et CSS conservés.
 * Le menu latéral PC (Sidebar, dérivé de `maisons`) est STRICTEMENT INCHANGÉ.
 *
 * Preuve RTL RÉELLE : vrais composants MobileNav + Sidebar, vraie config `construireMaisons`.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { MobileNav, Sidebar } from '../components/Layout';
import { construireMaisons, filtrerMaisons, raccourcisMobileTerrain } from '../nav/maisons';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const TOUTES = ['dashboard', 'alertes', 'chantiers', 'planning', 'heures', 'finances', 'devis',
  'clients', 'employes', 'rapport', 'agents', 'calculs', 'parametres'];
const maisons = () => filtrerMaisons(construireMaisons(), TOUTES);

function renderNav(over = {}) {
  const naviguer = over.naviguer || vi.fn();
  const setMobileMenuOuvert = over.setMobileMenuOuvert || vi.fn();
  const m = maisons();
  const result = renderWithApp(
    <MobileNav maisons={m} raccourcis={raccourcisMobileTerrain(m)} page="dashboard"
      naviguer={naviguer} mobileMenuOuvert={over.ouvert ?? false} setMobileMenuOuvert={setMobileMenuOuvert} />,
    {},
  );
  return { ...result, naviguer, setMobileMenuOuvert };
}

describe('raccourcisMobileTerrain (pure)', () => {
  it('retourne exactement Accueil · Chantiers · Heures · Planning (dans cet ordre)', () => {
    const r = raccourcisMobileTerrain(maisons());
    expect(r.map(x => x.page)).toEqual(['dashboard', 'chantiers', 'heures', 'planning']);
    expect(r.map(x => x.labelCourt)).toEqual(['Accueil', 'Chantiers', 'Heures', 'Planning']);
    expect(r.every(x => typeof x.Icon === 'function' || typeof x.Icon === 'object')).toBe(true); // icône réutilisée
  });
});

describe('bottom-nav mobile — raccourcis terrain', () => {
  it('la barre contient Accueil, Chantiers, Heures, Planning et PAS « Plus »', () => {
    const { container } = renderNav();
    const barre = container.querySelector('.bottom-nav');
    ['Accueil', 'Chantiers', 'Heures', 'Planning'].forEach(l =>
      expect(within(barre).getByText(l)).toBeInTheDocument());
    expect(within(barre).queryByText('Plus')).toBeNull(); // navigation complète = ☰ (Sidebar)
    // exactement 4 entrées → répartition propre (flex:1), pas de trou à droite
    expect(barre.querySelectorAll('.bottom-nav-item').length).toBe(4);
  });

  it('la barre ne contient PLUS Finances ni Analyse en raccourci direct', () => {
    const { container } = renderNav(); // tiroir fermé → seule la barre est rendue
    const barre = container.querySelector('.bottom-nav');
    expect(within(barre).queryByText('Finances')).toBeNull();
    expect(within(barre).queryByText('Analyse')).toBeNull();
  });

  it('cliquer « Heures » → navigue vers la page heures ; « Planning » → planning', () => {
    const { container, naviguer } = renderNav();
    const barre = container.querySelector('.bottom-nav');
    fireEvent.click(within(barre).getByText('Heures'));
    expect(naviguer).toHaveBeenCalledWith('heures');
    fireEvent.click(within(barre).getByText('Planning'));
    expect(naviguer).toHaveBeenCalledWith('planning');
  });
});

describe('tiroir « Plus » — hors service (flag DRAWER_PLUS_ACTIF=false)', () => {
  it('le tiroir n\'est PAS rendu, même en demandant son ouverture', () => {
    // Régression : la navigation complète passe par le ☰ ; le tiroir « Plus » est désactivé
    // (code + CSS conservés pour rollback). Il ne doit pas apparaître dans le DOM.
    const { container } = renderNav({ ouvert: true });
    expect(container.querySelector('.mobile-drawer')).toBeNull();
    expect(container.querySelector('.mobile-drawer-overlay')).toBeNull();
  });
});

describe('non-régression PC — le menu latéral (Sidebar) est inchangé', () => {
  it('construireMaisons garde ses 5 maisons dans le même ordre (source du menu PC)', () => {
    expect(construireMaisons().map(m => m.page)).toEqual(
      ['dashboard', 'chantiers', 'finances', 'rapport', 'parametres']);
  });

  it('la Sidebar liste toujours Finances et Analyse & IA', () => {
    renderWithApp(
      <Sidebar sidebarOuvert maisons={maisons()} page="dashboard" naviguer={vi.fn()}
        darkMode={false} toggleDarkMode={vi.fn()} profil={{ nom: 'Valdrin', id: 'cyna' }} deconnecter={vi.fn()} />,
      {},
    );
    expect(screen.getByText('Finances')).toBeInTheDocument();
    expect(screen.getByText(/Analyse/)).toBeInTheDocument();
  });
});
