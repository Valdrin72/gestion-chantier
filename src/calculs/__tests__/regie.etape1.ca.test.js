/**
 * Tests Étape 1 régie — Séparation caForfait / caTotal
 *
 * Règle CLAUDE.md : tests RÉELS (logique pure + RTL)
 * - Logique : calculerCAForfait / calculerCA sur vraies fonctions exportées
 * - RTL : FinancesPage avec extras — potentiel sur caForfait uniquement
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { calculerCA, calculerCAForfait } from '../../donnees';
import Finances from '../../pages/FinancesPage';
import { renderWithApp } from '../../test-utils/renderWithApp';

// ── Mocks dépendances FinancesPage ───────────────────────────────────────────
vi.mock('../../ExportPDF', () => ({ exportFacture: vi.fn(), exportFicheChantier: vi.fn() }));
vi.mock('../../utils/exportCSV', () => ({ exportCSV: vi.fn() }));
vi.mock('../../relances', () => ({
  prochainRappel: vi.fn(() => null),
  niveauInfo: vi.fn(() => ({ couleur: '#f59e0b', label: 'Rappel 1' })),
  genererTexteRappel: vi.fn(() => ({ texte: '', objet: '' })),
  marquerRappelEnvoye: vi.fn(f => f),
}));
vi.mock('../../Paiements', () => ({ default: () => null }));
vi.mock('../../RelancesTab', () => ({ default: () => null }));

// ── Fixtures ─────────────────────────────────────────────────────────────────
const DEVIS_BASE = [{
  id: 'd1', numero: 'D-2026-001', montantHT: 50000,
  avenants: [], heuresRegie: [],
}];
const DEVIS_AVENANT = [{
  id: 'd2', numero: 'D-2026-002', montantHT: 40000,
  avenants: [{ montant: 5000 }, { montant: 3000 }],
  heuresRegie: [{ id: 'r1', description: 'Régie', heures: 10, tarifHeure: 100 }],
}];

const CHANTIER_BASE = { id: 'c1', nom: 'Réno Dupont', devisId: 'd1', clientId: 'cl1', statut: 'En cours', avancement: 60, journal: [] };
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', prenom: 'Jean', entreprise: '' }];

// ── Helpers de rendu ─────────────────────────────────────────────────────────
function renderFinances(chantiers, factures = []) {
  return renderWithApp(
    <Finances
      clients={CLIENTS}
      chantiers={chantiers}
      devis={DEVIS_BASE}
      factures={factures}
      onSave={vi.fn()}
      paiementsData={{}}
      setPaiementsData={vi.fn()}
      profil={{ id: 'cyna' }}
      parametres={{ employes: [] }}
      periodeGlobale="annee"
    />,
  );
}

// ── BLOC 1 — Logique pure calculerCAForfait / calculerCA ──────────────────────
describe('calculerCAForfait — logique pure', () => {
  it('sans extras : égal à l\'ancien calculerCA (non-régression)', () => {
    const chantier = { ...CHANTIER_BASE, extras: [] };
    expect(calculerCAForfait(chantier, DEVIS_BASE)).toBe(50000);
    expect(calculerCA(chantier, DEVIS_BASE)).toBe(50000);
  });

  it('avec avenants et heuresRegie : calculerCAForfait inclut les deux', () => {
    const chantier = { id: 'c2', devisId: 'd2', extras: [] };
    // 40000 + (5000+3000) avenants + 10×100 régie = 49000
    expect(calculerCAForfait(chantier, DEVIS_AVENANT)).toBe(49000);
  });

  it('calculerCAForfait retourne null sans devisId', () => {
    expect(calculerCAForfait({ id: 'cx' }, DEVIS_BASE)).toBeNull();
  });

  it('calculerCAForfait retourne null si devis introuvable', () => {
    expect(calculerCAForfait({ id: 'cx', devisId: 'inconnu' }, DEVIS_BASE)).toBeNull();
  });
});

describe('calculerCA — logique pure (total = forfait + extras)', () => {
  it('invariant : extras vide → calculerCA === calculerCAForfait', () => {
    const chantier = { ...CHANTIER_BASE, extras: [] };
    expect(calculerCA(chantier, DEVIS_BASE)).toBe(calculerCAForfait(chantier, DEVIS_BASE));
  });

  it('extra mode forfait inclus dans calculerCA, pas dans calculerCAForfait', () => {
    const chantier = {
      ...CHANTIER_BASE,
      extras: [{ id: 'e1', mode: 'forfait', montantForfait: 8000 }],
    };
    expect(calculerCAForfait(chantier, DEVIS_BASE)).toBe(50000);
    expect(calculerCA(chantier, DEVIS_BASE)).toBe(58000);
  });

  it('extra mode heures inclus dans calculerCA, pas dans calculerCAForfait', () => {
    const chantier = {
      ...CHANTIER_BASE,
      extras: [{ id: 'e2', mode: 'heures', heures: 5, tarifHeure: 120 }],
    };
    expect(calculerCAForfait(chantier, DEVIS_BASE)).toBe(50000);
    expect(calculerCA(chantier, DEVIS_BASE)).toBe(50600); // 50000 + 5×120
  });

  it('cumul : extra forfait + extra heures', () => {
    const chantier = {
      ...CHANTIER_BASE,
      extras: [
        { id: 'e1', mode: 'forfait', montantForfait: 3000 },
        { id: 'e2', mode: 'heures', heures: 4, tarifHeure: 100 },
      ],
    };
    expect(calculerCA(chantier, DEVIS_BASE)).toBe(53400); // 50000 + 3000 + 400
    expect(calculerCAForfait(chantier, DEVIS_BASE)).toBe(50000);
  });

  it('extra avec factureId reste compté dans calculerCA', () => {
    const chantier = {
      ...CHANTIER_BASE,
      extras: [{ id: 'e1', mode: 'forfait', montantForfait: 5000, factureId: 'f-extra-1' }],
    };
    expect(calculerCA(chantier, DEVIS_BASE)).toBe(55000);
  });

  it('guards parseFloat : champs manquants ou null → 0 sans NaN', () => {
    const chantier = {
      ...CHANTIER_BASE,
      extras: [
        { id: 'e1', mode: 'forfait', montantForfait: null },
        { id: 'e2', mode: 'heures', heures: null, tarifHeure: 100 },
        { id: 'e3', mode: 'heures', heures: 2, tarifHeure: undefined },
      ],
    };
    const ca = calculerCA(chantier, DEVIS_BASE);
    expect(ca).toBe(50000);
    expect(Number.isNaN(ca)).toBe(false);
  });

  it('calculerCA retourne null si caForfait null (pas de devis)', () => {
    const chantier = { id: 'cx', extras: [{ id: 'e1', mode: 'forfait', montantForfait: 5000 }] };
    expect(calculerCA(chantier, DEVIS_BASE)).toBeNull();
  });
});

// ── BLOC 2 — RTL FinancesPage : potentiel sur caForfait ──────────────────────
describe('FinancesPage — potentiel sur caForfait (RTL)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sans extras : potentiel = caForfait × avancement − 0 = 30 000', () => {
    const chantier = { ...CHANTIER_BASE, extras: [] };
    renderFinances([chantier]);
    // potentiel = 50000 × 60% = 30000 → widget visible
    expect(screen.getByText('Réno Dupont')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer la situation/i })).toBeInTheDocument();
  });

  it('avec extra forfait : potentiel basé sur caForfait (50 000), PAS sur caTotal (58 000)', () => {
    const chantier = {
      ...CHANTIER_BASE,
      avancement: 60,
      extras: [{ id: 'e1', mode: 'forfait', montantForfait: 8000 }],
    };
    renderFinances([chantier]);
    // caForfait = 50000, caTotal = 58000
    // potentiel attendu = 50000 × 60% = 30000 (pas 34800 qui serait caTotal × 60%)
    // Le widget "À facturer" affiche le chantier si potentiel > 500
    expect(screen.getAllByText('Réno Dupont').length).toBeGreaterThan(0);
    // "34 800" / "34'800" / "34800" ne doit PAS apparaître (ce serait caTotal × 60%)
    expect(screen.queryByText(/34 800|34'800|34800/)).toBeNull();
    // "30 000" / "30'000" doit apparaître (caForfait × 60%)
    expect(screen.getAllByText(/30 000|30'000|30000/).length).toBeGreaterThan(0);
  });

  it('facture avec extraId exclue du déjà-facturé des situations', () => {
    const chantier = { ...CHANTIER_BASE, avancement: 60, extras: [] };
    const factures = [
      // facture standard (situation) → compte dans déjà-facturé
      { id: 'f1', chantierId: 'c1', type: 'situation', statut: 'envoyee', montantHT: 10000, extraId: null },
      // facture d'un extra → EXCLUE du déjà-facturé des situations
      { id: 'f2', chantierId: 'c1', type: 'standard', statut: 'envoyee', montantHT: 5000, extraId: 'e1' },
    ];
    renderFinances([chantier], factures);
    // déjà-facturé = 10000 (f1 uniquement, f2 ignorée car extraId)
    // potentiel = 50000×60% − 10000 = 20000
    // Si f2 était comptée : potentiel = 30000 − 15000 = 15000
    // On vérifie que le chantier reste visible (potentiel > 500)
    expect(screen.getAllByText('Réno Dupont').length).toBeGreaterThan(0);
    // "15 000" ne doit PAS apparaître (sinon f2 aurait été comptée à tort)
    expect(screen.queryByText(/\b15 000\b|15'000|\b15000\b/)).toBeNull();
    // Potentiel = 20 000 (pas 15 000)
    expect(screen.getAllByText(/20 000|20'000|20000/).length).toBeGreaterThan(0);
  });
});
