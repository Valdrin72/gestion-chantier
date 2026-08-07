/**
 * Design v1 — page HEURES (grille hebdomadaire + fenêtre de pointage).
 * Maquette validée patron : hero bleu nuit (4 chiffres) + grille v1 (initiales
 * retirées) + modale de pointage à en-tête bleu nuit.
 *
 * ⚠ MONEY-CRITICAL : rhabillage pur. Aucun calcul d'heures / taux CCT / répartition
 * touché (la non-régression des suites de pointage/majorations le prouve). Ici on
 * prouve seulement l'affichage v1 et que les actions restent branchées.
 *
 * Preuve RTL RÉELLE (vrai composant Heures + vraie modale + vrai hook usePointages) :
 *   1. le hero affiche les 4 chiffres (dont NON SAISIES à la vraie valeur) ;
 *   2. la grille liste les vrais employés avec leur métier, sans initiales colorées ;
 *   3. la navigation semaine change la semaine affichée ;
 *   4. « Saisir des heures » ouvre la modale (en-tête « Pointage ») ;
 *   5. répartition chantier + heures puis « Enregistrer » → sauvegarde réelle (setPointages).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Heures from '../Heures';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

// Employé au nom en deux mots → l'ancien badge affichait les initiales « XY ».
const EMPLOYE = { id: 1, prenom: 'Anna', nom: 'Xylo Yeti', actif: true, poste: 'Maçon' };
const CHANTIER = { id: 'CH3', nom: 'Construction Villa', statut: 'en cours', canton: 'GE', equipe: [{ employeId: 1 }], journal: [], dateDebut: '2020-01-01', inclusSamedi: true };
const PARAMETRES = { employes: [EMPLOYE] };

function renderHeures(over = {}) {
  return renderWithApp(
    <Heures chantiers={[CHANTIER]} parametres={PARAMETRES} setChantiers={vi.fn()} />,
    {
      pointages: [], setPointages: over.setPointages || vi.fn(), periodeGlobale: 'semaine',
      chantiers: [CHANTIER], parametres: PARAMETRES,
      afficherNotif: vi.fn(), ouvrirMenu: over.ouvrirMenu || vi.fn(),
      setPeriodeGlobale: over.setPeriodeGlobale || vi.fn(),
    },
  );
}

describe('HERO — 4 chiffres + ☰', () => {
  it('affiche les 4 libellés et NON SAISIES = 1 (un employé sans heures)', () => {
    renderHeures();
    const chiffres = screen.getByTestId('hero-chiffres');
    expect(within(chiffres).getByText(/HEURES SEMAINE/)).toBeInTheDocument();
    expect(within(chiffres).getByText('MOYENNE / EMPLOYÉ')).toBeInTheDocument();
    expect(within(chiffres).getByText('HEURES SUPP.')).toBeInTheDocument();
    expect(within(chiffres).getByText('NON SAISIES')).toBeInTheDocument();
    // Un seul employé actif, aucune heure lun–ven → NON SAISIES = 1
    expect(within(screen.getByTestId('hero-kpi-non-saisies')).getByText('1')).toBeInTheDocument();
  });

  it('le bouton ☰ du hero appelle ouvrirMenu', () => {
    const ouvrirMenu = vi.fn();
    renderHeures({ ouvrirMenu });
    fireEvent.click(within(screen.getByTestId('hero-heures')).getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });
});

describe('GRILLE — employés + métier, initiales retirées', () => {
  it('affiche le nom et le métier de l\'employé', () => {
    renderHeures();
    expect(screen.getByText('Xylo Yeti')).toBeInTheDocument();
    expect(screen.getByText('Maçon')).toBeInTheDocument();
  });

  it('les initiales colorées (« XY ») ont été retirées', () => {
    renderHeures();
    expect(screen.queryByText('XY')).toBeNull();
  });
});

describe('NAVIGATION semaine', () => {
  it('« ← Sem. préc. » change la semaine affichée', () => {
    renderHeures();
    const avant = screen.getByText(/Semaine du/i).textContent;
    fireEvent.click(screen.getByRole('button', { name: /sem\. préc\./i }));
    expect(screen.getByText(/Semaine du/i).textContent).not.toBe(avant);
  });
});

describe('MODALE de pointage', () => {
  it('« Saisir des heures » ouvre la modale (en-tête « Pointage »)', () => {
    renderHeures();
    fireEvent.click(screen.getByRole('button', { name: /saisir des heures/i }));
    expect(screen.getByRole('heading', { name: 'Pointage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enregistrer le pointage/i })).toBeInTheDocument();
  });

  it('répartition chantier + heures puis « Enregistrer » → sauvegarde réelle (setPointages)', () => {
    const setPointages = vi.fn();
    renderHeures({ setPointages });
    fireEvent.click(screen.getByRole('button', { name: /saisir des heures/i }));

    // Selects ciblés par leurs options (robuste au <select> période du hero)
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos.find(s => within(s).queryAllByRole('option').some(o => o.value === '1')), { target: { value: '1' } });
    fireEvent.change(combos.find(s => within(s).queryAllByRole('option').some(o => o.value === 'CH3')), { target: { value: 'CH3' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '8' } });

    fireEvent.click(screen.getByRole('button', { name: /enregistrer le pointage/i }));
    // Le vrai hook usePointages persiste via setPointages → preuve que l'action est branchée.
    expect(setPointages).toHaveBeenCalled();
  });
});
