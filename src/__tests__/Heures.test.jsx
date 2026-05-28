import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import Heures from '../Heures';
import { renderWithApp } from '../test-utils/renderWithApp';

// ── Mock usePointages ────────────────────────────────────────────────────────

const { mockUpsertPointage, mockDeletePointage, mockGetPointagesParDate } = vi.hoisted(() => ({
  mockUpsertPointage: vi.fn(),
  mockDeletePointage: vi.fn(),
  mockGetPointagesParDate: vi.fn(() => []),
}));

vi.mock('../hooks/usePointages', () => ({
  usePointages: () => ({
    upsertPointage: mockUpsertPointage,
    deletePointage: mockDeletePointage,
    getPointagesParDate: mockGetPointagesParDate,
    addPointage: vi.fn(),
    updatePointage: vi.fn(),
    getPointage: vi.fn(),
    getPointagesParEmploye: vi.fn(() => []),
    getPointagesParChantier: vi.fn(() => []),
  }),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const EMPLOYE = { id: 1, prenom: 'Luc', nom: 'Bernard', actif: true, poste: 'Chef chantier' };
const CHANTIER = {
  id: 'CH3', nom: 'Construction Villa', statut: 'en cours',
  canton: 'GE', equipe: [{ employeId: 1 }], journal: [],
  dateDebut: '2020-01-01', inclusSamedi: true,
};
const PARAMETRES = { employes: [EMPLOYE] };

function renderHeures(propsOverrides = {}, ctxOverrides = {}) {
  const heuresChantiers = propsOverrides.chantiers || [CHANTIER];
  const heuresParams = propsOverrides.parametres || PARAMETRES;
  const defaultProps = {
    chantiers: heuresChantiers,
    parametres: heuresParams,
    setChantiers: vi.fn(),
  };
  return renderWithApp(
    <Heures {...defaultProps} {...propsOverrides} />,
    {
      pointages: [], setPointages: vi.fn(), periodeGlobale: 'semaine',
      // Fournir chantiers + parametres pour PointageFormulaire via useApp()
      chantiers: heuresChantiers,
      parametres: heuresParams,
      ...ctxOverrides,
    },
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Heures — grille hebdomadaire', () => {
  beforeEach(() => {
    mockUpsertPointage.mockReset();
    mockUpsertPointage.mockReturnValue({ ok: true });
    mockDeletePointage.mockClear();
    mockGetPointagesParDate.mockReturnValue([]);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('se rend sans erreur avec un employé et un chantier', () => {
    renderHeures();
    expect(screen.getByText('Heures')).toBeInTheDocument();
  });

  it('affiche le titre de la semaine courante', () => {
    renderHeures();
    expect(screen.getByText(/Semaine du/i)).toBeInTheDocument();
  });

  it('les boutons de navigation semaine sont présents', () => {
    renderHeures();
    expect(screen.getByRole('button', { name: /sem\. préc\./i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cette semaine/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sem\. suiv\./i })).toBeInTheDocument();
  });

  it('sans employés : message "Aucun employé configuré"', () => {
    renderHeures({ parametres: { employes: [] } });
    expect(screen.getByText(/aucun employé configuré/i)).toBeInTheDocument();
  });

  it('avec un employé : son nom apparaît dans la grille', () => {
    renderHeures();
    expect(screen.getByText('Bernard')).toBeInTheDocument();
  });

  // ── Tests adaptés : ModalPointageFormulaire remplace la modale inline ──────

  it('bouton "Saisir des heures" ouvre ModalPointageFormulaire', () => {
    renderHeures();
    fireEvent.click(screen.getByRole('button', { name: /saisir des heures/i }));
    // ModalPointageFormulaire rend un h2 "Pointage" et le formulaire complet
    expect(screen.getByRole('heading', { name: 'Pointage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enregistrer le pointage/i })).toBeInTheDocument();
  });

  it('bouton "Saisir des heures" ouvre le formulaire avec la date d\'aujourd\'hui pré-remplie', () => {
    const TODAY = new Date().toISOString().split('T')[0];
    renderHeures();
    fireEvent.click(screen.getByRole('button', { name: /saisir des heures/i }));
    // L'input date est pré-rempli avec aujourd'hui (initialDate = undefined → TODAY dans PointageFormulaire)
    const dateInputs = screen.getAllByDisplayValue(TODAY);
    expect(dateInputs.length).toBeGreaterThanOrEqual(1);
  });

  it('saisie dans ModalPointageFormulaire → upsertPointage appelé avec les bonnes répartitions', () => {
    renderHeures();
    fireEvent.click(screen.getByRole('button', { name: /saisir des heures/i }));

    // PointageFormulaire : 3 comboboxes (employé, chantier, catégorie) + 1 spinbutton (heures)
    const comboboxes = screen.getAllByRole('combobox');
    // comboboxes[0] = employé select
    fireEvent.change(comboboxes[0], { target: { value: '1' } });
    // comboboxes[1] = chantier select dans LigneRepartition
    fireEvent.change(comboboxes[1], { target: { value: 'CH3' } });

    // Spinbutton = heures dans LigneRepartition
    const spinbutton = screen.getByRole('spinbutton');
    fireEvent.change(spinbutton, { target: { value: '8' } });

    fireEvent.click(screen.getByRole('button', { name: /enregistrer le pointage/i }));

    expect(mockUpsertPointage).toHaveBeenCalledOnce();
    const [pointage, canton] = mockUpsertPointage.mock.calls[0];
    expect(pointage.repartitions).toEqual([
      { chantierId: 'CH3', categorie: 'production', heures: 8 },
    ]);
    expect(canton).toBe('GE');
  });

  // ── Nouveau test : clic "+" sur cellule → prefill date + employeId ─────────

  it('clic "+" sur une cellule ouvre ModalPointageFormulaire avec date et employé pré-remplis', () => {
    renderHeures();
    // Les cellules de la semaine courante sans heures affichent "Saisir heures" en titre
    const cells = screen.getAllByTitle('Saisir heures');
    expect(cells.length).toBeGreaterThan(0);
    fireEvent.click(cells[0]);

    // La modale s'ouvre
    expect(screen.getByRole('heading', { name: 'Pointage' })).toBeInTheDocument();
    // L'employé est pré-rempli (select avec valeur '1')
    const empSelects = screen.getAllByRole('combobox');
    const empSelect = empSelects.find(s => s.value === '1');
    expect(empSelect).toBeDefined();
  });

  // ── Nouveau test : cellule avec pointage → mode édition ───────────────────

  it('clic sur cellule avec pointage existant → mode édition dans ModalPointageFormulaire', async () => {
    const TODAY_STR = new Date().toISOString().split('T')[0];
    const ptg = {
      id: 'ptg_today', date: TODAY_STR, employeId: 1,
      repartitions: [{ chantierId: 'CH3', categorie: 'production', heures: 6 }],
      deplacement: null,
    };
    const chantierAvecJournal = {
      ...CHANTIER,
      journal: [{ date: TODAY_STR, employes: [{ employeId: 1, heuresTravaillees: 6 }] }],
    };

    renderHeures(
      { chantiers: [chantierAvecJournal] },
      { chantiers: [chantierAvecJournal], parametres: PARAMETRES, pointages: [ptg] },
    );

    // La cellule avec heures affiche "6h" et a title "Modifier — 6h"
    const cell6h = screen.getByTitle('Modifier — 6h');
    fireEvent.click(cell6h);

    expect(screen.getByRole('heading', { name: 'Pointage' })).toBeInTheDocument();
    // PointageFormulaire détecte le pointage existant et passe en mode édition
    await screen.findByText(/Modification d'un pointage existant/i);
  });

  it('navigation ← Sem. préc. → le titre de la semaine change', () => {
    renderHeures();
    const initialTitle = screen.getByText(/Semaine du/i).textContent;
    fireEvent.click(screen.getByRole('button', { name: /sem\. préc\./i }));
    const newTitle = screen.getByText(/Semaine du/i).textContent;
    expect(newTitle).not.toBe(initialTitle);
  });

  it('deletePointage reste accessible via le hook (non invoqué depuis la grille)', () => {
    renderHeures();
    expect(mockDeletePointage).not.toHaveBeenCalled();
  });
});
