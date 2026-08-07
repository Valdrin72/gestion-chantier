/**
 * Design v1 — FICHE CHANTIER (détail), maquette OPTION 3 validée par le patron :
 * hero bleu nuit + VERDICT dans le hero + 3 onglets (Analyse / Financier / Détail)
 * + actions « Que faire » sous le hero.
 *
 * Preuve RTL RÉELLE (aucun logic-mirror) : vrai composant ChantierDetail rendu via
 * renderWithApp, vrais pointages issus de migrerJournalVersPointages, vrais calculs
 * (useChantierCalculs). On prouve :
 *   1. le hero affiche le nom + le VERDICT correct selon l'état (perte ROUGE / bénéfice VERT) ;
 *   2. les 3 indicateurs portent les vraies valeurs (rentabilité / avancement / planning) ;
 *   3. les 3 onglets basculent (Analyse ↔ Financier ↔ Détail) ;
 *   4. « Travaux terminés » garde son garde-fou C8 (non payé → « Passer en Terminé » absent) ;
 *   5. onglet Détail : le libellé ET la valeur sont bien SÉPARÉS (bug d'affichage corrigé).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
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

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', prenom: 'Jean', entreprise: 'Dupont SA', telephone: '022 000 00 00' }];

// Journal : 6 jours réalisés d'un employé (400/j) → coût réel 2400, avancement 60 % sur 10 j prévus.
const JOURNAL_6J = [
  { date: '2026-02-02', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-02-03', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-02-04', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-02-05', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-02-06', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-02-09', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
];

// PROFIT : devis 100'000, coût réel modeste → EAC ≈ 4000 ⇒ bénéfice estimé largement positif.
const CH_BENEF = {
  id: 'CHB', nom: 'Rénovation Grand-Pré', numero: 'CH-2026-001', ville: 'Genève',
  adresse: 'Place de la République 1', canton: 'GE', conducteur: 'Sami Berisha',
  statut: 'En cours', clientId: 'cl1', devisId: 'dB', nombreJours: 10, dateDebut: '2026-02-02',
  priorite: 'Haute', surface: 120, typesTravaux: ['Peinture', 'Carrelage'], notes: 'Accès par la cour intérieure.',
  journal: JOURNAL_6J, extras: [],
};
// PERTE : même chantier réel mais devis famélique 3'000 → EAC ≈ 4000 > CA ⇒ perte estimée.
const CH_PERTE = { ...CH_BENEF, id: 'CHP', nom: 'Chantier à perte', numero: 'CH-2026-002', devisId: 'dP' };

const DEVIS = [
  { id: 'dB', numero: 'D-B', montantHT: 100000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] },
  { id: 'dP', numero: 'D-P', montantHT: 3000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] },
];

function baseCtx(over = {}) {
  const chantiers = over.chantiers || [CH_BENEF, CH_PERTE];
  return {
    chantiers, clients: CLIENTS, devis: DEVIS, factures: over.factures ?? [],
    parametres: { employes: [EMP], localites: [], parametres: CFG },
    pointages: migrerJournalVersPointages(chantiers, [EMP]),
    setChantiers: over.setChantiers || vi.fn(), naviguer: over.naviguer || vi.fn(),
    afficherNotif: vi.fn(), confirmer: over.confirmer || vi.fn().mockResolvedValue(true),
    ouvrirSaisieHeures: vi.fn(), agentState: {}, ouvrirMenu: over.ouvrirMenu || vi.fn(),
    ...over.ctx,
  };
}

// Harness stateful : gère l'onglet actif comme le fait ChantiersPage.
function Fiche({ chantier, onglet = 'analyse', ...props }) {
  const [o, setO] = React.useState(onglet);
  return (
    <ChantierDetail chantier={chantier} detailOnglet={o} setDetailOnglet={setO}
      modeCompleter={false} onRetour={vi.fn()} onModifier={vi.fn()}
      onSupprimer={vi.fn()} onPasserEnCours={vi.fn()} {...props} />
  );
}

describe('HERO — nom + VERDICT selon l\'état (perte ROUGE / bénéfice VERT)', () => {
  it('chantier rentable → hero « BÉNÉFICE ESTIMÉ À LA FIN » + montant VERT signé +', () => {
    renderWithApp(<Fiche chantier={CH_BENEF} />, baseCtx());
    const hero = screen.getByTestId('hero-chantier');
    // Nom du chantier dans le hero
    expect(within(hero).getByText('Rénovation Grand-Pré')).toBeInTheDocument();
    // Ligne mono : référence
    expect(within(hero).getByText(/CH-2026-001/)).toBeInTheDocument();
    // Verdict bénéfice
    const verdict = screen.getByTestId('hero-verdict');
    expect(within(verdict).getByText('BÉNÉFICE ESTIMÉ À LA FIN')).toBeInTheDocument();
    const montant = screen.getByTestId('verdict-montant');
    expect(montant.textContent).toMatch(/^\+CHF/);
    // Couleur VERTE (HERO_OK #4ADE80 → rgb(74, 222, 128))
    expect(montant.style.color).toBe('rgb(74, 222, 128)');
  });

  it('chantier à perte → hero « PERTE ESTIMÉE À LA FIN » + montant ROUGE signé −', () => {
    renderWithApp(<Fiche chantier={CH_PERTE} />, baseCtx());
    const verdict = screen.getByTestId('hero-verdict');
    expect(within(verdict).getByText('PERTE ESTIMÉE À LA FIN')).toBeInTheDocument();
    const montant = screen.getByTestId('verdict-montant');
    expect(montant.textContent).toMatch(/^−CHF/);
    // Couleur ROUGE (HERO_DANGER #FF7A6B → rgb(255, 122, 107))
    expect(montant.style.color).toBe('rgb(255, 122, 107)');
  });
});

describe('HERO — 3 indicateurs avec les VRAIES valeurs', () => {
  it('Rentabilité / Avancement (60 %) / Planning (4 j restants) issus des vrais calculs', () => {
    renderWithApp(<Fiche chantier={CH_BENEF} />, baseCtx());
    // Avancement réel : 6 j réalisés / 10 prévus = 60 %
    expect(within(screen.getByTestId('hero-ind-av')).getByText('60%')).toBeInTheDocument();
    // Planning : 10 − 6 = 4 j restants
    expect(within(screen.getByTestId('hero-ind-plan')).getByText('4j restants')).toBeInTheDocument();
    // Rentabilité : tuile présente avec un % (marge projetée positive)
    const renta = screen.getByTestId('hero-ind-renta');
    expect(within(renta).getByText('RENTABILITÉ')).toBeInTheDocument();
    expect(within(renta).getByText(/%$/)).toBeInTheDocument();
  });
});

describe('ONGLETS — bascule Analyse / Financier / Détail', () => {
  it('cliquer « Financier » puis « Détail » change le contenu affiché sous le hero', () => {
    renderWithApp(<Fiche chantier={CH_BENEF} onglet="analyse" />, baseCtx());
    // Analyse par défaut : la zone « Que faire » / recommandations, pas la carte Financier.
    expect(screen.queryByText('Détail du chantier')).toBeNull();

    // → Financier
    fireEvent.click(screen.getByRole('button', { name: 'Financier' }));
    expect(screen.getByText('Extras / travaux imprévus')).toBeInTheDocument();
    expect(screen.getByText('CA signé')).toBeInTheDocument();

    // → Détail
    fireEvent.click(screen.getByRole('button', { name: 'Détail' }));
    expect(screen.getByText('Détail du chantier')).toBeInTheDocument();
    // La carte Financier n'est plus rendue
    expect(screen.queryByText('Extras / travaux imprévus')).toBeNull();
  });
});

describe('C8 — « Travaux terminés » garde son garde-fou (non payé)', () => {
  it('chantier actif → bouton « Travaux terminés » présent dans le hero', () => {
    renderWithApp(<Fiche chantier={CH_BENEF} />, baseCtx());
    const hero = screen.getByTestId('hero-chantier');
    expect(within(hero).getByRole('button', { name: /Travaux terminés/i })).toBeInTheDocument();
  });

  it('chantier « Attente paiement » avec facture impayée → bandeau + « Passer en Terminé » ABSENT', () => {
    const attente = { ...CH_BENEF, statut: 'Attente paiement', dateFinTravaux: '2026-02-10' };
    const FACT_IMPAYEE = { id: 'F1', numero: 'FAC-1', chantierId: 'CHB', clientId: 'cl1', devisId: 'dB',
      statut: 'envoyee', montantTTC: 30000, montantPaye: 0, dateEmission: '2026-02-11', dateEcheance: '2026-03-11' };
    renderWithApp(<Fiche chantier={attente} onglet="financier" />,
      baseCtx({ chantiers: [attente], factures: [FACT_IMPAYEE] }));
    expect(screen.getByText(/Travaux terminés — en attente de paiement/)).toBeInTheDocument();
    expect(screen.getByText(/30'000 pas encore encaissés/)).toBeInTheDocument();
    // Garde-fou : impossible de clôturer tant que ce n'est pas payé.
    expect(screen.queryByRole('button', { name: /Passer en Terminé/i })).toBeNull();
  });
});

describe('ONGLET DÉTAIL — libellé ET valeur bien SÉPARÉS (bug d\'affichage corrigé)', () => {
  it('« Adresse » est un élément distinct de sa valeur « Place de la République 1, Genève »', () => {
    renderWithApp(<Fiche chantier={CH_BENEF} onglet="detail" />, baseCtx());
    // Le libellé existe seul (textContent === 'Adresse', jamais collé à la valeur)
    const labelAdresse = screen.getByText('Adresse');
    expect(labelAdresse.textContent).toBe('Adresse');
    // La valeur existe dans un AUTRE élément
    const valeurAdresse = screen.getByText('Place de la République 1, Genève (GE)');
    expect(valeurAdresse).toBeInTheDocument();
    expect(valeurAdresse).not.toBe(labelAdresse);
    // Le bug historique (libellé collé à la valeur) est absent
    expect(screen.queryByText('AdressePlace de la République 1, Genève (GE)')).toBeNull();
  });

  it('« Début » et sa date « 2026-02-02 » sont des éléments distincts', () => {
    renderWithApp(<Fiche chantier={CH_BENEF} onglet="detail" />, baseCtx());
    const labelDebut = screen.getByText('Début');
    expect(labelDebut.textContent).toBe('Début');
    expect(screen.getByText('2026-02-02')).toBeInTheDocument();
    // Dir. travaux séparé de sa valeur
    expect(screen.getByText('Dir. travaux').textContent).toBe('Dir. travaux');
    expect(screen.getByText('Sami Berisha')).toBeInTheDocument();
  });
});
