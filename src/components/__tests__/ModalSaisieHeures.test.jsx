import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import ModalSaisieHeures from '../ModalSaisieHeures';
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

const EMPLOYE_1 = { id: 1, prenom: 'Marie', nom: 'Martin', actif: true, poste: 'Électricienne' };
const EMPLOYE_2 = { id: 2, prenom: 'Paul', nom: 'Renaud', actif: true, poste: 'Plombier' };
const TODAY = new Date().toISOString().slice(0, 10);

const CHANTIER = {
  id: 'CH2', nom: 'Rénovation Bureau', statut: 'en cours',
  canton: 'GE', equipe: [{ employeId: 1 }], journal: [],
  dateDebut: '2020-01-01', inclusSamedi: true,
};
const PARAMETRES = { employes: [EMPLOYE_1, EMPLOYE_2] };

function renderModal(propsOverrides = {}, ctxOverrides = {}) {
  const defaultProps = {
    chantierSaisie: CHANTIER,
    initialDate: TODAY,
    onFermer: vi.fn(),
    onSave: vi.fn(),
    parametres: PARAMETRES,
  };
  return renderWithApp(
    <ModalSaisieHeures {...defaultProps} {...propsOverrides} />,
    { pointages: [], setPointages: vi.fn(), ...ctxOverrides },
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ModalSaisieHeures', () => {
  beforeEach(() => {
    mockUpsertPointage.mockClear();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('affiche le nom du chantier et les employés', () => {
    renderModal();
    expect(screen.getByText('Rénovation Bureau')).toBeInTheDocument();
    expect(screen.getByText('Marie Martin')).toBeInTheDocument();
    expect(screen.getByText('Paul Renaud')).toBeInTheDocument();
  });

  it('membres d\'équipe affichés en premier (Marie avant Paul)', () => {
    renderModal();
    const names = screen.getAllByText(/Martin|Renaud/).map(n => n.textContent);
    expect(names[0]).toContain('Martin');
    expect(names[1]).toContain('Renaud');
  });

  it('bouton Valider désactivé si 0 heures saisies', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /valider/i })).toBeDisabled();
  });

  it('quick fill 8h → compteur affiche "1 employé · 8h"', () => {
    renderModal();
    // Le premier bouton "8h" correspond au quick fill de Marie Martin
    const btn8h = screen.getAllByRole('button', { name: '8h' })[0];
    fireEvent.click(btn8h);
    expect(screen.getByText(/1 employé.*·.*8h/i)).toBeInTheDocument();
  });

  it('quick fill 8h pour 2 employés → compteur "2 employés · 16h"', () => {
    renderModal();
    const btns8h = screen.getAllByRole('button', { name: '8h' });
    fireEvent.click(btns8h[0]); // Marie
    fireEvent.click(btns8h[1]); // Paul
    expect(screen.getByText(/2 employés.*·.*16h/i)).toBeInTheDocument();
  });

  it('Valider → upsertPointage appelé une fois par employé saisi', () => {
    const onSave = vi.fn();
    renderModal({ onSave });
    const btns8h = screen.getAllByRole('button', { name: '8h' });
    fireEvent.click(btns8h[0]); // Marie 8h

    const validateBtn = screen.getByRole('button', { name: /valider/i });
    expect(validateBtn).not.toBeDisabled();
    fireEvent.click(validateBtn);

    expect(mockUpsertPointage).toHaveBeenCalledOnce();
    const [pointage, canton] = mockUpsertPointage.mock.calls[0];
    expect(pointage.employeId).toBe(1); // Marie id=1
    expect(pointage.repartitions).toEqual([
      { categorie: 'production', heures: 8, chantierId: 'CH2' },
    ]);
    expect(pointage.date).toBe(TODAY);
    expect(canton).toBe('GE');
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('Valider avec 2 employés → 2 appels upsertPointage', () => {
    const onSave = vi.fn();
    renderModal({ onSave });
    const btns8h = screen.getAllByRole('button', { name: '8h' });
    fireEvent.click(btns8h[0]); // Marie 8h
    fireEvent.click(btns8h[1]); // Paul 8h
    fireEvent.click(screen.getByRole('button', { name: /valider/i }));
    expect(mockUpsertPointage).toHaveBeenCalledTimes(2);
  });

  it('bouton Effacer remet toutes les heures à 0', () => {
    renderModal();
    const btns8h = screen.getAllByRole('button', { name: '8h' });
    fireEvent.click(btns8h[0]);
    expect(screen.getByText(/1 employé/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /effacer/i }));
    expect(screen.getByRole('button', { name: /valider/i })).toBeDisabled();
  });

  it('clic sur la superposition ferme la modale via onFermer', () => {
    const onFermer = vi.fn();
    const { container } = renderModal({ onFermer });
    // La div backdrop (position: fixed) est le premier enfant du container
    const backdrop = container.firstChild;
    fireEvent.click(backdrop);
    expect(onFermer).toHaveBeenCalledOnce();
  });
});
