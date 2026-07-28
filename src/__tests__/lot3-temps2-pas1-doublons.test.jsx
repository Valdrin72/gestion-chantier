/**
 * Lot 3 Temps 2 Pas 1 — suppression des PURS DOUBLONS de l'onglet Analyse.
 * Tests RÉELS : on rend les vrais composants et on vérifie (a) que chaque doublon a disparu
 * DANS l'état où il s'affichait avant, (b) que toute info UNIQUE est toujours là.
 * Aucun chiffre testé — seulement présence/absence de blocs d'affichage.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';
import { calculerEtatChantier, calculerCoutsChantier, fmtN } from '../donnees';
import ChantierDetail from '../components/chantiers/ChantierDetail';
import DetailRecommandations from '../components/chantiers/detail/DetailRecommandations';
import DetailRentabilite from '../components/chantiers/detail/DetailRentabilite';

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
const wk = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'];

function build(ch) {
  const POINT = migrerJournalVersPointages([ch], [EMP]);
  const etat = calculerEtatChantier(ch, [EMP], [DEVIS], CFG, POINT);
  const couts = calculerCoutsChantier(ch, [EMP], [], CFG, [DEVIS], POINT);
  return { POINT, etat, couts };
}
const ctxFor = (ch, POINT) => ({
  chantiers: [ch], devis: [DEVIS], clients: [{ id: 'cl1', nom: 'C', entreprise: 'C SA' }],
  parametres: { employes: [EMP], localites: [], parametres: CFG }, pointages: POINT,
  profil: { id: 'cyna', pages: ['chantiers'] }, agentState: { alertes: [], patterns: {} },
});
const base = { statut: 'en cours', devisId: 'd1', clientId: 'cl1', equipe: [{ employeId: 1, joursPlannifies: 10 }] };

// Chantier « principal » : en cours, en perte (matériel élevé), avancement 50 % → projection dispo.
const CH_MAIN = { ...base, id: 'CH1', nom: 'Main', nombreJours: 10, dateDebut: '2026-03-02', journal: jour(wk.slice(0, 5)), materielReel: 45000 };

describe('DOUBLONS RETIRÉS', () => {
  it('tuile ACTION retirée (plus de 4e tuile « Recommandation basée sur retard et rentabilité »)', () => {
    const { POINT } = build(CH_MAIN);
    const { container } = renderWithApp(<ChantierDetail chantier={CH_MAIN} detailOnglet="analyse" />, ctxFor(CH_MAIN, POINT));
    const txt = container.textContent;
    expect(txt).toContain('RENTABILITÉ');
    expect(txt).toContain('AVANCEMENT');
    expect(txt).toContain('PLANNING');
    expect(txt).not.toContain('Recommandation basée sur retard et rentabilité'); // desc unique de la tuile ACTION
  });

  it('« Léger retard » retiré (chantier avec dérive de +4 j, où il s\'affichait avant)', () => {
    const CH = { ...base, id: 'CH2', nom: 'Leger', nombreJours: 6, dateDebut: '2026-03-02', journal: jour(wk), materielReel: 5000 };
    const { POINT, etat } = build(CH);
    expect(etat.deriveJours).toBeGreaterThan(3);
    expect(etat.deriveJours).toBeLessThanOrEqual(7); // zone « léger retard »
    const { container } = renderWithApp(<ChantierDetail chantier={CH} detailOnglet="analyse" />, ctxFor(CH, POINT));
    expect(container.textContent).not.toContain('Léger retard');
  });

  it('« Efficacité dépense à surveiller » retirée (ratio 0.70–0.85, où elle s\'affichait avant)', () => {
    const CH = { ...base, id: 'CH3', nom: 'Eff', nombreJours: 10, dateDebut: '2026-03-02',
      journal: jour(wk.slice(0, 4)), coutMaterielPrevu: 6000, materielReel: 3400 };
    const { POINT, couts } = build(CH);
    expect(couts.ratioEfficacite).toBeGreaterThanOrEqual(0.70);
    expect(couts.ratioEfficacite).toBeLessThan(0.85); // zone « à surveiller »
    const { container } = renderWithApp(<ChantierDetail chantier={CH} detailOnglet="analyse" />, ctxFor(CH, POINT));
    expect(container.textContent).not.toContain('Efficacité dépense à surveiller');
  });

  it('« sur les rails » retiré : sans recommandation, le bloc ne rend rien', () => {
    const CH = { ...base, id: 'CH4', nom: 'Sain', nombreJours: 20, dateDebut: '2026-03-02', journal: [], materielReel: 0 };
    const { POINT, etat, couts } = build(CH);
    const { container } = renderWithApp(
      <DetailRecommandations etat={etat} couts={couts} chantier={CH} factures={[]} devis={[DEVIS]} fmtK={fmtN} />, ctxFor(CH, POINT));
    expect(container.textContent).not.toContain('sur les rails');
    expect(container.textContent.trim()).toBe(''); // recs=0 → null
  });

  it('barre de jours dupliquée retirée (plus de « 0 jour » de la 2e barre)', () => {
    const { POINT, etat, couts } = build(CH_MAIN);
    const { container } = renderWithApp(
      <DetailRentabilite c={CH_MAIN} etat={etat} couts={couts} pointages={POINT} naviguer={vi.fn()} fmtN={fmtN} fmtK={fmtN} />, ctxFor(CH_MAIN, POINT));
    expect(container.textContent).not.toContain('0 jour'); // marqueur de la barre supprimée
  });

  it('tuile « Projection fin chantier » retirée du bloc rentabilité', () => {
    const { POINT, etat, couts } = build(CH_MAIN);
    expect(etat.margeEstimee).not.toBeNull(); // projection dispo → la tuile s'affichait avant
    const { container } = renderWithApp(
      <DetailRentabilite c={CH_MAIN} etat={etat} couts={couts} pointages={POINT} naviguer={vi.fn()} fmtN={fmtN} fmtK={fmtN} />, ctxFor(CH_MAIN, POINT));
    expect(container.textContent).not.toContain('Projection fin chantier');
  });
});

describe('INFOS UNIQUES PRÉSERVÉES', () => {
  it('les 3 tuiles + le verdict de projection + les deux marges sont toujours là', () => {
    const { POINT } = build(CH_MAIN);
    const { container } = renderWithApp(<ChantierDetail chantier={CH_MAIN} detailOnglet="analyse" />, ctxFor(CH_MAIN, POINT));
    const txt = container.textContent;
    // 3 tuiles
    ['RENTABILITÉ', 'AVANCEMENT', 'PLANNING'].forEach(w => expect(txt).toContain(w));
    // verdict de projection (DetailProjection) — unique
    expect(txt).toContain('Ce que le chantier coûtera au total');
    // les DEUX marges, distinctes
    expect(txt).toContain('Marge réelle');       // à ce jour (DetailRentabilite)
    expect(txt).toContain('Rentabilité prévue');  // fin de chantier (DetailProjection)
  });

  it('le coût par employé (bloc unique) est toujours affiché', () => {
    const { POINT, etat, couts } = build(CH_MAIN);
    renderWithApp(
      <DetailRentabilite c={CH_MAIN} etat={etat} couts={couts} pointages={POINT} naviguer={vi.fn()} fmtN={fmtN} fmtK={fmtN} />, ctxFor(CH_MAIN, POINT));
    expect(screen.getByText('Müller')).toBeInTheDocument(); // détail nominatif préservé
  });

  it('les vraies recommandations chiffrées restent (facture d\'avancement / avenant)', () => {
    const { POINT, etat, couts } = build(CH_MAIN);
    const { container } = renderWithApp(
      <DetailRecommandations etat={etat} couts={couts} chantier={CH_MAIN} factures={[]} devis={[DEVIS]} fmtK={fmtN} />, ctxFor(CH_MAIN, POINT));
    const txt = container.textContent;
    expect(txt).toMatch(/facture d'avancement|avenant/i);
    expect(txt).toMatch(/Impact estimé/i); // les recos gardées sont chiffrées
  });
});
