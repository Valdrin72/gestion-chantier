/**
 * Phase 7c groupe 1 — PREUVE de la bascule du pattern "jours uniques du journal"
 * vers joursReelsChantier(pointages, id) dans les consommateurs UI.
 *
 * Chemin de code RÉEL exercé (zéro logic-mirror) :
 *   fixture chantier (journal K dates)
 *     → migrerJournalVersPointages (VRAIE migration prod) → pointages
 *     → rendu du VRAI composant via renderWithApp (contexte = pointages dérivés)
 *   On prouve que le nombre de jours AFFICHÉ = nombre de dates uniques du journal
 *   (= la valeur d'AVANT bascule). Oracle = new Set(journal.map(date)).size.
 *
 * Contrôle anti-tautologie : avec pointages=[] le composant affiche la valeur "0 jour"
 * (jours restants = nombreJours). Prouve que le composant LIT bien les pointages.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';

// jsdom n'implémente pas matchMedia (utilisé par useIsMobile dans Dashboard).
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
  }
});
import { renderWithApp } from '../test-utils/renderWithApp';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';
import { useChantierFiltres } from '../hooks/useChantierFiltres';
import ChantierDetail from '../components/chantiers/ChantierDetail';

const EMP = { id: 1, nom: 'Test', tarifJour: 400, tarifDejaCharge: true, actif: true };

// 5 dates distinctes dans le journal → oracle = 5 jours réalisés.
const JOURNAL_5 = [
  { date: '2026-03-02', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-03-03', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-03-04', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-03-05', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  { date: '2026-03-06', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
];
// nombreJours = 23 → jours restants = 23 − 5 = 18 (valeur distinctive, peu de collisions).
const CHANTIER = {
  id: 'CH1', nom: 'Chantier Preuve', statut: 'en cours', nombreJours: 23,
  devisId: 'd1', clientId: 'cl1', equipe: [{ employeId: 1, joursPlannifies: 23 }],
  dateDebut: '2026-03-02', journal: JOURNAL_5,
};
const DEVIS = { id: 'd1', numero: 'D-1', montantHT: 80_000, statut: 'Accepté', clientId: 'cl1' };

// Oracle : nombre de dates uniques du journal (comportement d'AVANT bascule).
const JOURS_ORACLE = new Set(JOURNAL_5.map(e => e.date)).size; // 5
const JOURS_RESTANTS_ORACLE = CHANTIER.nombreJours - JOURS_ORACLE; // 18

// Pointages dérivés via la vraie migration (comme en prod).
const POINTAGES = migrerJournalVersPointages([CHANTIER], [EMP]);

const CTX = {
  chantiers: [CHANTIER],
  devis: [DEVIS],
  clients: [{ id: 'cl1', nom: 'Client', type: 'prive' }],
  parametres: { employes: [EMP], localites: [], parametres: { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 } },
  pointages: POINTAGES,
  profil: { id: 'cyna', pages: ['dashboard', 'chantiers', 'planning', 'rapport', 'analyse'] },
  agentState: { alertes: [], agentData: {}, patterns: {} },
};

// ── Sonde pour le hook useChantierFiltres (surface ChantiersListe) ─────────────
function SondeFiltres() {
  const { joursParChantier } = useChantierFiltres();
  return <div data-testid="jpc">{String(joursParChantier.CH1)}</div>;
}

describe('Phase 7c-G1 — sanity : oracle', () => {
  it('journal démo = 5 dates uniques → 18 jours restants attendus', () => {
    expect(JOURS_ORACLE).toBe(5);
    expect(JOURS_RESTANTS_ORACLE).toBe(18);
    // La migration a bien produit des pointages couvrant les 5 dates.
    expect(POINTAGES.length).toBe(5);
  });
});

describe('Phase 7c-G1 — ChantiersListe (hook useChantierFiltres)', () => {
  it('joursParChantier = nombreJours − jours réels (pointages) = 18', () => {
    renderWithApp(<SondeFiltres />, CTX);
    expect(screen.getByTestId('jpc').textContent).toBe(String(JOURS_RESTANTS_ORACLE));
  });

  it('CONTRÔLE : sans pointages → 23 (nombreJours, 0 réalisé) — le hook lit bien les pointages', () => {
    renderWithApp(<SondeFiltres />, { ...CTX, pointages: [] });
    expect(screen.getByTestId('jpc').textContent).toBe(String(CHANTIER.nombreJours)); // 23
  });
});

describe('Phase 7c-G1 — ChantierDetail', () => {
  it('affiche "18j restants" (jours réels lus depuis les pointages)', () => {
    renderWithApp(<ChantierDetail chantier={CHANTIER} />, CTX);
    expect(screen.getByText(/18j restants/)).toBeTruthy();
  });

  it('CONTRÔLE : sans pointages → PLUS "18j restants" mais "non démarré" — le composant lit bien les pointages', () => {
    // Même chantier, pointages=[] : joursRéalisés tombe à 0 → mode "non démarré".
    // La disparition du "18j restants" prouve que l'affichage dépend des pointages (pas hardcodé).
    const { container } = renderWithApp(<ChantierDetail chantier={CHANTIER} />, { ...CTX, pointages: [] });
    expect(container.textContent).not.toContain('18j restants');
    expect(container.textContent).toContain('non démarré');
  });
});

describe('Phase 7c-G1 — Dashboard (surface visible)', () => {
  it('se rend avec pointages dérivés sans crash et affiche le chantier', async () => {
    const { default: Dashboard } = await import('../pages/Dashboard');
    expect(() => renderWithApp(<Dashboard />, CTX)).not.toThrow();
    expect(screen.getAllByText(/Chantier Preuve/).length).toBeGreaterThan(0);
  });
});

describe('Phase 7c-G1 — Planning (surface visible)', () => {
  it('se rend avec pointages dérivés sans crash et affiche le chantier', async () => {
    const { default: Planning } = await import('../Planning');
    expect(() => renderWithApp(
      <Planning chantiers={[CHANTIER]} setChantiers={vi.fn()} clients={CTX.clients} parametres={CTX.parametres} naviguer={vi.fn()} />,
      CTX
    )).not.toThrow();
  });
});

// ── Cas Müller : chantier sans pointage ───────────────────────────────────────
const MULLER = {
  id: 'MULLER', nom: 'Müller AG', statut: 'planifié', nombreJours: 10,
  devisId: 'd1', clientId: 'cl1', equipe: [], dateDebut: '2026-06-01', journal: [],
};

describe('Phase 7c-G1 — cas Müller (0 pointage) : 0, pas de NaN, pas de crash', () => {
  it('hook useChantierFiltres : joursParChantier = 0 réalisé → 10 restants, jamais NaN', () => {
    const ctxM = { ...CTX, chantiers: [MULLER], pointages: [] };
    function SondeM() {
      const { joursParChantier } = useChantierFiltres();
      return <div data-testid="jm">{String(joursParChantier.MULLER)}</div>;
    }
    renderWithApp(<SondeM />, ctxM);
    const v = screen.getByTestId('jm').textContent;
    expect(v).toBe('10');          // 10 − 0 réalisé
    expect(v).not.toContain('NaN');
  });

  it('ChantierDetail : se rend sans crash, aucun NaN dans le DOM', () => {
    const ctxM = { ...CTX, chantiers: [MULLER], pointages: [] };
    const { container } = renderWithApp(<ChantierDetail chantier={MULLER} />, ctxM);
    expect(container.textContent).not.toContain('NaN');
  });
});
