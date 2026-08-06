/**
 * Design v1 — ajustements : drawer de navigation au clic (☰) remplaçant la
 * sidebar fixe. La navigation reste ENTIÈREMENT testée : ouvrir le menu →
 * cliquer une entrée → la route change et le panneau se ferme.
 * Vrais composants (Sidebar, Topbar, Dashboard).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { Sidebar, Topbar } from '../components/Layout';
import Dashboard from '../pages/Dashboard';
import { HardHat, FileText, Users } from 'lucide-react';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const MAISONS = [
  { id: 'accueil', page: 'dashboard', label: 'Accueil', Icon: HardHat, enfants: [] },
  { id: 'chantiers', page: 'chantiers', label: 'Chantiers', Icon: HardHat, enfants: [] },
  { id: 'finances', page: 'finances', label: 'Finances', Icon: FileText, enfants: [] },
  { id: 'employes', page: 'employes', label: 'Employés', Icon: Users, enfants: [] },
];

function renderSidebar(over = {}) {
  const naviguer = over.naviguer || vi.fn();
  const setSidebarOuvert = over.setSidebarOuvert || vi.fn();
  const result = renderWithApp(
    <Sidebar sidebarOuvert={over.ouvert ?? true} setSidebarOuvert={setSidebarOuvert}
      maisons={MAISONS} page="dashboard" naviguer={naviguer}
      darkMode={false} toggleDarkMode={vi.fn()} profil={{ nom: 'Valdrin', id: 'cyna' }} deconnecter={vi.fn()} />,
    {},
  );
  return { ...result, naviguer, setSidebarOuvert };
}

describe('DRAWER — la navigation complète vit dans le panneau au clic', () => {
  it('ouvert : toutes les entrées + « Nouveau devis » sont visibles', () => {
    renderSidebar();
    ['Accueil', 'Chantiers', 'Finances', 'Employés'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument());
    expect(screen.getByText(/Nouveau devis/)).toBeInTheDocument();
  });

  it('cliquer une entrée → la route change ET le panneau se ferme', () => {
    const { naviguer, setSidebarOuvert } = renderSidebar();
    fireEvent.click(screen.getByText('Finances'));
    expect(naviguer).toHaveBeenCalledWith('finances');
    expect(setSidebarOuvert).toHaveBeenCalledWith(false);
  });

  it('✕ ferme le panneau ; clic sur l\'overlay ferme aussi', () => {
    const { setSidebarOuvert, container } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /Fermer le menu/i }));
    expect(setSidebarOuvert).toHaveBeenCalledWith(false);
    const overlay = container.querySelector('.sidebar-overlay');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);
    expect(setSidebarOuvert).toHaveBeenCalledTimes(2);
  });

  it('fermé : la classe sidebar-open est absente (drawer replié)', () => {
    const { container } = renderSidebar({ ouvert: false });
    expect(container.querySelector('.sidebar-open')).toBeNull();
    expect(container.querySelector('.sidebar')).not.toBeNull(); // le panneau existe, replié
  });
});

describe('☰ — points d\'entrée du menu', () => {
  it('le hero de l\'Accueil a le bouton ☰ qui ouvre le menu (ouvrirMenu du contexte)', () => {
    const ouvrirMenu = vi.fn();
    renderWithApp(<Dashboard />, {
      chantiers: [], factures: [], devis: [], clients: [],
      parametres: { employes: [], localites: [], parametres: {} },
      pointages: [], naviguer: vi.fn(), agentState: { scoreGlobal: 60, alertes: [], priorites: [], briefingMatin: null },
      periodeGlobale: 'annee', setPeriodeGlobale: vi.fn(), ouvrirMenu,
      profil: { id: 'cyna', pages: ['dashboard'] },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^Menu$/i })[0]);
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });

  it('le Topbar des autres pages a le bouton ☰ qui ouvre le drawer', () => {
    const setSidebarOuvert = vi.fn();
    renderWithApp(
      <Topbar setSidebarOuvert={setSidebarOuvert} canGoBack={false} page="chantiers"
        revenirArriere={vi.fn()} darkMode={false} toggleDarkMode={vi.fn()}
        profil={{ id: 'cyna' }} naviguer={vi.fn()} />,
      { chantiers: [], devis: [], factures: [], clients: [], periodeGlobale: 'annee', setPeriodeGlobale: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /^Menu$/i }));
    expect(setSidebarOuvert).toHaveBeenCalledWith(true);
  });
});
