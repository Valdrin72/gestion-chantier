/**
 * LOT 4b — Écriture dans le coffre org (org_storage) protégée par 3 VERROUS.
 *
 * Prouve, sur le VRAI hook useSupabaseData (supabase mocké) :
 *   - VERROU 1 : pas d'écriture tant que le coffre org n'est pas chargé (vide au boot / pas d'org).
 *   - Cas nominal : coffre non vide chargé → une édition → 1 UPSERT sur org_storage (bon org_id).
 *   - VERROU 2 : payload « tout vide » sur coffre non vide → 0 écriture (anti-effacement) ;
 *                un payload non vide → écriture OK.
 *   - VERROU 3 : l'écriture est un UPSERT by org_id (jamais un insert aveugle), jamais table devis.
 *   - estPayloadVide (pure).
 *   - Non-régression mode 'user' : écrit toujours dans devis.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const store = { membres: [], orgRow: null, userRow: null, writes: [] };

vi.mock('../../lib/supabase', () => {
  function from(table) {
    const b = {
      select() { return b; },
      eq() { return b; },
      limit() {
        if (table === 'membres') return Promise.resolve({ data: store.membres, error: null });
        return b;
      },
      maybeSingle() {
        if (table === 'org_storage') return Promise.resolve({ data: store.orgRow, error: null });
        if (table === 'devis')       return Promise.resolve({ data: store.userRow, error: null });
        return Promise.resolve({ data: null, error: null });
      },
      upsert(payload, opts) { store.writes.push({ op: 'upsert', table, payload, opts }); return Promise.resolve({ error: null }); },
      update(payload) { store.writes.push({ op: 'update', table, payload }); return { eq: () => Promise.resolve({ error: null }) }; },
      insert(payload) { store.writes.push({ op: 'insert', table, payload }); return { select: () => ({ single: () => Promise.resolve({ data: { id: 'row-x' }, error: null }) }) }; },
    };
    return b;
  }
  return {
    supabase: {
      from,
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => {},
    },
  };
});

import useSupabaseData, { estPayloadVide } from '../useSupabaseData';

const blobNonVide = () => ({
  chantiers: [{ id: 'C1' }, { id: 'C2' }, { id: 'C3' }],
  devis: [{ id: 'D1' }, { id: 'D2' }],
  factures: [], pointages: [], clients: [], parametres: { tauxFraisGeneraux: 12 },
});

beforeEach(() => {
  store.membres = [];
  store.orgRow = null;
  store.userRow = null;
  store.writes = [];
  try { localStorage.clear(); } catch {}
  delete process.env.REACT_APP_STORAGE_MODE;
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

async function bootOrg(userId = 'user-1') {
  const hook = renderHook(() => useSupabaseData(userId, false));
  await vi.waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('LOT 4b · estPayloadVide (pure)', () => {
  it('toutes listes vides/absentes → true', () => {
    expect(estPayloadVide({ chantiers: [], devis: [], factures: [], pointages: [], clients: [] })).toBe(true);
    expect(estPayloadVide({ parametres: { x: 1 } })).toBe(true);
    expect(estPayloadVide(null)).toBe(true);
  });
  it('au moins une liste non vide → false', () => {
    expect(estPayloadVide({ chantiers: [{ id: 1 }], devis: [], factures: [], pointages: [], clients: [] })).toBe(false);
  });
});

describe('LOT 4b · VERROU 1 — pas d\'écriture sans coffre chargé', () => {
  it('coffre vide au boot (orgChargee=false) → édition → 0 écriture', async () => {
    localStorage.setItem('cyna_storage_mode', 'org');
    store.membres = [{ org_id: 'ORG-1' }];
    store.orgRow = null; // vide
    const { result } = await bootOrg();

    act(() => { result.current.setChantiers([{ id: 'C1' }]); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(store.writes).toHaveLength(0);
  });

  it('user sans org (orgId=null) → édition → 0 écriture', async () => {
    localStorage.setItem('cyna_storage_mode', 'org');
    store.membres = []; // pas d'org
    const { result } = await bootOrg();

    act(() => { result.current.setChantiers([{ id: 'C1' }]); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(store.writes).toHaveLength(0);
  });
});

describe('LOT 4b · cas nominal + VERROU 3 (UPSERT by org_id)', () => {
  it('coffre non vide chargé → édition → 1 UPSERT sur org_storage (bon org_id, jamais devis)', async () => {
    localStorage.setItem('cyna_storage_mode', 'org');
    store.membres = [{ org_id: 'ORG-1' }];
    store.orgRow = { data: blobNonVide() };
    const { result } = await bootOrg();
    expect(result.current.chantiers).toHaveLength(3); // lecture 4a OK

    act(() => { result.current.setChantiers([{ id: 'C1' }, { id: 'C2' }]); });
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });

    expect(store.writes).toHaveLength(1);
    const w = store.writes[0];
    expect(w.op).toBe('upsert');                 // VERROU 3 : upsert, pas insert aveugle
    expect(w.table).toBe('org_storage');         // jamais devis
    expect(w.opts).toEqual({ onConflict: 'org_id' });
    expect(w.payload.org_id).toBe('ORG-1');      // bon org
    expect(w.payload.updated_by).toBe('user-1'); // traçage du writer
  });
});

describe('LOT 4b · VERROU 2 — anti-effacement', () => {
  it('payload tout vide sur coffre non vide → 0 écriture ; puis édition non vide → écriture OK', async () => {
    localStorage.setItem('cyna_storage_mode', 'org');
    store.membres = [{ org_id: 'ORG-1' }];
    // Coffre chargé avec SEULEMENT chantiers → vider chantiers rend le payload entièrement vide.
    store.orgRow = { data: { chantiers: [{ id: 'C1' }], devis: [], factures: [], pointages: [], clients: [], parametres: {} } };
    const { result } = await bootOrg();

    // (a) vider tout → payload vide → bloqué (verrou 2)
    act(() => { result.current.setChantiers([]); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(store.writes).toHaveLength(0);

    // (b) édition non vide → écriture OK
    act(() => { result.current.setChantiers([{ id: 'C1' }, { id: 'C2' }]); });
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0].table).toBe('org_storage');
  });
});

describe('LOT 4b · non-régression mode USER', () => {
  it('mode user (défaut) → écrit dans devis, jamais org_storage', async () => {
    store.userRow = { id: 'row-1', data: { chantiers: [{ id: 'C1' }], devis: [], factures: [], clients: [], parametres: {}, pointages: [] } };
    const { result } = await bootOrg(); // défaut user (pas d'override)

    act(() => { result.current.setChantiers([{ id: 'C1' }, { id: 'C2' }]); });
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });

    expect(store.writes.length).toBeGreaterThan(0);
    expect(store.writes.every(w => w.table === 'devis')).toBe(true);
    expect(store.writes.some(w => w.table === 'org_storage')).toBe(false);
  });
});
