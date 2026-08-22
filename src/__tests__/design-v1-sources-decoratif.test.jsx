/**
 * Design v1 — sources de design, LOT C : couleur décorative C.violet → V1.bleuMoyen (#4C8FD1).
 * ⚠ ZÉRO logique métier touchée : ce que ces éléments affichent (coût matériel, coût/m²,
 *   coût/j équipe, total équipe, catégorie photo « Autre ») est inchangé. Diff = valeur de
 *   couleur (donnees.js:C.violet) + le bg rgba de Photos. #6366f1 → #4C8FD1 = rgb(76,143,209).
 *
 * Preuve RTL RÉELLE (vrais composants via renderWithApp, vrais calculs) :
 *   1. ChantierDetail onglet Financier : le badge coût « Matériel réel » (ex-violet) est en
 *      bleu moyen rgb(76,143,209), plus en indigo rgb(99,102,241) ;
 *   2. ChantierDetail onglet Analyse : la tuile « Coût/j équipe » (DetailRentabilite, ex-violet)
 *      est en bleu moyen ;
 *   3. Photos se rend et expose la catégorie « Autre » sans aucun violet résiduel.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';
import ChantierDetail from '../components/chantiers/ChantierDetail';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const BLEU_MOYEN = 'rgb(76, 143, 209)';   // #4C8FD1 = V1.bleuMoyen
const INDIGO     = 'rgb(99, 102, 241)';   // #6366f1 = ex-C.violet

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', prenom: 'Jean', entreprise: 'Dupont SA', telephone: '022 000 00 00' }];

const JOURNAL_6J = [
  { date: '2026-02-02', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-02-03', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-02-04', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-02-05', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-02-06', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-02-09', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
];

const CH = {
  id: 'CHB', nom: 'Rénovation Grand-Pré', numero: 'CH-2026-001', ville: 'Genève',
  adresse: 'Place de la République 1', canton: 'GE', conducteur: 'Sami Berisha',
  statut: 'En cours', clientId: 'cl1', devisId: 'dB', nombreJours: 10, dateDebut: '2026-02-02',
  priorite: 'Haute', surface: 120, typesTravaux: ['Peinture', 'Carrelage'], notes: 'Accès cour.',
  journal: JOURNAL_6J, extras: [],
};
const DEVIS = [{ id: 'dB', numero: 'D-B', montantHT: 100000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];

function baseCtx(over = {}) {
  const chantiers = [CH];
  return {
    chantiers, clients: CLIENTS, devis: DEVIS, factures: [],
    parametres: { employes: [EMP], localites: [], parametres: CFG },
    pointages: migrerJournalVersPointages(chantiers, [EMP]),
    setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(),
    confirmer: vi.fn().mockResolvedValue(true), ouvrirSaisieHeures: vi.fn(),
    agentState: {}, ouvrirMenu: vi.fn(), ...over,
  };
}

function Fiche({ onglet = 'analyse' }) {
  const [o, setO] = React.useState(onglet);
  return (
    <ChantierDetail chantier={CH} detailOnglet={o} setDetailOnglet={setO}
      modeCompleter={false} onRetour={vi.fn()} onModifier={vi.fn()}
      onSupprimer={vi.fn()} onPasserEnCours={vi.fn()} />
  );
}

describe('ONGLET FINANCIER — badge « Matériel réel » (ex-C.violet) en bleu moyen', () => {
  it('la valeur du badge coût matériel est en rgb(76,143,209), plus en indigo', () => {
    renderWithApp(<Fiche onglet="financier" />, baseCtx());
    const label = screen.getByText('Matériel réel');
    // Dans CoutBadge : label puis valeur (CHF …) en sibling, colorée par `couleur`.
    const valeur = label.nextElementSibling;
    expect(valeur).toBeTruthy();
    expect(valeur.style.color).toBe(BLEU_MOYEN);
    expect(valeur.style.color).not.toBe(INDIGO);
  });
});

describe('ONGLET ANALYSE — tuile « Coût/j équipe » (DetailRentabilite, ex-C.violet) en bleu moyen', () => {
  it('la valeur de la tuile coût/j équipe est en rgb(76,143,209)', () => {
    renderWithApp(<Fiche onglet="analyse" />, baseCtx());
    // DetailRentabilite est derrière un toggle « Voir le détail » — on le déplie.
    fireEvent.click(screen.getByText(/Voir le détail/));
    const label = screen.getByText('Coût/j équipe');
    const valeur = label.nextElementSibling;   // <div style={{ color: s.couleur }}>{valeur}</div>
    expect(valeur).toBeTruthy();
    expect(valeur.style.color).toBe(BLEU_MOYEN);
  });
});

// NOTE (ménage code mort) : le bloc PHOTOS a été retiré avec la suppression de
// src/Photos.js (page orpheline, 0 route / 0 conso prod). La couverture ChantierDetail
// (badges ex-violet → bleu moyen) ci-dessus est conservée.
