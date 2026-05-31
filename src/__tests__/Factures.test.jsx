import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import Factures from '../Factures';
import { renderWithApp } from '../test-utils/renderWithApp';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../utils/exportCSV', () => ({ exportCSV: vi.fn() }));
vi.mock('../ExportPDF', () => ({
  exportFacture: vi.fn(),
  exportFicheChantier: vi.fn(),
}));
// Supabase : requis par donnees.js (donneesDemo import chain)
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CLIENT_1 = { id: '1', prenom: 'Alice', nom: 'Dupont', entreprise: 'Dupont SA' };
const CLIENT_2 = { id: '2', prenom: 'Bob', nom: 'Martin', entreprise: '' };
const PROFIL_CYNA = { id: 'cyna' };

const CHANTIER_1 = { id: 'CH1', nom: 'Chantier Test', numero: 'C-001', statut: 'en cours', clientId: '1', devisId: 'D1' };
const DEVIS_1 = { id: 'D1', numero: 'D-2026-001', chantierId: 'CH1', montantHT: 20000, statut: 'accepté' };

// Dates dans l'année courante pour passer le filtre periodeGlobale='annee'
const TODAY = new Date().toISOString().slice(0, 10);
const IN_30_DAYS = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

const FACTURE_ENVOYEE = {
  id: 'F1', numero: 'F-2026-001', clientId: '1', chantierId: 'CH1', devisId: 'D1',
  statut: 'envoyee', type: 'situation', source: 'chantier',
  montantHT: 1000, montantTVA: 81, montantTTC: 1081, montantPaye: 0,
  dateEmission: TODAY, dateEcheance: IN_30_DAYS,
  lignes: [{ description: 'Situation 1', quantite: 1, prixUnitaire: 1000, tva: 8.1 }],
  paiementsHistorique: [], rappels: [],
};

const FACTURE_BROUILLON = {
  id: 'F2', numero: 'F-2026-002', clientId: '1', chantierId: 'CH1', devisId: 'D1',
  statut: 'brouillon', type: 'standard', source: 'manuel',
  montantHT: 2000, montantTVA: 162, montantTTC: 2162, montantPaye: 0,
  dateEmission: TODAY, dateEcheance: IN_30_DAYS,
  lignes: [{ description: 'Travaux divers', quantite: 2, prixUnitaire: 1000, tva: 8.1 }],
  paiementsHistorique: [], rappels: [],
};

const FACTURE_PARTIELLE = {
  id: 'F3', numero: 'F-2026-003', clientId: '1', chantierId: 'CH1', devisId: 'D1',
  statut: 'partielle', type: 'finale', source: 'chantier',
  montantHT: 5000, montantTVA: 405, montantTTC: 5405, montantPaye: 2000,
  dateEmission: TODAY, dateEcheance: IN_30_DAYS,
  lignes: [{ description: 'Travaux finale', quantite: 1, prixUnitaire: 5000, tva: 8.1 }],
  paiementsHistorique: [{ id: 'pay1', montant: 2000, date: TODAY, mode: 'Virement', note: '' }],
  rappels: [],
};

// Facture pour test relances (en retard > 15 jours)
const PAST_DATE = '2020-01-01';
const FACTURE_RETARD_RELANCE = {
  id: 'F4', numero: 'F-2026-004', clientId: '1', chantierId: 'CH1', devisId: 'D1',
  statut: 'envoyee', type: 'standard', source: 'manuel',
  montantHT: 3000, montantTVA: 243, montantTTC: 3243, montantPaye: 0,
  dateEmission: PAST_DATE, dateEcheance: PAST_DATE,
  lignes: [{ description: 'Retard', quantite: 1, prixUnitaire: 3000, tva: 8.1 }],
  paiementsHistorique: [], rappels: [],
};

// Helper — render Factures avec profil CYNA (canEdit=true) + periodeGlobale='annee'
function renderFactures(propsOverrides = {}, ctxOverrides = {}) {
  const onSave = propsOverrides.onSave || vi.fn();
  const defaults = {
    factures: [],
    onSave,
    clients: [CLIENT_1],
    chantiers: [CHANTIER_1],
    devis: [DEVIS_1],
    paiementsData: {},
    setPaiementsData: vi.fn(),
    naviguer: vi.fn(),
    profil: PROFIL_CYNA,
    periodeGlobale: 'annee',
    parametres: { employes: [] },
    preRemplir: null,
    onConsumePreRemplir: vi.fn(),
  };
  const props = { ...defaults, ...propsOverrides, onSave };
  return renderWithApp(<Factures {...props} />, ctxOverrides);
}

// ── Setup : mock window.confirm + window.alert ────────────────────────────────

let confirmSpy;
let alertSpy;

beforeEach(() => {
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  alertSpy   = vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// LISTE — Rendu de base
// ─────────────────────────────────────────────────────────────────────────────

describe('Factures — liste : rendu de base', () => {
  it('affiche "Aucune facture trouvée" quand la liste est vide', () => {
    renderFactures();
    expect(screen.getByText(/Aucune facture trouvée/i)).toBeInTheDocument();
  });

  it('affiche le bouton "+ Nouvelle facture" (canEdit=cyna)', () => {
    renderFactures();
    expect(screen.getByRole('button', { name: /Nouvelle facture/i })).toBeInTheDocument();
  });

  it("n'affiche pas le bouton Nouvelle facture sans profil (canEdit=false)", () => {
    renderFactures({ profil: null });
    expect(screen.queryByRole('button', { name: /Nouvelle facture/i })).not.toBeInTheDocument();
  });

  it('affiche une facture dans le tableau', () => {
    renderFactures({ factures: [FACTURE_ENVOYEE] });
    expect(screen.getByText('F-2026-001')).toBeInTheDocument();
  });

  it('affiche le badge statut de la facture', () => {
    renderFactures({ factures: [FACTURE_ENVOYEE] });
    expect(screen.getAllByText('Envoyée').length).toBeGreaterThan(0);
  });

  it('affiche le bouton "Payer" pour une facture envoyée', () => {
    renderFactures({ factures: [FACTURE_ENVOYEE] });
    expect(screen.getByRole('button', { name: /^Payer$/i })).toBeInTheDocument();
  });

  it('affiche le bouton "Émettre" pour une facture brouillon', () => {
    renderFactures({ factures: [FACTURE_BROUILLON] });
    expect(screen.getByRole('button', { name: /^Émettre$/i })).toBeInTheDocument();
  });

  it('affiche les 4 labels KPI', () => {
    renderFactures({ factures: [FACTURE_ENVOYEE] });
    expect(screen.getAllByText('Total facturé').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Encaissé').length).toBeGreaterThan(0);
    expect(screen.getAllByText('En retard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Brouillons').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORMULAIRE — Ouverture et navigation
// ─────────────────────────────────────────────────────────────────────────────

describe('Factures — formulaire : ouverture', () => {
  it('cliquer "+ Nouvelle facture" ouvre le formulaire', () => {
    renderFactures();
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle facture/i }));
    expect(screen.getByText(/Nouvelle facture/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enregistrer brouillon/i })).toBeInTheDocument();
  });

  it('bouton "← Annuler" revient à la liste', () => {
    renderFactures();
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle facture/i }));
    fireEvent.click(screen.getByRole('button', { name: /← Annuler/i }));
    expect(screen.getByText(/Aucune facture trouvée/i)).toBeInTheDocument();
  });

  it('preRemplir ouvre directement le formulaire via useEffect', async () => {
    const preRemplir = {
      clientId: '1',
      chantierId: 'CH1',
      type: 'situation',
      lignes: [{ description: 'Situation 1', quantite: 1, prixUnitaire: 1000, tva: 8.1 }],
    };
    renderFactures({ preRemplir });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enregistrer brouillon/i })).toBeInTheDocument();
    });
  });

  it('modifier une facture existante ouvre le formulaire en mode édition', () => {
    renderFactures({ factures: [FACTURE_ENVOYEE] });
    fireEvent.click(screen.getByRole('button', { name: /^Modifier$/i }));
    // Titre "Modifier F-2026-001"
    expect(screen.getByText(/Modifier F-2026-001/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CALCUL TTC 8.1% — CŒUR DU MÉTIER
// ─────────────────────────────────────────────────────────────────────────────

describe('Factures — calcul TTC 8.1% (via sauvegarder)', () => {
  it('1 ligne 1000 HT × 8.1% → TVA=81 exact, TTC=1081 dans onSave', async () => {
    const onSave = vi.fn();
    const preRemplir = {
      clientId: '1',
      chantierId: 'CH1',
      type: 'situation',
      lignes: [{ description: 'Situation', quantite: 1, prixUnitaire: 1000, tva: 8.1 }],
    };
    renderFactures({ onSave, preRemplir });

    await waitFor(() => expect(screen.getByRole('button', { name: /Enregistrer brouillon/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer brouillon/i }));

    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0][0][0];
    expect(saved.montantHT).toBe(1000);
    expect(saved.montantTVA).toBeCloseTo(81, 5);   // 1000 × 8.1/100 = 81.000 exact
    expect(saved.montantTTC).toBeCloseTo(1081, 5);  // 1000 + 81 = 1081 exact
    expect(saved.statut).toBe('brouillon');
  });

  it('TVA 8.1% — pas 7.7%, pas 8.0% : précision à 4 décimales', async () => {
    const onSave = vi.fn();
    // 500 HT × 8.1% = 40.50 TVA, TTC = 540.50
    const preRemplir = {
      clientId: '1',
      type: 'standard',
      lignes: [{ description: 'Test', quantite: 1, prixUnitaire: 500, tva: 8.1 }],
    };
    renderFactures({ onSave, preRemplir });

    await waitFor(() => expect(screen.getByRole('button', { name: /Enregistrer brouillon/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer brouillon/i }));

    const saved = onSave.mock.calls[0][0][0];
    expect(saved.montantTVA).toBeCloseTo(40.5, 4);   // 500 × 0.081 = 40.5
    expect(saved.montantTTC).toBeCloseTo(540.5, 4);
    // Vérification négative : pas le taux 7.7% de l'ancienne TVA
    expect(saved.montantTVA).not.toBeCloseTo(500 * 0.077, 4);
  });

  it('2 lignes — TTC = somme des deux', async () => {
    const onSave = vi.fn();
    // L1: 1 × 1000 = 1000 HT, L2: 2 × 500 = 1000 HT → total HT = 2000, TVA = 162, TTC = 2162
    const preRemplir = {
      clientId: '1',
      type: 'standard',
      lignes: [
        { description: 'Ligne 1', quantite: 1, prixUnitaire: 1000, tva: 8.1 },
        { description: 'Ligne 2', quantite: 2, prixUnitaire: 500,  tva: 8.1 },
      ],
    };
    renderFactures({ onSave, preRemplir });

    await waitFor(() => expect(screen.getByRole('button', { name: /Enregistrer brouillon/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer brouillon/i }));

    const saved = onSave.mock.calls[0][0][0];
    expect(saved.montantHT).toBe(2000);
    expect(saved.montantTVA).toBeCloseTo(162, 4);
    expect(saved.montantTTC).toBeCloseTo(2162, 4);
  });

  it('TVA mixte : ligne 8.1% + ligne 0% → TVA sur ligne 8.1% seulement', async () => {
    const onSave = vi.fn();
    // L1: 1000 HT × 8.1% = 81 TVA ; L2: 500 HT × 0% = 0 TVA → TTC = 1581
    const preRemplir = {
      clientId: '1',
      type: 'standard',
      lignes: [
        { description: 'Travaux', quantite: 1, prixUnitaire: 1000, tva: 8.1 },
        { description: 'Exonéré', quantite: 1, prixUnitaire: 500,  tva: 0   },
      ],
    };
    renderFactures({ onSave, preRemplir });

    await waitFor(() => expect(screen.getByRole('button', { name: /Enregistrer brouillon/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer brouillon/i }));

    const saved = onSave.mock.calls[0][0][0];
    expect(saved.montantHT).toBe(1500);
    expect(saved.montantTVA).toBeCloseTo(81, 4);
    expect(saved.montantTTC).toBeCloseTo(1581, 4);
  });

  it('le formulaire affiche "Total TTC" et "Montant HT" dans les totaux', async () => {
    const preRemplir = {
      clientId: '1',
      type: 'situation',
      lignes: [{ description: 'Test', quantite: 1, prixUnitaire: 1000, tva: 8.1 }],
    };
    renderFactures({ preRemplir });

    await waitFor(() => expect(screen.getByText(/Total TTC/i)).toBeInTheDocument());
    expect(screen.getByText(/Montant HT/i)).toBeInTheDocument();
    // TTC = 1081 → affiché comme "1'081.00 CHF"
    expect(screen.getByText("1'081.00 CHF")).toBeInTheDocument();
  });

  it('updateLigne via interaction UI recalcule TTC en temps réel', async () => {
    renderFactures();
    // Ouvrir le formulaire
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle facture/i }));

    // La ligne par défaut a prixUnitaire=0 → TTC affiché = "0.00 CHF"
    expect(screen.getAllByText('0.00 CHF').length).toBeGreaterThan(0);

    // Trouver le champ prix unit. : input type="text" sans placeholder dans le tbody
    const descInput = screen.getByPlaceholderText(/Description du poste/i);
    const tr = descInput.closest('tr');
    // Les textbox dans cette ligne : [description, prixUnit]
    const textboxes = within(tr).getAllByRole('textbox');
    const prixInput = textboxes[1]; // prix unit est le 2e textbox de la ligne

    fireEvent.change(prixInput, { target: { value: '1000' } });

    // TTC = 1000 + 81 = 1081 → "1'081.00 CHF" dans les totaux
    await waitFor(() => {
      expect(screen.getByText("1'081.00 CHF")).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORMULAIRE — Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('Factures — formulaire : validation', () => {
  it('client obligatoire : alerte si pas de clientId, onSave non appelé', async () => {
    const onSave = vi.fn();
    // preRemplir sans clientId → form.clientId = '' (preRemplir n'a pas de clientId key)
    const preRemplir = {
      type: 'standard',
      lignes: [{ description: 'Test', quantite: 1, prixUnitaire: 100, tva: 8.1 }],
    };
    renderFactures({ onSave, preRemplir });

    await waitFor(() => expect(screen.getByRole('button', { name: /Enregistrer brouillon/i })).toBeInTheDocument());

    // Le preRemplir spread sur le form : clientId absent → form.clientId reste ''
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer brouillon/i }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('client'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('émettre sans dateEmission → alerte, onSave non appelé', async () => {
    const onSave = vi.fn();
    const preRemplir = {
      clientId: '1', type: 'standard',
      dateEmission: '', dateEcheance: IN_30_DAYS,
      lignes: [{ description: 'Test', quantite: 1, prixUnitaire: 100, tva: 8.1 }],
    };
    renderFactures({ onSave, preRemplir });

    await waitFor(() => expect(screen.getByRole('button', { name: /Émettre la facture/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Émettre la facture/i }));

    expect(alertSpy).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("émettre avec échéance avant émission → alerte", async () => {
    const onSave = vi.fn();
    const preRemplir = {
      clientId: '1', chantierId: 'CH1', devisId: 'D1', type: 'standard',
      dateEmission: IN_30_DAYS, dateEcheance: TODAY, // échéance avant émission
      lignes: [{ description: 'Test', quantite: 1, prixUnitaire: 100, tva: 8.1 }],
    };
    renderFactures({ onSave, preRemplir });

    await waitFor(() => expect(screen.getByRole('button', { name: /Émettre la facture/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Émettre la facture/i }));

    expect(alertSpy).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('émettre avec lignes vides (prix=0) → alerte', async () => {
    const onSave = vi.fn();
    const preRemplir = {
      clientId: '1', chantierId: 'CH1', type: 'standard',
      dateEmission: TODAY, dateEcheance: IN_30_DAYS,
      lignes: [{ description: 'Rien', quantite: 0, prixUnitaire: 0, tva: 8.1 }],
    };
    renderFactures({ onSave, preRemplir });

    await waitFor(() => expect(screen.getByRole('button', { name: /Émettre la facture/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Émettre la facture/i }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('ligne'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('émettre sans chantierId ni devisId → window.confirm (avertissement orpheline)', async () => {
    const onSave = vi.fn();
    confirmSpy.mockReturnValue(false); // annuler → onSave non appelé
    const preRemplir = {
      clientId: '1', type: 'standard',
      // pas de chantierId ni devisId
      dateEmission: TODAY, dateEcheance: IN_30_DAYS,
      lignes: [{ description: 'Sans ancrage', quantite: 1, prixUnitaire: 100, tva: 8.1 }],
    };
    renderFactures({ onSave, preRemplir });

    await waitFor(() => expect(screen.getByRole('button', { name: /Émettre la facture/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Émettre la facture/i }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('orpheline'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('émettre valide → statut=envoyee dans onSave', async () => {
    const onSave = vi.fn();
    confirmSpy.mockReturnValue(true);
    const preRemplir = {
      clientId: '1', chantierId: 'CH1', devisId: 'D1', type: 'situation',
      dateEmission: TODAY, dateEcheance: IN_30_DAYS,
      lignes: [{ description: 'Situation', quantite: 1, prixUnitaire: 1000, tva: 8.1 }],
    };
    renderFactures({ onSave, preRemplir });

    await waitFor(() => expect(screen.getByRole('button', { name: /Émettre la facture/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Émettre la facture/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved = onSave.mock.calls[0][0][0];
    expect(saved.statut).toBe('envoyee');
    expect(saved.montantTTC).toBeCloseTo(1081, 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PAIEMENTS — Modal et calculs
// ─────────────────────────────────────────────────────────────────────────────

describe('Factures — paiements', () => {
  it('cliquer "Payer" ouvre la modal de paiement', () => {
    renderFactures({ factures: [FACTURE_ENVOYEE] });
    fireEvent.click(screen.getByRole('button', { name: /^Payer$/i }));
    expect(screen.getByText(/Enregistrer un paiement/i)).toBeInTheDocument();
    expect(screen.getByText(/Solde restant/i)).toBeInTheDocument();
  });

  it('paiement partiel → statut=partielle, montantPaye cumulé, paiementsHistorique+1', () => {
    const onSave = vi.fn();
    renderFactures({ factures: [FACTURE_ENVOYEE], onSave });

    // Ouvrir modal
    fireEvent.click(screen.getByRole('button', { name: /^Payer$/i }));

    // Saisir montant partiel = 500
    const montantInput = screen.getByPlaceholderText(/Solde/i);
    fireEvent.change(montantInput, { target: { value: '500' } });

    // Confirmer
    fireEvent.click(screen.getByRole('button', { name: /Confirmer le paiement/i }));

    expect(onSave).toHaveBeenCalledOnce();
    const factureMAJ = onSave.mock.calls[0][0].find(f => f.id === 'F1');
    expect(factureMAJ.statut).toBe('partielle');
    expect(factureMAJ.montantPaye).toBe(500);
    expect(factureMAJ.paiementsHistorique).toHaveLength(1);
    expect(factureMAJ.paiementsHistorique[0].montant).toBe(500);
  });

  it('paiement complet (montant = TTC exact) → statut=payee', () => {
    const onSave = vi.fn();
    renderFactures({ factures: [FACTURE_ENVOYEE], onSave });

    fireEvent.click(screen.getByRole('button', { name: /^Payer$/i }));

    const montantInput = screen.getByPlaceholderText(/Solde/i);
    fireEvent.change(montantInput, { target: { value: '1081' } });

    fireEvent.click(screen.getByRole('button', { name: /Confirmer le paiement/i }));

    const factureMAJ = onSave.mock.calls[0][0].find(f => f.id === 'F1');
    expect(factureMAJ.statut).toBe('payee');
    expect(factureMAJ.montantPaye).toBe(1081);
    expect(factureMAJ.paiementsHistorique).toHaveLength(1);
  });

  it('paiements cumulatifs : 2 paiements partiels → paiementsHistorique.length=2', () => {
    const onSave = vi.fn();
    // FACTURE_PARTIELLE a déjà 1 paiement de 2000, montantPaye=2000, montantTTC=5405
    renderFactures({ factures: [FACTURE_PARTIELLE], onSave });

    fireEvent.click(screen.getByRole('button', { name: /^Payer$/i }));

    // Payer encore 1000
    const montantInput = screen.getByPlaceholderText(/Solde/i);
    fireEvent.change(montantInput, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmer le paiement/i }));

    const factureMAJ = onSave.mock.calls[0][0].find(f => f.id === 'F3');
    // Historique initial (1) + nouveau (1) = 2
    expect(factureMAJ.paiementsHistorique).toHaveLength(2);
    expect(factureMAJ.montantPaye).toBe(3000);
    expect(factureMAJ.statut).toBe('partielle'); // 5405 - 3000 = 2405 > 0
  });

  it('🐛 surpaiement (montant > restant) → alert, onSave NON appelé', () => {
    // FACTURE_ENVOYEE : restant = 1081. Tenter de payer 9999 > 1081 + 0.01
    const onSave = vi.fn();
    renderFactures({ factures: [FACTURE_ENVOYEE], onSave });

    fireEvent.click(screen.getByRole('button', { name: /^Payer$/i }));

    const montantInput = screen.getByPlaceholderText(/Solde/i);
    fireEvent.change(montantInput, { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmer le paiement/i }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Solde restant'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('paiement à 0 → rien ne se passe (montant <= 0 guard)', () => {
    const onSave = vi.fn();
    renderFactures({ factures: [FACTURE_ENVOYEE], onSave });

    fireEvent.click(screen.getByRole('button', { name: /^Payer$/i }));
    // Laisser le champ vide (montant = '') → montant = 0
    fireEvent.click(screen.getByRole('button', { name: /Confirmer le paiement/i }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('annuler la modal de paiement → onSave non appelé', () => {
    const onSave = vi.fn();
    renderFactures({ factures: [FACTURE_ENVOYEE], onSave });

    fireEvent.click(screen.getByRole('button', { name: /^Payer$/i }));
    expect(screen.getByText(/Enregistrer un paiement/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Annuler$/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByText(/Enregistrer un paiement/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// changerStatut
// ─────────────────────────────────────────────────────────────────────────────

describe('Factures — changerStatut', () => {
  it('Émettre (brouillon→envoyee) depuis la liste → statut=envoyee dans onSave', () => {
    const onSave = vi.fn();
    renderFactures({ factures: [FACTURE_BROUILLON], onSave });

    fireEvent.click(screen.getByRole('button', { name: /^Émettre$/i }));

    expect(onSave).toHaveBeenCalledOnce();
    const factureMAJ = onSave.mock.calls[0][0].find(f => f.id === 'F2');
    expect(factureMAJ.statut).toBe('envoyee');
  });

  it("changerStatut('payee') manuellement — complète montantPaye et ajoute paiementsHistorique", async () => {
    // Pour accéder au bouton "Payée", il faut être en vue détail
    const onSave = vi.fn();
    renderFactures({ factures: [FACTURE_ENVOYEE], onSave });

    // Naviguer vers le détail : cliquer sur la ligne (pas sur les boutons actions)
    const rows = screen.getAllByRole('row');
    // Cliquer sur la ligne du tableau (2e ligne, la 1re est le header)
    const dataRow = rows.find(r => r.textContent?.includes('F-2026-001'));
    fireEvent.click(dataRow);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Payée$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Payée$/i }));

    expect(onSave).toHaveBeenCalledOnce();
    const factureMAJ = onSave.mock.calls[0][0].find(f => f.id === 'F1');
    expect(factureMAJ.statut).toBe('payee');
    // montantPaye doit être complété au TTC total
    expect(factureMAJ.montantPaye).toBe(1081);
    // paiementsHistorique doit avoir une entrée "Soldé manuellement"
    expect(factureMAJ.paiementsHistorique.some(p => p.note === 'Soldé manuellement')).toBe(true);
  });

  // 🐛 Pas de bouton "Annuler" dans l'UI — changerStatut('annulee') inaccessible
  it("🐛 aucun bouton 'Annuler' ou 'Annulée' dans l'UI — changerStatut('annulee') est du code mort", () => {
    renderFactures({ factures: [FACTURE_ENVOYEE] });
    // Il n'existe aucun bouton qui appelle changerStatut avec 'annulee'
    // La liste des boutons dans la liste : Modifier, Émettre (brouillon seulement), Payer, Suppr
    // Le détail : Modifier, Émettre (brouillon), Paiement, Payée, Supprimer
    // → Aucun "Annuler" / "Annulée" visible
    const tousLesBoutons = screen.getAllByRole('button').map(b => b.textContent?.trim());
    expect(tousLesBoutons).not.toContain('Annuler');
    expect(tousLesBoutons).not.toContain('Annulée');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPPRIMER
// ─────────────────────────────────────────────────────────────────────────────

describe('Factures — supprimerFacture', () => {
  it('confirm=true → onSave appelé sans la facture supprimée', () => {
    const onSave = vi.fn();
    confirmSpy.mockReturnValue(true);
    renderFactures({ factures: [FACTURE_ENVOYEE], onSave });

    fireEvent.click(screen.getByRole('button', { name: /^Suppr$/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledOnce();
    const liste = onSave.mock.calls[0][0];
    expect(liste.some(f => f.id === 'F1')).toBe(false);
    expect(liste).toHaveLength(0);
  });

  it('confirm=false → onSave non appelé', () => {
    const onSave = vi.fn();
    confirmSpy.mockReturnValue(false);
    renderFactures({ factures: [FACTURE_ENVOYEE], onSave });

    fireEvent.click(screen.getByRole('button', { name: /^Suppr$/i }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('supprimer une facture parmi plusieurs conserve les autres', () => {
    const onSave = vi.fn();
    confirmSpy.mockReturnValue(true);
    renderFactures({ factures: [FACTURE_ENVOYEE, FACTURE_BROUILLON], onSave });

    const boutonsSup = screen.getAllByRole('button', { name: /^Suppr$/i });
    fireEvent.click(boutonsSup[0]); // Supprimer F1

    const liste = onSave.mock.calls[0][0];
    expect(liste).toHaveLength(1);
    expect(liste[0].id).toBe('F2');
  });

  it('supprimer nettoie paiementsData (factureId orphelins)', () => {
    const setPaiementsData = vi.fn();
    const paiementsData = {
      CH1: [{ id: 'pay1', factureId: 'F1', montant: 500 }],
    };
    confirmSpy.mockReturnValue(true);
    renderFactures({ factures: [FACTURE_ENVOYEE], setPaiementsData, paiementsData });

    fireEvent.click(screen.getByRole('button', { name: /^Suppr$/i }));

    expect(setPaiementsData).toHaveBeenCalledOnce();
    const nouveauPaiements = setPaiementsData.mock.calls[0][0];
    expect(nouveauPaiements.CH1).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VUE DETAIL
// ─────────────────────────────────────────────────────────────────────────────

describe('Factures — vue détail', () => {
  it('cliquer une ligne de tableau → vue détail avec le numéro de facture', async () => {
    renderFactures({ factures: [FACTURE_ENVOYEE] });

    const rows = screen.getAllByRole('row');
    const dataRow = rows.find(r => r.textContent?.includes('F-2026-001'));
    fireEvent.click(dataRow);

    await waitFor(() => {
      expect(screen.getByText(/Facture F-2026-001/i)).toBeInTheDocument();
    });
  });

  it('bouton "← Retour" depuis le détail ramène à la liste', async () => {
    renderFactures({ factures: [FACTURE_ENVOYEE] });

    const rows = screen.getAllByRole('row');
    const dataRow = rows.find(r => r.textContent?.includes('F-2026-001'));
    fireEvent.click(dataRow);

    await waitFor(() => screen.getByRole('button', { name: /← Retour/i }));
    fireEvent.click(screen.getByRole('button', { name: /← Retour/i }));

    expect(screen.getByText('F-2026-001')).toBeInTheDocument(); // dans le tableau de liste
  });

  it('la vue détail affiche les montants HT / TVA / TTC / Payé', async () => {
    renderFactures({ factures: [FACTURE_ENVOYEE] });

    const rows = screen.getAllByRole('row');
    const dataRow = rows.find(r => r.textContent?.includes('F-2026-001'));
    fireEvent.click(dataRow);

    await waitFor(() => screen.getByText(/Montant HT/i));
    expect(screen.getAllByText(/Montant TTC/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Payé/i).length).toBeGreaterThan(0);
  });

  it('la vue détail affiche les lignes de facturation', async () => {
    renderFactures({ factures: [FACTURE_ENVOYEE] });

    const rows = screen.getAllByRole('row');
    const dataRow = rows.find(r => r.textContent?.includes('F-2026-001'));
    fireEvent.click(dataRow);

    await waitFor(() => screen.getByText(/Lignes de facturation/i));
    expect(screen.getByText('Situation 1')).toBeInTheDocument();
  });

  it("la vue détail affiche l'historique des paiements pour FACTURE_PARTIELLE", async () => {
    renderFactures({ factures: [FACTURE_PARTIELLE] });

    const rows = screen.getAllByRole('row');
    const dataRow = rows.find(r => r.textContent?.includes('F-2026-003'));
    fireEvent.click(dataRow);

    await waitFor(() => screen.getByText(/Historique des paiements/i));
    // 1 paiement existant de 2000
    expect(screen.getAllByText(/2'000.00 CHF/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RELANCES
// ─────────────────────────────────────────────────────────────────────────────

describe('Factures — relances (vue détail)', () => {
  async function ouvrirDetailRetard() {
    renderFactures({ factures: [FACTURE_RETARD_RELANCE] });
    // Note: FACTURE_RETARD_RELANCE dateEmission=PAST_DATE → filtrée par periodeGlobale='annee'?
    // 2020-01-01 est dans 2020, mais periodeGlobale='annee' couvre 2026 → elle sera filtrée!
    // Solution : utiliser la vue détail directement via une facture retard de 2026
    // Ce test est redessiné pour vérifier la logique via une facture récente en retard
  }

  it("relances visibles quand la facture est en retard dans le détail", async () => {
    // Facture de cette année avec echeance passée (hier)
    const HIER = new Date(Date.now() - 86400000 * 20).toISOString().slice(0, 10);
    const factureRetard2026 = {
      ...FACTURE_ENVOYEE,
      id: 'FR2026', numero: 'F-2026-099',
      dateEcheance: HIER,
      montantPaye: 0,
      rappels: [],
    };
    renderFactures({ factures: [factureRetard2026] });

    const rows = screen.getAllByRole('row');
    const dataRow = rows.find(r => r.textContent?.includes('F-2026-099'));
    fireEvent.click(dataRow);

    await waitFor(() => screen.getByText(/Relances/i));
    // prochainRappel retourne niveau 1 après 15j → bouton "Générer le rappel"
    expect(screen.getByRole('button', { name: /Générer le rappel/i })).toBeInTheDocument();
  });

  it('Générer le rappel → modal de rappel avec textarea', async () => {
    const HIER = new Date(Date.now() - 86400000 * 20).toISOString().slice(0, 10);
    const factureRetard = {
      ...FACTURE_ENVOYEE,
      id: 'FR_MODAL', numero: 'F-2026-100',
      dateEcheance: HIER,
      montantPaye: 0,
      rappels: [],
    };
    renderFactures({ factures: [factureRetard] });

    const rows = screen.getAllByRole('row');
    const dataRow = rows.find(r => r.textContent?.includes('F-2026-100'));
    fireEvent.click(dataRow);

    await waitFor(() => screen.getByRole('button', { name: /Générer le rappel/i }));
    fireEvent.click(screen.getByRole('button', { name: /Générer le rappel/i }));

    // Modal s'ouvre avec un textarea
    await waitFor(() => screen.getByRole('textbox'));
    expect(screen.getByRole('button', { name: /Marquer comme envoyé/i })).toBeInTheDocument();
  });

  it('confirmerRappelEnvoye → facture.rappels mise à jour via onSave', async () => {
    const onSave = vi.fn();
    const HIER = new Date(Date.now() - 86400000 * 20).toISOString().slice(0, 10);
    const factureRetard = {
      ...FACTURE_ENVOYEE,
      id: 'FR_ENVOI', numero: 'F-2026-101',
      dateEcheance: HIER,
      montantPaye: 0,
      rappels: [],
    };
    renderFactures({ factures: [factureRetard], onSave });

    const rows = screen.getAllByRole('row');
    const dataRow = rows.find(r => r.textContent?.includes('F-2026-101'));
    fireEvent.click(dataRow);

    await waitFor(() => screen.getByRole('button', { name: /Générer le rappel/i }));
    fireEvent.click(screen.getByRole('button', { name: /Générer le rappel/i }));

    await waitFor(() => screen.getByRole('button', { name: /Marquer comme envoyé/i }));
    fireEvent.click(screen.getByRole('button', { name: /Marquer comme envoyé/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const factureMAJ = onSave.mock.calls[0][0].find(f => f.id === 'FR_ENVOI');
    expect(factureMAJ.rappels).toHaveLength(1);
    expect(factureMAJ.rappels[0].niveau).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FILTRES
// ─────────────────────────────────────────────────────────────────────────────

describe('Factures — filtres et recherche', () => {
  it('filtre par statut "Brouillon" → seules les brouillons visibles', () => {
    renderFactures({ factures: [FACTURE_ENVOYEE, FACTURE_BROUILLON] });

    const selects = screen.getAllByRole('combobox');
    // Le filtre statut est le 2e select (après le filtre type)
    const filtreStatut = selects.find(s => s.textContent?.includes('Tous statuts'));
    fireEvent.change(filtreStatut, { target: { value: 'brouillon' } });

    expect(screen.queryByText('F-2026-001')).not.toBeInTheDocument();
    expect(screen.getByText('F-2026-002')).toBeInTheDocument();
  });

  it('recherche par numéro de facture', () => {
    renderFactures({ factures: [FACTURE_ENVOYEE, FACTURE_BROUILLON] });

    const rechercheInput = screen.getByPlaceholderText(/Rechercher/i);
    fireEvent.change(rechercheInput, { target: { value: 'F-2026-001' } });

    expect(screen.getByText('F-2026-001')).toBeInTheDocument();
    expect(screen.queryByText('F-2026-002')).not.toBeInTheDocument();
  });
});
