/**
 * Phase 7c — PREUVE que la régression "moteurs appelés sans pointages" est corrigée.
 * L'argent affiché à l'écran doit être NON NUL et égal au moteur avec les vrais pointages.
 *
 * Chemin RÉEL exercé : vrais composants/hooks via renderWithApp, pointages dérivés par la
 * VRAIE migrerJournalVersPointages. Oracle = moteur appelé directement avec ces pointages.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';
import { calculerEtatChantier, calculerCoutsChantier } from '../donnees';
import { useChantierCalculs } from '../hooks/useChantierCalculs';
import ChantierDetail from '../components/chantiers/ChantierDetail';
import Marges from '../Marges';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

// Employé tarif 400/j déjà chargé → 5 jours = 5×400 = 2 000 CHF de coût MO réel.
const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const JOURNAL_5 = [
  { date: '2026-03-02', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-03-03', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-03-04', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-03-05', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-03-06', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
];
const CHANTIER = {
  id: 'CH1', nom: 'Chantier Preuve', statut: 'en cours', nombreJours: 23,
  devisId: 'd1', clientId: 'cl1', equipe: [{ employeId: 1, joursPlannifies: 23 }],
  dateDebut: '2026-03-02', journal: JOURNAL_5,
};
const DEVIS = { id: 'd1', numero: 'D-1', montantHT: 80_000, statut: 'Accepté', clientId: 'cl1' };
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
const PARAMS = { employes: [EMP], localites: [], parametres: CFG };
const POINTAGES = migrerJournalVersPointages([CHANTIER], [EMP]);

// Oracle : moteur appelé AVEC les vrais pointages.
const ORACLE_ETAT = calculerEtatChantier(CHANTIER, [EMP], [DEVIS], CFG, POINTAGES);
const ORACLE_COUTS = calculerCoutsChantier(CHANTIER, [EMP], [], CFG, [DEVIS], POINTAGES);

const CTX = {
  chantiers: [CHANTIER], devis: [DEVIS],
  clients: [{ id: 'cl1', nom: 'Client', type: 'prive' }],
  parametres: PARAMS, pointages: POINTAGES,
  profil: { id: 'cyna', pages: ['dashboard', 'chantiers'] },
  agentState: { alertes: [], patterns: {} },
};

describe('Phase 7c — oracle (sanity)', () => {
  it('le moteur avec pointages donne des valeurs NON NULLES', () => {
    expect(ORACLE_ETAT.totalJoursReels).toBe(5);
    expect(ORACLE_ETAT.coutMOReel).toBe(2000);      // 5j × 400
    expect(ORACLE_COUTS.coutEquipeReel).toBe(2000);
    expect(ORACLE_COUTS.margeActuellePct).toBeGreaterThan(0);
  });
});

// Sonde : le VRAI hook qui alimente ChantierDetail.
function SondeCalculs() {
  const { etat, couts } = useChantierCalculs(CHANTIER);
  return (
    <div>
      <span data-testid="jours">{String(etat.totalJoursReels)}</span>
      <span data-testid="coutMO">{String(etat.coutMOReel)}</span>
      <span data-testid="coutEquipe">{String(couts.coutEquipeReel)}</span>
      <span data-testid="marge">{String(couts.margeActuellePct)}</span>
    </div>
  );
}

describe('Phase 7c — useChantierCalculs (moteur de ChantierDetail) lit les pointages', () => {
  it('coûtMO, jours réalisés, marge NON NULS et = moteur avec pointages', () => {
    renderWithApp(<SondeCalculs />, CTX);
    expect(screen.getByTestId('jours').textContent).toBe(String(ORACLE_ETAT.totalJoursReels)); // 5
    expect(screen.getByTestId('coutMO').textContent).toBe(String(ORACLE_ETAT.coutMOReel));     // 2000
    expect(screen.getByTestId('coutEquipe').textContent).toBe(String(ORACLE_COUTS.coutEquipeReel));
    expect(screen.getByTestId('marge').textContent).toBe(String(ORACLE_COUTS.margeActuellePct));
    // NON NUL explicite
    expect(Number(screen.getByTestId('coutMO').textContent)).toBeGreaterThan(0);
  });

  it('🔴 MORDANT : sans pointages, coûtMO/jours retombent à 0 (échouerait si on repassait [])', () => {
    renderWithApp(<SondeCalculs />, { ...CTX, pointages: [] });
    // Preuve que le composant LIT les pointages : sans eux, tout est 0 (l'ancien bug).
    expect(screen.getByTestId('coutMO').textContent).toBe('0');
    expect(screen.getByTestId('jours').textContent).toBe('0');
    // Et donc DIFFÉRENT du cas correct → si un jour on repasse [] aux moteurs, le test ci-dessus casse.
    expect(screen.getByTestId('coutMO').textContent).not.toBe(String(ORACLE_ETAT.coutMOReel));
  });
});

describe('Phase 7c — ChantierDetail : cohérence interne (réalisés + restants = nombreJours)', () => {
  it('affiche "5j réalisés" et "18j restants" → 5 + 18 = 23 = nombreJours', () => {
    const { container } = renderWithApp(<ChantierDetail chantier={CHANTIER} />, CTX);
    const txt = container.textContent;
    // jours réalisés (via etat, moteur corrigé) : 5
    expect(txt).toContain('5j réalisés');
    expect(txt).not.toContain('0j réalisés');   // l'ancien bug affichait 0
    // jours restants (site jours-uniques) : 23 − 5 = 18
    expect(txt).toContain('18j restants');
    // Cohérence arithmétique explicite
    expect(5 + 18).toBe(CHANTIER.nombreJours);
  });
});

describe('Phase 7c — Marges : marge affichée non nulle et correcte (CA facturé HT, lot 4a périodes)', () => {
  // Lot 4a : Marges compare le CA FACTURÉ HT de la période aux coûts de la période (MO datée + forfait).
  // On facture 80'000 HT en mars → CA facturé HT = 80'000 ; coûts période = 5j × 400 = 2'000 de MO
  // (lus depuis les VRAIS pointages). Marge = 78'000 → 78'000 / 80'000 = 97.5 %. Si le composant
  // ne lisait pas les pointages, le coût MO retomberait à 0 et la marge passerait à 100 % (≠ 97.5 %).
  const FACTURE = { id: 'FX', numero: 'F-1', chantierId: 'CH1', clientId: 'cl1',
    statut: 'envoyee', montantHT: 80_000, montantTTC: 86_480, dateEmission: '2026-03-15' };
  it('la marge de période du chantier apparaît (CA facturé − coûts pointages), pas de 0/N-D silencieux', () => {
    const { container } = renderWithApp(
      <Marges chantiers={[CHANTIER]} clients={CTX.clients} devis={[DEVIS]} parametres={PARAMS} periodeGlobale="annee" />,
      { ...CTX, factures: [FACTURE] }
    );
    // 97.5 % = (80'000 − 2'000) / 80'000 : dépend du coût MO réel (2'000) donc des pointages lus.
    expect(container.textContent).toContain('97.5%');
    // MORDANT : sans pointages, le coût MO serait 0 → marge 100 %. La preuve tient sur le fait
    // que 97.5 % ≠ 100 % ; le coût MO réel (2'000) est bien pris en compte.
    expect(container.textContent).not.toContain('100%');
  });
});
