/**
 * Unification des paiements sur les FACTURES (source unique, cloud).
 *
 * L'onglet « Paiements chantiers » et le store localStorage `cyna_paiements` sont
 * supprimés : tout le « payé / encaissé » d'un chantier se lit UNIQUEMENT depuis
 * ses factures. Ces mordants prouvent qu'UN SEUL nombre circule partout (fiche
 * chantier, Finances, rapport hebdo) et que les lecteurs recâblés lisent bien les
 * factures (jamais 0/NaN). Tests RÉELS : vraies fonctions exportées + vrais
 * composants rendus via renderWithApp (aucun logic-mirror).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { montantPayeChantier, resumePaiementsFactures, calculerStatutFacture } from '../donnees';
import { projeterTresorerie30j } from '../calculs/tresorerie';
import ChantierDetail from '../components/chantiers/ChantierDetail';
import Rapport from '../Rapport';
import Factures from '../Factures';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const CLIENT = { id: '1', nom: 'Dupont', entreprise: 'Dupont SA', type: 'prive' };
const DEVIS  = { id: 'D1', numero: 'D-1', montantHT: 10000, statut: 'Accepté', clientId: '1' };
const CHANTIER = { id: 'CH1', nom: 'Chantier Preuve', numero: 'C-001', statut: 'en cours',
  nombreJours: 10, devisId: 'D1', clientId: '1', dateDebut: '2026-03-02' };

// Une facture partiellement payée : facturé 8000, payé 5000.
const FACTURE_PARTIELLE = {
  id: 'F1', numero: 'FAC-001', clientId: '1', chantierId: 'CH1', devisId: 'D1',
  statut: 'partielle', type: 'situation',
  montantHT: 7400, tva: 8.1, montantTTC: 8000, montantPaye: 5000,
  dateEmission: '2026-03-01', dateEcheance: '2026-12-31',
  paiementsHistorique: [{ id: 'h1', montant: 5000, date: '2026-03-10', mode: 'Virement' }],
  lignes: [{ description: 'Situation 1', quantite: 1, prixUnitaire: 7400, tva: 8.1 }],
};

// ════════════════════════════════════════════════════════════════════════════
// MORDANT 1 — SOURCE UNIQUE : le « payé » se calcule depuis les factures
// ════════════════════════════════════════════════════════════════════════════
describe('MORDANT 1 — montantPayeChantier / resumePaiementsFactures : une seule vérité', () => {
  it('le payé d\'un chantier = Σ payé de ses factures (5000)', () => {
    expect(montantPayeChantier([FACTURE_PARTIELLE], 'CH1')).toBe(5000);
    expect(resumePaiementsFactures([FACTURE_PARTIELLE]).recus).toBe(5000);
  });

  it('MORDANT anti-double-comptage : historique OU scalaire, jamais les deux additionnés', () => {
    const viaHistorique = { id: 'A', chantierId: 'CH1', montantPaye: 0, paiementsHistorique: [{ montant: 3000 }] };
    const viaScalaire   = { id: 'B', chantierId: 'CH1', montantPaye: 3000 };
    expect(montantPayeChantier([viaHistorique], 'CH1')).toBe(3000);
    expect(montantPayeChantier([viaScalaire], 'CH1')).toBe(3000);
    // une facture qui a les DEUX (historique 3000 + scalaire 3000) ne compte pas 6000.
    const lesDeux = { id: 'C', chantierId: 'CH1', montantPaye: 3000, paiementsHistorique: [{ montant: 3000 }] };
    expect(montantPayeChantier([lesDeux], 'CH1')).toBe(3000);
  });

  it('résumé factures : en attente / en retard cohérents avec Finances', () => {
    // FACTURE_PARTIELLE : reste 3000 dû, échéance future → « en attente », pas « en retard ».
    const r = resumePaiementsFactures([FACTURE_PARTIELLE]);
    expect(r.recus).toBe(5000);
    expect(r.attente).toBe(3000);
    expect(r.retard).toBe(0);
    // même facture mais échue → bascule intégralement en retard.
    const echue = { ...FACTURE_PARTIELLE, dateEcheance: '2020-01-01' };
    const r2 = resumePaiementsFactures([echue]);
    expect(r2.retard).toBe(3000);
    expect(r2.attente).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MORDANT 2 — UN SEUL NOMBRE PARTOUT : fiche chantier == Rapport == helper
// ════════════════════════════════════════════════════════════════════════════
const ctx = {
  chantiers: [CHANTIER], devis: [DEVIS], clients: [CLIENT], factures: [FACTURE_PARTIELLE],
  parametres: { employes: [], localites: [], parametres: { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 } },
  pointages: [], profil: { id: 'cyna', pages: ['chantiers', 'rapport'] }, agentState: { alertes: [], patterns: {} },
};

describe('MORDANT 2 — le « payé » est IDENTIQUE sur la fiche chantier et dans le rapport', () => {
  it('fiche chantier (onglet Financier) affiche le payé lu des factures : CHF 5\'000', () => {
    renderWithApp(<ChantierDetail chantier={CHANTIER} detailOnglet="financier" />, ctx);
    // La tuile « Payé » et sa barre montrent 5'000 (Σ payé des factures du chantier).
    expect(screen.getAllByText(/5'000/).length).toBeGreaterThan(0);
  });

  it('le rapport hebdo affiche le MÊME encaissé (5\'000 reçus), sans paiementsData', () => {
    // Rapport ne reçoit AUCUN paiementsData — uniquement les factures (source unique).
    renderWithApp(
      <Rapport chantiers={[CHANTIER]} clients={[CLIENT]} devis={[DEVIS]} parametres={ctx.parametres} factures={[FACTURE_PARTIELLE]} />,
      ctx,
    );
    expect(screen.getAllByText(/5'000/).length).toBeGreaterThan(0);
  });

  it('MORDANT anti-NaN : rapport sans facture rend « reçus » à 0, jamais NaN', () => {
    const { container } = renderWithApp(
      <Rapport chantiers={[CHANTIER]} clients={[CLIENT]} devis={[DEVIS]} parametres={ctx.parametres} factures={[]} />,
      { ...ctx, factures: [] },
    );
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).not.toContain('undefined');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MORDANT 3 — le bouton « Payée » fait monter le payé du chantier (sur la facture)
// ════════════════════════════════════════════════════════════════════════════
describe('MORDANT 3 — bouton « Payée » : le montant atterrit SUR LA FACTURE, visible partout', () => {
  const FACTURE_ENVOYEE = {
    id: 'FE', numero: 'FAC-100', clientId: '1', chantierId: 'CH1', devisId: 'D1',
    statut: 'envoyee', type: 'situation',
    montantHT: 9259, tva: 8.1, montantTTC: 10000, montantPaye: 0,
    dateEmission: '2026-03-01', dateEcheance: '2026-12-31',
    paiementsHistorique: [], lignes: [{ description: 'Situation', quantite: 1, prixUnitaire: 9259, tva: 8.1 }],
  };

  it('cliquer « Payée » solde la facture (montantPaye = TTC) et le payé chantier passe à 10\'000', () => {
    const onSave = vi.fn();
    renderWithApp(
      <Factures factures={[FACTURE_ENVOYEE]} onSave={onSave} clients={[CLIENT]} chantiers={[CHANTIER]}
        devis={[DEVIS]} profil={{ id: 'cyna', pages: ['finances'], role: 'cyna' }} periodeGlobale="annee"
        parametres={{ employes: [] }} naviguer={vi.fn()} />,
      {},
    );

    // Ouvrir le détail de la facture, puis cliquer « Payée ».
    const row = screen.getAllByRole('row').find(r => r.textContent?.includes('FAC-100'));
    fireEvent.click(row);
    fireEvent.click(screen.getByRole('button', { name: 'Payée' }));

    // Le paiement est enregistré SUR LA FACTURE (montantPaye = TTC, statut payee).
    const listeSauvee = onSave.mock.calls[0][0];
    const factureMAJ = listeSauvee.find(x => x.id === 'FE');
    expect(factureMAJ.montantPaye).toBe(10000);
    expect(factureMAJ.statut).toBe('payee');

    // Et la source unique reflète la hausse partout : payé chantier = 10'000.
    expect(montantPayeChantier(listeSauvee, 'CH1')).toBe(10000);
    expect(resumePaiementsFactures(listeSauvee).recus).toBe(10000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MORDANT 4 — F4 : PAIEMENT PARTIEL (45'000 → 20'000 → reste 25'000 → 25'000 → payée)
// ════════════════════════════════════════════════════════════════════════════
describe('MORDANT 4 (F4) — paiement partiel : reste dû calculé, « payée » seulement à 0', () => {
  const FACTURE_45K = {
    id: 'F45', numero: 'FAC-045', clientId: '1', chantierId: 'CH1', devisId: 'D1',
    statut: 'envoyee', type: 'situation',
    montantHT: 41628, tva: 8.1, montantTTC: 45000, montantPaye: 0,
    dateEmission: '2026-07-01', dateEcheance: '2026-12-31',
    paiementsHistorique: [], lignes: [{ description: 'Situation 1', quantite: 1, prixUnitaire: 41628, tva: 8.1 }],
  };

  it('vrai modal Factures : paiement de 20\'000 → montantPaye 20\'000, statut « partielle », PAS « payée »', () => {
    const onSave = vi.fn();
    renderWithApp(
      <Factures factures={[FACTURE_45K]} onSave={onSave} clients={[CLIENT]} chantiers={[CHANTIER]}
        devis={[DEVIS]} profil={{ id: 'cyna', pages: ['finances'], role: 'cyna' }} periodeGlobale="annee"
        parametres={{ employes: [] }} naviguer={vi.fn()} />,
      {},
    );
    // Ouvrir le détail → bouton Paiement → saisir 20'000 → confirmer.
    const row = screen.getAllByRole('row').find(r => r.textContent?.includes('FAC-045'));
    fireEvent.click(row);
    fireEvent.click(screen.getAllByRole('button', { name: 'Paiement' })[0]);
    fireEvent.change(screen.getByPlaceholderText(/Solde :/), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmer le paiement/ }));

    const factureMAJ = onSave.mock.calls[0][0].find(x => x.id === 'F45');
    expect(factureMAJ.montantPaye).toBe(20000);
    expect(factureMAJ.statut).toBe('partielle');           // PAS « payée » : reste dû 25'000
    expect(factureMAJ.paiementsHistorique).toHaveLength(1);
    expect(factureMAJ.paiementsHistorique[0].montant).toBe(20000);
    // Reste dû = facturé − payé = 25'000.
    expect((factureMAJ.montantTTC - factureMAJ.montantPaye)).toBe(25000);
    // CA encaissé : +20'000 EXACTEMENT, au franc près (F4).
    expect(resumePaiementsFactures(onSave.mock.calls[0][0]).recus).toBe(20000);
    expect(montantPayeChantier(onSave.mock.calls[0][0], 'CH1')).toBe(20000);
  });

  it('second paiement de 25\'000 → reste dû 0, statut « payée » (moteur calculerStatutFacture)', () => {
    const apresPartiel = { ...FACTURE_45K, montantPaye: 20000, statut: 'partielle',
      paiementsHistorique: [{ id: 'h1', montant: 20000, date: '2026-07-10' }] };
    expect(calculerStatutFacture(apresPartiel)).toBe('partielle'); // toujours pas payée
    const apresSolde = { ...apresPartiel, montantPaye: 45000, statut: 'payee',
      paiementsHistorique: [...apresPartiel.paiementsHistorique, { id: 'h2', montant: 25000, date: '2026-07-20' }] };
    expect(calculerStatutFacture(apresSolde)).toBe('payee');       // reste dû = 0 → payée
    expect(resumePaiementsFactures([apresSolde]).recus).toBe(45000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MORDANT 5 — F7/T1 : le paiement partiel alimente la trésorerie du montant payé
// ════════════════════════════════════════════════════════════════════════════
describe('MORDANT 5 (F7/T1) — trésorerie : seuls les paiements clients comptent, au franc près', () => {
  const maintenant = new Date('2026-07-15').getTime();
  const AVANT = { id: 'FT', numero: 'FAC-T', chantierId: 'CH1', clientId: '1',
    statut: 'envoyee', montantTTC: 45000, montantPaye: 0,
    dateEmission: '2026-07-01', dateEcheance: '2026-07-30' };
  const APRES_PARTIEL = { ...AVANT, statut: 'partielle', montantPaye: 20000 };

  it('cash reçu : +20\'000 exactement après le paiement partiel (T1 : paiements clients uniquement)', () => {
    expect(resumePaiementsFactures([AVANT]).recus).toBe(0);
    expect(resumePaiementsFactures([APRES_PARTIEL]).recus).toBe(20000);
  });

  it('projection 30j (vraie fonction) : l\'attendu passe de 45\'000 à 25\'000 — diminué du montant payé', () => {
    const avant = projeterTresorerie30j({ factures: [AVANT], parametres: {}, maintenant });
    const apres = projeterTresorerie30j({ factures: [APRES_PARTIEL], parametres: {}, maintenant });
    expect(avant.encaissements30jBrut).toBe(45000);
    expect(apres.encaissements30jBrut).toBe(25000);   // = 45'000 − 20'000 payés (F7)
    expect(avant.encaissements30jBrut - apres.encaissements30jBrut).toBe(20000);
  });
});
