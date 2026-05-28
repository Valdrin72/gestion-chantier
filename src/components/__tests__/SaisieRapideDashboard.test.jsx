import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import SaisieRapideDashboard from '../SaisieRapideDashboard';
import { renderWithApp } from '../../test-utils/renderWithApp';

// ── Mock usePointages ────────────────────────────────────────────────────────

const { mockUpsertPointage } = vi.hoisted(() => ({
  mockUpsertPointage: vi.fn(),
}));

vi.mock('../../hooks/usePointages', () => ({
  usePointages: () => ({
    upsertPointage: mockUpsertPointage,
    deletePointage: vi.fn(),
    getPointagesParDate: vi.fn(() => []),
    addPointage: vi.fn(),
    updatePointage: vi.fn(),
    getPointage: vi.fn(),
    getPointagesParEmploye: vi.fn(() => []),
    getPointagesParChantier: vi.fn(() => []),
  }),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const EMPLOYE = { id: 1, prenom: 'Jean', nom: 'Dupont', actif: true, poste: 'Maçon' };
const CHANTIER = {
  id: 'CH1', nom: 'Chantier Alpha', statut: 'en cours',
  canton: 'GE', equipe: [{ employeId: 1 }], journal: [],
  inclusSamedi: true, // évite le blocage samedi dans les tests
};
const PARAMETRES = { employes: [EMPLOYE] };

function renderComp(propsOverrides = {}, ctxOverrides = {}) {
  const defaultProps = {
    chantiersActifs: [CHANTIER],
    parametres: PARAMETRES,
    setChantiers: vi.fn(),
    afficherNotif: vi.fn(),
  };
  return renderWithApp(
    <SaisieRapideDashboard {...defaultProps} {...propsOverrides} />,
    { pointages: [], setPointages: vi.fn(), ...ctxOverrides },
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SaisieRapideDashboard', () => {
  beforeEach(() => { mockUpsertPointage.mockClear(); });

  it('rendu initial : le panneau est fermé', () => {
    renderComp();
    expect(screen.getByText('Saisie rapide d\'heures')).toBeInTheDocument();
    expect(screen.queryByText('Heures par employé')).not.toBeInTheDocument();
    expect(screen.queryByText('Sélectionnez un chantier')).not.toBeInTheDocument();
  });

  it('clic sur l\'en-tête → panneau ouvert, invite à choisir un chantier', () => {
    renderComp();
    fireEvent.click(screen.getByText('Saisie rapide d\'heures'));
    expect(screen.getByText(/Sélectionnez un chantier/i)).toBeInTheDocument();
  });

  it('la liste des chantiers actifs est présente dans le select', () => {
    renderComp();
    fireEvent.click(screen.getByText('Saisie rapide d\'heures'));
    expect(screen.getByRole('option', { name: 'Chantier Alpha' })).toBeInTheDocument();
  });

  it('sélection d\'un chantier → grille employés + titre "Heures par employé"', () => {
    renderComp();
    fireEvent.click(screen.getByText('Saisie rapide d\'heures'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CH1' } });
    expect(screen.getByText('Heures par employé')).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
  });

  it('bouton Enregistrer désactivé tant qu\'aucune heure saisie', () => {
    renderComp();
    fireEvent.click(screen.getByText('Saisie rapide d\'heures'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CH1' } });
    // Le bouton footer a pour accessible name exact "Enregistrer les heures"
    expect(screen.getByRole('button', { name: 'Enregistrer les heures' })).toBeDisabled();
  });

  it('saisie 8h → compteur "1 employé · 8h total" visible', () => {
    renderComp();
    fireEvent.click(screen.getByText('Saisie rapide d\'heures'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CH1' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '8' } });
    expect(screen.getByText(/1 employé.*8h total/i)).toBeInTheDocument();
  });

  it('clic Enregistrer → upsertPointage appelé avec les bonnes repartitions', () => {
    const afficherNotif = vi.fn();
    renderComp({ afficherNotif });
    fireEvent.click(screen.getByText('Saisie rapide d\'heures'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CH1' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '8' } });

    const btn = screen.getByRole('button', { name: 'Enregistrer les heures' });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    expect(mockUpsertPointage).toHaveBeenCalledOnce();
    const [pointage, canton] = mockUpsertPointage.mock.calls[0];
    expect(pointage.employeId).toBe(1);
    expect(pointage.repartitions).toEqual([
      { categorie: 'production', heures: 8, chantierId: 'CH1' },
    ]);
    expect(pointage.deplacement).toBeNull();
    expect(canton).toBe('GE');
    expect(afficherNotif).toHaveBeenCalledWith('Heures enregistrées — Chantier Alpha');
  });

  it('après enregistrement : champ heures remis à vide', () => {
    renderComp();
    fireEvent.click(screen.getByText('Saisie rapide d\'heures'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CH1' } });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les heures' }));
    expect(input.value).toBe('');
  });

  it('après enregistrement : flash de succès "Heures enregistrées avec succès"', () => {
    renderComp();
    fireEvent.click(screen.getByText('Saisie rapide d\'heures'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CH1' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les heures' }));
    expect(screen.getByText(/Heures enregistrées avec succès/i)).toBeInTheDocument();
  });
});
