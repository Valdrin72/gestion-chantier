/**
 * Lot 2b — composant de saisie d'heures UNIFIÉ (mordants sur le vrai composant).
 * Rend le VRAI SaisieHeuresRapide dans un AppProvider avec un store de pointages
 * vivant → exercise le VRAI upsertPointage (fusion C1, majorations, validation).
 */
import React, { useState, useMemo } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import SaisieHeuresRapide from '../SaisieHeuresRapide';
import { heuresEmployeChantier } from '../../calculs/pointagesHelper';
import { calculerEtatChantier } from '../../donnees';

const EMPLOYES = [{ id: 1, prenom: 'Paul', nom: 'Meier', poste: 'Ouvrier', tarifJour: 400, tarifDejaCharge: true }];
const PARAMS = { employes: EMPLOYES };
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
const DEVIS = [{ id: 'd1', montantHT: 100000, statut: 'accepté' }];
const CH_A = { id: 'A', nom: 'Chantier A', canton: 'GE', devisId: 'd1', nombreJours: 100, statut: 'en cours' };
const CH_B = { id: 'B', nom: 'Chantier B', canton: 'GE', devisId: 'd1', nombreJours: 100, statut: 'en cours' };
const LUNDI = '2025-06-02';
const SAMEDI = '2025-06-07';

// Store vivant : capture les pointages écrits par le vrai upsertPointage.
const capture = { pointages: [] };
function Harness({ chantierFixe = null, chantiers = [], initialDate }) {
  const [pointages, setPointages] = useState([]);
  capture.pointages = pointages;
  const value = useMemo(() => ({ pointages, setPointages, afficherNotif: () => {} }), [pointages]);
  return (
    <AppProvider value={value}>
      <SaisieHeuresRapide chantierFixe={chantierFixe} chantiers={chantiers} parametres={PARAMS} initialDate={initialDate} />
    </AppProvider>
  );
}
const saisirHeures = (nom, v) => fireEvent.change(screen.getByLabelText(`Heures ${nom}`), { target: { value: String(v) } });
const enregistrer = () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les heures' }));

beforeEach(() => { capture.pointages = []; });

describe('SaisieHeuresRapide — écriture correcte (contexte fiche : chantier fixé)', () => {
  it('8h saisies → 1 pointage au bon chantier, coût MO correct (400 CHF/jour)', () => {
    render(<Harness chantierFixe={CH_A} initialDate={LUNDI} />);
    saisirHeures('Paul Meier', 8);
    enregistrer();
    expect(heuresEmployeChantier(capture.pointages, 1, 'A')).toBe(8);
    const etat = calculerEtatChantier(CH_A, EMPLOYES, DEVIS, CFG, capture.pointages);
    expect(etat.coutMOReel).toBe(400); // 8h = 1 jour × 400
  });
});

describe('SaisieHeuresRapide — MORDANT C1 : multi-chantier même jour (contexte Accueil : select)', () => {
  it('4h chantier A + 4h chantier B le même jour → 8h coexistent, AUCUN écrasement', () => {
    render(<Harness chantiers={[CH_A, CH_B]} initialDate={LUNDI} />);
    // Chantier A → 4h
    fireEvent.change(screen.getByLabelText('Chantier'), { target: { value: 'A' } });
    saisirHeures('Paul Meier', 4);
    enregistrer();
    // Chantier B, même jour → 4h
    fireEvent.change(screen.getByLabelText('Chantier'), { target: { value: 'B' } });
    saisirHeures('Paul Meier', 4);
    enregistrer();

    // Les 8h coexistent (fix C1) — pas d'écrasement de A par B.
    expect(heuresEmployeChantier(capture.pointages, 1, 'A')).toBe(4);
    expect(heuresEmployeChantier(capture.pointages, 1, 'B')).toBe(4);
    // Un SEUL pointage (date, employé), deux répartitions.
    const duJour = capture.pointages.filter(p => p.date === LUNDI && String(p.employeId) === '1');
    expect(duJour).toHaveLength(1);
    expect(duJour[0].repartitions).toHaveLength(2);
  });
});

describe('SaisieHeuresRapide — correction sans doublon', () => {
  it('8h puis correction à 6h sur le même chantier → 6h, une seule répartition', () => {
    render(<Harness chantierFixe={CH_A} initialDate={LUNDI} />);
    saisirHeures('Paul Meier', 8);
    enregistrer();
    saisirHeures('Paul Meier', 6);
    enregistrer();
    expect(heuresEmployeChantier(capture.pointages, 1, 'A')).toBe(6); // pas 14, pas 8
    const duJour = capture.pointages.filter(p => p.date === LUNDI && String(p.employeId) === '1');
    expect(duJour).toHaveLength(1);
    expect(duJour[0].repartitions.filter(r => String(r.chantierId) === 'A')).toHaveLength(1);
  });
});

describe('SaisieHeuresRapide — cas limites', () => {
  it('0h → bouton désactivé, rien écrit', () => {
    render(<Harness chantierFixe={CH_A} initialDate={LUNDI} />);
    saisirHeures('Paul Meier', 0);
    expect(screen.getByRole('button', { name: 'Enregistrer les heures' })).toBeDisabled();
    expect(capture.pointages).toHaveLength(0);
  });

  it('heures NÉGATIVES → refusées (bouton désactivé, rien écrit)', () => {
    render(<Harness chantierFixe={CH_A} initialDate={LUNDI} />);
    saisirHeures('Paul Meier', -5);
    expect(screen.getByRole('button', { name: 'Enregistrer les heures' })).toBeDisabled();
    expect(capture.pointages).toHaveLength(0);
  });

  it('MORDANT majoration : 8h un SAMEDI coûtent plus cher que 8h un lundi (×1.25 appliqué au write)', () => {
    // Lundi
    const vue = render(<Harness chantierFixe={CH_A} initialDate={LUNDI} />);
    saisirHeures('Paul Meier', 8);
    enregistrer();
    const coutLundi = calculerEtatChantier(CH_A, EMPLOYES, DEVIS, CFG, capture.pointages).coutMOReel;

    // Samedi (nouveau store, on démonte d'abord le lundi)
    vue.unmount();
    capture.pointages = [];
    render(<Harness chantierFixe={CH_A} initialDate={SAMEDI} />);
    saisirHeures('Paul Meier', 8);
    enregistrer();
    const coutSamedi = calculerEtatChantier(CH_A, EMPLOYES, DEVIS, CFG, capture.pointages).coutMOReel;

    expect(coutLundi).toBe(400);
    expect(coutSamedi).toBe(500);            // 400 + majoration samedi 25%
    expect(coutSamedi).toBeGreaterThan(coutLundi); // MORDANT : la majoration CCT tient à travers le composant
  });
});
