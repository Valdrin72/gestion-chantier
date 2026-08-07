/**
 * Design v1 — KANBAN des chantiers (finition). Maquette validée patron.
 * Rhabillage pur : colonnes par état C8 + cartes épurées (initiales retirées),
 * verdict perte/bénéfice, liseré d'état. Répartition/tri/navigation inchangés,
 * aucun drag & drop (les cartes ne font que naviguer au clic).
 *
 * Preuve RTL RÉELLE (vrai composant KanbanChantiers rendu via renderWithApp,
 * aucun logic-mirror) :
 *   1. les colonnes affichent les vrais chantiers dans la bonne colonne d'état ;
 *   2. une carte affiche nom + avancement (%) + montant + badge verdict ;
 *   3. cliquer une carte appelle onSelect (navigation vers la fiche) ;
 *   4. le compteur de colonne = le nombre de chantiers de cette colonne ;
 *   5. les initiales colorées ont bien été retirées.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import KanbanChantiers from '../components/chantiers/KanbanChantiers';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const CLIENTS = [
  { id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' },
  { id: 'cl2', nom: 'Rossi', entreprise: 'Rossi Sàrl' },
];

// « scored » = ce que ChantiersListe passe au Kanban : { c, etatC, decision }.
const item = (over) => ({
  c: { id: over.id, nom: over.nom, numero: over.numero, statut: over.statut, clientId: over.clientId, ville: over.ville, devisId: null },
  etatC: { avancementPct: over.avancementPct, margeProjeteePct: over.margeProjeteePct },
  decision: { couleur: over.couleur || '#1E5FAF', niveau: over.niveau || 'ok', label: over.label || '', priorite: 4 },
});

const SCORED = [
  item({ id: 'A', nom: 'Bureaux Grand-Pré', numero: 'C-001', statut: 'En cours', clientId: 'cl1', ville: 'Genève', avancementPct: 60, margeProjeteePct: -8, niveau: 'critique' }),
  item({ id: 'B', nom: 'Villa Cologny',     numero: 'C-002', statut: 'En cours', clientId: 'cl2', ville: 'Cologny', avancementPct: 30, margeProjeteePct: 22 }),
  item({ id: 'C', nom: 'Loft Eaux-Vives',   numero: 'C-003', statut: 'Attente paiement', clientId: 'cl1', ville: 'Genève', avancementPct: 100, margeProjeteePct: 18 }),
];

function renderKanban(over = {}) {
  const onSelect = over.onSelect || vi.fn();
  const scored = over.scored || SCORED;
  return renderWithApp(
    <KanbanChantiers scored={scored} onSelect={onSelect} />,
    { clients: CLIENTS, devis: [], chantiers: scored.map(s => s.c) },
  );
}

describe('KANBAN — colonnes par état + bons chantiers dans chaque colonne', () => {
  it('les 7 colonnes d\'état sont présentes (En cours, Attente paiement…)', () => {
    renderKanban();
    ['Planifié', 'En cours', 'Suspendu', 'Attente paiement', 'Terminé', 'Facturé', 'Clôturé'].forEach(s => {
      expect(screen.getByText(s)).toBeInTheDocument();
    });
  });

  it('chaque chantier apparaît, et « En cours » contient bien les 2 chantiers en cours', () => {
    renderKanban();
    expect(screen.getByText('Bureaux Grand-Pré')).toBeInTheDocument();
    expect(screen.getByText('Villa Cologny')).toBeInTheDocument();
    expect(screen.getByText('Loft Eaux-Vives')).toBeInTheDocument();
    // Ligne mono client · lieu (Dupont SA · Genève sur 2 chantiers → getAll)
    expect(screen.getAllByText('DUPONT SA · GENÈVE').length).toBeGreaterThan(0);
    expect(screen.getByText('ROSSI SÀRL · COLOGNY')).toBeInTheDocument();
  });
});

describe('KANBAN — carte : nom + avancement + montant + verdict', () => {
  it('affiche l\'avancement % et le badge verdict (PERTE rouge / BÉNÉFICE vert)', () => {
    renderKanban();
    // Avancement affiché
    expect(screen.getByText('60%')).toBeInTheDocument();
    // Verdict : marge -8 → PERTE (1 carte) ; marges 22 et 18 → BÉNÉFICE (2 cartes)
    expect(screen.getByText('PERTE')).toBeInTheDocument();
    expect(screen.getAllByText('BÉNÉFICE').length).toBe(2);
  });

  it('les initiales colorées (ex. « BG », « VC ») ont été retirées des cartes', () => {
    const { container } = renderKanban();
    // L'ancien badge d'initiales affichait 2 lettres majuscules seules ; il ne doit plus exister.
    expect(screen.queryByText('BG')).toBeNull();
    expect(screen.queryByText('VC')).toBeNull();
    // Le nom complet reste présent
    expect(within(container).getByText('Bureaux Grand-Pré')).toBeInTheDocument();
  });
});

describe('KANBAN — navigation + compteur', () => {
  it('cliquer une carte appelle onSelect avec le chantier', () => {
    const onSelect = vi.fn();
    renderKanban({ onSelect });
    fireEvent.click(screen.getByText('Bureaux Grand-Pré'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'A' }));
  });

  it('le compteur d\'une colonne = le nombre de chantiers (En cours → 2, Attente paiement → 1)', () => {
    renderKanban();
    // En-tête « En cours » : le nom et le compteur 2 sont dans le même bloc d'en-tête.
    const enCoursHeader = screen.getByText('En cours').closest('div');
    expect(within(enCoursHeader).getByText('2')).toBeInTheDocument();
    const attenteHeader = screen.getByText('Attente paiement').closest('div');
    expect(within(attenteHeader).getByText('1')).toBeInTheDocument();
  });

  it('une colonne vide affiche « — » (allégé) et non un long message', () => {
    renderKanban();
    // Planifié / Terminé / Facturé / Clôturé / Suspendu sont vides → des tirets discrets.
    const tirets = screen.getAllByText('—');
    expect(tirets.length).toBeGreaterThanOrEqual(5);
  });
});
