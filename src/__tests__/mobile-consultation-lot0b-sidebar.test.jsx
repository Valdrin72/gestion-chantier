/**
 * Mode consultation mobile — LOT 0b : la Sidebar ouverte par le ☰ ne montre plus, sur mobile,
 * QUE le bloc profil + la déconnexion. Preuve RÉELLE (vrai composant Sidebar).
 *  • mobile : aucune entrée de navigation, pas de « Nouveau devis » ; profil visible ;
 *    déconnexion présente ET fonctionnelle (clic → handler appelé) ;
 *  • desktop : navigation complète + CTA + profil + déconnexion (PC inchangé).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { Sidebar } from '../components/Layout';

const Ico = (props) => <svg data-icon {...props} />;
const MAISONS = [
  { id: 'accueil', page: 'dashboard', label: 'Accueil', Icon: Ico, enfants: [] },
  { id: 'analyse', page: 'rapport', label: 'Analyse', Icon: Ico, enfants: [
    { id: 'calculs', label: 'Calculs', Icon: Ico },
  ] },
  { id: 'parametres', page: 'parametres', label: 'Paramètres', Icon: Ico, enfants: [] },
];
const PROFIL = { id: 'cyna', nom: 'Valdrin', couleur: '#0d3d6e', icone: 'V' };

const renderSidebar = (over = {}, deconnecter = vi.fn()) => {
  const r = renderWithApp(
    <Sidebar sidebarOuvert setSidebarOuvert={vi.fn()} maisons={MAISONS} page="dashboard"
      naviguer={vi.fn()} darkMode={false} toggleDarkMode={vi.fn()} profil={PROFIL} deconnecter={deconnecter} />,
    over,
  );
  return { ...r, deconnecter };
};

describe('Sidebar mobile — panneau réduit profil + déconnexion (consultation)', () => {
  it('aucune navigation ni CTA, profil visible', () => {
    renderSidebar({ consultationMobile: true });
    // Profil affiché
    expect(screen.getByText('Valdrin')).toBeInTheDocument();
    // Aucune entrée de navigation
    expect(screen.queryByText('Accueil')).toBeNull();
    expect(screen.queryByText('Analyse')).toBeNull();
    expect(screen.queryByText('Calculs')).toBeNull();
    expect(screen.queryByText('Paramètres')).toBeNull();
    // Pas de CTA « Nouveau devis »
    expect(screen.queryByText(/Nouveau devis/)).toBeNull();
  });

  it('la déconnexion est présente ET fonctionnelle (clic → handler appelé)', () => {
    const { deconnecter } = renderSidebar({ consultationMobile: true });
    const btn = screen.getByRole('button', { name: /Se déconnecter/ });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(deconnecter).toHaveBeenCalledTimes(1);
  });
});

describe('Sidebar desktop — non-régression (PC inchangé)', () => {
  it('navigation complète + CTA + profil + déconnexion', () => {
    const { deconnecter } = renderSidebar({ consultationMobile: false });
    // Navigation complète
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Analyse')).toBeInTheDocument();
    expect(screen.getByText('Paramètres')).toBeInTheDocument();
    // CTA présent
    expect(screen.getByText(/Nouveau devis/)).toBeInTheDocument();
    // Profil + déconnexion toujours là et fonctionnelle
    expect(screen.getByText('Valdrin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Se déconnecter/ }));
    expect(deconnecter).toHaveBeenCalledTimes(1);
  });
});
