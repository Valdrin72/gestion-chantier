/**
 * Finances Lot 1-bis — garde anti-régression des titres/icônes de la fiche chantier.
 *
 * Le Lot 1 ne testait que l'onglet Vue et un seul état. Ici on rend la VRAIE fiche
 * (ChantierDetail) sur les 3 onglets (Vue / Analyse / Financier) ET sur 4 états de
 * chantier (en cours OK, en dépassement, planifié, quasi terminé) — pour verrouiller
 * TOUS les chemins d'affichage des tuiles cockpit et des bandeaux d'alerte.
 *
 * Échoue si un mot-code ('RENTA RENTABILITÉ'…) ou un mot technique ('danger'/'warning')
 * ou un caractère brut d'icône ('▶','◎','●','○') réapparaît quelque part.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
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

const EMP = { id: 1, nom: 'M', tarifJour: 400, tarifDejaCharge: true, actif: true };
const J = (dates) => dates.map(d => ({ date: d, employes: [{ employeId: 1, heuresTravaillees: 8 }] }));
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
const mkCtx = (ch) => ({
  chantiers: [ch], devis: [{ id: 'd1', numero: 'D-1', montantHT: 20000, statut: 'Accepté', clientId: 'cl1' }],
  clients: [{ id: 'cl1', nom: 'C', entreprise: 'C SA' }],
  parametres: { employes: [EMP], localites: [], parametres: CFG },
  pointages: migrerJournalVersPointages([ch], [EMP]),
  profil: { id: 'cyna', pages: ['chantiers'] }, agentState: { alertes: [], patterns: {} },
});

const base = { id: 'CH1', nom: 'T', clientId: 'cl1', devisId: 'd1', equipe: [{ employeId: 1, joursPlannifies: 6 }], dateDebut: '2026-03-02' };
const ETATS = {
  'en cours': { ...base, statut: 'en cours', nombreJours: 20, journal: J(['2026-03-02', '2026-03-03', '2026-03-04']), materielReel: 5000 },
  'dépassement': { ...base, statut: 'en cours', nombreJours: 3, journal: J(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10', '2026-03-11']), materielReel: 30000 },
  'planifié': { ...base, statut: 'planifié', nombreJours: 10, journal: [], materielReel: 0 },
  'quasi terminé': { ...base, statut: 'en cours', nombreJours: 6, journal: J(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09']), materielReel: 8000 },
};
const ONGLETS = ['vue', 'analyse', 'financier'];
const MOTS_CODES = ['RENTA RENTABILITÉ', 'AV AVANCEMENT', 'PLAN PLANNING', 'DANGER ACTION', 'INFO ACTION', 'WARNING ACTION'];
const CARS_BRUTS = ['▶', '◎', '●', '○'];

describe('Lot 1-bis — aucun mot-code / mot technique / caractère brut sur 3 onglets × 4 états', () => {
  for (const [nomEtat, ch] of Object.entries(ETATS)) {
    for (const onglet of ONGLETS) {
      it(`[${nomEtat} · ${onglet}] tuiles et bandeaux propres`, () => {
        const { container } = renderWithApp(<ChantierDetail chantier={ch} detailOnglet={onglet} />, mkCtx(ch));
        const txt = container.textContent;
        MOTS_CODES.forEach(b => expect(txt).not.toContain(b));
        // mots techniques rendus comme du texte (les vrais libellés sont en français)
        expect(txt).not.toMatch(/\bdanger\b/);
        expect(txt).not.toMatch(/\bwarning\b/);
        CARS_BRUTS.forEach(c => expect(txt).not.toContain(c));
        cleanup();
      });
    }
  }
});

describe('Lot 1-bis — les vrais titres restent présents (pas de sur-correction)', () => {
  it('la fiche affiche bien RENTABILITÉ / AVANCEMENT / PLANNING (tuile ACTION retirée au Lot 3)', () => {
    const ch = ETATS['en cours'];
    const { container } = renderWithApp(<ChantierDetail chantier={ch} detailOnglet="vue" />, mkCtx(ch));
    const txt = container.textContent;
    ['RENTABILITÉ', 'AVANCEMENT', 'PLANNING'].forEach(w => expect(txt).toContain(w));
  });
});
