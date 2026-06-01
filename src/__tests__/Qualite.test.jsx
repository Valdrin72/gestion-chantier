import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Qualite from '../Qualite';
import { renderWithApp } from '../test-utils/renderWithApp';

// matchMedia polyfill (useIsMobile)
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
});

const CHANTIER_VIERGE = {
  id: 'CH-1', nom: 'Salle blanche', statut: 'planifié',
};
const CHANTIER_AVEC_FACTURE = {
  id: 'CH-2', nom: 'Entrepôt Carouge', statut: 'en cours',
};
const CHANTIER_AVEC_POINTAGE = {
  id: 'CH-3', nom: 'Bureau Pictet', statut: 'en cours',
};

function renderQualite(propsOver = {}, ctxOver = {}) {
  const confirmer = ctxOver.confirmer ?? vi.fn().mockResolvedValue(true);
  const afficherNotif = ctxOver.afficherNotif ?? vi.fn();

  const defaultProps = {
    chantiers: [CHANTIER_VIERGE],
    setChantiers: vi.fn(),
    qualiteData: {},
    setQualiteData: vi.fn(),
    factures: [],
    pointages: [],
  };

  const result = renderWithApp(
    <Qualite {...defaultProps} {...propsOver} />,
    { confirmer, afficherNotif, ...ctxOver }
  );
  return { ...result, confirmer, afficherNotif, setChantiers: (propsOver.setChantiers ?? defaultProps.setChantiers) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Affichage de la liste
// ─────────────────────────────────────────────────────────────────────────────

describe('Qualite — affichage', () => {
  it('affiche le nom des chantiers dans la liste', () => {
    renderQualite({ chantiers: [CHANTIER_VIERGE, CHANTIER_AVEC_FACTURE] });
    expect(screen.getByText('Salle blanche')).toBeDefined();
    expect(screen.getByText('Entrepôt Carouge')).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Suppression protégée — principe "Rien ne se détruit"
// ─────────────────────────────────────────────────────────────────────────────

describe('Qualite — suppression protégée', () => {
  it('supprimer un chantier vierge → confirmer appelé, setChantiers appelé', async () => {
    const setChantiers = vi.fn();
    const { confirmer } = renderQualite({
      chantiers: [CHANTIER_VIERGE],
      setChantiers,
      factures: [],
      pointages: [],
    });

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));
    await waitFor(() => expect(confirmer).toHaveBeenCalledOnce());
    await waitFor(() => expect(setChantiers).toHaveBeenCalledOnce());
  });

  it('supprimer un chantier avec facture → BLOQUÉ, afficherNotif appelée', async () => {
    const setChantiers = vi.fn();
    const afficherNotif = vi.fn();
    renderQualite(
      {
        chantiers: [CHANTIER_AVEC_FACTURE],
        setChantiers,
        factures: [{ id: 'F-1', chantierId: 'CH-2' }],
        pointages: [],
      },
      { afficherNotif },
    );

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    await waitFor(() => expect(afficherNotif).toHaveBeenCalledOnce());
    const [msg, type] = afficherNotif.mock.calls[0];
    expect(msg).toMatch(/ne peut pas être supprimé/);
    expect(type).toBe('error');
    expect(setChantiers).not.toHaveBeenCalled();
  });

  it('supprimer un chantier avec pointage → BLOQUÉ', async () => {
    const setChantiers = vi.fn();
    const afficherNotif = vi.fn();
    renderQualite(
      {
        chantiers: [CHANTIER_AVEC_POINTAGE],
        setChantiers,
        factures: [],
        pointages: [{ id: 'P-1', repartitions: [{ chantierId: 'CH-3', heures: 8 }] }],
      },
      { afficherNotif },
    );

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    await waitFor(() => expect(afficherNotif).toHaveBeenCalledOnce());
    expect(setChantiers).not.toHaveBeenCalled();
  });

  it('si confirmer renvoie false → setChantiers non appelé', async () => {
    const setChantiers = vi.fn();
    const confirmer = vi.fn().mockResolvedValue(false);
    renderQualite(
      { chantiers: [CHANTIER_VIERGE], setChantiers },
      { confirmer },
    );

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));
    await waitFor(() => expect(confirmer).toHaveBeenCalledOnce());
    expect(setChantiers).not.toHaveBeenCalled();
  });

  it('n\'utilise plus window.confirm — utilise confirmer() du contexte', async () => {
    const windowConfirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { confirmer } = renderQualite({ chantiers: [CHANTIER_VIERGE] });

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));
    await waitFor(() => expect(confirmer).toHaveBeenCalledOnce());
    expect(windowConfirmSpy).not.toHaveBeenCalled();
    windowConfirmSpy.mockRestore();
  });
});
