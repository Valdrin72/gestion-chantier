import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import Chantiers from '../ChantiersPage';
import { renderWithApp } from '../../test-utils/renderWithApp';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) },
}));
// exportCSV : side-effect navigateur (URL.createObjectURL absent jsdom)
vi.mock('../../utils/exportCSV', () => ({ exportCSV: vi.fn() }));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CLIENTS = [
  { id: 1, prenom: 'Alice', nom: 'Dupont', entreprise: 'Dupont SA' },
  { id: 2, prenom: 'Bob', nom: 'Martin', entreprise: 'Martin SÀRL' },
];

const DEVIS = [
  { id: 100, numero: 'D-100', clientId: 1, statut: 'accepté', montantHT: 50000 },
  { id: 200, numero: 'D-200', clientId: 2, statut: 'accepté', montantHT: 30000 },
];

// Journal de N dates distinctes (pour piloter l'avancement auto)
const journalDeNJours = (n) =>
  Array.from({ length: n }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    employes: [],
  }));

const CHANTIER_EN_COURS = {
  id: 1, numero: 'CH-2026-001', nom: 'Bureaux Dupont', clientId: 1, devisId: 100,
  statut: 'En cours', priorite: 'Normale', canton: 'GE', ville: 'Genève',
  dateDebut: '2026-01-01', nombreJours: 10, avancement: 30,
  equipe: [], employes: [], typesTravaux: [], avenants: [], imprevus: [],
  journal: journalDeNJours(3), montantDevis: '50000',
};
const CHANTIER_TERMINE = {
  id: 2, numero: 'CH-2026-002', nom: 'Villa Martin', clientId: 2, devisId: 200,
  statut: 'Terminé', priorite: 'Haute', canton: 'VD', ville: 'Lausanne',
  dateDebut: '2025-11-01', nombreJours: 20, avancement: 100,
  equipe: [], employes: [], typesTravaux: [], avenants: [], imprevus: [],
  journal: journalDeNJours(20), montantDevis: '30000',
};

const PARAMETRES = {
  employes: [],
  localites: [{ id: 1, nom: 'Genève', tarifJour: 50 }],
  typesTravaux: [{ id: 1, nom: 'Cloisons', unite: 'm²', tarifBase: 125 }],
  parametres: { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12, tauxTVA: 8.1, margeCible: 20 },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

// Helper — render Chantiers via le vrai contexte App, ctx pilotable
function renderChantiers(ctxOver = {}) {
  const ctx = {
    chantiers: [clone(CHANTIER_EN_COURS), clone(CHANTIER_TERMINE)],
    setChantiers: vi.fn(),
    clients: CLIENTS,
    setClients: vi.fn(),
    devis: DEVIS,
    setDevis: vi.fn(),
    factures: [],
    setFactures: vi.fn(),
    pointages: [],
    setPointages: vi.fn(),
    parametres: clone(PARAMETRES),
    naviguer: vi.fn(),
    contexte: {},
    afficherNotif: vi.fn(),
    confirmer: vi.fn().mockResolvedValue(true),
    agentState: {},
    periodeGlobale: 'an',
    ...ctxOver,
  };
  const result = renderWithApp(<Chantiers />, ctx);
  return { ...result, ctx };
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  // jsdom n'implémente pas matchMedia (requis par useIsMobile) → polyfill desktop
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    });
  }
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// LISTE + FILTRES
// ─────────────────────────────────────────────────────────────────────────────

describe('ChantiersPage — liste & filtres', () => {
  it('affiche le titre et les chantiers (vrai rendu liste)', () => {
    renderChantiers();
    expect(screen.getByText('Chantiers')).toBeInTheDocument();
    expect(screen.getByText('Bureaux Dupont')).toBeInTheDocument();
    expect(screen.getByText('Villa Martin')).toBeInTheDocument();
  });

  it('filtre "Terminé" → ne montre que le chantier terminé', () => {
    renderChantiers();
    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }));
    expect(screen.getByText('Villa Martin')).toBeInTheDocument();
    expect(screen.queryByText('Bureaux Dupont')).not.toBeInTheDocument();
  });

  it('filtre "En cours" → ne montre que le chantier en cours', () => {
    renderChantiers();
    fireEvent.click(screen.getByRole('button', { name: 'En cours' }));
    expect(screen.getByText('Bureaux Dupont')).toBeInTheDocument();
    expect(screen.queryByText('Villa Martin')).not.toBeInTheDocument();
  });

  it('liste vide → message "Aucun chantier à afficher"', () => {
    renderChantiers({ chantiers: [] });
    expect(screen.getByText(/Aucun chantier à afficher/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ÉDITION (le seul flux de création de form dans ChantiersPage)
// ─────────────────────────────────────────────────────────────────────────────

describe('ChantiersPage — édition', () => {
  // Ouvre le form d'édition pour un chantier donné via le bouton Modifier de sa ligne
  function ouvrirEdition(nomChantier = 'Bureaux Dupont') {
    const r = renderChantiers();
    const ligne = screen.getByText(nomChantier).closest('tr');
    fireEvent.click(within(ligne).getByTitle('Modifier'));
    return r;
  }

  it('clic Modifier → ouvre le form pré-rempli "Modifier le chantier"', () => {
    ouvrirEdition();
    expect(screen.getByText('Modifier le chantier')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bureaux Dupont')).toBeInTheDocument();
    expect(screen.getByDisplayValue('GE')).toBeInTheDocument();
  });

  it('éditer nom + canton + statut → setChantiers avec les bons champs (même id)', () => {
    const { ctx } = ouvrirEdition();
    fireEvent.change(screen.getByDisplayValue('Bureaux Dupont'), { target: { value: 'Bureaux Dupont V2' } });
    fireEvent.change(screen.getByDisplayValue('GE'), { target: { value: 'VD' } });
    // statut : le select affiche "En cours"
    const statutSelect = screen.getByDisplayValue('En cours');
    fireEvent.change(statutSelect, { target: { value: 'Suspendu' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le suivi/i }));

    const arg = ctx.setChantiers.mock.calls.at(-1)[0];
    const maj = arg.find(c => c.id === 1);
    expect(maj.nom).toBe('Bureaux Dupont V2');
    expect(maj.canton).toBe('VD');
    expect(maj.statut).toBe('Suspendu');
    // l'id est conservé (édition, pas création)
    expect(arg.filter(c => c.id === 1)).toHaveLength(1);
  });

  it('éditer nombreJours → reflété dans setChantiers', () => {
    const { ctx } = ouvrirEdition();
    // nombreJours = 10 dans la fixture (input number)
    const nbInput = screen.getByDisplayValue('10');
    fireEvent.change(nbInput, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le suivi/i }));
    const arg = ctx.setChantiers.mock.calls.at(-1)[0];
    expect(arg.find(c => c.id === 1).nombreJours).toBe('15');
  });

  it('nombreJours guard form : saisir 0 → clampé au min (1)', () => {
    ouvrirEdition();
    const nbInput = screen.getByDisplayValue('10');
    fireEvent.change(nbInput, { target: { value: '0' } });
    // le form clampe en dessous de min=1
    expect(nbInput.value).toBe('1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AVANCEMENT — money : auto-dérivé, borné [0, 100]
// ─────────────────────────────────────────────────────────────────────────────

describe('ChantiersPage — avancement (auto-dérivé, borné)', () => {
  function ouvrirEdition(chantier) {
    const r = renderChantiers({ chantiers: [clone(chantier)] });
    const ligne = screen.getByText(chantier.nom).closest('tr');
    fireEvent.click(within(ligne).getByTitle('Modifier'));
    return r;
  }

  it('avancement JAMAIS > 100 : journal (20 j) > nombreJours (10) → saved = 100', () => {
    const surActivite = { ...clone(CHANTIER_EN_COURS), nombreJours: 10, journal: journalDeNJours(20) };
    const { ctx } = ouvrirEdition(surActivite);
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le suivi/i }));
    const arg = ctx.setChantiers.mock.calls.at(-1)[0];
    const maj = arg.find(c => c.id === surActivite.id);
    expect(maj.avancement).toBe(100); // Math.min(100, 200%) = 100
  });

  it('avancement JAMAIS négatif : journal vide → saved = 0', () => {
    const sansJournal = { ...clone(CHANTIER_EN_COURS), nombreJours: 10, journal: [] };
    const { ctx } = ouvrirEdition(sansJournal);
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le suivi/i }));
    const arg = ctx.setChantiers.mock.calls.at(-1)[0];
    expect(arg.find(c => c.id === sansJournal.id).avancement).toBe(0);
  });

  it('avancement proportionnel : journal 3 j / nombreJours 10 → 30%', () => {
    const partiel = { ...clone(CHANTIER_EN_COURS), nombreJours: 10, journal: journalDeNJours(3) };
    const { ctx } = ouvrirEdition(partiel);
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le suivi/i }));
    const arg = ctx.setChantiers.mock.calls.at(-1)[0];
    expect(arg.find(c => c.id === partiel.id).avancement).toBe(30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPPRESSION + CASCADE
// ─────────────────────────────────────────────────────────────────────────────

describe('ChantiersPage — suppression protégée (Option 2)', () => {
  function supprimer(nomChantier, ctxOver) {
    const r = renderChantiers(ctxOver);
    const ligne = screen.getByText(nomChantier).closest('tr');
    fireEvent.click(within(ligne).getByTitle('Supprimer'));
    return r;
  }

  // Pointage liant un employé au chantier via repartitions[].chantierId
  const pointageLie = (id, chantierId) => ({
    id, date: '2026-01-01', employeId: 1,
    repartitions: [{ chantierId, categorie: 'production', heures: 8 }],
  });

  it('coquille vide (sans pointage ni facture) → suppression AUTORISÉE', async () => {
    const { ctx } = supprimer('Bureaux Dupont', { factures: [], pointages: [] });
    await waitFor(() => expect(ctx.setChantiers).toHaveBeenCalled());
    const arg = ctx.setChantiers.mock.calls.at(-1)[0];
    expect(arg.some(c => String(c.id) === '1')).toBe(false);
    expect(arg.some(c => String(c.id) === '2')).toBe(true);
  });

  it('🐛→✅ chantier AVEC pointages → suppression BLOQUÉE (zéro orphelin)', async () => {
    const pointages = [pointageLie('P1', 1), pointageLie('P2', 2)];
    const { ctx } = supprimer('Bureaux Dupont', { pointages, factures: [] });
    // message d'information affiché, AUCUNE mutation
    await waitFor(() => expect(ctx.afficherNotif).toHaveBeenCalled());
    expect(ctx.afficherNotif.mock.calls.at(-1)[0]).toMatch(/Terminé ou Annulé|heures pointées/i);
    expect(ctx.setChantiers).not.toHaveBeenCalled();
    expect(ctx.setPointages).not.toHaveBeenCalled(); // pas d'orphelin : le chantier reste
    expect(ctx.setFactures).not.toHaveBeenCalled();
  });

  it('chantier AVEC factures (sans pointage) → suppression BLOQUÉE', async () => {
    const factures = [{ id: 'F1', chantierId: 1, montantTTC: 1000 }];
    const { ctx } = supprimer('Bureaux Dupont', { factures, pointages: [] });
    await waitFor(() => expect(ctx.afficherNotif).toHaveBeenCalled());
    expect(ctx.setChantiers).not.toHaveBeenCalled();
    expect(ctx.setFactures).not.toHaveBeenCalled();
  });

  it('chantier AVEC pointage ET facture → suppression BLOQUÉE', async () => {
    const factures = [{ id: 'F1', chantierId: 1, montantTTC: 1000 }];
    const pointages = [pointageLie('P1', 1)];
    const { ctx } = supprimer('Bureaux Dupont', { factures, pointages });
    await waitFor(() => expect(ctx.afficherNotif).toHaveBeenCalled());
    expect(ctx.setChantiers).not.toHaveBeenCalled();
    expect(ctx.setPointages).not.toHaveBeenCalled();
    expect(ctx.setFactures).not.toHaveBeenCalled();
  });

  it('coquille vide + confirm=false → AUCUNE suppression', async () => {
    const confirmer = vi.fn().mockResolvedValue(false);
    const { ctx } = supprimer('Bureaux Dupont', { confirmer, factures: [], pointages: [] });
    await waitFor(() => expect(confirmer).toHaveBeenCalled());
    expect(ctx.setChantiers).not.toHaveBeenCalled();
  });

  it('passer en Terminé via le form → chantier conservé, pointages + factures intacts', () => {
    const factures = [{ id: 'F1', chantierId: 1, montantTTC: 1000 }];
    const pointages = [pointageLie('P1', 1)];
    const { ctx } = renderChantiers({ factures, pointages });
    const ligne = screen.getByText('Bureaux Dupont').closest('tr');
    fireEvent.click(within(ligne).getByTitle('Modifier'));
    fireEvent.change(screen.getByDisplayValue('En cours'), { target: { value: 'Terminé' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le suivi/i }));
    // chantier conservé avec nouveau statut, même id
    const arg = ctx.setChantiers.mock.calls.at(-1)[0];
    const maj = arg.find(c => c.id === 1);
    expect(maj.statut).toBe('Terminé');
    // rien n'est effacé : ni factures, ni pointages
    expect(ctx.setFactures).not.toHaveBeenCalled();
    expect(ctx.setPointages).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GARDE-FOU FORM
// ─────────────────────────────────────────────────────────────────────────────

describe('ChantierForm — robustesse', () => {
  it('parametres sans typesTravaux → pas de crash à l\'ouverture du form', () => {
    const params = clone(PARAMETRES);
    delete params.typesTravaux;
    renderChantiers({ parametres: params });
    const ligne = screen.getByText('Bureaux Dupont').closest('tr');
    // ne doit pas throw (garde || [])
    expect(() => fireEvent.click(within(ligne).getByTitle('Modifier'))).not.toThrow();
    expect(screen.getByText('Modifier le chantier')).toBeInTheDocument();
  });
});
