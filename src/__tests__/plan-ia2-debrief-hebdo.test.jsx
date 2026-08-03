/**
 * Plan directeur IA2 — les deux rendez-vous manquants du directeur :
 * DÉBRIEF DU SOIR (« qu'est-ce qui s'est passé aujourd'hui ? ») et
 * BILAN HEBDO (« comment s'est passée la semaine, que prépare la suivante ? »).
 * Règle IA3 : le cerveau LIT (pointages, factures lot 4, états C8), n'invente rien.
 * Tests RÉELS : vraies fonctions pures (calculs/directeur.js) + vrais composants.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { construireDebriefSoir, construireBilanHebdo, rendezVousParDefaut } from '../calculs/directeur';
import DirecteurBloc, { DebriefSoir, BilanHebdo } from '../components/DirecteurBloc';

// Mardi 2026-08-04 — jour ouvrable (l'alerte C4 ne vaut que les jours travaillés).
const JOUR = '2026-08-04';

const EMPLOYES = [{ id: 1, nom: 'Müller', actif: true }, { id: 2, nom: 'Rossi', actif: true }];
const CH_A = { id: 'A', nom: 'Chantier Alpha', statut: 'en cours', clientId: 'cl1', devisId: 'd1' };
const CH_B = { id: 'B', nom: 'Chantier Beta', statut: 'en cours', clientId: 'cl1', devisId: 'd2' };
const CH_SANS_POINTAGE = { id: 'C', nom: 'Chantier Gamma', statut: 'en cours', clientId: 'cl1', devisId: 'd3' };

// 3 pointages sur 2 chantiers aujourd'hui : Müller 8h Alpha, Rossi 6h Alpha + 4h Beta.
const POINTAGES_JOUR = [
  { id: 'p1', date: JOUR, employeId: 1, repartitions: [{ chantierId: 'A', categorie: 'production', heures: 8 }] },
  { id: 'p2', date: JOUR, employeId: 2, repartitions: [{ chantierId: 'A', categorie: 'production', heures: 6 }] },
  { id: 'p3', date: JOUR, employeId: 2, repartitions: [{ chantierId: 'B', categorie: 'atelier', heures: 4 }] },
];

// 1 paiement reçu aujourd'hui (15'000 sur FAC-9, chantier Alpha).
const FACTURE_PAYEE_AUJOURDHUI = {
  id: 'F9', numero: 'FAC-9', chantierId: 'A', clientId: 'cl1', statut: 'partielle',
  montantTTC: 40000, montantPaye: 15000, dateEmission: '2026-07-20', dateEcheance: '2026-08-20',
  paiementsHistorique: [{ id: 'h1', montant: 15000, date: JOUR, mode: 'Virement' }],
};

describe('MORDANT débrief — heures par chantier, paiement du jour, alerte C4', () => {
  const debrief = construireDebriefSoir({
    chantiers: [CH_A, CH_B, CH_SANS_POINTAGE],
    factures: [FACTURE_PAYEE_AUJOURDHUI],
    pointages: POINTAGES_JOUR,
    parametres: { employes: EMPLOYES },
    date: JOUR,
  });

  it('3 pointages sur 2 chantiers → 18h total, Alpha 14h (Müller 8 + Rossi 6), Beta 4h', () => {
    expect(debrief.heuresTotal).toBe(18);
    const alpha = debrief.parChantier.find(c => c.nom === 'Chantier Alpha');
    const beta = debrief.parChantier.find(c => c.nom === 'Chantier Beta');
    expect(alpha.heures).toBe(14);
    expect(alpha.parEmploye).toEqual(expect.arrayContaining([
      { nom: 'Müller', heures: 8 }, { nom: 'Rossi', heures: 6 },
    ]));
    expect(beta.heures).toBe(4);
  });

  it('le paiement reçu aujourd\'hui apparaît (15\'000, FAC-9, chantier Alpha)', () => {
    expect(debrief.paiementsRecus.total).toBe(15000);
    expect(debrief.paiementsRecus.liste[0]).toMatchObject({ montant: 15000, factureNumero: 'FAC-9', chantierNom: 'Chantier Alpha' });
  });

  it('MORDANT C4 : le chantier en cours SANS pointage du jour déclenche « pas encore pointé »', () => {
    expect(debrief.pointagesManquants).toHaveLength(1);
    expect(debrief.pointagesManquants[0].nom).toBe('Chantier Gamma');
    // Et pas les chantiers pointés :
    expect(debrief.pointagesManquants.some(m => m.nom === 'Chantier Alpha')).toBe(false);
  });

  it('IA3 : un dimanche, pas de fausse alerte pointage (jour non ouvrable)', () => {
    const dimanche = construireDebriefSoir({ chantiers: [CH_SANS_POINTAGE], factures: [], pointages: [], parametres: {}, date: '2026-08-02' });
    expect(dimanche.pointagesManquants).toHaveLength(0);
  });

  it('le composant DebriefSoir AFFICHE heures, paiement et alerte (vrai rendu)', () => {
    renderWithApp(<DebriefSoir debrief={debrief} naviguer={vi.fn()} />, {});
    expect(screen.getByText(/Heures pointées aujourd'hui — 18h/)).toBeInTheDocument();
    expect(screen.getByText('Chantier Alpha')).toBeInTheDocument();
    expect(screen.getByText(/\+ CHF 15'000/)).toBeInTheDocument();
    expect(screen.getByText(/Pointage manquant aujourd'hui/)).toBeInTheDocument();
    expect(screen.getByText(/Chantier Gamma/)).toBeInTheDocument();
  });
});

describe('MORDANT hebdo — heures totales, CA encaissé, actions de la semaine à venir', () => {
  // Semaine écoulée (fenêtre 7 j avant le 2026-08-04) : 3 jours × 8h Müller + paiement 15'000.
  const POINTAGES_SEMAINE = ['2026-07-29', '2026-07-30', '2026-07-31'].map((d, i) => ({
    id: `s${i}`, date: d, employeId: 1, repartitions: [{ chantierId: 'A', categorie: 'production', heures: 8 }],
  }));
  // Semaine précédente (fenêtre −14 → −7 j) : 2 jours × 8h → comparaison.
  const POINTAGES_SEM_PREC = ['2026-07-22', '2026-07-23'].map((d, i) => ({
    id: `q${i}`, date: d, employeId: 1, repartitions: [{ chantierId: 'A', categorie: 'production', heures: 8 }],
  }));
  const BRIEFING = { actionsAvantLundi: [
    { priorite: 'URGENT', icone: '💰', action: 'Relancer Dupont — FAC-9', detail: 'Impayée depuis 40 jours' },
    { priorite: 'NOTE', icone: '📋', action: 'Action mineure', detail: '' },
  ] };
  const FACT_PAIEMENT_SEMAINE = { ...FACTURE_PAYEE_AUJOURDHUI, paiementsHistorique: [{ id: 'h1', montant: 15000, date: '2026-07-30' }] };

  const bilan = construireBilanHebdo({
    chantiers: [CH_A, { ...CH_B, statut: 'Attente paiement', dateFinTravaux: '2026-07-30' }],
    factures: [FACT_PAIEMENT_SEMAINE],
    pointages: [...POINTAGES_SEMAINE, ...POINTAGES_SEM_PREC],
    briefing: BRIEFING,
    date: JOUR,
  });

  it('heures de la semaine (24h) vs précédente (16h) → +50%', () => {
    expect(bilan.heuresSemaine).toBe(24);
    expect(bilan.heuresSemainePrec).toBe(16);
    expect(bilan.deltaHeuresPct).toBe(50);
  });

  it('CA encaissé de la semaine = 15\'000 (paiements réels, source factures)', () => {
    expect(bilan.caEncaisseSemaine).toBe(15000);
  });

  it('chantier passé « travaux terminés » cette semaine compté ; actions de la semaine à venir reprises du matin (URGENT/IMPORTANT seulement)', () => {
    expect(bilan.chantiersFinis.some(c => c.nom === 'Chantier Beta')).toBe(true);
    expect(bilan.actionsSemaine).toHaveLength(1);
    expect(bilan.actionsSemaine[0].action).toBe('Relancer Dupont — FAC-9');
  });

  it('le composant BilanHebdo AFFICHE les chiffres (vrai rendu)', () => {
    renderWithApp(<BilanHebdo bilan={bilan} naviguer={vi.fn()} />, {});
    expect(screen.getByText('24h')).toBeInTheDocument();
    expect(screen.getByText(/CHF 15'000/)).toBeInTheDocument();
    expect(screen.getByText(/Relancer Dupont — FAC-9/)).toBeInTheDocument();
  });

  it('point dur : un impayé qui franchit 30 j cette semaine remonte', () => {
    // Échéance il y a 32 jours → a franchi le seuil 30 dans la fenêtre des 7 derniers jours.
    const impayeeVieillie = { id: 'FV', numero: 'FAC-V', chantierId: 'A', clientId: 'cl1', statut: 'envoyee',
      montantTTC: 8000, montantPaye: 0, dateEmission: '2026-06-25', dateEcheance: '2026-07-03' };
    const b = construireBilanHebdo({ chantiers: [], factures: [impayeeVieillie], pointages: [], briefing: null, date: JOUR });
    expect(b.impayesVieillis).toHaveLength(1);
    expect(b.impayesVieillis[0]).toMatchObject({ numero: 'FAC-V', seuil: 30, restant: 8000 });
  });
});

describe('MORDANT rendez-vous du moment — le bloc montre le bon rendez-vous', () => {
  const CTX = {
    chantiers: [CH_A], factures: [], pointages: [], parametres: { employes: EMPLOYES },
    agentState: { briefingMatin: null, scoreGlobal: null },
  };

  it('avant 14h → le briefing du MATIN est affiché par défaut', () => {
    renderWithApp(<DirecteurBloc naviguer={vi.fn()} maintenant={new Date('2026-08-04T09:00:00')} />, CTX);
    expect(screen.getByTestId('directeur-matin')).toBeInTheDocument();
    expect(screen.queryByTestId('debrief-soir')).toBeNull();
  });

  it('après 14h → le DÉBRIEF DU SOIR est affiché par défaut', () => {
    renderWithApp(<DirecteurBloc naviguer={vi.fn()} maintenant={new Date('2026-08-04T18:30:00')} />, CTX);
    expect(screen.getByTestId('debrief-soir')).toBeInTheDocument();
    expect(screen.queryByTestId('directeur-matin')).toBeNull();
  });

  it('les 3 onglets naviguent : clic « Hebdo » → bilan affiché', () => {
    renderWithApp(<DirecteurBloc naviguer={vi.fn()} maintenant={new Date('2026-08-04T09:00:00')} />, CTX);
    fireEvent.click(screen.getByRole('button', { name: /Hebdo/i }));
    expect(screen.getByTestId('bilan-hebdo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Matin/i }));
    expect(screen.getByTestId('directeur-matin')).toBeInTheDocument();
  });

  it('rendezVousParDefaut : 13h59 → matin, 14h00 → soir', () => {
    expect(rendezVousParDefaut(new Date('2026-08-04T13:59:00'))).toBe('matin');
    expect(rendezVousParDefaut(new Date('2026-08-04T14:00:00'))).toBe('soir');
  });
});
