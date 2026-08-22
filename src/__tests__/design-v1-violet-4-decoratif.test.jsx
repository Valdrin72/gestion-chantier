/**
 * Design v1 — dé-violetisation résiduelle, LOT 4/5 : décoratif divers.
 * ⚠ ZÉRO logique métier touchée : attribution des avatars (hash→couleur), affichage
 *   des heures, onboarding, onglets Documents, données du camembert — inchangés. Diff = couleurs.
 *
 * Preuve RTL RÉELLE (vrais composants) :
 *   1. EmployeeAvatar : les 2 index ex-violets (4, 8) rendent désormais en CYNA
 *      (#4C8FD1 bleu moyen / #0E2A4F bleu nuit), plus aucun avatar violet ;
 *   2. Documents : l'onglet actif est en V1.bleu (plus en indigo) ;
 *   3. Heures : le composant se rend (non-régression du surlignage week-end → V1.bleuFond).
 * (App onboarding étape 2 et Dashboard slice « Matériaux » : swap de littéral prouvé par grep
 *  exact + non-régression — sites data-gated/contexte lourd, non assertables proprement en RTL.)
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import EmployeeAvatar from '../components/ui/EmployeeAvatar';
import Heures from '../Heures';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })), auth: { getSession: vi.fn() } },
}));

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const BLEU_MOYEN = 'rgb(76, 143, 209)';  // #4C8FD1 (index 4)
const MARINE     = 'rgb(14, 42, 79)';    // #0E2A4F (index 8)
const VIOLET_1   = 'rgb(139, 92, 246)';  // #8b5cf6
const VIOLET_2   = 'rgb(99, 102, 241)';  // #6366f1

describe('EMPLOYEEAVATAR — palette de hash dé-violetée', () => {
  it('les avatars des index ex-violets (4, 8) sont désormais en CYNA, aucun violet', () => {
    // « Xena Vidal » → index 4 (ex #8b5cf6 → #4C8FD1) ; « Eva Blanc » → index 8 (ex #6366f1 → #0E2A4F).
    const { container: c4 } = renderWithApp(<EmployeeAvatar name="Xena Vidal" />, {});
    const av4 = c4.querySelector('div[style]');
    expect(av4.style.background).toBe(BLEU_MOYEN);
    expect(av4.style.background).not.toBe(VIOLET_1);

    const { container: c8 } = renderWithApp(<EmployeeAvatar name="Eva Blanc" />, {});
    const av8 = c8.querySelector('div[style]');
    expect(av8.style.background).toBe(MARINE);
    expect(av8.style.background).not.toBe(VIOLET_2);
  });
});

// NOTE (ménage code mort) : le bloc DOCUMENTS a été retiré avec la suppression de
// src/Documents.js (onglet orphelin, 0 route / 0 conso prod). Les couvertures
// EmployeeAvatar et Heures (ci-dessus/ci-dessous) sont conservées.

describe('HEURES — se rend (surlignage week-end → V1.bleuFond)', () => {
  it('le composant Heures se rend sans régression', () => {
    const EMPLOYE = { id: 1, nom: 'Müller', poste: 'Chef', tarifJour: 400, actif: true };
    renderWithApp(
      <Heures chantiers={[{ id: 'CH1', nom: 'Test', statut: 'en cours' }]}
        parametres={{ employes: [EMPLOYE] }} setChantiers={vi.fn()} />,
      { pointages: [], setPointages: vi.fn(), periodeGlobale: 'semaine' },
    );
    // Le nom de l'employé apparaît dans la grille des heures → composant monté.
    expect(screen.getAllByText('Müller').length).toBeGreaterThanOrEqual(1);
  });
});
