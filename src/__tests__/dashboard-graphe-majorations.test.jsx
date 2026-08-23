/**
 * Conformité C2 — le graphe « coût 4 semaines » du Dashboard inclut désormais les majorations CCT.
 *
 * Le graphe calcule, par fenêtre hebdo, `Σ (coutBase + surcharge)` via la SOURCE UNIQUE
 * surchargeMajorationPointage — c.-à-d. exactement `coutMODansPeriode + coutMajorationsDansPeriode`.
 * Ce test exerce les VRAIES fonctions exportées (pas de logic-mirror) :
 *   1. un samedi travaillé ajoute la majoration ×1.25 (avant : sous-évalué) ;
 *   2. la méthode du graphe (Σ surchargeMajorationPointage) == le coût-période canonique
 *      (coutMODansPeriode + coutMajorationsDansPeriode) → cohérent avec l'Aperçu financier ;
 *   3. le Dashboard se rend sans erreur avec la nouvelle boucle basée pointages.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Dashboard from '../pages/Dashboard';
import { coutMODansPeriode, coutMajorationsDansPeriode } from '../calculs/periode';
import { surchargeMajorationPointage } from '../calculs/majorations';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true }; // tarifH = 50
const CFG = { coefficientMainOeuvre: 1 };
// Semaine ISO du 11→17 mai 2026 (lundi→dimanche). 16 mai = SAMEDI.
const LUNDI = '2026-05-11';
const SAMEDI = '2026-05-16';
const refSemaine = new Date(2026, 4, 13); // mercredi de cette semaine
const CH = { id: 'C1', nom: 'Chantier', canton: 'GE', statut: 'en cours', nombreJours: 10, equipe: [{ employeId: 1 }] };
const P = (date) => ({ id: 'p_' + date, date, employeId: 1, repartitions: [{ chantierId: 'C1', categorie: 'production', heures: 8 }] });
const POINTAGES = [P(LUNDI), P(SAMEDI)];

describe('C2 — graphe Dashboard : coût hebdo AVEC majorations (source unique)', () => {
  it('un samedi ajoute la majoration ×1.25 : base 800 + maj 100 = 900 (coût-période canonique)', () => {
    const base = coutMODansPeriode(CH, [EMP], CFG, POINTAGES, 'semaine', refSemaine);
    const maj  = coutMajorationsDansPeriode(CH, [EMP], CFG, POINTAGES, 'semaine', refSemaine);
    expect(base).toBeCloseTo(800, 6);  // 2 j × 8h × 50
    expect(maj).toBeCloseTo(100, 6);   // samedi 8h × 50 × 0.25
  });

  it('la méthode du graphe (Σ surchargeMajorationPointage) == coutMO + coutMajorations de la semaine', () => {
    // Reproduit la boucle du graphe en appelant la VRAIE fonction partagée qu'il utilise.
    const tarifH = (400 * 1) / 8; // 50 (tarifDejaCharge)
    const coutGraphe = POINTAGES.reduce((s, p) => {
      const m = surchargeMajorationPointage(p, 'C1', tarifH, POINTAGES, 'GE');
      return s + m.coutBase + m.surcharge;
    }, 0);
    const canonique = coutMODansPeriode(CH, [EMP], CFG, POINTAGES, 'semaine', refSemaine)
                    + coutMajorationsDansPeriode(CH, [EMP], CFG, POINTAGES, 'semaine', refSemaine);
    expect(coutGraphe).toBeCloseTo(canonique, 6); // 900 — cohérent avec l'Aperçu financier
    expect(coutGraphe).toBeCloseTo(900, 6);
    // AVANT le fix, le graphe sommait seulement coutBase (800) → sous-évaluation de 100.
    const baseSeule = POINTAGES.reduce((s, p) => s + surchargeMajorationPointage(p, 'C1', tarifH, POINTAGES, 'GE').coutBase, 0);
    expect(baseSeule).toBeCloseTo(800, 6);
    expect(coutGraphe).toBeGreaterThan(baseSeule);
  });

  it('le Dashboard se rend sans erreur avec la nouvelle boucle (pointages)', () => {
    renderWithApp(<Dashboard />, {
      chantiers: [CH], factures: [], devis: [], clients: [], pointages: POINTAGES,
      parametres: { employes: [EMP], localites: [], parametres: CFG },
      setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(), setPeriodeGlobale: vi.fn(),
      agentState: { scoreGlobal: 60, alertes: [], priorites: [], briefingMatin: null },
      profil: { id: 'cyna', pages: ['dashboard'] }, periodeGlobale: 'mois',
    });
    expect(screen.getByText('CA SIGNÉ')).toBeInTheDocument(); // le Dashboard a bien rendu ses KPIs
  });
});
