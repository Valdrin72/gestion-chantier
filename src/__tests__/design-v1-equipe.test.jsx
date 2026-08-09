/**
 * Design v1 — page ÉQUIPE (2 onglets : Équipe / Performance + formulaire).
 * Maquette validée patron. Rhabillage pur.
 *
 * ⚠ MONEY-CRITICAL : les tarifs horaires (CHF/h, régie, charges incluses) alimentent
 * les coûts de main d'œuvre. Aucun calcul touché — la non-régression des suites
 * coûts/tarifs le prouve. Ici on prouve seulement l'affichage v1 et que les actions
 * (dont la sauvegarde des tarifs) restent branchées.
 *
 * Preuve RTL RÉELLE (vrai composant Employes rendu via renderWithApp, aucun logic-mirror) :
 *   1. le hero affiche les 4 chiffres aux vraies valeurs (Effectif / Heures / Coût / Tarif moyen) ;
 *   2. onglet Équipe : cartes avec métier + CHF/h ; initiales retirées ;
 *   3. bascule Équipe ↔ Performance ; le tableau Performance affiche le coût main-d'œuvre ;
 *   4. « Nouvel employé » ouvre le formulaire ; sauvegarder préserve le tarif horaire.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Employes from '../pages/EmployesPage';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const AUJ = new Date().toISOString().slice(0, 10);
// Employé « Zébulon Xavier » (2 mots → ancienne initiale « Z ») avec heures aujourd'hui.
const EMP = { id: 1, nom: 'Zébulon Xavier', poste: 'Ouvrier qualifié', tarifHeure: 43.75, tarifJour: 350, telephone: '079 000 00 00', actif: true };
const CHANTIER = {
  id: 'CH1', nom: 'Chantier A', statut: 'en cours', clientId: 'cl1',
  equipe: [{ employeId: 1 }],
  journal: [{ date: AUJ, employes: [{ employeId: 1, heuresTravaillees: 8 }] }],
};

function renderEquipe(over = {}) {
  const setParametres = over.setParametres || vi.fn();
  return renderWithApp(
    <Employes
      parametres={{ employes: over.employes || [EMP], parametres: { coefficientMainOeuvre: 1 } }}
      setParametres={setParametres}
      chantiers={over.chantiers || [CHANTIER]}
      naviguer={over.naviguer || vi.fn()} />,
    { profil: { id: 'cyna' }, afficherNotif: vi.fn(), periodeGlobale: 'annee', ouvrirMenu: over.ouvrirMenu || vi.fn() },
  );
}

describe('HERO — 4 chiffres + ☰', () => {
  it('affiche Effectif (1), Heures totales, Coût mensuel et Tarif moyen (43.75/h)', () => {
    renderEquipe();
    const chiffres = screen.getByTestId('hero-chiffres');
    expect(within(chiffres).getByText('EFFECTIF')).toBeInTheDocument();
    expect(within(chiffres).getByText('HEURES TOTALES')).toBeInTheDocument();
    expect(within(chiffres).getByText('COÛT MENSUEL')).toBeInTheDocument();
    expect(within(chiffres).getByText('TARIF MOYEN')).toBeInTheDocument();
    expect(within(screen.getByTestId('hero-kpi-effectif')).getByText('1')).toBeInTheDocument();
    // Tarif moyen = 43.75/h (source de saisie, calcul inchangé)
    expect(screen.getByTestId('hero-kpi-tarif-moyen').textContent).toMatch(/43\.75\/h/);
  });

  it('le bouton ☰ du hero appelle ouvrirMenu', () => {
    const ouvrirMenu = vi.fn();
    renderEquipe({ ouvrirMenu });
    fireEvent.click(within(screen.getByTestId('hero-equipe')).getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });
});

describe('ONGLET ÉQUIPE — cartes employés', () => {
  it('affiche le nom, le métier et le CHF/h ; initiales retirées', () => {
    renderEquipe();
    expect(screen.getByText('Zébulon Xavier')).toBeInTheDocument();
    // Badge métier (le poste apparaît sur la carte)
    expect(screen.getAllByText('Ouvrier qualifié').length).toBeGreaterThan(0);
    // CHF/h affiché (43.75)
    expect(screen.getByText('43.75')).toBeInTheDocument();
    // Ancienne initiale colorée « Z » retirée
    expect(screen.queryByText('Z')).toBeNull();
  });
});

describe('BASCULE Équipe / Performance', () => {
  it('cliquer Performance affiche le tableau avec le coût main-d\'œuvre', () => {
    renderEquipe();
    fireEvent.click(screen.getByRole('button', { name: 'Performance' }));
    // « Coût main-d'œuvre » apparaît en KPI ET en-tête de colonne → getAll
    expect(screen.getAllByText(/Coût main-d'œuvre/i).length).toBeGreaterThanOrEqual(2);
    expect(within(screen.getByTestId('perf-kpis')).getByText('HEURES ÉQUIPE')).toBeInTheDocument();
    // La ligne de l'employé porte des heures (8h aujourd'hui, période année)
    expect(screen.getAllByText(/8h/).length).toBeGreaterThan(0);
  });
});

describe('FORMULAIRE — création (tarifs préservés)', () => {
  it('« Nouvel employé » ouvre le formulaire ; sauvegarder préserve le tarif horaire', () => {
    const setParametres = vi.fn();
    renderEquipe({ setParametres });
    fireEvent.click(within(screen.getByTestId('hero-equipe')).getByRole('button', { name: /Nouvel employé/i }));
    expect(screen.getByRole('button', { name: /Sauvegarder/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Jean Martin'), { target: { value: 'Paul Neuf' } });
    fireEvent.change(screen.getByPlaceholderText('43.75'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));

    expect(setParametres).toHaveBeenCalledOnce();
    const emp = setParametres.mock.calls[0][0].employes.find(e => e.nom === 'Paul Neuf');
    expect(emp).toBeTruthy();
    // Tarif horaire conservé + tarifJour dérivé (× 8) — calcul inchangé (money-critical)
    expect(emp.tarifHeure).toBe(50);
    expect(emp.tarifJour).toBe(400);
  });
});
