/**
 * Design v1 — Assistant Devis IA (AssistantDevisIA.js), panneau IA du formulaire « Nouveau devis ».
 * ⚠ MONEY-CRITICAL : suggère montant HT médian / durée / marge basés sur l'historique, avec
 *   des boutons « Appliquer » qui reportent les valeurs dans le devis (onApply). ZÉRO logique
 *   touchée — rhabillage pur (JSX + styles), violet → bleu CYNA.
 *
 * Preuve RTL RÉELLE (vrai composant AssistantDevisIA via renderWithApp) :
 *   1. déplier affiche l'en-tête, le badge « Basé sur N chantiers », le sélecteur, les stats ;
 *   2. montant médian / durée / marge affichés aux vraies valeurs ;
 *   3. « Appliquer » déclenche onApply avec la bonne valeur (comportement inchangé) ;
 *   4. changer de type de travaux met à jour les stats ; réduire referme le panneau.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import AssistantDevisIA from '../AssistantDevisIA';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const PARAMETRES = { employes: [], localites: [], typesTravaux: [{ nom: 'Faux-plafond' }, { nom: 'Carrelage' }], parametres: { tauxFraisGeneraux: 12 } };
const DEVIS = [
  { id: 'dv1', montantHT: 40000 }, { id: 'dv2', montantHT: 60000 }, { id: 'dv3', montantHT: 50000 },
  { id: 'dvc', montantHT: 20000 },
];
// 3 chantiers Faux-plafond terminés (montants 40k/60k/50k, durées) + 1 Carrelage.
const CHANTIERS = [
  { id: 'c1', nom: 'FP A', statut: 'Terminé', devisId: 'dv1', typesTravaux: ['Faux-plafond'], nombreJours: 8, nombrePersonnes: 3, journal: [], equipe: [] },
  { id: 'c2', nom: 'FP B', statut: 'Terminé', devisId: 'dv2', typesTravaux: ['Faux-plafond'], nombreJours: 12, nombrePersonnes: 4, journal: [], equipe: [] },
  { id: 'c3', nom: 'FP C', statut: 'Terminé', devisId: 'dv3', typesTravaux: ['Faux-plafond'], nombreJours: 10, nombrePersonnes: 3, journal: [], equipe: [] },
  { id: 'c4', nom: 'Car A', statut: 'Terminé', devisId: 'dvc', typesTravaux: ['Carrelage'], nombreJours: 5, nombrePersonnes: 2, journal: [], equipe: [] },
];

function renderAssistant(over = {}) {
  const onApply = over.onApply || vi.fn();
  const r = renderWithApp(
    <AssistantDevisIA chantiers={CHANTIERS} devis={DEVIS} parametres={PARAMETRES}
      form={over.form || { montantHT: '', dureeEstimee: '', nombrePersonnes: '' }} onApply={onApply} />,
    { pointages: [] },
  );
  return { ...r, onApply };
}

describe('DÉPLIER — en-tête + badge + sélecteur + stats', () => {
  it('l\'état réduit affiche le bandeau, déplier affiche l\'assistant complet', () => {
    renderAssistant();
    // Réduit : le bandeau compact d'invite
    expect(screen.getByText(/type\(s\) de travaux analysés/)).toBeInTheDocument();
    // Déplier
    fireEvent.click(screen.getByText('Assistant Devis IA'));
    const panel = within(screen.getByTestId('assistant-devis-ia'));
    expect(panel.getByText(/Basé sur 4 chantier/)).toBeInTheDocument();
    expect(panel.getByText('Type de travaux à analyser')).toBeInTheDocument();
    expect(panel.getByText('Statistiques historiques')).toBeInTheDocument();
    expect(panel.getByText('Appliquer au devis')).toBeInTheDocument();
  });
});

describe('STATISTIQUES — vraies valeurs', () => {
  it('affiche le montant HT médian, la durée moyenne et la marge', () => {
    renderAssistant();
    fireEvent.click(screen.getByText('Assistant Devis IA'));
    // Faux-plafond montants triés 40k/50k/60k → médian 50'000 ; durées 8/10/12 → moy 10
    expect(screen.getAllByText('Montant HT médian').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/50'000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Durée moyenne').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Marge nette réelle moyenne')).toBeInTheDocument();
  });
});

describe('APPLIQUER — report dans le devis (comportement inchangé)', () => {
  it('cliquer « Appliquer » sur le montant appelle onApply avec le médian', () => {
    const onApply = vi.fn();
    renderAssistant({ onApply });
    fireEvent.click(screen.getByText('Assistant Devis IA'));
    const boutons = screen.getAllByRole('button', { name: /^Appliquer$/ });
    fireEvent.click(boutons[0]);
    expect(onApply).toHaveBeenCalledWith({ montantHT: '50000' });
  });
});

describe('CHANGER DE TYPE + RÉDUIRE', () => {
  it('changer le type de travaux met à jour les stats ; « Réduire » referme', () => {
    renderAssistant();
    fireEvent.click(screen.getByText('Assistant Devis IA'));
    // → Carrelage (1 chantier, montant 20'000)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Carrelage' } });
    expect(screen.getAllByText(/20'000/).length).toBeGreaterThan(0);
    // Réduire
    fireEvent.click(screen.getByRole('button', { name: /Réduire/ }));
    expect(screen.queryByTestId('assistant-devis-ia')).toBeNull();
  });
});
