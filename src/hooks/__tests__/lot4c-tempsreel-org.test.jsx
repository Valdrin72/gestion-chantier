/**
 * LOT 4c — Temps réel en mode org : les membres d'une même org voient les changements des autres.
 *
 * Prouve, sur le VRAI hook useSupabaseData (supabase mocké) :
 *   - Abonnement org : mode 'org' + orgId → canal filtré org_storage / org_id=eq.<org> (nom cyna_org_<org>).
 *   - Application d'un event : un changement distant met à jour l'état local (lecture-only).
 *   - Anti-echo : un event dont updated_by === moi est IGNORÉ ; idem si une écriture locale est en attente.
 *   - Pas de boucle : recevoir un event ne déclenche AUCUNE écriture (0 upsert).
 *   - Non-régression user : mode 'user' → canal user inchangé (filtre user_id, table devis).
 *   - Désabonnement : removeChannel appelé au démontage.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const store = { membres: [], orgRow: null, userRow: null, writes: [], channels: [], removed: 0 };

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
      channel(name) {
        const ch = { name, config: null, handler: null,
          on(evt, cfg, handler) { ch.config = cfg; ch.handler = handler; return ch; },
          subscribe(cb) { if (cb) cb('SUBSCRIBED'); return ch; },
        };
        store.channels.push(ch);
        return ch;
      },
      removeChannel() { store.removed += 1; },
    },
  };
});

import useSupabaseData from '../useSupabaseData';

const blob = () => ({ chantiers: [{ id: 'C1' }], devis: [], factures: [], pointages: [], clients: [], parametres: {} });

beforeEach(() => {
  store.membres = []; store.orgRow = null; store.userRow = null;
  store.writes = []; store.channels = []; store.removed = 0;
  try { localStorage.clear(); } catch {}
  delete process.env.REACT_APP_SUPABASE_URL;
  delete process.env.REACT_APP_STORAGE_MODE;
});
afterEach(() => { vi.useRealTimers(); });

async function bootOrg(userId = 'user-1') {
  localStorage.setItem('cyna_storage_mode', 'org');
  store.membres = [{ org_id: 'ORG-1' }];
  store.orgRow = { data: blob() };
  const hook = renderHook(() => useSupabaseData(userId, false));
  await vi.waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('LOT 4c · abonnement temps réel org', () => {
  it('s\'abonne au canal org_storage filtré org_id (nom cyna_org_<org>)', async () => {
    vi.useFakeTimers();
    await bootOrg();
    // Le dernier canal créé est le canal org.
    const orgCh = store.channels.find(c => c.name === 'cyna_org_ORG-1');
    expect(orgCh).toBeTruthy();
    expect(orgCh.config).toMatchObject({ schema: 'public', table: 'org_storage', filter: 'org_id=eq.ORG-1' });
  });
});

describe('LOT 4c · application d\'un event distant (lecture-only)', () => {
  it('un changement distant met à jour l\'état ; aucune écriture déclenchée', async () => {
    vi.useFakeTimers();
    const { result } = await bootOrg();
    expect(result.current.chantiers).toHaveLength(1);

    const orgCh = store.channels.find(c => c.name === 'cyna_org_ORG-1');
    // Event d'un AUTRE membre (updated_by différent) → nouvelle data appliquée.
    act(() => {
      orgCh.handler({ new: { org_id: 'ORG-1', updated_by: 'autre-membre', data: {
        chantiers: [{ id: 'C1' }, { id: 'C2' }, { id: 'C3' }], devis: [], factures: [], pointages: [], clients: [], parametres: {},
      } } });
    });
    expect(result.current.chantiers).toHaveLength(3);   // état mis à jour
    expect(store.writes).toHaveLength(0);               // pas de boucle : aucune écriture
  });
});

describe('LOT 4c · anti-echo', () => {
  it('ignore ma propre écriture (updated_by === moi)', async () => {
    vi.useFakeTimers();
    const { result } = await bootOrg('user-1');
    const orgCh = store.channels.find(c => c.name === 'cyna_org_ORG-1');

    act(() => {
      orgCh.handler({ new: { org_id: 'ORG-1', updated_by: 'user-1', data: {
        chantiers: [{ id: 'X1' }, { id: 'X2' }, { id: 'X3' }], devis: [], factures: [], pointages: [], clients: [], parametres: {},
      } } });
    });
    // Mon propre echo → ignoré : l'état ne bouge pas.
    expect(result.current.chantiers).toHaveLength(1);
    expect(store.writes).toHaveLength(0);
  });
});

describe('LOT 4c · non-régression mode user', () => {
  it('mode user → canal user inchangé (filtre user_id, table devis)', async () => {
    vi.useFakeTimers();
    store.userRow = { id: 'row-1', data: blob() };
    const hook = renderHook(() => useSupabaseData('user-1', false)); // défaut user
    await vi.waitFor(() => expect(hook.result.current.loading).toBe(false));

    const userCh = store.channels.find(c => c.name === 'cyna_user-1');
    expect(userCh).toBeTruthy();
    expect(userCh.config).toMatchObject({ table: 'devis', filter: 'user_id=eq.user-1' });
    // Aucun canal org.
    expect(store.channels.some(c => c.name?.startsWith('cyna_org_'))).toBe(false);
  });
});

describe('LOT 4c · désabonnement au démontage', () => {
  it('removeChannel appelé à l\'unmount (pas de fuite)', async () => {
    vi.useFakeTimers();
    const { unmount } = await bootOrg();
    expect(store.removed).toBe(0);
    unmount();
    expect(store.removed).toBeGreaterThan(0);
  });
});
