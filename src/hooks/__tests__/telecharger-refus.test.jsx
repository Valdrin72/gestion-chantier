import React from 'react';
import { useApp } from '../../context/AppContext';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, act, screen, fireEvent } from '@testing-library/react';

const store = vi.hoisted(() => ({ row: null, reads: [], writes: [], handlers: [], readError: null, writeError: null, deferRead: null, deferWrite: null, org: false }));
const deconnecter = vi.hoisted(() => vi.fn());
vi.mock('../useAuth', () => ({
  DEMO_USER_ID: 'demo',
  default: () => ({ session: { user: { id: store.demo ? 'demo' : 'user' } }, profil: store.profil || (store.profil = { id: 'cyna', nom: 'CYNA', pages: ['dashboard'] }), loading: false, deconnecter }),
}));
vi.mock('../../useAgents', () => ({ default: () => store.agents || (store.agents = {}) }));
vi.mock('../../modules/alertes/useAlertBootstrap', () => ({ useAlertBootstrap: () => {} }));
vi.mock('../../pages/Dashboard', () => ({ default: () => { const app = useApp(); store.app = app; return <div>Tableau de bord chargé<button onClick={() => app.setClients([{ id: 'saisie' }])}>Modifier test</button><button onClick={() => app.deconnecter()}>Déconnexion test</button></div>; } }));
vi.mock('../../lib/supabase', () => {
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  function from(table) {
    let op, payload;
    const filters = {};
    const execute = async () => {
      const gate = store.deferWrite;
      store.deferWrite = null;
      store.writes.push({ op, table, payload: clone(payload), filters: { ...filters } });
      if (gate) await gate;
      if (store.writeError) return { error: store.writeError };
      if (op === 'upsert') { store.row = { data: clone(payload.data) }; return { error: null }; }
      if (op === 'insert') {
        if (store.row) return { error: { code: '23505' } };
        store.row = { id: 'row', numero: '__cyna_storage__', data: clone(payload.data), version: 0 };
        return { data: { id: 'row', version: 0 }, error: null };
      }
      // E1 — le coffre org (org_storage) est la même ligne en mémoire, ciblée par org_id = 'ORG'.
      const cible = table === 'org_storage' ? filters.org_id === 'ORG' : filters.id === store.row?.id;
      if (!store.row || !cible || (filters.version !== undefined && filters.version !== store.row.version)) return { data: [], error: null };
      if (payload.version !== store.row.version + 1) return { error: { code: 'P0409' } };
      store.row = { ...store.row, data: clone(payload.data), version: payload.version };
      return { data: [table === 'org_storage' ? { org_id: 'ORG', version: store.row.version } : { id: store.row.id, version: store.row.version }], error: null };
    };
    const b = {
      eq(k, v) { filters[k] = v; return b; },
      select() { return op === 'update' ? execute() : b; },
      limit() { return Promise.resolve({ data: [{ org_id: 'ORG' }], error: null }); },
      async maybeSingle() {
        store.reads.push(table);
        const snapshot = table === 'org_storage' && store.row ? { ...clone(store.row), org_id: 'ORG' } : clone(store.row);
        const gate = store.deferRead;
        store.deferRead = null;
        if (gate) return await gate;
        if (store.readError instanceof Error) throw store.readError;
        return { data: snapshot, error: store.readError };
      },
      update(p) { op = 'update'; payload = p; return b; },
      insert(p) { op = 'insert'; payload = p; return b; },
      single: execute,
      upsert(p) { op = 'upsert'; payload = p; return execute(); },
    };
    return b;
  }
  return { supabase: {
    from,
    channel: () => ({ on(event, filter, handler) { store.handlers.push(handler); return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn(),
  } };
});

import useSupabaseData from '../useSupabaseData';
import { supabase } from '../../lib/supabase';
import { BandeauSauvegarde, EcranErreurChargement } from '../../components/EtatSauvegarde';
import App from '../../App';
import { regenererJournalDepuisPointages } from '../../migration/regenererJournalDepuisPointages';
import { conserverBrouillonRefuse } from '../../utils/gardeEdition';

const blob = () => ({ chantiers: [], devis: [{ id: 'initial' }], factures: [], clients: [], pointages: [], parametres: { employes: [{ id: 1, tarifJour: 350 }, { id: 2, tarifJour: 450 }] } });
const row = (version = 0, data = blob()) => ({ id: 'row', numero: '__cyna_storage__', version, data });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function settle() { await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); }); }
async function tick(ms = 900) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function boot() { const hook = renderHook(() => useSupabaseData('user')); await settle(); return hook; }
function distant(version = 1) { store.row = row(version, { ...blob(), devis: [{ id: 'distant' }] }); }
function emit() { act(() => store.handlers.forEach(handler => handler({ new: store.row }))); }
function visible() { act(() => document.dispatchEvent(new Event('visibilitychange'))); }
const copies = () => Object.keys(localStorage).filter(k => k.startsWith('cyna_sauvegarde_rejetee_'))
  .sort((a, b) => parseInt(b.slice(24), 10) - parseInt(a.slice(24), 10))
  .map(k => JSON.parse(localStorage.getItem(k)));
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('cyna_onboarding_done', '1');
  window.matchMedia = query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
  deconnecter.mockClear();
  delete process.env.REACT_APP_STORAGE_MODE;
  Object.assign(store, { row: row(), reads: [], writes: [], handlers: [], readError: null, writeError: null, deferRead: null, deferWrite: null, demo: false });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());


// Lot « modifications refusées » : après un conflit, les modifications mises de côté peuvent être
// téléchargées, même quand la copie locale a échoué (stockage plein).
const telechargements = vi.hoisted(() => ({ appels: [], erreur: null }));
vi.mock('../../utils/importControle', async original => ({
  ...(await original()),
  telechargerTexte: (texte, nom) => { if (telechargements.erreur) throw telechargements.erreur; telechargements.appels.push({ texte, nom }); },
}));
beforeEach(() => { telechargements.appels = []; telechargements.erreur = null; });
const fichier = (i = 0) => JSON.parse(telechargements.appels[i].texte);
async function conflit(h, { plein = false } = {}) {
  distant();
  const spy = plein ? vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('plein'); }) : null;
  try { act(() => h.result.current.setClients([{ id: 'refuse', nom: 'Client refusé' }])); await tick(); await settle(); }
  finally { spy?.mockRestore(); }
}

describe('télécharger les modifications refusées', () => {
  it('R1 : rien à télécharger tant qu\'aucun conflit n\'a eu lieu', async () => {
    const h = await boot();
    expect(h.result.current.refusDisponible).toBe(false);
    expect(h.result.current.telechargerRefus()).toBe(false);
    expect(telechargements.appels).toHaveLength(0);
  });
  it('R2 : stockage plein au conflit → message qui renvoie au bouton, téléchargement complet et relisible', async () => {
    const h = await boot();
    await conflit(h, { plein: true });
    expect(h.result.current.etatSync.statut).toBe('conflit');
    expect(h.result.current.etatSync.message).toMatch(/n'a pas pu être conservée/);
    expect(h.result.current.etatSync.message).toMatch(/Télécharger mes modifications refusées/);
    expect(h.result.current.devis).toEqual([{ id: 'distant' }]);
    expect(h.result.current.refusDisponible).toBe(true);
    let ok; act(() => { ok = h.result.current.telechargerRefus(); });
    expect(ok).toBe(true);
    expect(telechargements.appels).toHaveLength(1);
    expect(telechargements.appels[0].nom).toMatch(/^cyna-modifications-refusees-\d{4}-\d\d-\d\dT[\d-]+\.json$/);
    const f = fichier();
    expect(f.clients).toEqual([{ id: 'refuse', nom: 'Client refusé' }]);
    expect(f.devis).toEqual([{ id: 'initial' }]);
    expect(f.parametres.employes).toHaveLength(2);
    expect(f.meta).toMatchObject({ app: 'CYNA', version: 1, source: 'modifications-refusees' });
    const { verifierSauvegarde } = await import('../../utils/importControle');
    expect(verifierSauvegarde(f).erreurs).toEqual([]);
  });
  it('R3 : copie locale réussie → le téléchargement reste disponible', async () => {
    const h = await boot();
    await conflit(h);
    expect(h.result.current.etatSync.message).toMatch(/copie de vos modifications non enregistrées est conservée/);
    expect(h.result.current.refusDisponible).toBe(true);
    act(() => { h.result.current.telechargerRefus(); });
    expect(fichier().clients).toEqual([{ id: 'refuse', nom: 'Client refusé' }]);
  });
  it('R4 : rechargement impossible après le conflit → le message renvoie aussi au bouton', async () => {
    const h = await boot();
    distant();
    store.readError = new Error('réseau');
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('plein'); });
    try { act(() => h.result.current.setClients([{ id: 'refuse' }])); await tick(); await settle(); }
    finally { spy.mockRestore(); }
    expect(h.result.current.etatSync.erreurChargement).toMatch(/Télécharger mes modifications refusées/);
    expect(h.result.current.refusDisponible).toBe(true);
    act(() => { h.result.current.telechargerRefus(); });
    expect(fichier().clients).toEqual([{ id: 'refuse' }]);
  });
});

describe('App : bouton « Télécharger mes modifications refusées »', () => {
  it('R5 : absent sans conflit, présent dans le bandeau de conflit, et télécharge', async () => {
    render(<App />); await settle(); await tick();
    expect(screen.queryByText('Télécharger mes modifications refusées')).toBeNull();
    distant(store.row.version + 1);
    fireEvent.click(screen.getByText('Modifier test')); await tick(); await settle();
    const alerte = screen.getByRole('alert');
    expect(alerte).toHaveTextContent("Quelqu'un a enregistré entre-temps");
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger mes modifications refusées' }));
    expect(telechargements.appels).toHaveLength(1);
    expect(fichier().clients).toEqual([{ id: 'saisie' }]);
    expect(screen.getByRole('button', { name: 'Compris' })).toBeInTheDocument();
  });
  it('R6 : échec du téléchargement → alerte, données gardées', async () => {
    render(<App />); await settle(); await tick();
    distant(store.row.version + 1);
    fireEvent.click(screen.getByText('Modifier test')); await tick(); await settle();
    telechargements.erreur = new Error('bloqué');
    const alerte = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger mes modifications refusées' }));
    expect(alerte).toHaveBeenCalledWith(expect.stringMatching(/Téléchargement impossible/));
    alerte.mockRestore();
  });
});

describe('refus sans copie locale : jamais perdus en silence', () => {
  it('R7 : deux conflits de suite, stockage plein → le premier refus est joint au téléchargement', async () => {
    const h = await boot();
    await conflit(h, { plein: true });
    expect(h.result.current.refusNonSauve).toBe(true);
    store.row = row(2, { ...blob(), devis: [{ id: 'distant2' }] });
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('plein'); });
    try { act(() => h.result.current.setClients([{ id: 'second' }])); await tick(); await settle(); }
    finally { spy.mockRestore(); }
    expect(h.result.current.devis).toEqual([{ id: 'distant2' }]);
    act(() => { h.result.current.telechargerRefus(); });
    const f = fichier();
    expect(f.clients).toEqual([{ id: 'second' }]);
    expect(f.refusPrecedents).toHaveLength(1);
    expect(f.refusPrecedents[0].donnees.clients).toEqual([{ id: 'refuse', nom: 'Client refusé' }]);
    expect(h.result.current.refusNonSauve).toBe(false);
    const { verifierSauvegarde } = await import('../../utils/importControle');
    expect(verifierSauvegarde(f).erreurs).toEqual([]);
  });
  it('R8 : copie locale réussie → rien à forcer ; stockage plein → fermeture de page et déconnexion avertissent', async () => {
    const h = await boot();
    await conflit(h);
    expect(h.result.current.refusNonSauve).toBe(false);
    store.row = row(2, { ...blob(), devis: [{ id: 'distant2' }] });
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('plein'); });
    try { act(() => h.result.current.setClients([{ id: 'second' }])); await tick(); await settle(); }
    finally { spy.mockRestore(); }
    expect(h.result.current.refusNonSauve).toBe(true);
    const evt = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    let ok; await act(async () => { ok = await h.result.current.terminerSauvegardes(); });
    expect(ok).toBe(false);
    act(() => { h.result.current.abandonnerRefus(); });
    expect(h.result.current.refusNonSauve).toBe(false);
  });
  it('R9 : App — « Compris » remplacé tant que non téléchargé ; bandeau maintenu ; téléchargement puis fermeture', async () => {
    render(<App />); await settle(); await tick();
    distant(store.row.version + 1);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('plein'); });
    try { fireEvent.click(screen.getByText('Modifier test')); await tick(); await settle(); }
    finally { spy.mockRestore(); }
    expect(screen.queryByRole('button', { name: 'Compris' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger mes modifications refusées' }));
    expect(fichier().clients).toEqual([{ id: 'saisie' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Compris' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('R10 : App — après « Compris » impossible, l\'abandon demande confirmation ; « Garder » conserve le bandeau', async () => {
    render(<App />); await settle(); await tick();
    distant(store.row.version + 1);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('plein'); });
    try { fireEvent.click(screen.getByText('Modifier test')); await tick(); await settle(); }
    finally { spy.mockRestore(); }
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner ces modifications' })); await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Garder' })); await settle();
    expect(screen.getByRole('button', { name: 'Télécharger mes modifications refusées' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner ces modifications' })); await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner' })); await settle();
    expect(screen.queryByRole('button', { name: 'Abandonner ces modifications' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Compris' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(telechargements.appels).toHaveLength(0);
  });
  it('R11 : App — un enregistrement réussi ensuite ne fait pas disparaître le téléchargement', async () => {
    render(<App />); await settle(); await tick();
    distant(store.row.version + 1);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('plein'); });
    try { fireEvent.click(screen.getByText('Modifier test')); await tick(); await settle(); }
    finally { spy.mockRestore(); }
    act(() => store.app.setClients([{ id: 'apres' }])); await tick(); await settle();
    expect(store.row.data.clients).toEqual([{ id: 'apres' }]);
    expect(screen.getByRole('alert')).toHaveTextContent("Des modifications refusées n'ont pas pu être copiées");
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger mes modifications refusées' }));
    expect(fichier().clients).toEqual([{ id: 'saisie' }]);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
