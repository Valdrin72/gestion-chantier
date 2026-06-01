/**
 * Tests Étape 2+3 régie — capture des extras (champ employé + saisie fiche chantier)
 * Règle CLAUDE.md : tests RÉELS (RTL — vrais composants)
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import EmployesPage from '../../pages/EmployesPage';
import ChantierDetail from '../../components/chantiers/ChantierDetail';
import { renderWithApp } from '../../test-utils/renderWithApp';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../../AgentEngine', () => ({ default: class { analyser() { return []; } } }));
vi.mock('../../components/chantiers/detail/DetailVelocite',     () => ({ default: () => null }));
vi.mock('../../components/chantiers/detail/DetailProjection',   () => ({ default: () => null }));
vi.mock('../../components/chantiers/detail/DetailRecommandations', () => ({ default: () => null }));
vi.mock('../../components/chantiers/detail/DetailEcarts',       () => ({ default: () => null }));

// ── Fixtures ─────────────────────────────────────────────────────────────────
const DEVIS = [{ id: 'd1', numero: 'D-2026-001', montantHT: 50000, avenants: [], heuresRegie: [] }];
const CHANTIER = {
  id: 'c1', nom: 'Réno Dupont', devisId: 'd1', clientId: 'cl1',
  statut: 'En cours', avancement: 60, journal: [], extras: [],
};
const EMPLOYE = { id: 'e1', nom: 'Jean Martin', poste: 'Ouvrier qualifié', tarifJour: 350, tarifRegieHeure: 90, actif: true };

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderEmployes(overrides = {}) {
  const parametres = { employes: [], ...overrides.parametres };
  return renderWithApp(
    <EmployesPage
      parametres={parametres}
      setParametres={overrides.setParametres || vi.fn()}
      chantiers={[]}
      naviguer={vi.fn()}
    />,
    { profil: { id: 'cyna' }, afficherNotif: vi.fn(), ...overrides.ctx },
  );
}

function renderDetail(chantier = CHANTIER, overrides = {}) {
  const parametres = overrides.parametres || { employes: [EMPLOYE] };
  const setChantiers = overrides.setChantiers || vi.fn();
  return renderWithApp(
    <ChantierDetail
      chantier={chantier}
      detailOnglet="financier"
      setDetailOnglet={vi.fn()}
      modeCompleter={false}
      onRetour={vi.fn()}
      onModifier={vi.fn()}
      onSupprimer={vi.fn()}
      onPasserEnCours={vi.fn()}
    />,
    {
      devis: DEVIS,
      factures: [],
      clients: [{ id: 'cl1', nom: 'Dupont', prenom: 'Jean', entreprise: '' }],
      parametres,
      setChantiers,
      agentState: {},
      ...overrides.ctx,
    },
  );
}

// ── BLOC 1 — EmployesPage : champ tarifRegieHeure ────────────────────────────
describe('EmployesPage — champ tarifRegieHeure (RTL)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('le champ "Tarif régie /h" s\'affiche dans le formulaire employé', () => {
    renderEmployes();
    fireEvent.click(screen.getByRole('button', { name: /Nouvel employé/i }));
    expect(screen.getByPlaceholderText('85')).toBeInTheDocument();
  });

  it('saisir 95 CHF/h → valeur stockée dans tarifRegieHeure via setParametres', () => {
    const setParametres = vi.fn();
    renderEmployes({ setParametres });
    fireEvent.click(screen.getByRole('button', { name: /Nouvel employé/i }));

    // Remplir les champs obligatoires
    fireEvent.change(screen.getByPlaceholderText('Jean Martin'), { target: { value: 'Paul Müller' } });
    fireEvent.change(screen.getByPlaceholderText('350'), { target: { value: '350' } });
    fireEvent.change(screen.getByPlaceholderText('85'), { target: { value: '95' } });
    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));

    expect(setParametres).toHaveBeenCalledOnce();
    const appelé = setParametres.mock.calls[0][0];
    const empSauvé = appelé.employes[0];
    expect(empSauvé.tarifRegieHeure).toBe(95);
  });

  it('tarifRegieHeure absent si champ vide → undefined, pas 0', () => {
    const setParametres = vi.fn();
    renderEmployes({ setParametres });
    fireEvent.click(screen.getByRole('button', { name: /Nouvel employé/i }));

    fireEvent.change(screen.getByPlaceholderText('Jean Martin'), { target: { value: 'Marc Renaud' } });
    fireEvent.change(screen.getByPlaceholderText('350'), { target: { value: '400' } });
    // On ne saisit PAS tarifRegieHeure
    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));

    const empSauvé = setParametres.mock.calls[0][0].employes[0];
    expect(empSauvé.tarifRegieHeure).toBeUndefined();
  });
});

// ── BLOC 2 — ChantierDetail : saisie extras ──────────────────────────────────
describe('ChantierDetail — extras (RTL)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('section "Extras" visible avec bouton "+ Ajouter un extra"', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: /\+ Ajouter un extra/i })).toBeInTheDocument();
    expect(screen.getByText(/Aucun extra/i)).toBeInTheDocument();
  });

  it('clic "+ Ajouter un extra" → appelle setChantiers avec un extra dans chantier.extras', () => {
    const setChantiers = vi.fn();
    renderDetail(CHANTIER, { setChantiers });

    fireEvent.click(screen.getByRole('button', { name: /\+ Ajouter un extra/i }));

    expect(setChantiers).toHaveBeenCalledOnce();
    const updateFn = setChantiers.mock.calls[0][0];
    const résultat = updateFn([CHANTIER]);
    expect(résultat[0].extras).toHaveLength(1);
    expect(résultat[0].extras[0].mode).toBe('forfait');
    expect(résultat[0].extras[0].factureId).toBeNull();
  });

  it('extra mode forfait : montant 2500 CHF visible dans le formulaire', () => {
    const chantierAvecExtra = {
      ...CHANTIER,
      extras: [{ id: 'e1', description: 'Dépose carrelage', mode: 'forfait', montantForfait: '2500', heures: '', tarifHeure: '', employeId: '', factureId: null, dateCreation: '2026-05-29' }],
    };
    renderDetail(chantierAvecExtra);
    expect(screen.getByDisplayValue('Dépose carrelage')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2500')).toBeInTheDocument();
  });

  it('extra mode heures : select employé pré-remplit tarifHeure depuis emp.tarifRegieHeure', () => {
    const chantierAvecExtra = {
      ...CHANTIER,
      extras: [{ id: 'e1', description: 'Peinture extra', mode: 'heures', montantForfait: '', heures: '', tarifHeure: '', employeId: '', factureId: null, dateCreation: '2026-05-29' }],
    };
    const setChantiers = vi.fn();
    renderDetail(chantierAvecExtra, { setChantiers });

    // Sélectionner Jean Martin (tarifRegieHeure=90)
    fireEvent.change(screen.getByDisplayValue('— Employé (optionnel)'), { target: { value: String(EMPLOYE.id) } });

    expect(setChantiers).toHaveBeenCalledOnce();
    const updateFn = setChantiers.mock.calls[0][0];
    const résultat = updateFn([chantierAvecExtra]);
    expect(résultat[0].extras[0].tarifHeure).toBe('90');
    expect(résultat[0].extras[0].employeId).toBe(String(EMPLOYE.id));
  });

  it('extra mode heures : tarif modifié manuellement écrase le pré-rempli', () => {
    const chantierAvecExtra = {
      ...CHANTIER,
      extras: [{ id: 'e1', description: 'Extra', mode: 'heures', montantForfait: '', heures: '3', tarifHeure: '90', employeId: String(EMPLOYE.id), factureId: null, dateCreation: '2026-05-29' }],
    };
    const setChantiers = vi.fn();
    renderDetail(chantierAvecExtra, { setChantiers });

    // Modifier le tarif/h manuellement
    const tarifInputs = screen.getAllByDisplayValue('90');
    fireEvent.change(tarifInputs[0], { target: { value: '110' } });

    const updateFn = setChantiers.mock.calls[0][0];
    const résultat = updateFn([chantierAvecExtra]);
    expect(résultat[0].extras[0].tarifHeure).toBe('110');
  });

  it('extra mode heures 3h×90 → montant 270 affiché en direct', () => {
    const chantierAvecExtra = {
      ...CHANTIER,
      extras: [{ id: 'e1', description: 'Extra heures', mode: 'heures', montantForfait: '', heures: '3', tarifHeure: '90', employeId: '', factureId: null, dateCreation: '2026-05-29' }],
    };
    renderDetail(chantierAvecExtra);
    // montantHeures = 3 × 90 = 270 → affiché "= CHF 270"
    expect(screen.getByText(/= CHF 270/)).toBeInTheDocument();
  });

  it('suppression extra non facturé → confirmer puis setChantiers avec extras vide', async () => {
    const chantierAvecExtra = {
      ...CHANTIER,
      extras: [{ id: 'e1', description: 'À supprimer', mode: 'forfait', montantForfait: '500', heures: '', tarifHeure: '', employeId: '', factureId: null, dateCreation: '2026-05-29' }],
    };
    const setChantiers = vi.fn();
    const confirmer = vi.fn().mockResolvedValue(true);
    renderDetail(chantierAvecExtra, { setChantiers, ctx: { confirmer, afficherNotif: vi.fn() } });

    fireEvent.click(screen.getByRole('button', { name: '✕' }));

    await waitFor(() => expect(confirmer).toHaveBeenCalledOnce());
    await waitFor(() => expect(setChantiers).toHaveBeenCalledOnce());
    const updateFn = setChantiers.mock.calls[0][0];
    const résultat = updateFn([chantierAvecExtra]);
    expect(résultat[0].extras).toHaveLength(0);
  });

  it('KPI "CA signé" passe de caForfait à caForfait+extra après ajout d\'un extra forfait', () => {
    // Sans extra : CA affiché = caForfait = 50 000
    const { unmount } = renderDetail(CHANTIER);
    // "50" k ou "50'000" ou "50 000" doit être présent dans le KPI CA
    expect(screen.getAllByText(/50k|50'000|50 000|50\.0k/i).length).toBeGreaterThan(0);
    unmount();

    // Avec extra forfait 8000 : caTotal = 58 000, caForfait = 50 000
    // Le KPI CA affiche caForfait (50k) avec sous-label "forfait + extras CHF 8k"
    const chantierAvecExtra = {
      ...CHANTIER,
      extras: [{ id: 'e1', description: 'Extra', mode: 'forfait', montantForfait: '8000', heures: '', tarifHeure: '', employeId: '', factureId: null, dateCreation: '2026-05-29' }],
    };
    renderDetail(chantierAvecExtra);
    expect(screen.getByText(/forfait \+ extras/i)).toBeInTheDocument();
    expect(screen.getByText(/8k|8'000|8 000/i)).toBeInTheDocument();
  });
});
