import React from 'react';
import { useApp } from '../../context/AppContext';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, act, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';

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
    deconnecter.mockResolvedValue({ ok: false });
    fireEvent.click(screen.getByText('Se déconnecter')); await settle(); expect(deconnecter).toHaveBeenCalledOnce();
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
    expect(h.result.current.clients).toEqual([]);
    expect(localStorage.getItem('cyna_clients')).toBeNull();
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
  it("F1 : updater différé par React + temps réel avant le rendu → pas d'écrasement", async () => {
    const h = await boot();
    act(() => {
      // Une 1re mise à jour d'état sur le même composant rend l'updater suivant DIFFÉRÉ au rendu.
      h.result.current.fermerMessageSync();
      h.result.current.setDevis(prev => [...prev, { id: 'local' }]);
      // L'événement distant arrive AVANT que React n'exécute l'updater.
      distant(1); store.handlers.forEach(handler => handler({ new: store.row }));
    });
    await settle();
    expect(h.result.current.devis).toEqual([{ id: 'initial' }, { id: 'local' }]);
    await tick();
    expect(store.writes[0].filters.version).toBe(0);
    expect(store.row.data.devis).toEqual([{ id: 'distant' }]);
    expect(h.result.current.etatSync.statut).toBe('conflit');
  });
  it('F2 : Réessayer après récupération ratée annonce le conflit', async () => {
    const h = await boot(); store.writeError = { code: 'P0409' }; store.readError = { message: 'offline' };
    act(() => h.result.current.setDevis([{ id: 'rejet' }])); await tick();
    expect(h.result.current.etatSync.erreurChargement).toContain("n'ont pas été enregistrées");
    store.writeError = null; store.readError = null;
    await act(async () => h.result.current.reessayerChargement());
    expect(h.result.current.etatSync.erreurChargement).toBeNull();
    expect(h.result.current.etatSync.statut).toBe('conflit');
    expect(h.result.current.etatSync.message).toContain("Vos dernières modifications n'ont pas été enregistrées");
    expect(h.result.current.etatSync.message).not.toContain('Rechargement');
  });
  it('F3 : deux conflits successifs gardent les deux copies et le message les mentionne', async () => {
    const h = await boot();
    distant(1); act(() => h.result.current.setDevis([{ id: 'premier' }])); await tick(); await settle();
    expect(h.result.current.etatSync.message).toContain('copie de vos modifications non enregistrées');
    distant(2); act(() => h.result.current.setDevis([{ id: 'second' }])); await tick(); await settle();
    expect(copies().map(c => c.devis[0].id)).toEqual(['second', 'premier']);
    expect(JSON.parse(localStorage.getItem('cyna_sauvegarde_rejetee')).devis).toEqual([{ id: 'second' }]);
    expect(store.row.data.devis).toEqual([{ id: 'distant' }]);
  });
  it('REV-02 : quota partiel (index et pointeur refusés) → les copies des deux conflits restent intactes', async () => {
    const h = await boot();
    distant(1); act(() => h.result.current.setDevis([{ id: 'premier' }])); await tick(); await settle();
    const idPremier = copies()[0].id;
    const original = Storage.prototype.setItem;
    const espion = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (cle, valeur) {
      if (cle === 'cyna_sauvegarde_rejetee') throw new Error('QuotaExceededError');
      return original.call(this, cle, valeur);
    });
    try {
      distant(2); act(() => h.result.current.setDevis([{ id: 'second' }])); await tick(); await settle();
    } finally { espion.mockRestore(); }
    expect(JSON.parse(localStorage.getItem(`cyna_sauvegarde_rejetee_${idPremier}`)).devis).toEqual([{ id: 'premier' }]);
    const autres = Object.keys(localStorage).filter(k => k.startsWith('cyna_sauvegarde_rejetee_') && k !== `cyna_sauvegarde_rejetee_${idPremier}`);
    expect(autres).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(autres[0])).devis).toEqual([{ id: 'second' }]);
    expect(h.result.current.etatSync.message).toContain('copie de vos modifications non enregistrées');
  });
  it("REV-02 : la copie du 2e conflit échoue → la 1re reste intacte et le message ne ment pas", async () => {
    const h = await boot();
    distant(1); act(() => h.result.current.setDevis([{ id: 'premier' }])); await tick(); await settle();
    const idPremier = copies()[0].id;
    const original = Storage.prototype.setItem;
    const espion = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (cle, valeur) {
      if (String(cle).startsWith('cyna_sauvegarde_rejetee_') && cle !== `cyna_sauvegarde_rejetee_${idPremier}`) throw new Error('QuotaExceededError');
      return original.call(this, cle, valeur);
    });
    try {
      distant(2); act(() => h.result.current.setDevis([{ id: 'second' }])); await tick(); await settle();
    } finally { espion.mockRestore(); }
    expect(JSON.parse(localStorage.getItem(`cyna_sauvegarde_rejetee_${idPremier}`)).devis).toEqual([{ id: 'premier' }]);
    expect(h.result.current.etatSync.message).toContain("n'a pas pu être conservée");
  });
  it('REV-02 : au-delà de 5 conflits, seules les 5 dernières copies sont gardées', async () => {
    const h = await boot();
    for (let i = 1; i <= 6; i++) {
      distant(i); act(() => h.result.current.setDevis([{ id: `c${i}` }])); await tick(); await settle();
    }
    expect(copies().map(c => c.devis[0].id)).toEqual(['c6', 'c5', 'c4', 'c3', 'c2']);
  });
  it('REV-03 : 5 copies + 2 orphelines existantes → après un conflit, exactement les 5 plus récentes (dont la nouvelle)', async () => {
    const ancienne = (ms, id) => localStorage.setItem(`cyna_sauvegarde_rejetee_${ms}-x${id}`, JSON.stringify({ id: `${ms}-x${id}`, devis: [{ id }] }));
    [1000, 2000, 3000, 4000, 5000].forEach((ms, i) => ancienne(ms, `a${i + 1}`));
    ancienne(500, 'orpheline1'); ancienne(700, 'orpheline2');
    const h = await boot();
    distant(1); act(() => h.result.current.setDevis([{ id: 'nouvelle' }])); await tick(); await settle();
    expect(copies().map(c => c.devis[0].id)).toEqual(['nouvelle', 'a5', 'a4', 'a3', 'a2']);
  });
  it('REV-03 : le pointeur échoue sur plusieurs conflits d’affilée → la limite de 5 tient et la copie la plus récente est intacte', async () => {
    const h = await boot();
    const original = Storage.prototype.setItem;
    const espion = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (cle, valeur) {
      if (cle === 'cyna_sauvegarde_rejetee') throw new Error('QuotaExceededError');
      return original.call(this, cle, valeur);
    });
    try {
      for (let i = 1; i <= 8; i++) {
        distant(i); act(() => h.result.current.setDevis([{ id: `k${i}` }])); await tick(); await settle();
        await act(async () => { await vi.advanceTimersByTimeAsync(2); });
      }
    } finally { espion.mockRestore(); }
    const restantes = copies();
    expect(restantes).toHaveLength(5);
    expect(restantes[0].devis).toEqual([{ id: 'k8' }]);
    expect(restantes.map(c => c.devis[0].id)).toEqual(['k8', 'k7', 'k6', 'k5', 'k4']);
    expect(h.result.current.etatSync.message).toContain('copie de vos modifications non enregistrées');
  });
  it('REV-01 : un updater qui renvoie la même valeur ne déclenche aucune sauvegarde', async () => {
    const h = await boot();
    act(() => {
      h.result.current.setChantiers(prev => prev);
      h.result.current.setDevis(prev => prev);
      h.result.current.setFactures(prev => prev);
      h.result.current.setClients(prev => prev);
      h.result.current.setParametres(prev => prev);
      h.result.current.setPointages(prev => prev);
    });
    await tick(1500);
    expect(store.writes).toHaveLength(0);
    // Et le temps réel n'est pas bloqué : aucun jeton ne reste en attente.
    distant(1); emit(); expect(h.result.current.devis).toEqual([{ id: 'distant' }]);
  });
  it('REV-01 : vraie App avec pointages, deux instances en temps réel → aucune sauvegarde en boucle', async () => {
    const pointages = [{ id: 'P1', date: '2026-09-01', employeId: 1, repartitions: [{ chantierId: 'C1', categorie: 'production', heures: 8 }], deplacement: null, majoration: [] }];
    const chantiers = regenererJournalDepuisPointages(pointages, [{ id: 'C1', nom: 'Bureaux', devisId: 'D1', statut: 'En cours', journal: [] }]);
    const parametres = { employes: [{ id: 1, nom: 'Müller', tarifJour: 400 }], migrationJournalV2Done: true, backfillMajorationPhase4Done: true, backfillCoefMO10Done: true, coefficientMainOeuvre: 1 };
    const donnees = (devis) => ({ chantiers, devis, factures: [], clients: [], pointages, parametres });
    store.row = row(0, donnees([{ id: 'D1', numero: 'D-1' }]));
    render(<><App /><App /></>); await settle(); await tick(3000); await settle();
    expect(screen.getAllByText('Tableau de bord chargé')).toHaveLength(2);
    expect(store.writes).toHaveLength(0);
    // Un autre appareil enregistre : les deux instances l'appliquent, régénèrent le journal
    // (identique) et ne doivent RIEN renvoyer.
    store.row = row(1, donnees([{ id: 'D1', numero: 'D-1' }, { id: 'D2', numero: 'D-2' }]));
    emit(); await settle(); await tick(3000); await settle(); await tick(3000);
    expect(store.writes).toHaveLength(0);
    expect(store.row.version).toBe(1);
  });
  it("F3 : stockage plein → le message dit que la copie n'a pas pu être conservée", async () => {
    const h = await boot();
    const original = Storage.prototype.setItem;
    const espion = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (cle, valeur) {
      if (String(cle).startsWith('cyna_sauvegarde')) throw new Error('QuotaExceededError');
      return original.call(this, cle, valeur);
    });
    try {
      distant(1); act(() => h.result.current.setDevis([{ id: 'perdu' }])); await tick(); await settle();
      expect(h.result.current.etatSync.message).toContain("n'a pas pu être conservée");
    } finally { espion.mockRestore(); }
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

const PREFIXE_EP = 'cyna_sauvegarde_en_echec_user_';
const clesEpisode = () => Object.keys(localStorage).filter(k => k.startsWith(PREFIXE_EP));
const copieEpisode = () => { const k = clesEpisode().sort().at(-1); return k ? JSON.parse(localStorage.getItem(k)) : null; };
describe('suivi : chargement et épisode durable', () => {
  it('App démo : erreur bloquante puis reprise sans écran démo trompeur', async () => {
    store.demo = true; store.readError = { message: 'offline' };
    render(<App />); await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger');
    expect(screen.queryByText('Tableau de bord chargé')).toBeNull();
    store.readError = null; fireEvent.click(screen.getByText('Réessayer')); await settle();
    expect(screen.getByText('Tableau de bord chargé')).toBeInTheDocument();
  });
  it('beforeunload pendant debounce et vol, listener retiré après succès', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const h = await boot(); const gate = deferred(); store.deferWrite = gate.promise;
    const fermeture = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };
    act(() => h.result.current.setDevis([{ id: 'local' }])); expect(fermeture()).toBe(true);
    await tick(); expect(fermeture()).toBe(true);
    gate.resolve(); await settle(); expect(fermeture()).toBe(false);
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function)); remove.mockRestore();
  });
  it('quota à la mise à jour : original intact, nouvelle copie distincte si possible', async () => {
    const h = await boot(); store.writeError = { message: 'offline' };
    act(() => h.result.current.setDevis([{ id: 'premier' }])); await tick();
    const [key] = clesEpisode(), origine = localStorage.getItem(key);
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v) {
      if (k === key) throw new Error('quota');
      return original.call(this, k, v);
    });
    try {
      act(() => h.result.current.setDevis([{ id: 'dernier' }]));
      expect(localStorage.getItem(key)).toBe(origine);
      const copie = clesEpisode().find(k => k !== key);
      expect(JSON.parse(localStorage.getItem(copie)).devis[0].id).toBe('dernier');
      expect(h.result.current.etatSync.message).toContain("copie n'a pas pu être mise à jour");
    } finally { spy.mockRestore(); }
  });
  it('épisode transféré vers conflit seulement après persistance', async () => {
    const h = await boot(); store.writeError = { message: 'offline' };
    act(() => h.result.current.setPointages([{ id: 'local' }])); await tick();
    expect(clesEpisode()).toHaveLength(1);
    distant(); store.writeError = null;
    await act(async () => h.result.current.reessayerSauvegarde());
    expect(clesEpisode()).toHaveLength(0);
    expect(copies()[0].pointages[0].id).toBe('local');
  });
  it("six refus ne nettoient pas la copie ; copie d'une session précédente jamais touchée", async () => {
    const ancienne = 'cyna_sauvegarde_en_echec_user';
    const contenuAncien = JSON.stringify({ source: 'echec-sauvegarde', clients: [{ id: 'ancienne' }] });
    localStorage.setItem(ancienne, contenuAncien);
    const h = await boot(); store.writeError = { message: 'offline' };
    act(() => h.result.current.setClients([{ id: 'nouvelle' }])); await tick();
    expect(localStorage.getItem(ancienne)).toBe(contenuAncien);
    for (let n = 0; n < 6; n++) conserverBrouillonRefuse('devis', { id: n });
    act(() => h.result.current.setClients([{ id: 'dernière' }]));
    expect(copieEpisode().clients[0].id).toBe('dernière');
    expect(localStorage.getItem(ancienne)).toBe(contenuAncien);
  });
  it('quota pendant conflit : copie origine intacte et message exact', async () => {
    const h = await boot(); store.writeError = { message: 'offline' };
    act(() => h.result.current.setDevis([{ id: 'local' }])); await tick();
    const [key] = clesEpisode(); const origine = localStorage.getItem(key);
    distant(); store.writeError = null;
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v) {
      if (k.startsWith('cyna_sauvegarde_rejetee_')) throw new Error('quota');
      return original.call(this, k, v);
    });
    try {
      await act(async () => h.result.current.reessayerSauvegarde());
      expect(localStorage.getItem(key)).toBe(origine);
      expect(h.result.current.etatSync.message).toContain("copie n'a pas pu être mise à jour");
    } finally { spy.mockRestore(); }
  });
  it('App bloque la navigation pendant la lecture initiale', async () => {
    const gate = deferred(); store.deferRead = gate.promise;
    render(<App />); await settle();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement de vos données…');
    expect(screen.queryByText('Tableau de bord chargé')).toBeNull();
    gate.resolve({ data: store.row }); await settle();
    expect(screen.getByText('Tableau de bord chargé')).toBeInTheDocument();
  });
  it('les six setters ignorent leurs updaters et le cache avant lecture', async () => {
    const gate = deferred(); store.deferRead = gate.promise;
    const h = await boot(); const update = vi.fn(() => []);
    act(() => ['Chantiers', 'Devis', 'Factures', 'Clients', 'Parametres', 'Pointages'].forEach(k => h.result.current['set' + k](update)));
    expect(update).not.toHaveBeenCalled();
    expect(Object.keys(localStorage).filter(k => k !== 'cyna_onboarding_done')).toEqual([]);
    gate.resolve({ data: store.row }); await settle();
  });
  it('échec durable : pointages, debounce, vol et succès complet', async () => {
    const h = await boot(); store.writeError = { message: 'offline' };
    act(() => h.result.current.setPointages([{ id: 'P' }])); await tick();
    const [key] = clesEpisode();
    expect(JSON.parse(localStorage.getItem(key)).pointages).toEqual([{ id: 'P' }]);
    expect(h.result.current.etatSync.message).toContain('Ne fermez pas');
    const closing = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(closing);
    expect(closing.defaultPrevented).toBe(true);
    act(() => h.result.current.setClients([{ id: 'Q' }]));
    expect(JSON.parse(localStorage.getItem(key)).clients).toEqual([{ id: 'Q' }]);
    store.writeError = null; const gate = deferred(); store.deferWrite = gate.promise;
    act(() => { h.result.current.reessayerSauvegarde(); }); await settle();
    act(() => h.result.current.setDevis([{ id: 'R' }]));
    expect(JSON.parse(localStorage.getItem(key)).devis).toEqual([{ id: 'R' }]);
    gate.resolve(); await settle(); expect(localStorage.getItem(key)).not.toBeNull();
    await tick(); expect(localStorage.getItem(key)).toBeNull();
    const done = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(done);
    expect(done.defaultPrevented).toBe(false);
  });
  it('rechargement garde la copie ; Compris masque seulement le message', async () => {
    const h = await boot(); store.writeError = { message: 'offline' };
    act(() => h.result.current.setPointages([{ id: 'P' }])); await tick(); h.unmount();
    const next = await boot();
    expect(copieEpisode().pointages).toEqual([{ id: 'P' }]);
    expect(next.result.current.etatSync.message).toContain('session précédente');
    act(() => next.result.current.fermerMessageSync());
    expect(clesEpisode()).toHaveLength(1);
  });
  it("F1 : conflit avec stockage plein → la copie d'épisode n'est ni réécrite ni supprimée par la suite", async () => {
    const h = await boot(); store.writeError = { message: 'offline' };
    act(() => h.result.current.setDevis([{ id: 'rejet' }])); await tick();
    const [key] = clesEpisode();
    expect(JSON.parse(localStorage.getItem(key)).devis).toEqual([{ id: 'rejet' }]);
    distant(); store.writeError = null;
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
      if (String(k).startsWith('cyna_sauvegarde_rejetee_')) throw new Error('quota');
      return original.call(this, k, v);
    });
    try { await act(async () => h.result.current.reessayerSauvegarde()); } finally { spy.mockRestore(); }
    expect(h.result.current.etatSync.statut).toBe('conflit');
    act(() => h.result.current.setClients([{ id: 'apres' }])); await tick(); await settle();
    expect(store.row.data.clients).toEqual([{ id: 'apres' }]);
    expect(JSON.parse(localStorage.getItem(key)).devis).toEqual([{ id: 'rejet' }]);
  });
  it("F2 : après un incident de stockage, un conflit ordinaire n'affiche plus « la copie n'a pas pu être mise à jour »", async () => {
    const h = await boot(); store.writeError = { message: 'offline' };
    act(() => h.result.current.setDevis([{ id: 'rejet' }])); await tick();
    distant(); store.writeError = null;
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
      if (String(k).startsWith('cyna_sauvegarde_rejetee_')) throw new Error('quota');
      return original.call(this, k, v);
    });
    try { await act(async () => h.result.current.reessayerSauvegarde()); } finally { spy.mockRestore(); }
    expect(h.result.current.etatSync.message).toContain("copie n'a pas pu être mise à jour");
    // Conflit ordinaire, stockage disponible.
    distant(store.row.version + 1);
    act(() => h.result.current.setDevis([{ id: 'nouveau' }])); await tick(); await settle();
    expect(h.result.current.etatSync.statut).toBe('conflit');
    expect(h.result.current.etatSync.message).not.toContain("copie n'a pas pu être mise à jour");
  });
  it("REV-01 : les copies d'épisode d'une autre session restent intactes et sont signalées", async () => {
    const etrangere = 'cyna_sauvegarde_en_echec_user_1700000000000-abc';
    const contenu = JSON.stringify({ source: 'echec-sauvegarde', devis: [{ id: 'oubliee' }] });
    localStorage.setItem(etrangere, contenu);
    const h = await boot();
    expect(h.result.current.etatSync.message).toContain('session précédente');
    store.writeError = { message: 'offline' };
    act(() => h.result.current.setClients([{ id: 'nouvelle' }])); await tick();
    expect(localStorage.getItem(etrangere)).toBe(contenu);
    store.writeError = null; await act(async () => h.result.current.reessayerSauvegarde()); await settle();
    expect(localStorage.getItem(etrangere)).toBe(contenu);
  });
  it('REV-01 : deux instances (onglets) partageant le même stockage ne se volent pas leurs copies', async () => {
    const A = await boot(); const B = await boot();
    store.writeError = { message: 'offline' };
    act(() => A.result.current.setDevis([{ id: 'A-non-enregistre' }])); await tick();
    act(() => B.result.current.setClients([{ id: 'B-non-enregistre' }])); await tick();
    const lire = () => clesEpisode().map(k => JSON.parse(localStorage.getItem(k)));
    expect(clesEpisode()).toHaveLength(2);
    expect(lire().some(c => c.devis?.[0]?.id === 'A-non-enregistre')).toBe(true);
    expect(lire().some(c => c.clients?.[0]?.id === 'B-non-enregistre')).toBe(true);
    // A se rétablit et enregistre ; B reste « Non enregistré ».
    store.writeError = null;
    await act(async () => A.result.current.reessayerSauvegarde()); await settle();
    expect(A.result.current.etatSync.statut).not.toBe('echec');
    expect(clesEpisode()).toHaveLength(1);
    expect(lire()[0].clients[0].id).toBe('B-non-enregistre');
    // Une nouvelle modification de A n'écrase pas la copie de B.
    store.writeError = { message: 'offline' };
    act(() => A.result.current.setDevis([{ id: 'A2' }])); await tick();
    expect(lire().some(c => c.clients?.[0]?.id === 'B-non-enregistre')).toBe(true);
  });
  it("F3 : une sauvegarde de routine n'efface pas le bandeau « session précédente »", async () => {
    localStorage.setItem('cyna_sauvegarde_en_echec_user', JSON.stringify({ source: 'echec-sauvegarde', devis: [{ id: 'ancienne' }] }));
    const h = await boot();
    expect(h.result.current.etatSync.statut).toBe('information');
    act(() => h.result.current.setClients([{ id: 'routine' }])); await tick(); await settle();
    expect(store.row.data.clients).toEqual([{ id: 'routine' }]);
    expect(h.result.current.etatSync.statut).toBe('information');
    act(() => h.result.current.fermerMessageSync());
    expect(h.result.current.etatSync.statut).toBe('ok');
  });
  it('démo : lecture en échec bloque puis Réessayer active les setters', async () => {
    store.readError = { message: 'offline' };
    const h = renderHook(() => useSupabaseData('demo', true)); await settle();
    expect(h.result.current.etatSync.erreurChargement).toBeTruthy();
    const updater = vi.fn(() => []); act(() => h.result.current.setClients(updater));
    expect(updater).not.toHaveBeenCalled();
    store.readError = null; await act(async () => h.result.current.reessayerChargement());
    act(() => h.result.current.setClients(updater)); expect(updater).toHaveBeenCalled();
  });
});


describe('securite deconnexion : barriere et dernier envoi', () => {
  it('envoie immédiatement avant 800 ms', async () => {
    const h = await boot();
    act(() => h.result.current.setClients([{ id: 'dernier' }]));
    let ok; await act(async () => { ok = await h.result.current.terminerSauvegardes(); });
    expect(ok).toBe(true); expect(store.writes).toHaveLength(1);
    expect(store.row.data.clients).toEqual([{ id: 'dernier' }]);
  });
  it('sans modification : aucune écriture', async () => {
    const h = await boot(); let ok;
    await act(async () => { ok = await h.result.current.terminerSauvegardes(); });
    expect(ok).toBe(true); expect(store.writes).toHaveLength(0);
  });
  it('échec réseau : false et modification conservée pour réessayer', async () => {
    const h = await boot(); store.writeError = { message: 'réseau' };
    act(() => h.result.current.setClients([{ id: 'dernier' }]));
    let ok; await act(async () => { ok = await h.result.current.terminerSauvegardes(); });
    expect(ok).toBe(false); expect(h.result.current.clients).toEqual([{ id: 'dernier' }]);
    h.result.current.debloquerEcritures(); store.writeError = null;
    await act(async () => { ok = await h.result.current.terminerSauvegardes(); }); expect(ok).toBe(true);
  });
  it('import après le contrôle final : refus sans état ni écriture', async () => {
    const h = await boot(); await act(async () => { await h.result.current.terminerSauvegardes(); });
    expect(await h.result.current.importerTout({ ...blob(), clients: [{ id: 'tardif' }] })).toBe(false);
    await settle(); expect(h.result.current.clients).toEqual([]); expect(store.writes).toHaveLength(0);
    h.unmount(); expect(await h.result.current.importerTout(blob())).toBe(false);
  });
  it('refus avant contrôle final : false, compteur remis à zéro à annulation', async () => {
    const h = await boot(); h.result.current.bloquerEcritures();
    for (const key of ['setChantiers','setDevis','setFactures','setClients','setParametres','setPointages','setDonneesListes']) h.result.current[key](() => { throw new Error('écriture interdite'); });
    let ok; await act(async () => { ok = await h.result.current.terminerSauvegardes(); }); expect(ok).toBe(false);
    h.result.current.debloquerEcritures();
    await act(async () => { ok = await h.result.current.terminerSauvegardes(); }); expect(ok).toBe(true);
  });
  it.each([false, true])('conflit final, stockage plein=%s : false', async plein => {
    const h = await boot(); distant();
    act(() => h.result.current.setClients([{ id: 'rejet' }]));
    const spy = plein ? vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('plein'); }) : null;
    let ok; try { await act(async () => { ok = await h.result.current.terminerSauvegardes(); }); } finally { spy?.mockRestore(); }
    expect(ok).toBe(false); expect(h.result.current.etatSync.statut).toBe('conflit');
  });
  it('org : écriture non résolue reste en vol', async () => {
    localStorage.setItem('cyna_storage_mode', 'org'); const h = await boot();
    const gate = deferred(); store.deferWrite = gate.promise;
    act(() => h.result.current.setClients([{ id: 'org' }])); await tick();
    expect(await h.result.current.terminerSauvegardes()).toBe(false);
    gate.resolve(); await settle();
  });
});

const QUESTION = 'Des modifications ne sont pas enregistrées. Se déconnecter quand même ?';
describe('App : séquence de déconnexion sûre', () => {
  it('dernier envoi avant signOut ; double clic unique et application inerte', async () => {
    render(<App />); await settle(); await tick(); store.writes = [];
    const gate = deferred(); deconnecter.mockImplementation(() => { expect(store.row.data.clients).toEqual([{ id: 'saisie' }]); return gate.promise; });
    act(() => { fireEvent.click(screen.getByText('Modifier test'));
    fireEvent.click(screen.getByText('Déconnexion test')); fireEvent.click(screen.getByText('Déconnexion test')); }); await settle();
    expect(deconnecter).toHaveBeenCalledOnce(); const app = screen.getByTestId('application');
    expect(app).toHaveAttribute('inert'); expect(screen.getByRole('status')).toHaveTextContent('Déconnexion…'); expect(app.contains(screen.getByRole('status'))).toBe(false);
    const avantImport = store.writes.length;
    expect(await store.app.importerTout({ ...blob(), clients: [{ id: 'import-tardif' }] })).toBe(false); await settle();
    expect(store.row.data.clients).toEqual([{ id: 'saisie' }]); expect(store.writes).toHaveLength(avantImport);
    gate.resolve({ ok: false }); await settle(); expect(app).not.toHaveAttribute('inert'); expect(screen.getByText(/La d\u00e9connexion a/)).toHaveTextContent('La déconnexion a échoué. Vérifiez votre connexion et réessayez.');
    deconnecter.mockResolvedValue({ ok: true }); fireEvent.click(screen.getByText('Déconnexion test')); await settle(); expect(deconnecter).toHaveBeenCalledTimes(2);
  });
  it('échec sauvegarde : confirmation externe au conteneur inerte, annulation sans signOut', async () => {
    render(<App />); await settle(); await tick(); store.writeError = { message: 'offline' };
    localStorage.setItem('cyna_chat_history', 'secret'); fireEvent.click(screen.getByText('Modifier test')); fireEvent.click(screen.getByText('Déconnexion test')); await settle();
    expect(screen.getByText(QUESTION)).toBeTruthy(); const app = screen.getByTestId('application'); expect(app).toHaveAttribute('inert'); expect(app.contains(screen.getByRole('dialog'))).toBe(false);
    expect(screen.queryByText('Déconnexion…')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Annuler' })); await settle();
    expect(deconnecter).not.toHaveBeenCalled(); expect(app).not.toHaveAttribute('inert'); expect(localStorage.getItem('cyna_chat_history')).toBe('secret'); expect(store.row.data.clients).toEqual([]);
    store.writeError = null; deconnecter.mockResolvedValue({ ok: true }); fireEvent.click(screen.getByText('Déconnexion test')); await settle(); expect(store.row.data.clients).toEqual([{ id: 'saisie' }]); expect(deconnecter).toHaveBeenCalledOnce();
  });
  it('confirmer la perte appelle signOut et garde les copies', async () => {
    render(<App />); await settle(); await tick(); store.writeError = { message: 'offline' };
    deconnecter.mockResolvedValue({ ok: true }); fireEvent.click(screen.getByText('Modifier test')); fireEvent.click(screen.getByText('Déconnexion test')); await settle();
    const keys = Object.keys(localStorage).filter(k => k.startsWith('cyna_sauvegarde_en_echec_')); expect(keys.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('dialog').querySelector('button:last-child')); await settle(); expect(deconnecter).toHaveBeenCalledOnce(); keys.forEach(k => expect(localStorage.getItem(k)).not.toBeNull());
  });
  it('confirmation aussi sur écran erreur après conflit dont le rechargement échoue', async () => {
    render(<App />); await settle(); await tick(); distant(store.row.version + 1); store.readError = { message: 'offline' };
    fireEvent.click(screen.getByText('Modifier test')); fireEvent.click(screen.getByText('Déconnexion test')); await settle();
    expect(screen.getByText(QUESTION)).toBeTruthy(); expect(screen.queryByText('Tableau de bord chargé')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Annuler'})); await settle(); expect(deconnecter).not.toHaveBeenCalled(); expect(screen.getByTestId('application')).not.toHaveAttribute('inert');
  });
});

 describe('round 1 regressions', () => {
  it('SEC-PERF-01 contexte stable sur notification', async () => {
    render(<App />); await settle(); await tick(); const avant = store.app;
    act(() => avant.afficherNotif('test'));
    expect(store.app).toBe(avant);
  });
  it('SEC-PERF-01 fonctions du hook stables', async () => {
    const h = await boot(); const avant = h.result.current;
    act(() => h.result.current.setClients([{id:'rendu'}]));
    for (const cle of ['terminerSauvegardes','bloquerEcritures','debloquerEcritures']) expect(h.result.current[cle]).toBe(avant[cle]);
  });
  it('SEC-ORDRE-01 succes avant demontage garde inert et barriere', async () => {
    deconnecter.mockResolvedValue({ok:true}); render(<App />); await settle(); await tick();
    fireEvent.click(screen.getByText('Déconnexion test')); await settle();
    expect(screen.getByTestId('application')).toHaveAttribute('inert');
    expect(await store.app.importerTout(blob())).toBe(false);
  });
  it('SEC-UX-01 echec utilise notification error', async () => {
    deconnecter.mockResolvedValue({ok:false}); render(<App />); await settle(); await tick();
    fireEvent.click(screen.getByText('Déconnexion test')); await settle();
    const message = screen.getByText(/La déconnexion a échoué/);
    expect(message.style.position).toBe('fixed'); expect(message.style.background).toBe('rgb(239, 68, 68)');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('SEC-BARRIERE-02 import decide dans updater differe', async () => {
    const h = await boot(); let promesse;
    act(() => { h.result.current.setClients([{id:'avant'}]); promesse = h.result.current.importerTout(blob()); h.result.current.bloquerEcritures(); });
    expect(promesse).toBeInstanceOf(Promise); expect(await promesse).toBe(false);
    expect(h.result.current.clients).toEqual([]);
  });
  it('SEC-BARRIERE-02 normalisation distante bloquee sans cache ni envoi', async () => {
    const h = renderHook(() => useSupabaseData('demo', true)); await settle(); await tick(); store.writes=[]; h.result.current.bloquerEcritures();
    store.row = row(1, blob());
    const cache = vi.spyOn(Storage.prototype,'setItem');
    await act(async () => h.result.current.reessayerChargement()); await tick();
    expect(cache).not.toHaveBeenCalled(); expect(store.writes).toHaveLength(0); cache.mockRestore();
  });
 });
