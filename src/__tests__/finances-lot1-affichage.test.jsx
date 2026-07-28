/**
 * Finances — Lot 1 : bugs d'affichage purs. Tests RÉELS (vrais composants via renderWithApp).
 * On vérifie CE QUI EST RENDU : plus de mots-codes en titre, plus de mots "danger/warning"
 * à la place d'icônes, boutons PDF distincts, colonne client = entreprise.
 * (Aucune valeur/montant testé ici — la non-régression money est couverte par les suites existantes.)
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';
import ChantierDetail from '../components/chantiers/ChantierDetail';
import Factures from '../Factures';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const JOURNAL_5 = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']
  .map(date => ({ date, employes: [{ employeId: 1, heuresTravaillees: 8 }] }));
const DEVIS = { id: 'd1', numero: 'D-1', montantHT: 80_000, statut: 'Accepté', clientId: 'cl1' };
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
const PARAMS = { employes: [EMP], localites: [], parametres: CFG };

function ctxFor(chantier) {
  const pointages = migrerJournalVersPointages([chantier], [EMP]);
  return {
    chantiers: [chantier], devis: [DEVIS],
    clients: [{ id: 'cl1', nom: 'Client', entreprise: 'Client SA', type: 'prive' }],
    parametres: PARAMS, pointages,
    profil: { id: 'cyna', pages: ['dashboard', 'chantiers'] },
    agentState: { alertes: [], patterns: {} },
  };
}

const CHANTIER_OK = {
  id: 'CH1', nom: 'Chantier Preuve', statut: 'en cours', nombreJours: 23,
  devisId: 'd1', clientId: 'cl1', equipe: [{ employeId: 1, joursPlannifies: 23 }],
  dateDebut: '2026-03-02', journal: JOURNAL_5,
};
// Chantier en dépassement (2 jours prévus, 5 réalisés) → déclenche alerte critique + bandeau criticité.
const CHANTIER_RETARD = { ...CHANTIER_OK, id: 'CH2', nombreJours: 2 };

describe('BUG 1 — titres doubles : les mots-codes ne s\'affichent plus', () => {
  it('les 4 tuiles montrent le vrai titre seul, jamais "RENTA RENTABILITÉ" etc.', () => {
    const { container } = renderWithApp(<ChantierDetail chantier={CHANTIER_OK} detailOnglet="vue" />, ctxFor(CHANTIER_OK));
    const txt = container.textContent;
    // Vrais titres présents
    expect(txt).toContain('RENTABILITÉ');
    expect(txt).toContain('AVANCEMENT');
    expect(txt).toContain('PLANNING');
    expect(txt).toContain('ACTION');
    // MORDANT : aucun mot-code recopié devant le titre
    expect(txt).not.toContain('RENTA RENTABILITÉ');
    expect(txt).not.toContain('AV AVANCEMENT');
    expect(txt).not.toContain('PLAN PLANNING');
    expect(txt).not.toMatch(/(DANGER|INFO|WARNING) ACTION/);
    // Aucun caractère brut de pastille
    expect(txt).not.toContain('◎');
    expect(txt).not.toContain('▶');
  });
});

describe('BUG 2 — icônes-fantômes : plus de mots "danger"/"warning" à la place des icônes', () => {
  it('un chantier en dépassement affiche l\'alerte SANS le mot technique "danger"/"warning"', () => {
    const { container } = renderWithApp(<ChantierDetail chantier={CHANTIER_RETARD} detailOnglet="vue" />, ctxFor(CHANTIER_RETARD));
    const txt = container.textContent;
    // L'alerte de dépassement est bien là (le message métier)…
    expect(txt).toMatch(/Dépassement de délai/i);
    // …mais jamais les mots-codes techniques rendus comme du texte.
    expect(txt).not.toMatch(/\bdanger\b/);
    expect(txt).not.toMatch(/\bwarning\b/);
  });
});

describe('BUG 4 + 5 — Factures : boutons PDF distincts, colonne client = entreprise', () => {
  const CLIENT = { id: '1', prenom: 'Alice', nom: 'Dupont', entreprise: 'Dupont SA' };
  const CHANTIER_F = { id: 'CH1', nom: 'Chantier Test', numero: 'C-001', statut: 'en cours', clientId: '1', devisId: 'D1' };
  const DEVIS_F = { id: 'D1', numero: 'D-001', clientId: '1', montantHT: 50000, statut: 'accepté' };
  const FACTURE = {
    id: 'F1', numero: 'F-2026-001', clientId: '1', chantierId: 'CH1', devisId: 'D1',
    type: 'situation', statut: 'envoyee', dateEmission: '2026-03-01', dateEcheance: '2026-03-31',
    montantHT: 20000, tva: 8.1, montantTTC: 21620, montantPaye: 0, lignes: [],
  };
  const props = {
    factures: [FACTURE], onSave: vi.fn(), clients: [CLIENT], chantiers: [CHANTIER_F], devis: [DEVIS_F],
    paiementsData: {}, setPaiementsData: vi.fn(), naviguer: vi.fn(),
    profil: { id: 'cyna', pages: ['finances'], role: 'cyna' }, periodeGlobale: 'annee',
    parametres: { employes: [] }, preRemplir: null, onConsumePreRemplir: vi.fn(),
  };

  it('la colonne client affiche l\'ENTREPRISE (cohérent avec les autres écrans), pas le nom seul', () => {
    renderWithApp(<Factures {...props} />, {});
    expect(screen.getByText('Dupont SA')).toBeInTheDocument();
  });

  it('les deux boutons PDF ont des libellés distincts (Facture vs Chantier)', () => {
    renderWithApp(<Factures {...props} />, {});
    expect(screen.getByRole('button', { name: /Facture/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chantier/ })).toBeInTheDocument();
  });
});
