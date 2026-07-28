/**
 * Lot 3 Temps 1 — cohérence des chiffres de l'onglet Analyse. Tests RÉELS + mordants.
 * On vérifie les 4 pièges corrigés : retard unifié (source pointages), retard projeté distinct,
 * total équipe réconcilié (base + majorations CCT), ligne Imprévus dans le tableau d'écarts.
 * Aucune règle métier testée ici — seulement la cohérence source/affichage.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';
import { calculerEtatChantier, calculerCoutsChantier, calculerEcartChantier, fmtN } from '../donnees';
import DetailRentabilite from '../components/chantiers/detail/DetailRentabilite';
import DetailEcarts from '../components/chantiers/detail/DetailEcarts';
import DetailVelocite from '../components/chantiers/detail/DetailVelocite';
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
const DEVIS = { id: 'd1', numero: 'D-1', montantHT: 40000, statut: 'Accepté', clientId: 'cl1' };
const jour = (dates) => dates.map(d => ({ date: d, employes: [{ employeId: 1, heuresTravaillees: 8 }] }));

// ── PIÈGE B — KPI « Écart/devis » lit les POINTAGES et égale deriveJours ──────
describe('Piège B — Écart/devis = deriveJours (source pointages, journal ignoré)', () => {
  const dates8 = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10', '2026-03-11'];
  const CH = { id: 'CH1', nom: 'T', statut: 'en cours', nombreJours: 6, devisId: 'd1', clientId: 'cl1',
    equipe: [{ employeId: 1, joursPlannifies: 6 }], dateDebut: '2026-03-02', journal: jour(dates8) };
  const POINT = migrerJournalVersPointages([CH], [EMP]);
  const etat = calculerEtatChantier(CH, [EMP], [DEVIS], CFG, POINT);

  it('deriveJours = +2 (8 pointés − 6 vendus)', () => {
    expect(etat.deriveJours).toBe(2);
  });
  it('🔴 le journal est IGNORÉ : chantier avec journal trompeur (3 dates) + pointages (8) → écart = +2, pas −3', () => {
    const CH_trompe = { ...CH, journal: jour(['2026-03-02', '2026-03-03', '2026-03-04']) };
    const ec = calculerEcartChantier(CH_trompe, POINT);
    expect(ec.ecartJours).toBe(2);                 // pointages
    expect(ec.ecartJours).not.toBe(-3);            // pas le journal (3 − 6)
    expect(ec.ecartJours).toBe(etat.deriveJours);  // identique au retard constaté
  });
});

// ── PIÈGE A — retard unifié dans l'UI + retard projeté distinct ───────────────
describe('Piège A — retard constaté unique + retard projeté distinctement libellé', () => {
  const dates8 = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10', '2026-03-11'];
  const CH = { id: 'CH1', nom: 'T', statut: 'en cours', nombreJours: 6, devisId: 'd1', clientId: 'cl1',
    equipe: [{ employeId: 1, joursPlannifies: 6 }], dateDebut: '2026-03-02', journal: jour(dates8) };
  const POINT = migrerJournalVersPointages([CH], [EMP]);
  const CTX = { chantiers: [CH], devis: [DEVIS], clients: [{ id: 'cl1', nom: 'C', entreprise: 'C SA' }],
    parametres: { employes: [EMP], localites: [], parametres: CFG }, pointages: POINT,
    profil: { id: 'cyna', pages: ['chantiers'] }, agentState: { alertes: [], patterns: {} } };

  it('la fiche affiche le retard constaté +2j (bandeau visible), et le KPI Écart/devis = +2j dans le détail replié', () => {
    renderWithApp(<ChantierDetail chantier={CH} detailOnglet="analyse" />, CTX);
    // Retard constaté visible d'emblée dans le bloc retard groupé (+2j de dépassement).
    expect(screen.getAllByText(/\+2j/).length).toBeGreaterThan(0);
    // Le KPI Écart/devis (même valeur que deriveJours) est dans le détail replié → on l'ouvre.
    fireEvent.click(screen.getByRole('button', { name: /Voir le détail/i }));
    expect(screen.getByText('Écart / devis')).toBeInTheDocument();
    expect(screen.getAllByText('+2j').length).toBeGreaterThan(0);
  });

  it('DetailVélocité affiche « Retard projeté à ce rythme » (distinct du constaté), pas « jours de retard »', () => {
    // dateDebut ancienne → vitesse lente → retard projeté élevé.
    const CH_v = { id: 'CH2', nom: 'V', statut: 'en cours', nombreJours: 6, devisId: 'd1', clientId: 'cl1',
      equipe: [{ employeId: 1, joursPlannifies: 6 }],
      dateDebut: new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10),
      journal: jour(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']) };
    const P = migrerJournalVersPointages([CH_v], [EMP]);
    const etatV = calculerEtatChantier(CH_v, [EMP], [DEVIS], CFG, P);
    const { container } = renderWithApp(<DetailVelocite c={CH_v} etat={etatV} />, {});
    expect(container.textContent).toMatch(/Retard projeté à ce rythme/);
    expect(container.textContent).toMatch(/projection, pas le retard déjà constaté/);
    expect(container.textContent).not.toMatch(/jours de retard — action/); // ancien libellé disparu
  });
});

// ── PIÈGE D — Total équipe réconcilié avec les majorations CCT ────────────────
describe('Piège D — Total équipe (base) + majorations CCT = Coût main-d\'œuvre', () => {
  // 2026-03-07 = samedi → majoration CCT ×1.25 sur ce jour.
  const dates = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07'];
  const CH = { id: 'CH3', nom: 'S', statut: 'en cours', nombreJours: 6, devisId: 'd1', clientId: 'cl1', canton: 'GE',
    equipe: [{ employeId: 1, joursPlannifies: 6 }], dateDebut: '2026-03-02', journal: jour(dates) };
  const POINT = migrerJournalVersPointages([CH], [EMP]);
  const etat = calculerEtatChantier(CH, [EMP], [DEVIS], CFG, POINT);
  const couts = calculerCoutsChantier(CH, [EMP], [], CFG, [DEVIS], POINT);

  it('le samedi crée bien des majorations (base < coût main-d\'œuvre moteur)', () => {
    const base = etat.equipe.reduce((s, m) => s + m.cout, 0);
    const maj = couts.coutEquipeReel - base;
    expect(maj).toBeGreaterThan(0);
    // Réconciliation exacte : base + majorations = coût MO moteur.
    expect(Math.round(base + maj)).toBe(Math.round(couts.coutEquipeReel));
  });

  it('l\'affichage montre la ligne « majorations CCT » et « = Coût main-d\'œuvre »', () => {
    const { container } = renderWithApp(
      <DetailRentabilite c={CH} etat={etat} couts={couts} pointages={POINT} naviguer={vi.fn()} fmtN={fmtN} fmtK={fmtN} />, {});
    expect(container.textContent).toMatch(/majorations CCT/i);
    expect(container.textContent).toMatch(/= Coût main-d'œuvre/);
    // La valeur réconciliée affichée = coût MO moteur.
    expect(container.textContent).toContain(`CHF ${fmtN(Math.round(couts.coutEquipeReel))}`);
  });
});

// ── PIÈGE D — ligne Imprévus dans le tableau d'écarts ────────────────────────
describe('Piège D — le tableau d\'écarts contient la ligne Imprévus (somme = total)', () => {
  const dates = ['2026-03-02', '2026-03-03', '2026-03-04'];
  const CH = { id: 'CH4', nom: 'I', statut: 'en cours', nombreJours: 6, devisId: 'd1', clientId: 'cl1',
    equipe: [{ employeId: 1, joursPlannifies: 6 }], dateDebut: '2026-03-02', journal: jour(dates),
    materielReel: 5000, imprevus: [{ description: 'Casse', montant: 2000 }] };
  const POINT = migrerJournalVersPointages([CH], [EMP]);
  const couts = calculerCoutsChantier(CH, [EMP], [], CFG, [DEVIS], POINT);

  it('imprévus bien présents dans le moteur', () => {
    expect(couts.coutImprevus).toBe(2000);
    // Le total moteur inclut les imprévus.
    const sommeLignes = couts.coutEquipeReel + couts.coutMaterielReel + couts.coutSousTraitanceReel + couts.autresCoutsReel + couts.coutImprevus;
    expect(Math.round(sommeLignes)).toBe(Math.round(couts.totalCoutsReel));
  });

  it('le tableau affiche une ligne « Imprévus » avec son montant', () => {
    const { container } = renderWithApp(<DetailEcarts couts={couts} fmtN={fmtN} />, {});
    expect(screen.getByText('Imprévus')).toBeInTheDocument();
    expect(container.textContent).toContain(`CHF ${fmtN(2000)}`);
  });
});
