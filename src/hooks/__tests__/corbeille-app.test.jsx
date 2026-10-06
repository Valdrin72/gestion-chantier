import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, act, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';

const store = vi.hoisted(() => ({ row: null, reads: [], writes: [], handlers: [], readError: null, writeError: null, deferRead: null, deferWrite: null, org: false }));
const capture = vi.hoisted(() => ({ ctx: null }));
const deconnecter = vi.hoisted(() => vi.fn());
vi.mock('../useAuth', () => ({
  DEMO_USER_ID: 'demo',
  default: () => ({ session: { user: { id: store.demo ? 'demo' : 'user' } }, profil: { id: 'cyna', nom: 'CYNA', pages: ['dashboard'] }, loading: false, deconnecter }),
}));
vi.mock('../../useAgents', () => ({ default: () => ({}) }));
vi.mock('../../modules/alertes/useAlertBootstrap', () => ({ useAlertBootstrap: () => {} }));
vi.mock('../../pages/Dashboard', async () => {
  const { useApp } = await import('../../context/AppContext');
  const { default: Clients } = await import('../../pages/ClientsPage');
  return { default: () => {
    capture.ctx = useApp();
    return <><Clients {...capture.ctx} /><span data-testid="clients-kpi">{capture.ctx.clients.length}</span></>;
  } };
});
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
      if (!store.row || filters.id !== store.row.id || (filters.version !== undefined && filters.version !== store.row.version)) return { data: [], error: null };
      if (payload.version !== store.row.version + 1) return { error: { code: 'P0409' } };
      store.row = { ...store.row, data: clone(payload.data), version: payload.version };
      return { data: [{ id: store.row.id, version: store.row.version }], error: null };
    };
    const b = {
      eq(k, v) { filters[k] = v; return b; },
      select() { return op === 'update' ? execute() : b; },
      limit() { return Promise.resolve({ data: [{ org_id: 'ORG' }], error: null }); },
      async maybeSingle() {
        store.reads.push(table);
        const snapshot = clone(store.row);
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

import { appliquerSurVisibles, mettreALaCorbeille, retirerDefinitivement, aPurger } from '../../utils/corbeille';
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


const client = { id: 'c', nom: 'Dupont', prenom: 'Marc' };
it('App et hook : disparaît des listes et KPI mais reste marqué dans blob', async () => {
 store.row = row(0, { ...blob(), clients: [client] }); render(<App />); await settle();
 expect(screen.getByTestId('clients-kpi')).toHaveTextContent('1');
 expect(screen.getByTestId('hero-kpi-total-clients')).toHaveTextContent('TOTAL CLIENTS1');
 act(() => capture.ctx.setClients(prev => prev.map(x => mettreALaCorbeille(x, 'Salihu')))); await tick();
 expect(screen.getByTestId('hero-kpi-total-clients')).toHaveTextContent('TOTAL CLIENTS0');
 expect(screen.getByTestId('clients-kpi')).toHaveTextContent('0'); expect(store.row.data.clients[0].supprime_le).toBeTruthy();
});
it('écriture non fonctionnelle conserve corbeille et refuse tableau périmé après destruction', async () => {
 store.row = row(0, { ...blob(), clients: [client] }); render(<App />); await settle();
 const setterPerime = capture.ctx.setClients;
 act(() => setterPerime(prev => prev.map(x => mettreALaCorbeille(x, 'Salihu')))); await tick();
 act(() => setterPerime([client, { id: 'nouveau' }])); await tick();
 expect(store.row.data.clients.find(x => x.id === 'c').supprime_le).toBeTruthy();
 act(() => capture.ctx.setDonneesListes(prev => retirerDefinitivement(prev, [{ type: 'clients', element: prev.clients.find(x => x.id === 'c') }]))); await tick();
 act(() => setterPerime([client, { id: 'nouveau' }])); await tick();
 expect(store.row.data.clients.some(x => x.id === 'c')).toBe(false); expect(store.row.data.parametres.idsSupprimes.clients).toEqual(['c']);
});
it('purge App 31 jours avec ids et garde 29 jours, sans réapparition', async () => {
 const now = Date.now();
 store.row = row(0, { ...blob(), clients: [{ ...client, supprime_le: new Date(now - 31*86400000).toISOString() }, { id: 'recent', supprime_le: new Date(now - 29*86400000).toISOString() }] });
 render(<App />); await settle(); await tick();
 expect(store.row.data.clients.map(x => x.id)).toEqual(['recent']); expect(store.row.data.parametres.idsSupprimes.clients).toEqual(['c']);
 act(() => capture.ctx.setClients([client])); await tick(); expect(store.row.data.clients.map(x => x.id)).toEqual(['recent']);
});
it('paramètres périmés ne perdent jamais ids supprimés', async () => {
 const h = await boot(); const perime = h.result.current.parametres;
 act(() => h.result.current.setParametres(prev => ({ ...prev, idsSupprimes: { clients: ['c'] } }))); await tick();
 act(() => h.result.current.setParametres(perime)); await tick();
 expect(store.row.data.parametres.idsSupprimes.clients).toEqual(['c']);
});
it('setter composé ne sauvegarde rien si neutre et une fois pour restauration groupée', async () => {
 store.row = row(0, { ...blob(), clients: [{ ...client, supprime_le: '2026-10-01' }], devis: [{ id: 'd', supprime_le: '2026-10-01' }] });
 const h = await boot(); act(() => h.result.current.setDonneesListes(prev => prev)); await tick(); expect(store.writes).toHaveLength(0);
 act(() => h.result.current.setDonneesListes(prev => ({ ...prev, clients: [client], devis: [{ id: 'd' }] }))); await tick();
 expect(store.writes).toHaveLength(1); expect(store.row.data.clients).toEqual([client]); expect(store.row.data.devis).toEqual([{ id: 'd' }]);
});
it('import remplace corbeille, unit ids et autorise réimport explicite', async () => {
 store.row = row(0, { ...blob(), clients: [{ ...client, supprime_le: '2026-10-01' }], parametres: { idsSupprimes: { clients: ['c', 'local'] } } });
 const h = await boot(); act(() => h.result.current.importerTout({ ...blob(), clients: [client], parametres: { idsSupprimes: { clients: ['import'] } } })); await tick();
 expect(store.row.data.clients).toEqual([client]); expect(store.row.data.parametres.idsSupprimes.clients).toEqual(['local', 'import']); expect(store.writes).toHaveLength(1);
});
it('org : purge dernier élément ne modifie pas état ni serveur', async () => {
 localStorage.setItem('cyna_storage_mode', 'org'); store.row = row(0, { ...blob(), devis: [], clients: [{ ...client, supprime_le: new Date(Date.now()-31*86400000).toISOString() }] });
 const h = await boot(); const prev = h.result.current.clients;
 act(() => h.result.current.setDonneesListes(p => retirerDefinitivement(p, aPurger(p), true))); await tick();
 expect(h.result.current.clients).toBe(prev); expect(store.writes).toHaveLength(0);
});
it('CORB-03 : opérations composées et import ne recopient jamais les pointages en cache local', async () => {
 store.row = row(0, { ...blob(), clients: [{ ...client, supprime_le: '2026-10-01' }], pointages: [{ id: 'p', repartitions: [] }] });
 const h = await boot(); localStorage.removeItem('cyna_pointages');
 act(() => h.result.current.setDonneesListes(prev => ({ ...prev, clients: [client] }))); await tick();
 expect(localStorage.getItem('cyna_pointages')).toBeNull(); expect(JSON.parse(localStorage.getItem('cyna_clients'))).toEqual([client]);
 act(() => h.result.current.importerTout({ ...blob(), clients: [client], pointages: [{ id: 'p2', repartitions: [] }] })); await tick();
 expect(localStorage.getItem('cyna_pointages')).toBeNull(); expect(JSON.parse(localStorage.getItem('cyna_devis'))).toEqual([{ id: 'initial' }]);
});
