/**
 * Navigation mobile UNIFIÉE — décision patron : un seul menu, le ☰ (Sidebar).
 * (Annulation ciblée du Lot 0b #196 : la nav revient dans le ☰ sur mobile.)
 *
 * Preuve RÉELLE (vrais composants Sidebar + MobileNav, vraie config menuMobile) :
 *  • Sidebar mobile : la navigation est de retour (Finances atteignable) + profil + déconnexion
 *    fonctionnelle ; le CTA « Nouveau devis » reste MASQUÉ (mode consultation, Lot 3) ;
 *    la liste filtrée mobile (menuMobile) n'a PAS Analyse/Rapports, Calculs ni Paramètres ;
 *  • bottom-nav : le bouton « Plus » a disparu, les 4 raccourcis terrain restent ;
 *  • desktop : Sidebar complète + CTA (PC inchangé).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { Sidebar, MobileNav } from '../components/Layout';
import { construireMaisons, filtrerMaisons, menuMobile, raccourcisMobileTerrain } from '../nav/maisons';

const TOUTES = ['dashboard', 'alertes', 'chantiers', 'planning', 'heures', 'finances', 'devis',
  'clients', 'employes', 'rapport', 'agents', 'calculs', 'parametres'];
const maisonsPC = () => filtrerMaisons(construireMaisons(), TOUTES);
const maisonsMobile = () => menuMobile(maisonsPC());
const PROFIL = { id: 'cyna', nom: 'Valdrin', couleur: '#0d3d6e', icone: 'V' };

const renderSidebar = (maisons, over = {}, deconnecter = vi.fn()) => {
  renderWithApp(
    <Sidebar sidebarOuvert setSidebarOuvert={vi.fn()} maisons={maisons} page="dashboard"
      naviguer={over.naviguer || vi.fn()} darkMode={false} toggleDarkMode={vi.fn()}
      profil={PROFIL} deconnecter={deconnecter} />,
    over,
  );
  return { deconnecter };
};

describe('Sidebar mobile — navigation de retour dans le ☰ (menu unique)', () => {
  it('la navigation filtrée mobile est affichée ; CTA masqué ; profil + déconnexion OK', () => {
    const naviguer = vi.fn();
    const { deconnecter } = renderSidebar(maisonsMobile(), { consultationMobile: true, naviguer });
    // Navigation de retour : Finances atteignable dans le ☰
    expect(screen.getByText('Finances')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Finances'));
    expect(naviguer).toHaveBeenCalledWith('finances');
    // Filtrage mobile : pas d'Analyse/Rapports, Calculs ni Paramètres
    expect(screen.queryByText(/Analyse/)).toBeNull();
    expect(screen.queryByText('Calculs')).toBeNull();
    expect(screen.queryByText('Paramètres')).toBeNull();
    // CTA « Nouveau devis » masqué sur mobile (mode consultation)
    expect(screen.queryByText(/Nouveau devis/)).toBeNull();
    // Profil + déconnexion fonctionnelle
    expect(screen.getByText('Valdrin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Se déconnecter/ }));
    expect(deconnecter).toHaveBeenCalledTimes(1);
  });
});

describe('Sidebar desktop — non-régression (PC inchangé)', () => {
  it('navigation complète (Analyse & Paramètres inclus) + CTA « Nouveau devis »', () => {
    renderSidebar(maisonsPC(), { consultationMobile: false });
    expect(screen.getByText('Finances')).toBeInTheDocument();
    expect(screen.getByText(/Analyse/)).toBeInTheDocument();
    expect(screen.getByText('Paramètres')).toBeInTheDocument();
    expect(screen.getByText(/Nouveau devis/)).toBeInTheDocument();
  });
});

describe('bottom-nav — « Plus » retiré, 4 raccourcis terrain', () => {
  it('4 entrées, pas de « Plus », clic « Heures » navigue', () => {
    const naviguer = vi.fn();
    const m = maisonsMobile();
    const { container } = renderWithApp(
      <MobileNav maisons={m} raccourcis={raccourcisMobileTerrain(maisonsPC())} page="dashboard"
        naviguer={naviguer} mobileMenuOuvert={false} setMobileMenuOuvert={vi.fn()} />, {},
    );
    const barre = container.querySelector('.bottom-nav');
    ['Accueil', 'Chantiers', 'Heures', 'Planning'].forEach(l =>
      expect(within(barre).getByText(l)).toBeInTheDocument());
    expect(within(barre).queryByText('Plus')).toBeNull();
    expect(barre.querySelectorAll('.bottom-nav-item').length).toBe(4); // répartition propre
    fireEvent.click(within(barre).getByText('Heures'));
    expect(naviguer).toHaveBeenCalledWith('heures');
  });
});
