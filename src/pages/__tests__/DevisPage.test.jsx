import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import DevisPage from '../DevisPage';
import { renderWithApp } from '../../test-utils/renderWithApp';

// ── Mocks ────────────────────────────────────────────────────────────────────

// AssistantDevisIA : IA non testée ici
vi.mock('../../AssistantDevisIA', () => ({ default: () => null }));

// exportDevis : side-effect PDF (jsPDF non dispo jsdom)
vi.mock('../../ExportPDF', () => ({ exportDevis: vi.fn() }));

// exportCSV : side-effect navigateur (URL.createObjectURL absent jsdom)
const mockExportCSV = vi.fn();
vi.mock('../../utils/exportCSV', () => ({
  exportCSV: (...args) => mockExportCSV(...args),
}));

// Supabase : requis par useSupabaseData (importé pour PARAMETRES_DEFAUT)
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) },
}));

import { PARAMETRES_DEFAUT } from '../../hooks/useSupabaseData';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CLIENT_1 = { id: 1, prenom: 'Alice', nom: 'Dupont', entreprise: 'Dupont SA' };
const CLIENT_2 = { id: 2, prenom: 'Bob', nom: 'Martin', entreprise: 'Martin SÀRL' };

// Types de travaux CYNA (subset réaliste — comme parametres.typesTravaux)
const TYPES_TRAVAUX = [
  { id: 1, nom: 'Cloisons vitrées',   unite: 'm²', tarifBase: 125 },
  { id: 2, nom: 'Faux plancher',      unite: 'm²', tarifBase: 80  },
  { id: 3, nom: 'Plafonds suspendus', unite: 'm²', tarifBase: 85  },
];

// Devis accepté — sans chantier lié (pour tester la conversion)
const DEVIS_ACCEPTE = {
  id: 'd1', numero: 'DEV-2026-001', clientId: 1,
  statut: 'accepté', montantHT: '10000',
  date: '2026-05-01', avenants: [], heuresRegie: [],
  typesTravaux: ['Cloisons vitrées'],
};

const DEVIS_BROUILLON = {
  id: 'd2', numero: 'DEV-2026-002', clientId: 2,
  statut: 'brouillon', montantHT: '5000',
  date: '2026-05-10', avenants: [], heuresRegie: [],
};

// Devis modifiable : typesTravaux pré-renseigné (normal après le fix)
const DEVIS_EDITABLE = {
  id: 'd3', numero: 'DEV-2026-003', clientId: 1,
  statut: 'brouillon', montantHT: '8000',
  date: '2026-05-15', avenants: [], heuresRegie: [],
  typesTravaux: ['Cloisons vitrées'],
};

// Fixtures cascade : devis lié à un chantier lié à une facture
const DEVIS_CASCADE = {
  id: 'dc', numero: 'DEV-2026-CAD', clientId: 1,
  statut: 'accepté', montantHT: '20000',
  date: '2026-04-01', avenants: [], heuresRegie: [],
};
const CHANTIER_LIE = {
  id: 'chc', devisId: 'dc', nom: 'Chantier Cascade',
  numero: 'CH-2026-001', clientId: 1, statut: 'en cours',
};
const FACTURE_LIEE = {
  id: 'fc', devisId: 'dc', chantierId: 'chc',
  statut: 'émise', montantHT: 20000, montantTTC: 21620,
};

// ── Helper ───────────────────────────────────────────────────────────────────

function renderDevis(ctxOverrides = {}) {
  const confirmer = vi.fn().mockResolvedValue(true);
  const setDevis = vi.fn();
  const setChantiers = vi.fn();
  const setFactures = vi.fn();
  const naviguer = vi.fn();
  const afficherNotif = vi.fn();

  const { ctx, ...rest } = renderWithApp(
    <DevisPage />,
    {
      clients: [CLIENT_1, CLIENT_2],
      devis: [],
      chantiers: [],
      factures: [],
      parametres: { employes: [], typesTravaux: TYPES_TRAVAUX },
      confirmer,
      setDevis,
      setChantiers,
      setFactures,
      naviguer,
      afficherNotif,
      ...ctxOverrides,
    },
  );
  return { ...rest, ctx: { ...ctx, confirmer, setDevis, setChantiers, setFactures, naviguer, afficherNotif } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. RENDU INITIAL
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — rendu initial', () => {
  it('rend sans crasher avec des données vides', () => {
    renderDevis();
    expect(screen.getByText('Devis')).toBeInTheDocument();
  });

  it('affiche le bouton Nouveau devis', () => {
    renderDevis();
    expect(screen.getByRole('button', { name: /Nouveau devis/i })).toBeInTheDocument();
  });

  it('affiche les devis passés en contexte', () => {
    renderDevis({ devis: [DEVIS_ACCEPTE, DEVIS_BROUILLON] });
    expect(screen.getByText('DEV-2026-001')).toBeInTheDocument();
    expect(screen.getByText('DEV-2026-002')).toBeInTheDocument();
  });

  it('affiche le CA HT de chaque devis', () => {
    renderDevis({ devis: [DEVIS_ACCEPTE] });
    // fmtN(10000) = "10'000"
    expect(screen.getByText(/10'000/)).toBeInTheDocument();
  });

  it('affiche le bouton Exporter CSV quand il y a des devis', () => {
    renderDevis({ devis: [DEVIS_ACCEPTE] });
    expect(screen.getByRole('button', { name: /Exporter CSV/i })).toBeInTheDocument();
  });

  it('n\'affiche pas Exporter CSV quand la liste est vide', () => {
    renderDevis();
    expect(screen.queryByRole('button', { name: /Exporter CSV/i })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. FORMULAIRE — OUVERTURE ET FERMETURE
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — formulaire ouverture/fermeture', () => {
  it('cliquer Nouveau devis ouvre le formulaire', () => {
    renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));
    expect(screen.getByRole('button', { name: /Sauvegarder/i })).toBeInTheDocument();
  });

  it('cliquer Annuler ferme le formulaire', () => {
    renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(screen.queryByRole('button', { name: /Sauvegarder/i })).not.toBeInTheDocument();
  });

  it('re-cliquer Nouveau devis referme le formulaire', () => {
    renderDevis();
    const btn = screen.getByRole('button', { name: /Nouveau devis/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByRole('button', { name: /Sauvegarder/i })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. VALIDATION DU FORMULAIRE
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — validation formulaire', () => {
  it('sauvegarder sans aucune donnée affiche une erreur de validation', () => {
    const { ctx } = renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));
    expect(ctx.setDevis).not.toHaveBeenCalled();
  });

  it('sauvegarder sans montant HT affiche une erreur de validation', () => {
    const { ctx } = renderDevis({ devis: [] });
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));

    // Remplir client uniquement, pas de montant
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));

    // Au moins une erreur visible et setDevis non appelé
    const erreurs = screen.getAllByText(/Sélectionner au moins un type de travaux|Le montant HT est obligatoire/i);
    expect(erreurs.length).toBeGreaterThan(0);
    expect(ctx.setDevis).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CRÉATION D'UN DEVIS — le fix rend la création possible
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — création d\'un devis (fix typesTravaux)', () => {
  it('le sélecteur de types de travaux est visible dans le formulaire', () => {
    renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));
    expect(screen.getByText(/Types de travaux/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cloisons vitrées/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Faux plancher/i })).toBeInTheDocument();
  });

  it('client + montantHT + typesTravaux → setDevis appelé (création réussit)', () => {
    const { ctx } = renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));

    // 1. Sélectionner un client
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });

    // 2. Saisir le montant HT
    fireEvent.change(
      screen.getByPlaceholderText("Ex : 45'000"),
      { target: { value: '15000' } },
    );

    // 3. Sélectionner un type de travaux via le pill
    fireEvent.click(screen.getByRole('button', { name: /Cloisons vitrées/i }));

    // 4. Sauvegarder
    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));

    // setDevis doit être appelé avec le nouveau devis
    expect(ctx.setDevis).toHaveBeenCalledOnce();
    const nouvelleListeDevis = ctx.setDevis.mock.calls[0][0];
    expect(nouvelleListeDevis).toHaveLength(1);
    expect(nouvelleListeDevis[0].typesTravaux).toContain('Cloisons vitrées');
    expect(nouvelleListeDevis[0].montantHT).toBe('15000');
  });

  it('client + montantHT SANS type → toujours bloqué (validation intentionnelle)', () => {
    const { ctx } = renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(
      screen.getByPlaceholderText("Ex : 45'000"),
      { target: { value: '15000' } },
    );
    // Pas de type sélectionné → Sauvegarder
    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));

    // Erreur visible (inline + résumé = 2 occurrences possibles, d'où getAllByText)
    expect(screen.getAllByText(/Sélectionner au moins un type de travaux/i).length).toBeGreaterThan(0);
    expect(ctx.setDevis).not.toHaveBeenCalled();
  });

  it('sélectionner puis désélectionner un type → validation bloque à nouveau', () => {
    const { ctx } = renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText("Ex : 45'000"), { target: { value: '10000' } });

    // Sélectionner puis désélectionner
    fireEvent.click(screen.getByRole('button', { name: /Cloisons vitrées/i }));
    fireEvent.click(screen.getByRole('button', { name: /✓ Cloisons vitrées/i }));

    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));
    expect(screen.getAllByText(/Sélectionner au moins un type de travaux/i).length).toBeGreaterThan(0);
    expect(ctx.setDevis).not.toHaveBeenCalled();
  });

  it('sélection multiple : deux types → les deux sauvegardés', () => {
    const { ctx } = renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText("Ex : 45'000"), { target: { value: '20000' } });

    fireEvent.click(screen.getByRole('button', { name: /Cloisons vitrées/i }));
    fireEvent.click(screen.getByRole('button', { name: /Faux plancher/i }));

    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));

    expect(ctx.setDevis).toHaveBeenCalledOnce();
    const liste = ctx.setDevis.mock.calls[0][0];
    expect(liste[0].typesTravaux).toContain('Cloisons vitrées');
    expect(liste[0].typesTravaux).toContain('Faux plancher');
  });

  it('compte neuf sans typesTravaux configurés → message "Aucun type configuré"', () => {
    renderDevis({ parametres: { employes: [], typesTravaux: [] } });
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));
    expect(screen.getByText(/Aucun type configuré/i)).toBeInTheDocument();
  });

  it('afficherNotif "Devis créé" après création réussie', () => {
    const { ctx } = renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText("Ex : 45'000"), { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: /Cloisons vitrées/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));

    expect(ctx.afficherNotif).toHaveBeenCalledWith('Devis créé');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. MODIFICATION D'UN DEVIS EXISTANT
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — modification d\'un devis existant', () => {
  it('types du devis existant pré-sélectionnés à l\'ouverture de l\'édition', () => {
    renderDevis({ devis: [DEVIS_EDITABLE] });

    fireEvent.click(screen.getByTitle('Modifier'));

    // "✓ Cloisons vitrées" doit être visible (actif = préfixé par ✓)
    expect(screen.getByRole('button', { name: /✓ Cloisons vitrées/i })).toBeInTheDocument();
    // "Faux plancher" non sélectionné (pas de ✓)
    expect(screen.queryByRole('button', { name: /✓ Faux plancher/i })).not.toBeInTheDocument();
  });

  it('cliquer l\'icône crayon ouvre le formulaire pré-rempli', () => {
    renderDevis({ devis: [DEVIS_EDITABLE] });

    fireEvent.click(screen.getByTitle('Modifier'));

    // Le formulaire affiche le montant existant
    const montantInput = screen.getByPlaceholderText("Ex : 45'000");
    // fmtN('8000') = "8'000"
    expect(montantInput.value).toBe("8'000");
  });

  it('modifier le statut puis sauvegarder → setDevis appelé avec le nouveau statut', () => {
    const { ctx } = renderDevis({ devis: [DEVIS_EDITABLE] });

    fireEvent.click(screen.getByTitle('Modifier'));

    // Changer le statut vers "envoyé"
    const statuts = screen.getAllByRole('combobox');
    // Statut est le 2e combobox dans le formulaire (Client, Statut)
    const statutSelect = statuts.find(s =>
      within(s).queryAllByRole('option').some(o => o.value === 'envoyé'),
    );
    expect(statutSelect).toBeTruthy();
    fireEvent.change(statutSelect, { target: { value: 'envoyé' } });

    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));

    expect(ctx.setDevis).toHaveBeenCalledOnce();
    const args = ctx.setDevis.mock.calls[0][0];
    // setDevis reçoit devis.map(d => d.id === form.id ? form : d)
    const mis = args.find(d => d.id === 'd3');
    expect(mis.statut).toBe('envoyé');
  });

  it('modifier le statut → afficherNotif "Devis mis à jour"', () => {
    const { ctx } = renderDevis({ devis: [DEVIS_EDITABLE] });

    fireEvent.click(screen.getByTitle('Modifier'));
    const statuts = screen.getAllByRole('combobox');
    const statutSelect = statuts.find(s =>
      within(s).queryAllByRole('option').some(o => o.value === 'envoyé'),
    );
    fireEvent.change(statutSelect, { target: { value: 'envoyé' } });
    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));

    expect(ctx.afficherNotif).toHaveBeenCalledWith('Devis mis à jour');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. CALCUL TTC (TVA 8.1%) — via export CSV
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — calcul TTC TVA 8.1%', () => {
  it('TTC = HT × 1.081 (Math.round) dans l\'export CSV', () => {
    renderDevis({ devis: [DEVIS_ACCEPTE], clients: [CLIENT_1] });

    fireEvent.click(screen.getByRole('button', { name: /Exporter CSV/i }));

    expect(mockExportCSV).toHaveBeenCalledOnce();
    const lignes = mockExportCSV.mock.calls[0][2];
    const row = lignes.find(l => l[0] === 'DEV-2026-001');
    expect(row).toBeTruthy();
    expect(row[5]).toBe(10000); // HT
    expect(row[6]).toBe(8.1);   // taux TVA
    expect(row[7]).toBe(10810); // TTC = Math.round(10000 * 1.081)
  });

  it('export CSV sans TVA explicite utilise 8.1% par défaut', () => {
    const devisSansTva = { ...DEVIS_ACCEPTE, tva: undefined };
    renderDevis({ devis: [devisSansTva], clients: [CLIENT_1] });

    fireEvent.click(screen.getByRole('button', { name: /Exporter CSV/i }));

    const lignes = mockExportCSV.mock.calls[0][2];
    const row = lignes[0];
    expect(row[6]).toBe(8.1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. AVENANTS — ajout et CA total
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — avenants dans le formulaire', () => {
  it('ajouter un avenant affiche la section total avenants', () => {
    renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));

    // Remplir le montant de base
    fireEvent.change(
      screen.getByPlaceholderText("Ex : 45'000"),
      { target: { value: '10000' } },
    );

    // Ajouter un avenant
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un avenant/i }));

    // Remplir le montant de l'avenant
    const montantAvenant = screen.getByPlaceholderText('Montant CHF HT');
    fireEvent.change(montantAvenant, { target: { value: '2000' } });

    // Le CA total doit être affiché : 10000 + 2000 = 12000
    // fmtN(12000) = "12'000"  — on cherche le texte contenant "CA total" pour éviter faux positif
    expect(screen.getByText(/CA total \(devis \+ avenants\)/i)).toBeInTheDocument();
    // Total avenants label visible
    expect(screen.getByText(/Total avenants/i)).toBeInTheDocument();
    // La valeur CA total = CHF 12'000 (getByText cherche le nœud exact contenant "12'000")
    expect(screen.getAllByText(/12'000/).length).toBeGreaterThan(0);
  });

  it('supprimer un avenant le retire de la liste', () => {
    renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un avenant/i }));

    // Vérifier que la ligne est présente
    expect(screen.getByPlaceholderText('Montant CHF HT')).toBeInTheDocument();

    // Cliquer le × pour supprimer
    fireEvent.click(screen.getByTitle('Supprimer cet avenant'));

    expect(screen.queryByPlaceholderText('Montant CHF HT')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. HEURES RÉGIE — ajout et CA total
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — heures régie dans le formulaire', () => {
  it('ajouter une ligne régie affiche le CA total régie', () => {
    renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));

    // Montant de base
    fireEvent.change(
      screen.getByPlaceholderText("Ex : 45'000"),
      { target: { value: '10000' } },
    );

    // Ajouter une ligne régie
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une ligne/i }));

    // Remplir heures et tarif
    fireEvent.change(screen.getByPlaceholderText('Heures'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('CHF/h'), { target: { value: '200' } });

    // Le label "Régie total :" doit être visible
    expect(screen.getByText(/Régie total/i)).toBeInTheDocument();
    // Le label "CA total (devis + régie) :" doit être visible
    expect(screen.getByText(/CA total \(devis \+ régie\)/i)).toBeInTheDocument();
    // Régie total = 5 × 200 = 1000 → fmtN(1000) = "1'000" — cherche dans le bon span parent
    const regieTotal = screen.getByText(/Régie total/i).closest('div');
    expect(regieTotal.textContent).toMatch(/1'000/);
    // CA total = 10000 + 1000 = 11000 → fmtN(11000) = "11'000"
    expect(screen.getAllByText(/11'000/).length).toBeGreaterThan(0);
  });

  it('supprimer une ligne régie la retire', () => {
    renderDevis();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une ligne/i }));
    expect(screen.getByPlaceholderText('Heures')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Supprimer cette ligne de régie'));
    expect(screen.queryByPlaceholderText('Heures')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. CONVERSION DEVIS → CHANTIER
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — conversion devis → chantier', () => {
  it('bouton "Créer le chantier" visible uniquement pour devis accepté sans chantier lié', () => {
    renderDevis({
      devis: [DEVIS_ACCEPTE, DEVIS_BROUILLON],
      chantiers: [],
    });
    // Un seul bouton "Créer le chantier" (pour DEVIS_ACCEPTE seulement)
    expect(screen.getAllByRole('button', { name: /Créer le chantier/i })).toHaveLength(1);
  });

  it('cliquer "Créer le chantier" ouvre la modale de confirmation', () => {
    renderDevis({ devis: [DEVIS_ACCEPTE] });
    fireEvent.click(screen.getByRole('button', { name: /Créer le chantier/i }));
    // La modale affiche le label "Nom du chantier" (label sans htmlFor, utiliser getByText)
    expect(screen.getByText('Nom du chantier')).toBeInTheDocument();
    // L'input autoFocus de la modale est présent (valeur pré-remplie avec le nom suggéré)
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.some(i => i.value.includes('Dupont SA'))).toBe(true);
  });

  it('confirmer la conversion crée un chantier avec devisId correct', async () => {
    const { ctx } = renderDevis({ devis: [DEVIS_ACCEPTE] });

    fireEvent.click(screen.getByRole('button', { name: /Créer le chantier/i }));

    // Bouton de confirmation dans la modale
    const btnModalConfirm = screen.getAllByRole('button', { name: /Créer le chantier/i }).at(-1);
    fireEvent.click(btnModalConfirm);

    await waitFor(() => expect(ctx.setChantiers).toHaveBeenCalledOnce());

    // setChantiers est appelé avec une fonction (functional update)
    const updater = ctx.setChantiers.mock.calls[0][0];
    expect(typeof updater).toBe('function');

    // Le chantier créé a le bon devisId
    const nouveauxChantiers = updater([]);
    expect(nouveauxChantiers).toHaveLength(1);
    expect(String(nouveauxChantiers[0].devisId)).toBe('d1');
    expect(nouveauxChantiers[0].statut).toBe('Planifié');
  });

  it('confirmer la conversion passe le devis en statut "accepté" via setDevis', async () => {
    const { ctx } = renderDevis({ devis: [DEVIS_ACCEPTE] });

    fireEvent.click(screen.getByRole('button', { name: /Créer le chantier/i }));
    const btnModalConfirm = screen.getAllByRole('button', { name: /Créer le chantier/i }).at(-1);
    fireEvent.click(btnModalConfirm);

    await waitFor(() => expect(ctx.setDevis).toHaveBeenCalledOnce());
    const updater = ctx.setDevis.mock.calls[0][0];
    const updated = updater([DEVIS_ACCEPTE]);
    expect(updated[0].statut).toBe('accepté');
  });

  it('confirmer la conversion navigue vers "chantiers"', async () => {
    const { ctx } = renderDevis({ devis: [DEVIS_ACCEPTE] });

    fireEvent.click(screen.getByRole('button', { name: /Créer le chantier/i }));
    const btnModalConfirm = screen.getAllByRole('button', { name: /Créer le chantier/i }).at(-1);
    fireEvent.click(btnModalConfirm);

    await waitFor(() => expect(ctx.naviguer).toHaveBeenCalledWith('chantiers', expect.any(Object)));
  });

  it('annuler la modale ne crée pas de chantier', () => {
    const { ctx } = renderDevis({ devis: [DEVIS_ACCEPTE] });

    fireEvent.click(screen.getByRole('button', { name: /Créer le chantier/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Annuler$/i }));

    expect(ctx.setChantiers).not.toHaveBeenCalled();
    // La modale est fermée
    expect(screen.queryByLabelText(/Nom du chantier/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. SUPPRESSION CASCADE — devis + chantier lié + facture liée
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — suppression en cascade', () => {
  it('supprimer un devis sans chantier lié supprime uniquement le devis', async () => {
    const { ctx } = renderDevis({ devis: [DEVIS_BROUILLON] });

    fireEvent.click(screen.getByTitle('Supprimer'));
    await waitFor(() => expect(ctx.setDevis).toHaveBeenCalledOnce());

    const nouveauxDevis = ctx.setDevis.mock.calls[0][0];
    expect(nouveauxDevis).toHaveLength(0);
    // Pas de chantier à supprimer
    expect(ctx.setChantiers).not.toHaveBeenCalled();
    // Pas de facture à supprimer
    expect(ctx.setFactures).not.toHaveBeenCalled();
  });

  it('supprimer un devis avec chantier et facture → les 3 setters appelés', async () => {
    const { ctx } = renderDevis({
      devis: [DEVIS_CASCADE],
      chantiers: [CHANTIER_LIE],
      factures: [FACTURE_LIEE],
    });

    fireEvent.click(screen.getByTitle('Supprimer'));
    await waitFor(() => expect(ctx.setDevis).toHaveBeenCalledOnce());

    // Devis retiré
    const nouveauxDevis = ctx.setDevis.mock.calls[0][0];
    expect(nouveauxDevis).toHaveLength(0);

    // Chantier lié retiré
    expect(ctx.setChantiers).toHaveBeenCalledOnce();
    const nouveauxChantiers = ctx.setChantiers.mock.calls[0][0];
    expect(nouveauxChantiers).toHaveLength(0);

    // Facture liée retirée
    expect(ctx.setFactures).toHaveBeenCalledOnce();
    const nouvellesFactures = ctx.setFactures.mock.calls[0][0];
    expect(nouvellesFactures).toHaveLength(0);
  });

  it('confirmer affiche le nombre de chantiers et factures impactés', async () => {
    const { ctx } = renderDevis({
      devis: [DEVIS_CASCADE],
      chantiers: [CHANTIER_LIE],
      factures: [FACTURE_LIEE],
    });

    fireEvent.click(screen.getByTitle('Supprimer'));

    await waitFor(() => expect(ctx.confirmer).toHaveBeenCalledOnce());
    const msgConfirm = ctx.confirmer.mock.calls[0][0];
    expect(msgConfirm).toMatch(/1 chantier/);
    expect(msgConfirm).toMatch(/1 facture/);
  });

  it('si confirmer renvoie false → rien n\'est supprimé', async () => {
    const confirmer = vi.fn().mockResolvedValue(false);
    const { ctx } = renderDevis({
      devis: [DEVIS_CASCADE],
      chantiers: [CHANTIER_LIE],
      factures: [FACTURE_LIEE],
      confirmer,
    });

    fireEvent.click(screen.getByTitle('Supprimer'));
    await waitFor(() => expect(confirmer).toHaveBeenCalledOnce());

    expect(ctx.setDevis).not.toHaveBeenCalled();
    expect(ctx.setChantiers).not.toHaveBeenCalled();
    expect(ctx.setFactures).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. EXPORT CSV
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — export CSV', () => {
  it('cliquer Exporter CSV appelle exportCSV', () => {
    renderDevis({ devis: [DEVIS_ACCEPTE] });
    fireEvent.click(screen.getByRole('button', { name: /Exporter CSV/i }));
    expect(mockExportCSV).toHaveBeenCalledOnce();
  });

  it('le fichier CSV contient un nom avec la date', () => {
    renderDevis({ devis: [DEVIS_ACCEPTE] });
    fireEvent.click(screen.getByRole('button', { name: /Exporter CSV/i }));
    const nomFichier = mockExportCSV.mock.calls[0][0];
    expect(nomFichier).toMatch(/^devis_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('chaque ligne CSV contient numéro, client, statut, HT, tva, TTC', () => {
    renderDevis({ devis: [DEVIS_ACCEPTE], clients: [CLIENT_1] });
    fireEvent.click(screen.getByRole('button', { name: /Exporter CSV/i }));
    const lignes = mockExportCSV.mock.calls[0][2];
    const row = lignes.find(l => l[0] === 'DEV-2026-001');
    expect(row[4]).toBe('accepté');         // statut
    expect(row[5]).toBe(10000);              // HT
    expect(row[7]).toBe(10810);              // TTC = round(10000 * 1.081)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. FILTRE PAR STATUT
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — filtre par statut', () => {
  it('filtre "accepté" affiche uniquement les devis acceptés', () => {
    renderDevis({ devis: [DEVIS_ACCEPTE, DEVIS_BROUILLON] });

    fireEvent.click(screen.getByRole('button', { name: 'accepté' }));

    expect(screen.getByText('DEV-2026-001')).toBeInTheDocument();
    expect(screen.queryByText('DEV-2026-002')).not.toBeInTheDocument();
  });

  it('filtre "brouillon" affiche uniquement les brouillons', () => {
    renderDevis({ devis: [DEVIS_ACCEPTE, DEVIS_BROUILLON] });

    fireEvent.click(screen.getByRole('button', { name: 'brouillon' }));

    expect(screen.queryByText('DEV-2026-001')).not.toBeInTheDocument();
    expect(screen.getByText('DEV-2026-002')).toBeInTheDocument();
  });

  it('filtre "Tous" réaffiche tous les devis', () => {
    renderDevis({ devis: [DEVIS_ACCEPTE, DEVIS_BROUILLON] });

    fireEvent.click(screen.getByRole('button', { name: 'accepté' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tous' }));

    expect(screen.getByText('DEV-2026-001')).toBeInTheDocument();
    expect(screen.getByText('DEV-2026-002')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. COMPTE NEUF — PARAMETRES_DEFAUT seeds des types → dévis créable out of the box
// ─────────────────────────────────────────────────────────────────────────────

describe('DevisPage — compte neuf (PARAMETRES_DEFAUT)', () => {
  it('PARAMETRES_DEFAUT.typesTravaux est non vide (seed présent)', () => {
    expect(Array.isArray(PARAMETRES_DEFAUT.typesTravaux)).toBe(true);
    expect(PARAMETRES_DEFAUT.typesTravaux.length).toBeGreaterThan(0);
  });

  it('PARAMETRES_DEFAUT contient les 8 types CYNA standard', () => {
    const noms = PARAMETRES_DEFAUT.typesTravaux.map(t => t.nom);
    expect(noms).toContain('Cloisons vitrées');
    expect(noms).toContain('Faux plancher');
    expect(noms).toContain('Plafonds suspendus');
    expect(noms).toContain('Autre');
  });

  it('compte neuf : sélecteur peuplé avec PARAMETRES_DEFAUT — options visibles', () => {
    renderDevis({ parametres: PARAMETRES_DEFAUT });
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));

    // Tous les types CYNA standard sont cliquables
    expect(screen.getByRole('button', { name: /Cloisons vitrées/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Faux plancher/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Plafonds suspendus/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Autre/i })).toBeInTheDocument();
  });

  it('compte neuf : création d\'un devis OUT OF THE BOX (sans configurer de types)', () => {
    const setDevis = vi.fn();
    renderDevis({ parametres: PARAMETRES_DEFAUT, setDevis });
    fireEvent.click(screen.getByRole('button', { name: /Nouveau devis/i }));

    // Sélectionner client
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });

    // Saisir montant HT
    fireEvent.change(
      screen.getByPlaceholderText("Ex : 45'000"),
      { target: { value: '30000' } },
    );

    // Sélectionner un type (disponible grâce au seed)
    fireEvent.click(screen.getByRole('button', { name: /Cloisons vitrées/i }));

    // Sauvegarder → réussit sans configuration préalable
    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder/i }));

    expect(setDevis).toHaveBeenCalledOnce();
    const liste = setDevis.mock.calls[0][0];
    expect(liste[0].typesTravaux).toContain('Cloisons vitrées');
    expect(liste[0].montantHT).toBe('30000');
  });
});
