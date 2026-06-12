import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import Parametres from '../ParametresPage';
import { renderWithApp } from '../../test-utils/renderWithApp';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PARAMS = {
  parametres: {
    tauxFraisGeneraux: 12,
    coefficientMainOeuvre: 1.35,
    tauxTVA: 8.1,
    margeCible: 20,
    seuilRentabiliteMin: 15,
    plafondCredi: 80,
  },
  employes: [
    { id: 1, nom: 'Jean Martin', poste: 'Ouvrier qualifié', tarifJour: 350, telephone: '079', email: 'j@cyna.ch' },
  ],
  typesTravaux: [
    { id: 10, nom: 'Carrelage', unite: 'm²', tarifBase: 80 },
  ],
  zones: [],
  localites: [],
};

const POINTAGES_FIXTURE = [
  { id: 'p1', date: '2026-05-01', employeId: 1, repartitions: [{ chantierId: 'c1', categorie: 'production', heures: 8 }] },
  { id: 'p2', date: '2026-05-02', employeId: 1, repartitions: [{ chantierId: 'c1', categorie: 'production', heures: 7.5 }] },
];

const clone = (o) => JSON.parse(JSON.stringify(o));

// Helper — render Parametres avec props pilotables + renvoie les props (spies)
function renderParametres(over = {}, ctxOver = {}) {
  const props = {
    parametres: clone(PARAMS),
    setParametres: vi.fn(),
    clients: [],
    setClients: vi.fn(),
    chantiers: [],
    setChantiers: vi.fn(),
    devis: [],
    setDevis: vi.fn(),
    factures: [],
    setFactures: vi.fn(),
    pointages: [],
    setPointages: vi.fn(),
    naviguer: vi.fn(),
    ...over,
  };
  const confirmer = ctxOver.confirmer ?? vi.fn().mockResolvedValue(true);
  const afficherNotif = ctxOver.afficherNotif ?? vi.fn();
  const result = renderWithApp(<Parametres {...props} />, { confirmer, afficherNotif, ...ctxOver });
  return { ...result, props, confirmer, afficherNotif };
}

// Helpers backup
const makeFile = (obj) =>
  new File([typeof obj === 'string' ? obj : JSON.stringify(obj)], 'backup.json', { type: 'application/json' });
const getFileInput = (container) => container.querySelector('input[type="file"]');

// ── Setup : mock window.confirm + window.alert ────────────────────────────────
let confirmSpy;
let alertSpy;

beforeEach(() => {
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  // jsdom n'implémente pas Blob.text()/File.text() → polyfill via FileReader
  if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
    // eslint-disable-next-line no-extend-native
    Blob.prototype.text = function () {
      return new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.readAsText(this);
      });
    };
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURE DE BASE
// ─────────────────────────────────────────────────────────────────────────────

describe('Parametres — structure de base', () => {
  it('affiche le titre et les boutons backup', () => {
    renderParametres();
    expect(screen.getByText('Paramètres')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exporter backup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restaurer backup/i })).toBeInTheDocument();
  });

  it("démarre sur l'onglet Dashboard", () => {
    renderParametres();
    expect(screen.getByText('Paramètres du Dashboard')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARAMÈTRES DEVIS — tauxFG / coefMO / TVA
// ─────────────────────────────────────────────────────────────────────────────

describe('Parametres — onglet Devis (tauxFG / coefMO / TVA)', () => {
  function ouvrirDevis(over = {}) {
    const { props, ...rest } = renderParametres(over);
    fireEvent.click(screen.getByText('Devis'));
    return { props, ...rest };
  }

  it('éditer tauxFG (Frais généraux %) → setParametres avec la bonne valeur', () => {
    const { props } = ouvrirDevis();
    const card = screen.getByText('Frais généraux (%)').closest('div');
    const input = within(card).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '15' } });
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(arg.parametres.tauxFraisGeneraux).toBe(15);
  });

  it('éditer coefMO (Coeff. MO) → setParametres avec la bonne valeur', () => {
    const { props } = ouvrirDevis();
    const card = screen.getByText('Coeff. MO').closest('div');
    const input = within(card).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '1.5' } });
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(arg.parametres.coefficientMainOeuvre).toBe(1.5);
  });

  it('éditer TVA → setParametres avec la bonne valeur', () => {
    const { props } = ouvrirDevis();
    const card = screen.getByText('TVA (%)').closest('div');
    const input = within(card).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '7.7' } });
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(arg.parametres.tauxTVA).toBe(7.7);
  });

  it('valeur VIDE sur un taux financier → 0 (jamais NaN)', () => {
    const { props } = ouvrirDevis();
    const card = screen.getByText('Frais généraux (%)').closest('div');
    const input = within(card).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '' } });
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(Number.isNaN(arg.parametres.tauxFraisGeneraux)).toBe(false);
    expect(arg.parametres.tauxFraisGeneraux).toBe(0);
  });

  it('coefMO NÉGATIF → clampé à 0 (jamais négatif → pas de coût MO négatif)', () => {
    const { props } = ouvrirDevis();
    const card = screen.getByText('Coeff. MO').closest('div');
    const input = within(card).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-5' } });
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(arg.parametres.coefficientMainOeuvre).toBe(0);
  });

  it('saisie décimale "8.1" sur TVA (champ vide au départ) → stockée 8.1, buffer "8.1"', () => {
    // tauxTVA absent → buffer démarre vide → on prouve qu\'on peut taper un décimal complet
    const params = clone(PARAMS);
    delete params.parametres.tauxTVA;
    const { props } = ouvrirDevis({ parametres: params });
    const card = screen.getByText('TVA (%)').closest('div');
    const input = within(card).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '8.1' } });
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(arg.parametres.tauxTVA).toBe(8.1);
    // le buffer affiché conserve bien la saisie décimale
    expect(input.value).toBe('8.1');
  });

  it('saisie décimale "1.0" sur coefMO → buffer conserve "1.0", stocke 1', () => {
    // coefMO démarre à 1.35 → "1.0" diffère → onChange déclenché
    const { props } = ouvrirDevis();
    const card = screen.getByText('Coeff. MO').closest('div');
    const input = within(card).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '1.0' } });
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(arg.parametres.coefficientMainOeuvre).toBe(1);
    expect(input.value).toBe('1.0');
  });

  it('les 6 champs financiers : valeur vide → 0, jamais NaN/négatif', () => {
    const champs = [
      ['Marge cible (%)', 'margeCible'],
      ['Seuil min. (%)', 'seuilRentabiliteMin'],
      ['Plafond crédibilité (%)', 'plafondCredi'],
      ['Frais généraux (%)', 'tauxFraisGeneraux'],
      ['Coeff. MO', 'coefficientMainOeuvre'],
      ['TVA (%)', 'tauxTVA'],
    ];
    for (const [label, key] of champs) {
      const { props, unmount } = ouvrirDevis();
      const card = screen.getByText(label).closest('div');
      const input = within(card).getByRole('spinbutton');
      // vide → 0
      fireEvent.change(input, { target: { value: '' } });
      let arg = props.setParametres.mock.calls.at(-1)[0];
      expect(Number.isNaN(arg.parametres[key])).toBe(false);
      expect(arg.parametres[key]).toBe(0);
      // négatif → 0
      fireEvent.change(input, { target: { value: '-99' } });
      arg = props.setParametres.mock.calls.at(-1)[0];
      expect(arg.parametres[key]).toBe(0);
      unmount();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPES DE TRAVAUX — CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe('Parametres — onglet Travaux (typesTravaux CRUD)', () => {
  function ouvrirTravaux(over = {}) {
    const r = renderParametres(over);
    fireEvent.click(screen.getByText('Travaux'));
    return r;
  }

  it('ajouter un type → reflété dans parametres.typesTravaux', () => {
    const { props } = ouvrirTravaux();
    fireEvent.change(screen.getByPlaceholderText('Ex: Bardage'), { target: { value: 'Peinture' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Ajouter/i }));
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(arg.typesTravaux.some(t => t.nom === 'Peinture')).toBe(true);
  });

  it('ajouter sans nom → ignoré (setParametres non appelé)', () => {
    const { props } = ouvrirTravaux();
    fireEvent.click(screen.getByRole('button', { name: /\+ Ajouter/i }));
    expect(props.setParametres).not.toHaveBeenCalled();
  });

  it('éditer le nom d\'un type existant → reflété', () => {
    const { props } = ouvrirTravaux();
    const input = screen.getByDisplayValue('Carrelage');
    fireEvent.change(input, { target: { value: 'Carrelage fin' } });
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(arg.typesTravaux.find(t => t.id === 10).nom).toBe('Carrelage fin');
  });

  it('supprimer un type (confirm=true) → retiré de typesTravaux', () => {
    confirmSpy.mockReturnValue(true);
    const { props } = ouvrirTravaux();
    fireEvent.click(screen.getByRole('button', { name: /^Suppr$/i }));
    expect(confirmSpy).toHaveBeenCalled();
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(arg.typesTravaux.some(t => t.id === 10)).toBe(false);
  });

  it('supprimer un type (confirm=false) → conservé', () => {
    confirmSpy.mockReturnValue(false);
    const { props } = ouvrirTravaux();
    fireEvent.click(screen.getByRole('button', { name: /^Suppr$/i }));
    expect(props.setParametres).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYÉS — CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe('Parametres — onglet Employés (CRUD)', () => {
  function ouvrirEmployes(over = {}) {
    const r = renderParametres(over);
    fireEvent.click(screen.getByText('Employés'));
    return r;
  }

  it('ajouter un employé (nom + tarifJour) → reflété, tarifJour parsé en number', () => {
    const { props } = ouvrirEmployes();
    fireEvent.change(screen.getByPlaceholderText('Jean Martin'), { target: { value: 'Bob Dupuis' } });
    fireEvent.change(screen.getByPlaceholderText('350'), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Ajouter/i }));
    const arg = props.setParametres.mock.calls.at(-1)[0];
    const added = arg.employes.find(e => e.nom === 'Bob Dupuis');
    expect(added).toBeDefined();
    expect(added.tarifJour).toBe(400);
    expect(typeof added.tarifJour).toBe('number');
  });

  it('ajouter sans tarifJour → ignoré', () => {
    const { props } = ouvrirEmployes();
    fireEvent.change(screen.getByPlaceholderText('Jean Martin'), { target: { value: 'Sans tarif' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Ajouter/i }));
    expect(props.setParametres).not.toHaveBeenCalled();
  });

  it('éditer un employé existant → tarifJour mis à jour', () => {
    const { props } = ouvrirEmployes();
    fireEvent.click(screen.getByRole('button', { name: /Modifier/i }));
    const tarifInput = screen.getByDisplayValue('350');
    fireEvent.change(tarifInput, { target: { value: '450' } });
    fireEvent.click(screen.getByRole('button', { name: /^OK$/i }));
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(arg.employes.find(e => e.id === 1).tarifJour).toBe(450);
  });

  it('éditer avec nom vide → alerte, pas de sauvegarde', () => {
    const { props } = ouvrirEmployes();
    fireEvent.click(screen.getByRole('button', { name: /Modifier/i }));
    fireEvent.change(screen.getByDisplayValue('Jean Martin'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^OK$/i }));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('nom'));
    expect(props.setParametres).not.toHaveBeenCalled();
  });

  it('éditer avec tarif <= 0 → alerte, pas de sauvegarde', () => {
    const { props } = ouvrirEmployes();
    fireEvent.click(screen.getByRole('button', { name: /Modifier/i }));
    fireEvent.change(screen.getByDisplayValue('350'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /^OK$/i }));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('tarif'));
    expect(props.setParametres).not.toHaveBeenCalled();
  });

  it('désactiver un employé → actif:false (jamais retiré, historique conservé)', () => {
    const { props } = ouvrirEmployes();
    fireEvent.click(screen.getByRole('button', { name: /Désactiver/i }));
    const arg = props.setParametres.mock.calls.at(-1)[0];
    // L'employé EXISTE toujours — il est juste désactivé
    const emp = arg.employes.find(e => e.id === 1);
    expect(emp).toBeDefined();
    expect(emp.actif).toBe(false);
  });

  it('réactiver un employé désactivé → actif:true', () => {
    const params = clone(PARAMS);
    params.employes[0].actif = false;
    const { props } = ouvrirEmployes({ parametres: params });
    fireEvent.click(screen.getByRole('button', { name: /Réactiver/i }));
    const arg = props.setParametres.mock.calls.at(-1)[0];
    expect(arg.employes.find(e => e.id === 1).actif).toBe(true);
  });

  it('aucun bouton de suppression dure ("Suppr") pour les employés', () => {
    ouvrirEmployes();
    expect(screen.queryByRole('button', { name: /^Suppr$/i })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CARNET CLIENTS (EditClientRow) — suppression protégée
// ─────────────────────────────────────────────────────────────────────────────

describe('Parametres — carnet clients : suppression protégée', () => {
  const CLIENT = { id: 'CL-1', nom: 'Pictet', prenom: 'Banque' };

  function ouvrirClients(over = {}, ctxOver = {}) {
    const r = renderParametres({ clients: [CLIENT], ...over }, ctxOver);
    fireEvent.click(screen.getByText(/Clients/i));
    return r;
  }

  it('supprimer un client vierge → confirmer puis setClients (retiré)', async () => {
    const confirmer = vi.fn().mockResolvedValue(true);
    const { props } = ouvrirClients({}, { confirmer });
    fireEvent.click(screen.getByRole('button', { name: /^Suppr$/i }));
    await waitFor(() => expect(confirmer).toHaveBeenCalledOnce());
    await waitFor(() => expect(props.setClients).toHaveBeenCalledOnce());
    const arg = props.setClients.mock.calls.at(-1)[0];
    expect(arg.some(cl => String(cl.id) === 'CL-1')).toBe(false);
  });

  it('client avec chantier → bouton Archiver (pas Suppr), clic → setClients avec archive:true', async () => {
    const confirmer = vi.fn().mockResolvedValue(true);
    const { props } = ouvrirClients(
      { chantiers: [{ id: 'CH-1', clientId: 'CL-1' }] },
      { confirmer },
    );
    // Référencé → pas de "Suppr" dur, mais un bouton "Archiver"
    expect(screen.queryByRole('button', { name: /^Suppr$/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Archiver/i }));
    await waitFor(() => expect(props.setClients).toHaveBeenCalledOnce());
    const arg = props.setClients.mock.calls.at(-1)[0];
    const cl = arg.find(c => String(c.id) === 'CL-1');
    expect(cl.archive).toBe(true);
    expect(typeof cl.dateArchivage).toBe('string');
  });

  it('client avec devis → bouton Archiver présent', () => {
    ouvrirClients({ devis: [{ id: 'D-1', clientId: 'CL-1' }] });
    expect(screen.queryByRole('button', { name: /^Suppr$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Archiver/i })).toBeInTheDocument();
  });

  it('client archivé masqué de la liste active ; toggle + Restaurer → archive:false', async () => {
    const confirmer = vi.fn().mockResolvedValue(true);
    const { props } = ouvrirClients(
      { clients: [{ ...CLIENT, archive: true, dateArchivage: '2026-06-01T00:00:00.000Z' }] },
      { confirmer },
    );
    // Masqué de la liste active
    expect(screen.queryByText(/Pictet/)).toBeNull();
    // Toggle → la ligne archivée apparaît avec Restaurer
    fireEvent.click(screen.getByRole('button', { name: /Voir 1 client archivé/i }));
    expect(screen.getByText(/Pictet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Restaurer$/i }));
    await waitFor(() => expect(props.setClients).toHaveBeenCalledOnce());
    expect(props.setClients.mock.calls.at(-1)[0].find(c => String(c.id) === 'CL-1').archive).toBe(false);
  });

  it('n\'utilise plus window.confirm — passe par confirmer() du contexte', async () => {
    const confirmer = vi.fn().mockResolvedValue(true);
    ouvrirClients({}, { confirmer });
    fireEvent.click(screen.getByRole('button', { name: /^Suppr$/i }));
    await waitFor(() => expect(confirmer).toHaveBeenCalledOnce());
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT BACKUP — contenu complet
// ─────────────────────────────────────────────────────────────────────────────

describe('Parametres — EXPORT backup', () => {
  function spyBlob() {
    let captured;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { captured = b; return 'blob:test'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    return () => captured;
  }

  it('export contient chantiers / devis / factures / clients / parametres + meta CYNA', async () => {
    const get = spyBlob();
    renderParametres({
      chantiers: [{ id: 'c1', nom: 'Chantier', extras: [{ id: 'ex1', description: 'Mur' }] }],
      devis: [{ id: 'd1', montantHT: 1000 }],
      factures: [{ id: 'f1', montantTTC: 1081 }],
      clients: [{ id: 'cl1', nom: 'Dupont' }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Exporter backup/i }));
    const blob = get();
    expect(blob).toBeDefined();
    const data = JSON.parse(await blob.text());
    expect(data.chantiers).toHaveLength(1);
    expect(data.devis).toHaveLength(1);
    expect(data.factures).toHaveLength(1);
    expect(data.clients).toHaveLength(1);
    expect(data.parametres).toBeDefined();
    expect(data.meta.app).toBe('CYNA');
  });

  it('export inclut les 6 clés top-level du blob Supabase (garde-fou anti-régression)', async () => {
    const get = spyBlob();
    renderParametres({
      chantiers: [{ id: 'c1' }],
      devis: [{ id: 'd1' }],
      factures: [{ id: 'f1' }],
      clients: [{ id: 'cl1' }],
      pointages: [{ id: 'p1' }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Exporter backup/i }));
    const data = JSON.parse(await get().text());
    // Les 6 clés définies dans CLAUDE.md §2 : blob = {chantiers, devis, factures, clients, parametres, pointages}
    for (const key of ['chantiers', 'devis', 'factures', 'clients', 'parametres', 'pointages']) {
      expect(data).toHaveProperty(key);
    }
  });

  it('export inclut les pointages (source de vérité heures/coûts)', async () => {
    const get = spyBlob();
    renderParametres({ pointages: clone(POINTAGES_FIXTURE) });
    fireEvent.click(screen.getByRole('button', { name: /Exporter backup/i }));
    const data = JSON.parse(await get().text());
    expect(data.pointages).toHaveLength(2);
    expect(data.pointages[0].id).toBe('p1');
    expect(data.pointages[1].id).toBe('p2');
  });

  it('export inclut les extras (imbriqués dans chantier.extras)', async () => {
    const get = spyBlob();
    renderParametres({
      chantiers: [{ id: 'c1', extras: [{ id: 'ex1', description: 'Mur supp', montantForfait: 3000 }] }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Exporter backup/i }));
    const data = JSON.parse(await get().text());
    expect(data.chantiers[0].extras).toHaveLength(1);
    expect(data.chantiers[0].extras[0].description).toBe('Mur supp');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT BACKUP — round-trip, écrasement, robustesse, rétrocompat
// ─────────────────────────────────────────────────────────────────────────────

describe('Parametres — IMPORT backup', () => {
  // Backup format actuel (avec pointages)
  const BACKUP_VALIDE = {
    meta: { date: '2026-01-01', version: 1, app: 'CYNA' },
    parametres: { parametres: { tauxTVA: 7.7 }, employes: [] },
    chantiers: [{ id: 'NEW_C' }],
    devis: [{ id: 'NEW_D' }],
    factures: [{ id: 'NEW_F' }],
    clients: [{ id: 'NEW_CL' }],
    pointages: [{ id: 'NEW_P', date: '2026-01-01', employeId: 1, repartitions: [] }],
  };

  // Backup ancien format (sans pointages) — rétrocompatibilité
  const BACKUP_ANCIEN = {
    meta: { date: '2025-12-01', version: 1, app: 'CYNA' },
    parametres: { parametres: { tauxTVA: 8.1 }, employes: [] },
    chantiers: [{ id: 'OLD_C' }],
    devis: [{ id: 'OLD_D' }],
    factures: [{ id: 'OLD_F' }],
    clients: [{ id: 'OLD_CL' }],
    // pas de clé pointages
  };

  it('import valide + confirm=true → ÉCRASE toutes les données (replace, pas merge)', async () => {
    confirmSpy.mockReturnValue(true);
    const { container, props } = renderParametres({ chantiers: [{ id: 'OLD_C' }], clients: [{ id: 'OLD_CL' }] });
    fireEvent.change(getFileInput(container), { target: { files: [makeFile(BACKUP_VALIDE)] } });

    await waitFor(() => expect(props.setChantiers).toHaveBeenCalled());
    expect(props.setChantiers).toHaveBeenCalledWith([{ id: 'NEW_C' }]);
    expect(props.setDevis).toHaveBeenCalledWith([{ id: 'NEW_D' }]);
    expect(props.setFactures).toHaveBeenCalledWith([{ id: 'NEW_F' }]);
    expect(props.setClients).toHaveBeenCalledWith([{ id: 'NEW_CL' }]);
    expect(props.setParametres).toHaveBeenCalledWith({ parametres: { tauxTVA: 7.7 }, employes: [] });
  });

  it('import valide → restaure les pointages (setPointages appelé)', async () => {
    confirmSpy.mockReturnValue(true);
    const { container, props } = renderParametres();
    fireEvent.change(getFileInput(container), { target: { files: [makeFile(BACKUP_VALIDE)] } });
    await waitFor(() => expect(props.setPointages).toHaveBeenCalled());
    expect(props.setPointages).toHaveBeenCalledWith([{ id: 'NEW_P', date: '2026-01-01', employeId: 1, repartitions: [] }]);
  });

  it('round-trip export→import : pointages identiques après restauration', async () => {
    // 1. Export
    let captured;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { captured = b; return 'blob:x'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const exportData = {
      chantiers: [{ id: 'c1', nom: 'A', extras: [{ id: 'e1' }] }],
      devis: [{ id: 'd1' }],
      factures: [{ id: 'f1' }],
      clients: [{ id: 'cl1' }],
      pointages: clone(POINTAGES_FIXTURE),
    };
    const { container, props, unmount } = renderParametres(exportData);
    fireEvent.click(screen.getByRole('button', { name: /Exporter backup/i }));
    const exported = JSON.parse(await captured.text());
    unmount();

    // 2. Réimport du fichier exporté
    confirmSpy.mockReturnValue(true);
    const second = renderParametres({ chantiers: [], devis: [], factures: [], clients: [], pointages: [] });
    fireEvent.change(getFileInput(second.container), { target: { files: [makeFile(exported)] } });
    await waitFor(() => expect(second.props.setChantiers).toHaveBeenCalled());

    expect(second.props.setChantiers).toHaveBeenCalledWith(exportData.chantiers);
    expect(second.props.setDevis).toHaveBeenCalledWith(exportData.devis);
    expect(second.props.setFactures).toHaveBeenCalledWith(exportData.factures);
    expect(second.props.setClients).toHaveBeenCalledWith(exportData.clients);
    expect(second.props.setPointages).toHaveBeenCalledWith(exportData.pointages);
  });

  it('rétrocompat : backup ANCIEN FORMAT (sans pointages) → pas de crash, setPointages([]), alerte avertissement', async () => {
    confirmSpy.mockReturnValue(true);
    const { container, props } = renderParametres({ pointages: clone(POINTAGES_FIXTURE) });
    fireEvent.change(getFileInput(container), { target: { files: [makeFile(BACKUP_ANCIEN)] } });
    await waitFor(() => expect(props.setChantiers).toHaveBeenCalled());
    // Pas de crash — comportement gracieux
    expect(props.setPointages).toHaveBeenCalledWith([]);
    // Avertissement visible pour signaler la perte potentielle
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/pointages|version antérieure/i));
  });

  it('rétrocompat : data.pointages non-array (malformé) → traité comme absent, setPointages([])', async () => {
    confirmSpy.mockReturnValue(true);
    const backupMalformed = { ...BACKUP_ANCIEN, pointages: 'pas un tableau' };
    const { container, props } = renderParametres();
    fireEvent.change(getFileInput(container), { target: { files: [makeFile(backupMalformed)] } });
    await waitFor(() => expect(props.setChantiers).toHaveBeenCalled());
    // Non-array → garde identique à absent → pas de crash
    expect(props.setPointages).toHaveBeenCalledWith([]);
  });

  it('import JSON malformé → alerte + AUCUN écrasement', async () => {
    const { container, props } = renderParametres({ chantiers: [{ id: 'OLD' }] });
    fireEvent.change(getFileInput(container), { target: { files: [makeFile('{ ceci nest pas du json')] } });
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(props.setChantiers).not.toHaveBeenCalled();
    expect(props.setParametres).not.toHaveBeenCalled();
    expect(props.setClients).not.toHaveBeenCalled();
  });

  it('import structure incorrecte (chantiers non-array) → alerte "invalide" + aucun écrasement', async () => {
    const mauvais = { parametres: {}, chantiers: 'pas un tableau', devis: [], factures: [], clients: [] };
    const { container, props } = renderParametres({ chantiers: [{ id: 'OLD' }] });
    fireEvent.change(getFileInput(container), { target: { files: [makeFile(mauvais)] } });
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('invalide')));
    expect(props.setChantiers).not.toHaveBeenCalled();
    expect(props.setParametres).not.toHaveBeenCalled();
  });

  it('import partiel (parametres manquant) → alerte + aucun écrasement', async () => {
    const partiel = { chantiers: [], devis: [], factures: [], clients: [] };
    const { container, props } = renderParametres({ chantiers: [{ id: 'OLD' }] });
    fireEvent.change(getFileInput(container), { target: { files: [makeFile(partiel)] } });
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(props.setChantiers).not.toHaveBeenCalled();
  });

  it('import valide mais confirm=false → AUCUN écrasement (annulation utilisateur)', async () => {
    confirmSpy.mockReturnValue(false);
    const { container, props } = renderParametres({ chantiers: [{ id: 'OLD' }] });
    fireEvent.change(getFileInput(container), { target: { files: [makeFile(BACKUP_VALIDE)] } });
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(props.setChantiers).not.toHaveBeenCalled();
    expect(props.setParametres).not.toHaveBeenCalled();
  });
});
