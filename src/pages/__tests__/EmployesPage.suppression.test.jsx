/**
 * Phase 1b — non-destruction : un employé ne se supprime jamais (hard delete).
 * Le retrait passe par un toggle actif:false ; l'historique des pointages est conservé.
 * Tests RÉELS : rendu du vrai composant EmployesPage (vue cartes).
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import EmployesPage from '../EmployesPage';
import { renderWithApp } from '../../test-utils/renderWithApp';

vi.mock('../../AgentEngine', () => ({ default: class { analyser() { return []; } } }));

const EMPLOYE_ACTIF = { id: 'e1', nom: 'Jean Martin', poste: 'Ouvrier qualifié', tarifJour: 350, actif: true };
const EMPLOYE_INACTIF = { id: 'e2', nom: 'Marc Dubois', poste: 'Manœuvre', tarifJour: 280, actif: false };

function renderEmployes(employes = [EMPLOYE_ACTIF], over = {}) {
  const setParametres = over.setParametres || vi.fn();
  const result = renderWithApp(
    <EmployesPage
      parametres={{ employes }}
      setParametres={setParametres}
      chantiers={over.chantiers || []}
      naviguer={vi.fn()}
    />,
    { profil: { id: 'cyna' }, afficherNotif: vi.fn(), ...over.ctx },
  );
  return { ...result, setParametres };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('EmployesPage — non-destruction (vue cartes)', () => {
  it('aucun bouton de suppression dure (pas de Trash hard delete)', () => {
    renderEmployes([EMPLOYE_ACTIF]);
    // Plus de "Suppr" ni de bouton de suppression — uniquement Désactiver
    expect(screen.queryByRole('button', { name: /^Suppr$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Désactiver/i })).toBeDefined();
  });

  it('désactiver un employé actif → actif:false, jamais retiré', () => {
    const setParametres = vi.fn();
    renderEmployes([EMPLOYE_ACTIF], { setParametres });

    fireEvent.click(screen.getByRole('button', { name: /Désactiver/i }));

    const arg = setParametres.mock.calls.at(-1)[0];
    const emp = arg.employes.find(e => e.id === 'e1');
    expect(emp).toBeDefined();           // l'employé EXISTE toujours
    expect(emp.actif).toBe(false);       // il est juste désactivé
  });

  it('réactiver un employé inactif → actif:true', () => {
    const setParametres = vi.fn();
    renderEmployes([EMPLOYE_INACTIF], { setParametres });

    fireEvent.click(screen.getByRole('button', { name: /Réactiver/i }));

    const arg = setParametres.mock.calls.at(-1)[0];
    expect(arg.employes.find(e => e.id === 'e2').actif).toBe(true);
  });

  it('un employé avec heures dans le journal reste présent après désactivation', () => {
    const setParametres = vi.fn();
    const chantierAvecHeures = {
      id: 'c1', nom: 'Chantier X', journal: [
        { date: '2026-05-01', employes: [{ employeId: 'e1', heuresTravaillees: 8 }] },
      ],
    };
    renderEmployes([EMPLOYE_ACTIF], { setParametres, chantiers: [chantierAvecHeures] });

    fireEvent.click(screen.getByRole('button', { name: /Désactiver/i }));

    const arg = setParametres.mock.calls.at(-1)[0];
    // Toujours là — l'historique des heures n'est jamais orphelin
    expect(arg.employes.some(e => e.id === 'e1')).toBe(true);
    expect(arg.employes.find(e => e.id === 'e1').actif).toBe(false);
  });
});
