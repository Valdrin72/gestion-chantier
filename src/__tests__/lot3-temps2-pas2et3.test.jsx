/**
 * Lot 3 Temps 2 Pas 2+3 — regrouper (retard, actions) + replier le détail employé.
 * Tests RÉELS : on rend le vrai ChantierDetail (onglet Analyse) et on vérifie la nouvelle
 * organisation. Aucun chiffre testé — présence/ordre/repli des blocs.
 */
import { describe, it, expect, beforeAll } from 'vitest';
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

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
const DEVIS = { id: 'd1', numero: 'D-1', montantHT: 40000, statut: 'Accepté', clientId: 'cl1' };
const jour = (dates) => dates.map(d => ({ date: d, employes: [{ employeId: 1, heuresTravaillees: 8 }] }));
const base = { statut: 'en cours', devisId: 'd1', clientId: 'cl1', equipe: [{ employeId: 1, joursPlannifies: 10 }] };
const ctxFor = (ch, POINT) => ({
  chantiers: [ch], devis: [DEVIS], clients: [{ id: 'cl1', nom: 'C', entreprise: 'C SA' }],
  parametres: { employes: [EMP], localites: [], parametres: CFG }, pointages: POINT,
  profil: { id: 'cyna', pages: ['chantiers'] }, agentState: { alertes: [], patterns: {} },
});

// Chantier en perte, avancement 50 % → projection dispo, employé pointé.
const CH_MAIN = { ...base, id: 'CH1', nom: 'Main', nombreJours: 10, dateDebut: '2026-03-02',
  journal: jour(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']), materielReel: 45000 };
const POINT_MAIN = migrerJournalVersPointages([CH_MAIN], [EMP]);

describe('PAS 3 — détail employé replié par défaut, visible après clic', () => {
  it('à l\'ouverture : bouton « Voir le détail » présent, employé (Müller) NON visible', () => {
    renderWithApp(<ChantierDetail chantier={CH_MAIN} detailOnglet="analyse" />, ctxFor(CH_MAIN, POINT_MAIN));
    expect(screen.getByRole('button', { name: /Voir le détail/i })).toBeInTheDocument();
    expect(screen.queryByText('Müller')).toBeNull(); // détail fermé
  });
  it('après clic : le détail se déplie (Müller + Marge réelle + majorations visibles)', () => {
    renderWithApp(<ChantierDetail chantier={CH_MAIN} detailOnglet="analyse" />, ctxFor(CH_MAIN, POINT_MAIN));
    fireEvent.click(screen.getByRole('button', { name: /Voir le détail/i }));
    expect(screen.getByText('Müller')).toBeInTheDocument();
    expect(screen.getByText('Marge réelle (%)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Masquer le détail/i })).toBeInTheDocument();
  });
});

describe('PAS 2.1 — une seule zone RETARD (constaté + projeté étiquetés)', () => {
  // dateDebut ancienne → cadence lente → retard projeté élevé, distinct du constaté.
  const CH_v = { ...base, id: 'CH2', nom: 'V', nombreJours: 6,
    dateDebut: new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10),
    journal: jour(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']) };
  const P = migrerJournalVersPointages([CH_v], [EMP]);

  it('le retard constaté ET le retard projeté « à ce rythme » sont dans le même bloc, une seule fois', () => {
    const { container } = renderWithApp(<ChantierDetail chantier={CH_v} detailOnglet="analyse" />, ctxFor(CH_v, P));
    // constaté (jours restants / dépassement) visible
    expect(container.textContent).toMatch(/j restants|de dépassement/);
    // projeté clairement étiqueté, présent UNE seule fois (fusionné, plus de bloc vélocité séparé)
    expect(screen.getAllByText(/Retard projeté à ce rythme/i)).toHaveLength(1);
  });
});

describe('PAS 2.2 — une seule zone ACTIONS (pas de panneau « prochaine étape » séparé)', () => {
  it('le panneau « Prochaine étape recommandée » a disparu, remplacé par la zone « Que faire »', () => {
    const { container } = renderWithApp(<ChantierDetail chantier={CH_MAIN} detailOnglet="analyse" />, ctxFor(CH_MAIN, POINT_MAIN));
    expect(container.textContent).not.toContain('Prochaine étape recommandée');
    expect(container.textContent).toMatch(/Que faire/);
    expect(container.textContent).toMatch(/Impact estimé/i); // les actions restent chiffrées
  });
});

describe('ORDRE DE LECTURE — verdict d\'abord, puis actions', () => {
  it('la projection (verdict) apparaît AVANT la zone « Que faire »', () => {
    const { container } = renderWithApp(<ChantierDetail chantier={CH_MAIN} detailOnglet="analyse" />, ctxFor(CH_MAIN, POINT_MAIN));
    const txt = container.textContent;
    const iVerdict = txt.indexOf('Ce que le chantier coûtera au total');
    const iQueFaire = txt.indexOf('Que faire');
    expect(iVerdict).toBeGreaterThanOrEqual(0);
    expect(iQueFaire).toBeGreaterThan(iVerdict); // verdict avant actions
    // les 3 tuiles restent présentes
    ['RENTABILITÉ', 'AVANCEMENT', 'PLANNING'].forEach(w => expect(txt).toContain(w));
  });
});
