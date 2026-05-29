/**
 * Tests RÉELS Items 1 & 2 — acompte % + situation 1 clic
 *
 * Règle : ces tests exercent le VRAI code des composants via RTL.
 * Pas de helpers qui re-implémentent la logique dans le fichier de test.
 * Valdrin ne devrait jamais avoir à vérifier manuellement ces interactions.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import Factures from '../../Factures';
import Finances from '../../pages/FinancesPage';
import { renderWithApp } from '../../test-utils/renderWithApp';

// ── Mocks — dépendances non testées ici ─────────────────────────────────────
vi.mock('../../ExportPDF', () => ({
  exportFacture: vi.fn(),
  exportFicheChantier: vi.fn(),
}));
vi.mock('../../utils/exportCSV', () => ({ exportCSV: vi.fn() }));
vi.mock('../../relances', () => ({
  prochainRappel: vi.fn(() => null),
  niveauInfo: vi.fn(() => ({ couleur: '#f59e0b', label: 'Rappel 1' })),
  genererTexteRappel: vi.fn(() => ({ texte: '', objet: '' })),
  marquerRappelEnvoye: vi.fn(f => f),
}));
// FinancesPage utilise ces composants — on les neutralise pour isoler les items testés
vi.mock('../../Paiements', () => ({ default: () => null }));
vi.mock('../../RelancesTab', () => ({ default: () => null }));

// ── Fixtures communes ────────────────────────────────────────────────────────
const DEVIS    = [{ id: 'd1', numero: 'D-2026-001', montantHT: 50000, avenants: [], heuresRegie: [] }];
const CHANTIERS = [{ id: 'c1', nom: 'Réno Dupont', devisId: 'd1', clientId: 'cl1', statut: 'En cours', avancement: 60, journal: [] }];
const CLIENTS  = [{ id: 'cl1', nom: 'Dupont', prenom: 'Jean', entreprise: '' }];

// ── Helpers de rendu ─────────────────────────────────────────────────────────
function renderFactures(facturesData = []) {
  return renderWithApp(
    <Factures
      clients={CLIENTS}
      chantiers={CHANTIERS}
      devis={DEVIS}
      factures={facturesData}
      onSave={vi.fn()}
      profil={{ id: 'cyna' }}
    />,
  );
}

function renderFinances(facturesData = []) {
  return renderWithApp(
    <Finances
      clients={CLIENTS}
      chantiers={CHANTIERS}
      devis={DEVIS}
      factures={facturesData}
      onSave={vi.fn()}
      paiementsData={{}}
      setPaiementsData={vi.fn()}
      profil={{ id: 'cyna' }}
      parametres={{ employes: [] }}
      periodeGlobale="annee"
    />,
  );
}

// ── ITEM 1 — Acompte en % ────────────────────────────────────────────────────
describe('Item 1 — acompte % (RTL — vrai composant Factures)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('le helper acompte est masqué quand aucun chantier/devis sélectionné', () => {
    renderFactures();
    fireEvent.click(screen.getByRole('button', { name: /\+ Nouvelle facture/i }));

    // Changer type → acompte
    fireEvent.change(screen.getByDisplayValue('Standard'), { target: { value: 'acompte' } });

    // Pas de chantier sélectionné → helper invisible
    expect(screen.queryByPlaceholderText('30')).toBeNull();
  });

  it('le helper apparaît avec le CA affiché quand chantier sélectionné', () => {
    renderFactures();
    fireEvent.click(screen.getByRole('button', { name: /\+ Nouvelle facture/i }));

    fireEvent.change(screen.getByDisplayValue('Standard'), { target: { value: 'acompte' } });

    // Sélectionner chantier c1 (devisId d1 → CA 50 000)
    const aukunSelects = screen.getAllByDisplayValue('— Aucun —');
    fireEvent.change(aukunSelects[0], { target: { value: 'c1' } });

    // Le helper doit apparaître avec l'input %
    expect(screen.getByPlaceholderText('30')).toBeInTheDocument();
    // CA de référence affiché dans le texte helper
    expect(screen.getByText(/50'000/)).toBeInTheDocument();
  });

  it('le bouton Appliquer est désactivé tant que le % est vide', () => {
    renderFactures();
    fireEvent.click(screen.getByRole('button', { name: /\+ Nouvelle facture/i }));
    fireEvent.change(screen.getByDisplayValue('Standard'), { target: { value: 'acompte' } });
    const aukunSelects = screen.getAllByDisplayValue('— Aucun —');
    fireEvent.change(aukunSelects[0], { target: { value: 'c1' } });

    const appliquerBtn = screen.getByRole('button', { name: /Appliquer/i });
    expect(appliquerBtn).toBeDisabled();
  });

  it('saisir 30% + Appliquer → ligne "Acompte 30% — Réno Dupont", prix 15\'000, TVA 8.1%', () => {
    renderFactures();
    fireEvent.click(screen.getByRole('button', { name: /\+ Nouvelle facture/i }));
    fireEvent.change(screen.getByDisplayValue('Standard'), { target: { value: 'acompte' } });

    const aukunSelects = screen.getAllByDisplayValue('— Aucun —');
    fireEvent.change(aukunSelects[0], { target: { value: 'c1' } });

    // Saisir 30%
    const pctInput = screen.getByPlaceholderText('30');
    fireEvent.change(pctInput, { target: { value: '30' } });

    // Clic Appliquer
    fireEvent.click(screen.getByRole('button', { name: /Appliquer/i }));

    // La ligne de facturation est mise à jour avec le VRAI calculerCA(chantier, devis)
    const descInputs = screen.getAllByPlaceholderText('Description du poste');
    expect(descInputs[0]).toHaveValue('Acompte 30% — Réno Dupont');

    // Prix unitaire = 30% × 50 000 = 15 000 (format fmtN → "15'000")
    expect(screen.getByDisplayValue("15'000")).toBeInTheDocument();

    // TVA par défaut 8.1%
    expect(screen.getAllByDisplayValue('8.1% — Standard').length).toBeGreaterThan(0);
  });

  it('saisir 50% → prix = 25\'000', () => {
    renderFactures();
    fireEvent.click(screen.getByRole('button', { name: /\+ Nouvelle facture/i }));
    fireEvent.change(screen.getByDisplayValue('Standard'), { target: { value: 'acompte' } });
    fireEvent.change(screen.getAllByDisplayValue('— Aucun —')[0], { target: { value: 'c1' } });

    fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /Appliquer/i }));

    expect(screen.getByDisplayValue("25'000")).toBeInTheDocument();
  });

  it('saisir 101% → bouton Appliquer reste désactivé', () => {
    renderFactures();
    fireEvent.click(screen.getByRole('button', { name: /\+ Nouvelle facture/i }));
    fireEvent.change(screen.getByDisplayValue('Standard'), { target: { value: 'acompte' } });
    fireEvent.change(screen.getAllByDisplayValue('— Aucun —')[0], { target: { value: 'c1' } });

    fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '101' } });

    expect(screen.getByRole('button', { name: /Appliquer/i })).toBeDisabled();
  });

  it('acompte avec avenants : CA inclut les avenants du devis', () => {
    const devisAvecAvenants = [{
      id: 'd2', numero: 'D-2026-002', montantHT: 40000,
      avenants: [{ montant: 5000 }, { montant: 3000 }],
      heuresRegie: [],
    }];
    const chantierAvecDevis2 = [{ id: 'c2', nom: 'Chantier Avenants', devisId: 'd2', clientId: 'cl1', statut: 'En cours', avancement: 0, journal: [] }];

    renderWithApp(
      <Factures
        clients={CLIENTS}
        chantiers={chantierAvecDevis2}
        devis={devisAvecAvenants}
        factures={[]}
        onSave={vi.fn()}
        profil={{ id: 'cyna' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ Nouvelle facture/i }));
    fireEvent.change(screen.getByDisplayValue('Standard'), { target: { value: 'acompte' } });
    fireEvent.change(screen.getAllByDisplayValue('— Aucun —')[0], { target: { value: 'c2' } });

    // CA = 40 000 + 5 000 + 3 000 = 48 000 affiché dans le helper
    expect(screen.getByText(/48'000/)).toBeInTheDocument();

    // 25% de 48 000 = 12 000
    fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Appliquer/i }));

    expect(screen.getByDisplayValue("12'000")).toBeInTheDocument();
  });
});

// ── ITEM 2 — Situation en 1 clic ─────────────────────────────────────────────
describe('Item 2 — situation 1 clic (RTL — vrai composant FinancesPage)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('le widget "Chantiers à facturer" affiche Réno Dupont avec le bouton "Créer la situation"', () => {
    renderFinances();
    // potentiel = 50 000 × 60% − 0 = 30 000 > 500 → chantier visible
    expect(screen.getByText('Réno Dupont')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer la situation/i })).toBeInTheDocument();
  });

  it('clic "Créer la situation" → onglet Factures + formulaire pré-rempli type situation', async () => {
    renderFinances();

    fireEvent.click(screen.getByRole('button', { name: /Créer la situation/i }));

    // Le formulaire Factures s'ouvre (useEffect dans Factures réagit au preRemplir)
    // findBy* attend de manière asynchrone que le form soit rendu
    const objetInput = await screen.findByDisplayValue('Situation n°1 — Réno Dupont');
    expect(objetInput).toBeInTheDocument();

    // Type = situation
    expect(screen.getByDisplayValue('Situation')).toBeInTheDocument();

    // Description de la ligne = avancement 60%
    const descInput = await screen.findByDisplayValue(/Situation n°1 — avancement 60%/);
    expect(descInput).toBeInTheDocument();
  });

  it('le potentiel pré-remplit le prix de la ligne (30 000 HT)', async () => {
    renderFinances();
    fireEvent.click(screen.getByRole('button', { name: /Créer la situation/i }));

    // Prix unitaire = potentiel = 30 000 → fmtN(30000) → "30'000"
    await screen.findByDisplayValue("30'000");
    expect(screen.getByDisplayValue("30'000")).toBeInTheDocument();
  });

  it('deuxième situation → numérotée n°2 (une situation payée existante)', async () => {
    const facturesExistantes = [{
      id: 'f1', chantierId: 'c1', clientId: 'cl1', devisId: 'd1',
      type: 'situation', statut: 'payee',
      montantHT: 10000, montantTVA: 810, montantTTC: 10810, montantPaye: 10810,
      dateEmission: '2026-01-01', dateEcheance: '2026-01-31', lignes: [],
    }];

    renderFinances(facturesExistantes);
    fireEvent.click(screen.getByRole('button', { name: /Créer la situation/i }));

    const objetInput = await screen.findByDisplayValue('Situation n°2 — Réno Dupont');
    expect(objetInput).toBeInTheDocument();
  });

  it('une situation annulée ne compte pas → reste n°1', async () => {
    const facturesAnnulees = [{
      id: 'f1', chantierId: 'c1', clientId: 'cl1', devisId: 'd1',
      type: 'situation', statut: 'annulee',
      montantHT: 10000, montantTVA: 810, montantTTC: 10810, montantPaye: 0,
      dateEmission: '2026-01-01', dateEcheance: '2026-01-31', lignes: [],
    }];

    renderFinances(facturesAnnulees);
    fireEvent.click(screen.getByRole('button', { name: /Créer la situation/i }));

    const objetInput = await screen.findByDisplayValue('Situation n°1 — Réno Dupont');
    expect(objetInput).toBeInTheDocument();
  });

  it('chantier sans devisId absent du widget (pas de CA)', () => {
    const chantierSansDevis = [{ id: 'c9', nom: 'Sans Devis', devisId: '', clientId: 'cl1', statut: 'En cours', avancement: 80, journal: [] }];

    renderWithApp(
      <Finances
        clients={CLIENTS}
        chantiers={chantierSansDevis}
        devis={DEVIS}
        factures={[]}
        onSave={vi.fn()}
        paiementsData={{}}
        setPaiementsData={vi.fn()}
        profil={{ id: 'cyna' }}
        parametres={{ employes: [] }}
        periodeGlobale="annee"
      />,
    );

    // calculerCA retourne null sans devisId → filtré par potentiel <= 0
    expect(screen.queryByRole('button', { name: /Créer la situation/i })).toBeNull();
  });
});
