import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, act, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';

const store = vi.hoisted(() => ({ row: null, reads: [], writes: [], handlers: [], readError: null, writeError: null, deferRead: null, deferWrite: null, org: false }));
const deconnecter = vi.hoisted(() => vi.fn());
vi.mock('../useAuth', () => ({
  DEMO_USER_ID: 'demo',
  default: () => ({ session: { user: { id: 'user' } }, profil: { id: 'cyna', nom: 'CYNA', pages: ['dashboard'] }, loading: false, deconnecter }),
}));
vi.mock('../../useAgents', () => ({ default: () => ({}) }));
vi.mock('../../modules/alertes/useAlertBootstrap', () => ({ useAlertBootstrap: () => {} }));
vi.mock('../../pages/Dashboard', () => ({ default: () => <div>Tableau de bord chargé</div> }));
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

import useSupabaseData from '../useSupabaseData';
import { supabase } from '../../lib/supabase';
import { BandeauSauvegarde, EcranErreurChargement } from '../../components/EtatSauvegarde';
import App from '../../App';

const blob = () => ({ chantiers: [], devis: [{ id: 'initial' }], factures: [], clients: [], pointages: [], parametres: { employes: [{ id: 1, tarifJour: 350 }, { id: 2, tarifJour: 450 }] } });
const row = (version = 0, data = blob()) => ({ id: 'row', numero: '__cyna_storage__', version, data });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function settle() { await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); }); }
async function tick(ms = 900) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function boot() { const hook = renderHook(() => useSupabaseData('user')); await settle(); return hook; }
function distant(version = 1) { store.row = row(version, { ...blob(), devis: [{ id: 'distant' }] }); }
function emit() { act(() => store.handlers.forEach(handler => handler({ new: store.row }))); }
function visible() { act(() => document.dispatchEvent(new Event('visibilitychange'))); }
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('cyna_onboarding_done', '1');
  window.matchMedia = query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
  deconnecter.mockClear();
  delete process.env.REACT_APP_STORAGE_MODE;
  Object.assign(store, { row: row(), reads: [], writes: [], handlers: [], readError: null, writeError: null, deferRead: null, deferWrite: null });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('anti-écrasement user : vrai hook et serveur en mémoire', () => {
  it('T1 : deux appareils, le deuxième recharge sans écraser et conserve le rejet', async () => {
    const a = await boot(); const b = await boot();
    act(() => a.result.current.setDevis([{ id: 'A' }])); await tick();
    act(() => b.result.current.setDevis([{ id: 'B' }])); await tick();
    expect(store.row.data.devis).toEqual([{ id: 'A' }]);
    expect(b.result.current.devis).toEqual([{ id: 'A' }]);
    expect(b.result.current.etatSync.statut).toBe('conflit');
    expect(JSON.parse(localStorage.getItem('cyna_sauvegarde_rejetee')).devis).toEqual([{ id: 'B' }]);
    expect(store.writes.map(w => w.filters.version)).toEqual([0, 0]);
  });
  it.each([{ message: 'JWT' }, new Error('réseau')])('T2 : échec lecture %j bloque toute écriture, puis Réessayer restaure le compte', async error => {
    store.readError = error;
    const h = await boot();
    expect(h.result.current.etatSync.erreurChargement).toBeTruthy();
    act(() => h.result.current.setDevis([{ id: 'interdit' }])); await tick(1500);
    expect(store.writes).toHaveLength(0);
    store.readError = null;
    await act(async () => h.result.current.reessayerChargement());
    expect(h.result.current.devis).toEqual([{ id: 'initial' }]);
    expect(h.result.current.etatSync.erreurChargement).toBeNull();
    act(() => h.result.current.setDevis([{ id: 'autorisé' }])); await tick();
    expect(store.row.data.devis).toEqual([{ id: 'autorisé' }]);
  });
  it('T3 : bandeau réel, payload conservé et bouton Réessayer', async () => {
    function AppSync() {
      const h = useSupabaseData('user');
      return <><button onClick={() => h.setDevis([{ id: 'local' }])}>Modifier</button><BandeauSauvegarde {...h.etatSync} onReessayer={h.reessayerSauvegarde} /></>;
    }
    render(<AppSync />); await settle(); store.writeError = { message: 'offline' };
    fireEvent.click(screen.getByText('Modifier')); await tick();
    expect(screen.getByRole('alert')).toHaveTextContent('Non enregistré');
    await tick(3000); expect(store.writes).toHaveLength(1);
    store.writeError = null;
    fireEvent.click(screen.getByText('Réessayer')); await settle();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(store.row.data.devis).toEqual([{ id: 'local' }]);
  });
  it('T4 : temps réel ignoré pendant édition locale, sauvegarde en conflit', async () => {
    const h = await boot(); act(() => h.result.current.setDevis([{ id: 'local' }]));
    distant(); emit(); expect(h.result.current.devis).toEqual([{ id: 'local' }]);
    await tick(); expect(h.result.current.etatSync.statut).toBe('conflit');
    expect(store.row.data.devis).toEqual([{ id: 'distant' }]);
  });
  it('T5 : écran bloquant avec les deux actions réelles', () => {
    const retry = vi.fn(), logout = vi.fn();
    render(<EcranErreurChargement message="Erreur de lecture" onReessayer={retry} onDeconnecter={logout} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Erreur de lecture');
    fireEvent.click(screen.getByText('Réessayer')); fireEvent.click(screen.getByText('Se déconnecter'));
    expect(retry).toHaveBeenCalledOnce(); expect(logout).toHaveBeenCalledOnce();
  });
  it('App réel : erreur remplace le Dashboard ; Réessayer recharge, les updaters App préservent les employés', async () => {
    store.readError = { message: 'offline' };
    render(<App />); await settle(); await tick(1500);
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger');
    expect(screen.queryByText('Tableau de bord chargé')).toBeNull();
    expect(store.writes).toHaveLength(0);
    fireEvent.click(screen.getByText('Se déconnecter')); expect(deconnecter).toHaveBeenCalledOnce();
    store.readError = null;
    fireEvent.click(screen.getByText('Réessayer')); await settle();
    expect(screen.getByText('Tableau de bord chargé')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    await tick();
    expect(store.row.data.parametres.employes).toHaveLength(2);
    expect(store.row.data.parametres.backfillCoefMO10Done).toBe(true);
    expect(typeof store.row.data.parametres).toBe('object');
  });
  it('T6 : lecture visibilité lente jetée si une édition commence', async () => {
    const h = await boot(), gate = deferred();
    store.deferRead = gate.promise; visible();
    distant(); act(() => h.result.current.setDevis([{ id: 'local' }]));
    gate.resolve({ data: store.row }); await settle();
    expect(h.result.current.devis).toEqual([{ id: 'local' }]);
    await tick(); expect(h.result.current.etatSync.statut).toBe('conflit');
  });
  it('T7 + T7b : P, Q en vol et R en récupération sont rejetés ; seule une édition après récupération repart', async () => {
    const h = await boot(), write = deferred(), read = deferred();
    store.deferWrite = write.promise;
    act(() => h.result.current.setDevis([{ id: 'P' }])); await tick();
    act(() => h.result.current.setClients([{ id: 'Q' }]));
    // Le timer Q attend déjà P : il doit être invalidé par la récupération.
    await tick();
    distant(); store.deferRead = read.promise;
    write.resolve(); await settle();
    expect(h.result.current.etatSync.message).toContain('Rechargement');
    act(() => h.result.current.setFactures([{ id: 'R' }])); await tick(1500);
    const rejected = JSON.parse(localStorage.getItem('cyna_sauvegarde_rejetee'));
    expect(rejected.devis).toEqual([{ id: 'P' }]); expect(rejected.clients).toEqual([{ id: 'Q' }]); expect(rejected.factures).toEqual([{ id: 'R' }]);
    read.resolve({ data: store.row }); await settle(); await tick(1500);
    expect(store.writes).toHaveLength(1);
    expect(store.row.data.devis).toEqual([{ id: 'distant' }]);
    act(() => h.result.current.setDevis([{ id: 'après' }])); await tick();
    expect(store.row.data.devis).toEqual([{ id: 'après' }]); expect(store.row.version).toBe(2);
  });
  it.each(['user', 'org'])('T8/T15 : updaters fonctionnels résolus, employés préservés (%s)', async mode => {
    localStorage.setItem('cyna_storage_mode', mode);
    const h = await boot();
    act(() => {
      h.result.current.setParametres(prev => ({ ...prev, migrationJournalV2Done: true }));
      h.result.current.setDevis(prev => [...prev, { id: 'ajout' }]);
      h.result.current.setClients(prev => [...prev, { id: 'client' }]);
      h.result.current.setFactures(prev => [...prev, { id: 'facture' }]);
    }); await tick();
    const payload = store.writes[0].payload.data;
    expect(payload.parametres.employes).toHaveLength(2); expect(payload.parametres.migrationJournalV2Done).toBe(true);
    expect(payload.devis).toHaveLength(2); expect(payload.clients).toHaveLength(1); expect(payload.factures).toHaveLength(1);
    expect(Object.values(payload).some(v => typeof v === 'function')).toBe(false);
    expect(store.writes[0].table).toBe(mode === 'org' ? 'org_storage' : 'devis');
  });
  it('T9 : insert concurrent récupère le gagnant et rejette les changements locaux', async () => {
    store.row = null; const gate = deferred(); store.deferWrite = gate.promise;
    const h = await boot();
    act(() => h.result.current.setClients([{ id: 'local' }]));
    distant(); gate.resolve(); await settle(); await tick(1500);
    expect(h.result.current.devis).toEqual([{ id: 'distant' }]);
    expect(h.result.current.etatSync.erreurChargement).toBeNull(); expect(h.result.current.etatSync.statut).toBe('conflit');
    expect(store.writes).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('cyna_sauvegarde_rejetee')).clients).toEqual([{ id: 'local' }]);
  });
  it('T9 : deux vrais premiers chargements ne créent qu’une ligne', async () => {
    store.row = null;
    const gate = deferred(); store.deferWrite = gate.promise;
    const a = await boot();
    const b = await boot();
    expect(store.writes.map(w => w.op)).toEqual(['insert', 'insert']);
    expect(store.row.version).toBe(0);
    act(() => b.result.current.setDevis([{ id: 'gagnant' }])); await tick();
    gate.resolve(); await settle();
    expect(a.result.current.etatSync.statut).toBe('conflit');
    expect(a.result.current.devis).toEqual([{ id: 'gagnant' }]);
    expect(store.row.version).toBe(1);
    expect(store.writes).toHaveLength(3);
  });
  it('échec en vol : conserve P et les modifications Q plus récentes au réessai', async () => {
    const h = await boot(), gate = deferred(); store.deferWrite = gate.promise;
    act(() => h.result.current.setDevis([{ id: 'P' }])); await tick();
    act(() => h.result.current.setClients([{ id: 'Q' }]));
    store.writeError = { message: 'offline' }; gate.resolve(); await settle();
    await tick(1500); expect(store.writes).toHaveLength(1);
    store.writeError = null; await act(async () => h.result.current.reessayerSauvegarde());
    expect(store.row.data.devis).toEqual([{ id: 'P' }]); expect(store.row.data.clients).toEqual([{ id: 'Q' }]);
    expect(h.result.current.etatSync.statut).toBe('ok');
  });
  it('chargement initial faisant foi malgré une modification locale pendant la lecture', async () => {
    const gate = deferred(); store.deferRead = gate.promise;
    const h = await boot();
    act(() => h.result.current.setClients([{ id: 'avant-lecture' }]));
    gate.resolve({ data: store.row }); await settle(); await tick();
    expect(h.result.current.loading).toBe(false); expect(h.result.current.devis).toEqual([{ id: 'initial' }]);
    expect(store.writes).toHaveLength(0);
    act(() => h.result.current.setClients([{ id: 'après-lecture' }])); await tick();
    expect(store.row.data.clients).toEqual([{ id: 'après-lecture' }]);
  });
  it('T10 : le serveur simulé refuse un ancien client, le vrai hook avance de +1', async () => {
    const old = await supabase.from('devis').update({ data: {} }).eq('id', 'row').select();
    expect(old.error.code).toBe('P0409');
    const h = await boot(); act(() => h.result.current.setDevis([{ id: 'nouveau' }])); await tick();
    expect(store.writes[1].payload.version).toBe(1); expect(store.row.version).toBe(1);
  });
  it('T11 : temps réel v2 avant visibilité v1, v1 et écho v2 ignorés', async () => {
    const h = await boot(), gate = deferred(); store.deferRead = gate.promise; visible();
    const slow = row(1, { ...blob(), devis: [{ id: 'ancien' }] });
    distant(2); emit(); gate.resolve({ data: slow }); await settle();
    expect(h.result.current.devis).toEqual([{ id: 'distant' }]);
    act(() => store.handlers[0]({ new: slow }));
    act(() => store.handlers[0]({ new: row(2, blob()) }));
    expect(h.result.current.devis).toEqual([{ id: 'distant' }]);
    act(() => h.result.current.setClients([{ id: 'ok' }])); await tick(); expect(store.writes[0].filters.version).toBe(2);
  });
  it.each([false, true])('T13 : initialisation différée sérialisée (ligne vide %s)', async exists => {
    store.row = exists ? row(4, {}) : null;
    const gate = deferred(); store.deferWrite = gate.promise;
    const h = await boot(); act(() => h.result.current.setDevis([{ id: 'pendant-init' }])); await tick();
    expect(store.writes).toHaveLength(1);
    gate.resolve(); await settle();
    expect(store.writes).toHaveLength(2); expect(store.writes[1].op).toBe('update');
    expect(store.writes[1].filters.version).toBe(exists ? 5 : 0);
    expect(store.row.data.devis).toEqual([{ id: 'pendant-init' }]);
  });
  it('T14 : récupération échouée puis Réessayer de même version débloque', async () => {
    const h = await boot(); store.writeError = { code: 'P0409' }; store.readError = { message: 'offline' };
    act(() => h.result.current.setDevis([{ id: 'rejet' }])); await tick();
    expect(h.result.current.etatSync.erreurChargement).toBeTruthy();
    store.writeError = null; store.readError = null;
    await act(async () => h.result.current.reessayerChargement());
    expect(h.result.current.devis).toEqual([{ id: 'initial' }]); expect(h.result.current.etatSync.erreurChargement).toBeNull();
    act(() => h.result.current.setDevis([{ id: 'après' }])); await tick(); expect(store.row.data.devis).toEqual([{ id: 'après' }]);
  });
  it('migration : précontrôle sans destruction, trigger limité et index partiel', () => {
    const sql = readFileSync('supabase/migrations/20261004120000_devis_version_anti_ecrasement.sql', 'utf8');
    const code = sql.replace(/--[^\n]*/g, '').toLowerCase();
    expect(code).toContain('add column if not exists version');
    expect(code).toContain("old.numero = '__cyna_storage__'"); expect(code).toContain('new.version is distinct from old.version + 1');
    expect(code).toContain('security invoker set search_path'); expect(code).toContain('create trigger devis_version_garde before update');
    expect(code).toContain('create unique index if not exists devis_storage_un_par_user');
    expect(code).toContain("where numero = '__cyna_storage__'"); expect(code).toContain('having count(*) > 1');
    expect(code.indexOf('having count(*) > 1')).toBeLessThan(code.indexOf('alter table'));
    expect(code).not.toMatch(/delete\s+from|drop\s+table/);
  });
});
