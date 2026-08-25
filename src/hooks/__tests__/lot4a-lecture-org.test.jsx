/**
 * LOT 4a — Bascule LECTURE SEULE vers le coffre organisation (org_storage).
 *
 * Prouve, sur le VRAI hook useSupabaseData (chemin de code réel, supabase mocké) :
 *   1. resolveMode (pure) : démo → 'user' ; override localStorage prime ; défaut 'user'.
 *   2. deciderChargementOrg (pure) : data non vide → 'utiliser' ; absent/vide → 'vide-sans-ecriture' ;
 *      JAMAIS 'creer'.
 *   3. Mode 'org' : l'état se charge depuis org_storage ; AUCUNE écriture émise (0 update/insert),
 *      même après une édition simulée.
 *   4. Non-régression mode 'user' (défaut) : lecture depuis `devis` + une écriture EST émise après
 *      édition (le court-circuit d'écriture est bien propre au mode 'org', pas global).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Mock du client supabase : lectures configurables + enregistrement des écritures ──
const store = { membres: [], orgRow: null, userRow: null, writes: [] };

vi.mock('../../lib/supabase', () => {
  function from(table) {
    const b = {
      select() { return b; },
      eq() { return b; },
      limit() {
        // getMonOrgId : .from('membres').select('org_id').eq('user_id', x).limit(1)
        if (table === 'membres') return Promise.resolve({ data: store.membres, error: null });
        return b;
      },
      maybeSingle() {
        if (table === 'org_storage') return Promise.resolve({ data: store.orgRow, error: null });
        if (table === 'devis')       return Promise.resolve({ data: store.userRow, error: null });
        return Promise.resolve({ data: null, error: null });
      },
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

import useSupabaseData, { resolveMode, deciderChargementOrg } from '../useSupabaseData';

beforeEach(() => {
  store.membres = [];
  store.orgRow = null;
  store.userRow = null;
  store.writes = [];
  try { localStorage.clear(); } catch {}
  delete process.env.REACT_APP_STORAGE_MODE;
});
afterEach(() => { vi.useRealTimers(); });

describe('LOT 4a · resolveMode (pure)', () => {
  it('démo → toujours user (même avec override org)', () => {
    localStorage.setItem('cyna_storage_mode', 'org');
    expect(resolveMode(true)).toBe('user');
  });
  it('override localStorage prime sur l\'env', () => {
    process.env.REACT_APP_STORAGE_MODE = 'user';
    localStorage.setItem('cyna_storage_mode', 'org');
    expect(resolveMode(false)).toBe('org');
  });
  it('défaut = user (rien de configuré)', () => {
    expect(resolveMode(false)).toBe('user');
  });
  it('env org (sans override) → org', () => {
    process.env.REACT_APP_STORAGE_MODE = 'org';
    expect(resolveMode(false)).toBe('org');
  });
});

describe('LOT 4a · deciderChargementOrg (pure)', () => {
  it('data non vide → utiliser', () => {
    expect(deciderChargementOrg({ data: { chantiers: [{ id: 1 }] } })).toBe('utiliser');
  });
  it('ligne absente → vide-sans-ecriture', () => {
    expect(deciderChargementOrg(null)).toBe('vide-sans-ecriture');
  });
  it('data vide {} → vide-sans-ecriture', () => {
    expect(deciderChargementOrg({ data: {} })).toBe('vide-sans-ecriture');
  });
  it('ne renvoie JAMAIS « creer »', () => {
    for (const v of [null, undefined, { data: null }, { data: {} }, { data: { x: 1 } }]) {
      expect(deciderChargementOrg(v)).not.toBe('creer');
    }
  });
});

describe('LOT 4a · mode ORG — lecture seule, zéro écriture', () => {
  it('charge l\'état depuis org_storage et n\'émet AUCUNE écriture, même après le debounce', async () => {
    vi.useFakeTimers();
    localStorage.setItem('cyna_storage_mode', 'org');
    store.membres = [{ org_id: 'ORG-1' }];
    store.orgRow = { data: {
      chantiers: [{ id: 'C1' }, { id: 'C2' }, { id: 'C3' }],
      devis: [{ id: 'D1' }, { id: 'D2' }],
      factures: [], pointages: [], clients: [], parametres: { tauxFraisGeneraux: 12 },
    } };

    const { result } = renderHook(() => useSupabaseData('user-1', false));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    // Lecture : l'état vient bien du coffre ORG.
    expect(result.current.chantiers).toHaveLength(3);
    expect(result.current.devis).toHaveLength(2);
    // Aucune écriture au boot.
    expect(store.writes).toHaveLength(0);

    // Édition simulée + on dépasse LARGEMENT le debounce 800ms → toujours 0 écriture
    // (scheduleSync court-circuité en mode org : aucun timer d'écriture n'est même armé).
    act(() => { result.current.setChantiers([{ id: 'C1' }]); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(store.writes).toHaveLength(0);
  });

  it('org_storage vide → état vide sûr, aucune écriture', async () => {
    localStorage.setItem('cyna_storage_mode', 'org');
    store.membres = [{ org_id: 'ORG-1' }];
    store.orgRow = null; // pas encore semé

    const { result } = renderHook(() => useSupabaseData('user-1', false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.chantiers).toHaveLength(0);
    expect(store.writes).toHaveLength(0);
  });

  it('user sans org → état vide, aucune écriture', async () => {
    localStorage.setItem('cyna_storage_mode', 'org');
    store.membres = []; // aucune appartenance

    const { result } = renderHook(() => useSupabaseData('user-1', false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.chantiers).toHaveLength(0);
    expect(store.writes).toHaveLength(0);
  });
});

describe('LOT 4a · non-régression mode USER (défaut)', () => {
  it('lit depuis devis et ÉMET une écriture après édition (court-circuit propre au mode org)', async () => {
    vi.useFakeTimers();
    // défaut 'user' (aucun override, aucun env)
    store.userRow = { id: 'row-1', data: { chantiers: [{ id: 'C1' }], devis: [], factures: [], clients: [], parametres: {}, pointages: [] } };

    const { result } = renderHook(() => useSupabaseData('user-1', false));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.chantiers).toHaveLength(1);

    // Édition → en mode user, l'écriture (debounce 800ms) doit bien partir.
    act(() => { result.current.setChantiers([{ id: 'C1' }, { id: 'C2' }]); });
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });

    expect(store.writes.length).toBeGreaterThan(0);
    expect(store.writes.every(w => w.table === 'devis')).toBe(true); // jamais org_storage
  });
});
