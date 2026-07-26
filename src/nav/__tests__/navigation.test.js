/**
 * Navigation étape 1 — 13 entrées → 5 maisons, sans perdre aucun écran.
 * Teste le VRAI module de config (src/nav/maisons.js) ET le VRAI composant Sidebar.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { construireMaisons, filtrerMaisons, ecransAtteignables } from '../maisons';
import { Sidebar } from '../../components/Layout';

// Les 13 écrans de l'ancien menu — aucun ne doit devenir orphelin.
const ANCIEN_MENU = [
  'dashboard', 'chantiers', 'devis', 'finances', 'clients', 'employes',
  'heures', 'planning', 'rapport', 'agents', 'calculs', 'alertes', 'parametres',
];

describe('config des maisons — 5 maisons, tous les écrans atteignables', () => {
  const maisons = construireMaisons();

  it('exactement 5 maisons, dans l\'ordre attendu', () => {
    expect(maisons.map(m => m.label)).toEqual(['Accueil', 'Chantiers', 'Finances', 'Analyse & IA', 'Paramètres']);
  });

  it('GARDE-FOU : les 13 écrans de l\'ancien menu restent tous atteignables, exactement une fois', () => {
    const atteignables = ecransAtteignables(maisons);
    expect([...atteignables].sort()).toEqual([...ANCIEN_MENU].sort());
    // aucun doublon
    expect(new Set(atteignables).size).toBe(atteignables.length);
  });

  it('rangement attendu : chaque écran est dans la bonne maison', () => {
    const parLabel = Object.fromEntries(maisons.map(m => [m.label, m]));
    expect(parLabel['Accueil'].page).toBe('dashboard');
    expect(parLabel['Accueil'].enfants.map(e => e.id)).toContain('alertes');
    expect(parLabel['Chantiers'].page).toBe('chantiers');
    expect(parLabel['Chantiers'].enfants.map(e => e.id)).toEqual(['planning', 'heures']);
    expect(parLabel['Finances'].page).toBe('finances');
    expect(parLabel['Finances'].enfants.map(e => e.id)).toEqual(['devis', 'clients', 'employes']);
    expect(parLabel['Analyse & IA'].page).toBe('rapport');
    expect(parLabel['Analyse & IA'].enfants.map(e => e.id)).toEqual(['agents', 'calculs']);
    expect(parLabel['Paramètres'].page).toBe('parametres');
  });

  it('badges propagés depuis les compteurs (alertes urgentes, factures en retard)', () => {
    const m = construireMaisons({ urgentAlerteCount: 4, nbFacturesRetard: 2 });
    expect(m.find(x => x.label === 'Finances').badge).toBe(2);
    expect(m.find(x => x.label === 'Accueil').enfants[0].badge).toBe(4);
  });

  it('filtrage par permissions : une maison sans page ni enfant autorisé disparaît', () => {
    const filtres = filtrerMaisons(construireMaisons(), ['dashboard', 'alertes']); // droits réduits
    expect(filtres.map(m => m.label)).toEqual(['Accueil']);
    expect(filtres[0].enfants.map(e => e.id)).toEqual(['alertes']);
  });
});

describe('Sidebar (vrai composant) — on atteint chaque maison et les écrans clés', () => {
  const rendre = (page = 'dashboard') => {
    const naviguer = vi.fn();
    render(
      <Sidebar
        sidebarOuvert setSidebarOuvert={() => {}}
        maisons={construireMaisons()} page={page} naviguer={naviguer}
        darkMode={false} toggleDarkMode={() => {}}
        profil={{ nom: 'CYNA', id: 'cyna' }} deconnecter={() => {}}
      />
    );
    return naviguer;
  };

  it('les 5 en-têtes de maison sont affichés', () => {
    rendre();
    ['Accueil', 'Chantiers', 'Finances', 'Analyse & IA', 'Paramètres'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument()
    );
  });

  it('cliquer une maison navigue vers sa page principale', () => {
    const naviguer = rendre();
    fireEvent.click(screen.getByText('Chantiers'));
    expect(naviguer).toHaveBeenCalledWith('chantiers');
    fireEvent.click(screen.getByText('Finances'));
    expect(naviguer).toHaveBeenCalledWith('finances'); // les factures vivent ici
    fireEvent.click(screen.getByText('Paramètres'));
    expect(naviguer).toHaveBeenCalledWith('parametres');
  });

  it('ACTION FRÈRE : saisir des heures atteignable en 2 clics (Chantiers → Heures)', () => {
    const naviguer = rendre();
    fireEvent.click(screen.getByText('Chantiers'));   // ouvre la maison + va à la liste
    fireEvent.click(screen.getByText('Heures'));       // enfant désormais visible
    expect(naviguer).toHaveBeenCalledWith('heures');
  });

  it('BUREAU : devis et marge chantier atteignables', () => {
    const naviguer = rendre();
    fireEvent.click(screen.getByText('Finances'));
    fireEvent.click(screen.getByText('Devis'));
    expect(naviguer).toHaveBeenCalledWith('devis');
    // marge d'un chantier = via la maison Chantiers (liste → fiche)
    fireEvent.click(screen.getByText('Chantiers'));
    expect(naviguer).toHaveBeenCalledWith('chantiers');
  });

  it('ALERTES : liste complète atteignable depuis Accueil', () => {
    const naviguer = rendre();
    fireEvent.click(screen.getByText('Accueil'));  // ouvre Accueil
    fireEvent.click(screen.getByText('Alertes'));
    expect(naviguer).toHaveBeenCalledWith('alertes');
  });
});
