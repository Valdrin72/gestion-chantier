import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import PointageFormulaire from '../../components/pointages/PointageFormulaire';
import { renderWithApp } from '../../test-utils/renderWithApp';

// ── Mock usePointages ────────────────────────────────────────────────────────

const { mockUpsert } = vi.hoisted(() => ({ mockUpsert: vi.fn() }));

vi.mock('../../hooks/usePointages', () => ({
  usePointages: () => ({
    upsertPointage: mockUpsert,
    addPointage: vi.fn(),
    updatePointage: vi.fn(),
    deletePointage: vi.fn(),
    getPointage: vi.fn(),
    getPointagesParDate: vi.fn(() => []),
    getPointagesParEmploye: vi.fn(() => []),
    getPointagesParChantier: vi.fn(() => []),
  }),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const EMP1 = { id: 1, prenom: 'Jean', nom: 'Dupont', actif: true, poste: 'Maçon' };
const EMP2 = { id: 2, prenom: 'Marc', nom: 'Martin', actif: true, poste: 'Chef' };
const PARAMETRES = { employes: [EMP1, EMP2] };

// Chantier GE
const CH_GE = {
  id: 'CH_GE', nom: 'Chantier Genève', statut: 'en cours', canton: 'GE',
  equipe: [{ employeId: 1 }], journal: [],
};
// Chantier VD
const CH_VD = {
  id: 'CH_VD', nom: 'Chantier Vaud', statut: 'en cours', canton: 'VD',
  equipe: [{ employeId: 1 }], journal: [],
};

// Samedi canonique pour les tests de badge
const SAMEDI = '2025-09-06';
// Jeûne genevois 2026 — férié GE, ouvrable VD
const JEUNE_GE = '2026-09-10';

function renderForm(ctxOverrides = {}) {
  const afficherNotif = vi.fn();
  return renderWithApp(
    <PointageFormulaire />,
    {
      chantiers: [CH_GE, CH_VD],
      parametres: PARAMETRES,
      pointages: [],
      setPointages: vi.fn(),
      afficherNotif,
      ...ctxOverrides,
    },
  );
}

// ── Setup global — vider + réinitialiser le mock avant chaque test ────────────

beforeEach(() => {
  mockUpsert.mockReset();
  mockUpsert.mockReturnValue({ ok: true });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PointageFormulaire — rendu initial', () => {

  it('affiche les selects date, employé et chantier', () => {
    renderForm();
    expect(screen.getByRole('combobox', { name: '' })).toBeInTheDocument(); // employé
    expect(screen.getByLabelText('Chantier')).toBeInTheDocument();
  });

  it('bouton Enregistrer désactivé sans sélection', () => {
    renderForm();
    const btn = screen.getByRole('button', { name: /Enregistrer le pointage/i });
    expect(btn).toBeDisabled();
  });
});

describe('PointageFormulaire — saisie complète → upsertPointage', () => {

  it('saisie employé + chantier + 8h → upsertPointage appelé avec bonnes repartitions', () => {
    renderForm();

    // Sélectionne l'employé
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } }); // employé

    // Sélectionne le chantier dans la ligne de répartition
    fireEvent.change(screen.getByLabelText('Chantier'), { target: { value: 'CH_GE' } });
    // Saisit les heures
    fireEvent.change(screen.getByLabelText('Heures'), { target: { value: '8' } });

    // Clique Enregistrer
    const btn = screen.getByRole('button', { name: /Enregistrer le pointage/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    expect(mockUpsert).toHaveBeenCalledOnce();
    const [ptg, canton] = mockUpsert.mock.calls[0];
    expect(ptg.repartitions).toEqual([
      { chantierId: 'CH_GE', categorie: 'production', heures: 8 },
    ]);
    expect(ptg.deplacement).toBeNull();
    expect(canton).toBe('GE');
  });

  it('après enregistrement : flash de succès visible', () => {
    renderForm();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Chantier'), { target: { value: 'CH_GE' } });
    fireEvent.change(screen.getByLabelText('Heures'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le pointage/i }));
    expect(screen.getByText(/Pointage enregistré/i)).toBeInTheDocument();
  });
});

describe('PointageFormulaire — multi-chantier', () => {

  it('bouton "+ Ajouter un chantier" ajoute une deuxième ligne', () => {
    renderForm();
    const btnAjouter = screen.getByRole('button', { name: /\+ Ajouter un chantier/i });
    fireEvent.click(btnAjouter);
    // Maintenant il doit y avoir 2 selects "Chantier"
    expect(screen.getAllByLabelText('Chantier')).toHaveLength(2);
  });

  it('bouton supprimer ligne visible quand ≥ 2 lignes', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /\+ Ajouter un chantier/i }));
    expect(screen.getAllByRole('button', { name: /Supprimer la ligne/i })).toHaveLength(2);
  });

  it('supprimer une ligne → repasse à 1 ligne', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /\+ Ajouter un chantier/i }));
    expect(screen.getAllByLabelText('Chantier')).toHaveLength(2);
    const [btnSuppr] = screen.getAllByRole('button', { name: /Supprimer la ligne/i });
    fireEvent.click(btnSuppr);
    expect(screen.getAllByLabelText('Chantier')).toHaveLength(1);
  });

  it('2 chantiers + heures → upsertPointage avec 2 repartitions', () => {
    renderForm();
    // Ligne 1
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } }); // employé
    const chantierSelects = screen.getAllByLabelText('Chantier');
    fireEvent.change(chantierSelects[0], { target: { value: 'CH_GE' } });
    fireEvent.change(screen.getAllByLabelText('Heures')[0], { target: { value: '5' } });

    // Ajouter ligne 2
    fireEvent.click(screen.getByRole('button', { name: /\+ Ajouter un chantier/i }));
    const chantierSelects2 = screen.getAllByLabelText('Chantier');
    fireEvent.change(chantierSelects2[1], { target: { value: 'CH_VD' } });
    fireEvent.change(screen.getAllByLabelText('Heures')[1], { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le pointage/i }));

    expect(mockUpsert).toHaveBeenCalledOnce();
    const [ptg] = mockUpsert.mock.calls[0];
    expect(ptg.repartitions).toHaveLength(2);
    expect(ptg.repartitions[0]).toMatchObject({ chantierId: 'CH_GE', heures: 5 });
    expect(ptg.repartitions[1]).toMatchObject({ chantierId: 'CH_VD', heures: 3 });
  });
});

describe('PointageFormulaire — mode édition auto (Q2)', () => {
  it('pointage existant pour (date, employé) → indicateur "Modification d\'un pointage existant"', () => {
    const TODAY = new Date().toISOString().split('T')[0];
    const existingPointage = {
      id: 'ptg_existing',
      date: TODAY,
      employeId: 1,
      repartitions: [{ chantierId: 'CH_GE', categorie: 'production', heures: 7 }],
      deplacement: null,
      majoration: null,
    };
    renderForm({ pointages: [existingPointage] });

    // Sélectionne employé 1 — déclenche le useEffect auto-édition
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });

    expect(screen.getByText(/Modification d'un pointage existant/i)).toBeInTheDocument();
  });

  it('mode édition → bouton libellé "Modifier le pointage"', () => {
    const TODAY = new Date().toISOString().split('T')[0];
    const existingPointage = {
      id: 'ptg_existing2',
      date: TODAY,
      employeId: 1,
      repartitions: [{ chantierId: 'CH_GE', categorie: 'production', heures: 7 }],
      deplacement: null,
      majoration: null,
    };
    renderForm({ pointages: [existingPointage] });
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    expect(screen.getByRole('button', { name: /Modifier le pointage/i })).toBeInTheDocument();
  });

  it('mode édition → chantier pré-rempli dans la ligne', () => {
    const TODAY = new Date().toISOString().split('T')[0];
    const existingPointage = {
      id: 'ptg_existing3',
      date: TODAY,
      employeId: 1,
      repartitions: [{ chantierId: 'CH_GE', categorie: 'production', heures: 7 }],
      deplacement: null,
      majoration: null,
    };
    renderForm({ pointages: [existingPointage] });
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    // Le select chantier doit être pré-rempli
    expect(screen.getByLabelText('Chantier').value).toBe('CH_GE');
  });
});

describe('PointageFormulaire — absences', () => {

  it('cocher absence CP → section visible avec input heures', () => {
    renderForm();
    const checkbox = screen.getByRole('checkbox', { name: /Absence ce jour/i });
    fireEvent.click(checkbox);
    expect(screen.getByLabelText(/Heures d'absence/i)).toBeInTheDocument();
  });

  it('4h CP + 4h production → 2 repartitions dans upsertPointage', () => {
    renderForm();

    // Employé + chantier + 4h production
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Chantier'), { target: { value: 'CH_GE' } });
    fireEvent.change(screen.getByLabelText('Heures'), { target: { value: '4' } });

    // Absence 4h CP
    fireEvent.click(screen.getByRole('checkbox', { name: /Absence ce jour/i }));
    const heuresAbsence = screen.getByLabelText(/Heures d'absence/i);
    fireEvent.change(heuresAbsence, { target: { value: '4' } });

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le pointage/i }));

    expect(mockUpsert).toHaveBeenCalledOnce();
    const [ptg] = mockUpsert.mock.calls[0];
    expect(ptg.repartitions).toHaveLength(2);
    expect(ptg.repartitions.find(r => r.categorie === 'production')?.heures).toBe(4);
    expect(ptg.repartitions.find(r => r.categorie === 'absence_cp')?.heures).toBe(4);
    expect(ptg.repartitions.find(r => r.categorie === 'absence_cp')?.chantierId).toBeNull();
  });
});

describe('PointageFormulaire — déplacement', () => {

  it('cocher trajet → champs duree_h et indemnite_chf visibles', () => {
    renderForm();
    const checkbox = screen.getByRole('checkbox', { name: /Trajet ce jour/i });
    fireEvent.click(checkbox);
    expect(screen.getByLabelText(/Durée du trajet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Indemnité de déplacement/i)).toBeInTheDocument();
  });

  it('saisie déplacement → ptg.deplacement transmis correctement', () => {
    renderForm();
    // Remplir le minimum pour pouvoir sauvegarder
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Chantier'), { target: { value: 'CH_GE' } });
    fireEvent.change(screen.getByLabelText('Heures'), { target: { value: '7' } });

    // Activer + remplir déplacement
    fireEvent.click(screen.getByRole('checkbox', { name: /Trajet ce jour/i }));
    fireEvent.change(screen.getByLabelText(/Durée du trajet/i), { target: { value: '0.75' } });
    fireEvent.change(screen.getByLabelText(/Indemnité de déplacement/i), { target: { value: '15' } });

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le pointage/i }));

    const [ptg] = mockUpsert.mock.calls[0];
    expect(ptg.deplacement).toEqual({ duree_h: 0.75, indemnite_chf: 15 });
  });
});

describe('PointageFormulaire — badges majoration', () => {
  it('samedi → badge "SAM ×1.25" sur la ligne (canton GE)', () => {
    renderForm();
    // Changer la date au samedi
    const dateInput = document.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: SAMEDI } });
    // Sélectionner un chantier GE pour que le badge apparaisse
    fireEvent.change(screen.getByLabelText('Chantier'), { target: { value: 'CH_GE' } });
    expect(screen.getByText(/SAM ×1\.25/i)).toBeInTheDocument();
  });

  it('samedi → badge sur la ligne VD aussi (week-end canton-indépendant)', () => {
    renderForm();
    const dateInput = document.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: SAMEDI } });
    fireEvent.change(screen.getByLabelText('Chantier'), { target: { value: 'CH_VD' } });
    expect(screen.getByText(/SAM ×1\.25/i)).toBeInTheDocument();
  });

  it('Jeûne genevois → badge FÉRIÉ sur ligne GE, rien sur ligne VD', () => {
    renderForm();
    const dateInput = document.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: JEUNE_GE } });

    // Ajouter une ligne
    fireEvent.click(screen.getByRole('button', { name: /\+ Ajouter un chantier/i }));

    // Ligne 0 = GE, ligne 1 = VD
    const chantierSelects = screen.getAllByLabelText('Chantier');
    fireEvent.change(chantierSelects[0], { target: { value: 'CH_GE' } });
    fireEvent.change(chantierSelects[1], { target: { value: 'CH_VD' } });

    // GE → FÉRIÉ ; VD → rien (Jeûne genevois n'est pas férié VD)
    expect(screen.getByText(/FÉRIÉ ×1\.5/i)).toBeInTheDocument();
    // Le badge FÉRIÉ ne doit apparaître qu'UNE SEULE fois (ligne GE seulement)
    expect(screen.getAllByText(/FÉRIÉ ×1\.5/i)).toHaveLength(1);
  });
});
