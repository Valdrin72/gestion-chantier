/**
 * Mode consultation mobile — LOT 2 : Finances / Factures / Relances en lecture seule (mobile).
 * Preuve RÉELLE (vrai composant Finances = hero + Trésorerie + Factures + Relances).
 *  • mobile (consultationMobile) : aucun bouton d'écriture — Nouvelle facture, Modifier, Émettre,
 *    Payer, Confirmer paiement, Suppr, Annuler, Exporter CSV (Factures) ni Marquer envoyé (Relances) ;
 *    la consultation (recherche, filtres, ouverture détail, lettre de relance) reste possible ;
 *  • desktop : tous les boutons présents (PC inchangé).
 * ⚠ ARGENT : « Payer » et « Confirmer le paiement » ne doivent pas être atteignables sur mobile.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) } }));
vi.mock('../ExportPDF', () => ({ exportDevis: vi.fn(), exportFicheChantier: vi.fn(), exportFacture: vi.fn() }));
vi.mock('../utils/exportCSV', () => ({ exportCSV: vi.fn() }));

import Finances from '../pages/FinancesPage';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const CLIENTS = [{ id: 'c1', nom: 'Dupont', prenom: 'Marc', entreprise: 'Dupont SA' }];
const CHANTIERS = [{ id: 'ch1', nom: 'Chantier X', clientId: 'c1' }];
// Dates de l'année en cours (2026) → présentes dans la liste (filtrée par période).
// F_PAYABLE : échéance FUTURE → reste « envoyee » (bouton Payer). F_RETARD : échéance passée → relançable.
const F_PAYABLE = { id: 'f1', numero: 'F-2026-001', clientId: 'c1', chantierId: 'ch1', statut: 'envoyee',
  montantHT: 920, montantTTC: 1000, montantPaye: 0, dateEmission: '2026-01-05', dateEcheance: '2026-12-31',
  lignes: [{ _uid: 1, description: 'Travaux', quantite: 1, prixUnitaire: 920, tva: 8.1 }] };
const F_RETARD = { id: 'f3', numero: 'F-2026-003', clientId: 'c1', chantierId: 'ch1', statut: 'envoyee',
  montantHT: 1800, montantTTC: 2000, montantPaye: 0, dateEmission: '2026-01-05', dateEcheance: '2026-02-05',
  lignes: [{ _uid: 3, description: 'Retard', quantite: 1, prixUnitaire: 1800, tva: 8.1 }] };
const F_BROUILLON = { id: 'f2', numero: 'F-2026-002', clientId: 'c1', chantierId: 'ch1', statut: 'brouillon',
  montantHT: 500, montantTTC: 540, montantPaye: 0, dateEmission: '2026-03-01', dateEcheance: '2026-04-01',
  lignes: [{ _uid: 2, description: 'Divers', quantite: 1, prixUnitaire: 500, tva: 8.1 }] };

const renderFinances = (over = {}) => renderWithApp(
  <Finances factures={[F_PAYABLE, F_RETARD, F_BROUILLON]} onSave={vi.fn()} clients={CLIENTS} chantiers={CHANTIERS}
    devis={[]} parametres={{ employes: [], parametres: { tauxTVA: 8.1 } }} periodeGlobale="annee" pointages={[]} profil={{ id: 'cyna' }} />,
  { profil: { id: 'cyna' }, periodeGlobale: 'annee', setPeriodeGlobale: vi.fn(), naviguer: vi.fn(),
    confirmer: vi.fn(), afficherNotif: vi.fn(), ouvrirMenu: vi.fn(), ...over },
);

describe('Finances mobile — lecture seule (375px, consultationMobile)', () => {
  it('aucun bouton d\'écriture dans Factures ; ⚠ pas de Payer / Confirmer le paiement', () => {
    setLargeur(375);
    renderFinances({ consultationMobile: true });
    // hero
    expect(screen.queryByText(/Nouvelle facture/)).toBeNull();
    // Factures (toujours montée, masquée en CSS) — aucune action d'écriture
    ['Modifier', 'Émettre', 'Payer', 'Suppr', 'Annuler', 'Exporter CSV', 'Confirmer le paiement']
      .forEach(label => expect(screen.queryByText(label)).toBeNull());
    // la facture reste consultable (ligne présente)
    expect(screen.getAllByText('F-2026-001').length).toBeGreaterThan(0);
  });

  it('Relances : « Marquer envoyé » masqué, « Voir lettre » conservé', () => {
    setLargeur(375);
    renderFinances({ consultationMobile: true });
    fireEvent.click(screen.getByRole('button', { name: /Relances/ }));
    expect(screen.queryAllByText('Marquer envoyé').length).toBe(0);
    expect(screen.getAllByText('Voir lettre').length).toBeGreaterThan(0);
  });

  it('détail facture consultable, sans action d\'écriture', () => {
    setLargeur(375);
    renderFinances({ consultationMobile: true });
    // ouvrir le détail via la ligne facture (Factures est montée)
    fireEvent.click(screen.getAllByText('F-2026-001')[0].closest('tr'));
    expect(screen.getByText(/Facture F-2026-001/)).toBeInTheDocument(); // vue détail
    ['Paiement', 'Payée', 'Confirmer le paiement', 'Modifier']
      .forEach(label => expect(screen.queryByText(label)).toBeNull());
  });
});

describe('Finances desktop — non-régression (1200px)', () => {
  it('Nouvelle facture + Modifier + Payer présents', () => {
    setLargeur(1200);
    renderFinances({ consultationMobile: false });
    expect(screen.getAllByText(/Nouvelle facture/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Modifier').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Payer').length).toBeGreaterThan(0);
  });

  it('Relances : « Marquer envoyé » présent', () => {
    setLargeur(1200);
    renderFinances({ consultationMobile: false });
    fireEvent.click(screen.getByRole('button', { name: /Relances/ }));
    expect(screen.getAllByText('Marquer envoyé').length).toBeGreaterThan(0);
  });
});
