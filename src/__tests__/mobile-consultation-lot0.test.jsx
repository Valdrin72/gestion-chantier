/**
 * Mode consultation mobile — LOT 0 (fondation navigation).
 * Preuve RÉELLE : la fonction menuMobile (source unique) + le vrai composant MobileNav.
 *  • le menu MOBILE (drawer « Plus ») ne contient plus Analyse/Rapports, Calculs, Paramètres ;
 *  • le Centre IA (enfant d'« Analyse & IA ») reste accessible, promu en entrée directe ;
 *  • les Alertes restent accessibles ;
 *  • le menu DESKTOP (maisons complètes) reste inchangé (rapport/calculs/parametres présents).
 * Échoue si on réintègre Paramètres/Calculs/Rapports au menu mobile, ou si Centre IA en sort.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { construireMaisons, filtrerMaisons, menuMobile } from '../nav/maisons';
import { Sidebar } from '../components/Layout';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const TOUTES_PAGES = ['dashboard', 'alertes', 'chantiers', 'planning', 'heures',
  'finances', 'devis', 'clients', 'employes', 'rapport', 'agents', 'calculs', 'parametres'];
const maisonsCompletes = () => filtrerMaisons(construireMaisons({}), TOUTES_PAGES);
const pagesDe = (maisons) => maisons.flatMap(m => [m.page, ...(m.enfants || []).map(e => e.id)]);

describe('menuMobile — fondation (fonction pure)', () => {
  it('exclut Rapports, Calculs et Paramètres du menu mobile', () => {
    const pages = pagesDe(menuMobile(maisonsCompletes()));
    expect(pages).not.toContain('rapport');
    expect(pages).not.toContain('calculs');
    expect(pages).not.toContain('parametres');
  });

  it('garde le Centre IA (promu en entrée directe) et les Alertes', () => {
    const mob = menuMobile(maisonsCompletes());
    const pages = pagesDe(mob);
    expect(pages).toContain('agents');   // Centre IA
    expect(pages).toContain('alertes');
    // Centre IA devient une entrée de premier niveau libellée « Centre IA ».
    expect(mob.some(m => m.page === 'agents' && m.label === 'Centre IA')).toBe(true);
  });

  it('le menu DESKTOP (maisons complètes) reste inchangé', () => {
    const pages = pagesDe(maisonsCompletes());
    expect(pages).toContain('rapport');
    expect(pages).toContain('calculs');
    expect(pages).toContain('parametres');
    expect(pages).toContain('agents');
  });

  it('rôle sans Centre IA : la maison « Analyse & IA » quitte le menu mobile', () => {
    const sansIA = filtrerMaisons(construireMaisons({}), ['dashboard', 'chantiers', 'rapport', 'calculs']);
    const pages = pagesDe(menuMobile(sansIA));
    expect(pages).not.toContain('rapport');
    expect(pages).not.toContain('calculs');
    expect(pages).not.toContain('agents');
  });
});

describe('Sidebar mobile — la liste filtrée menuMobile est affichée dans le ☰', () => {
  // Décision patron : la navigation mobile vit dans le ☰ (Sidebar), alimenté par menuMobile.
  const renderSidebarMobile = (naviguer = vi.fn()) => renderWithApp(
    <Sidebar sidebarOuvert setSidebarOuvert={vi.fn()} maisons={menuMobile(maisonsCompletes())}
      page="dashboard" naviguer={naviguer} darkMode={false} toggleDarkMode={vi.fn()}
      profil={{ nom: 'Valdrin', id: 'cyna' }} deconnecter={vi.fn()} />,
    { consultationMobile: true },
  );

  it('le ☰ montre Centre IA et Alertes, pas Analyse/Calculs/Config', () => {
    renderSidebarMobile();
    expect(screen.getByText('Centre IA')).toBeInTheDocument();
    expect(screen.getByText('Alertes')).toBeInTheDocument();  // enfant d'Accueil (maison active, dépliée)
    expect(screen.queryByText('Analyse')).toBeNull();
    expect(screen.queryByText('Calculs')).toBeNull();
    expect(screen.queryByText('Config')).toBeNull();          // labelCourt de Paramètres
    expect(screen.queryByText('Paramètres')).toBeNull();
  });

  it('les liens de navigation du ☰ restent fonctionnels (Centre IA → agents)', () => {
    const naviguer = vi.fn();
    renderSidebarMobile(naviguer);
    fireEvent.click(screen.getByText('Centre IA'));
    expect(naviguer).toHaveBeenCalledWith('agents');
  });
});
