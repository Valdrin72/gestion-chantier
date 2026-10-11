/**
 * E1 — Entreprise partagée : anti-écrasement du coffre org_storage.
 *
 * Prouve, sur le VRAI hook useSupabaseData, avec un serveur en mémoire qui applique la même
 * règle que le trigger org_storage_version_garde (version = ancienne + 1, sinon P0409) :
 *   - le mode org emprunte le chemin versionné du mode user (UPDATE filtré org_id + version) ;
 *   - deux associés qui enregistrent en même temps : le second est refusé, recharge, garde une
 *     copie de ses modifications ; rien n'est écrasé ;
 *   - temps réel : seule une version plus récente est appliquée, jamais par-dessus une
 *     modification locale ;
 *   - coffre absent / vide, aucune ou plusieurs entreprises, erreur de lecture : écran
 *     « Réessayer » avec un message clair, AUCUNE écriture, jamais d'insert ni d'upsert ;
 *   - anti-effacement : un coffre ne peut pas être vidé de toutes ses listes ;
 *   - échec réseau : copie de secours, puis « Réessayer » enregistre ;
 *   - non-régression du mode user.
 * Remplace les anciens tests lot4a/4b/4c (lecture seule, upsert « dernier qui écrit gagne »,
 * anti-écho par updated_by), dont le comportement est volontairement abandonné.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const store = vi.hoisted(() => ({
  membres: {}, membresError: null, org: null, orgError: null, user: null,
  writes: [], reads: [], channels: [], removed: 0, writeError: null, deferWrite: null,
}));

vi.mock('../../lib/supabase', () => {
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  function diffuser() {
    for (const ch of store.channels) {
      if (ch.config?.table === 'org_storage' && ch.config.filter === `org_id=eq.${store.org.org_id}`) ch.handler({ new: clone(store.org) });
    }
  }
  function from(table) {
    let op, payload;
    const filters = {};
    const execute = async () => {
      const gate = store.deferWrite; store.deferWrite = null;
      store.writes.push({ op, table, payload: clone(payload), filters: { ...filters } });
      if (gate) await gate;
      if (store.writeError) return { error: store.writeError };
      if (op !== 'update') return { error: { message: 'interdit : ' + op } };
      if (table === 'org_storage') {
        if (!store.org || filters.org_id !== store.org.org_id || filters.version !== store.org.version) return { data: [], error: null };
        if (payload.version !== store.org.version + 1) return { error: { code: 'P0409' } };
        store.org = { ...store.org, data: clone(payload.data), version: payload.version };
        diffuser();
        return { data: [{ org_id: store.org.org_id, version: store.org.version }], error: null };
      }
      if (!store.user || filters.id !== store.user.id || filters.version !== store.user.version) return { data: [], error: null };
      store.user = { ...store.user, data: clone(payload.data), version: payload.version };
      return { data: [{ id: store.user.id, version: store.user.version }], error: null };
    };
    const b = {
      select() { return op ? execute() : b; },
      eq(k, v) { filters[k] = v; return b; },
      limit() {
        store.reads.push(table);
        if (store.membresError) return Promise.resolve({ data: null, error: store.membresError });
        return Promise.resolve({ data: store.membres[filters.user_id] || [], error: null });
      },
      async maybeSingle() {
        store.reads.push(table);
        if (table === 'org_storage') return store.orgError ? { data: null, error: store.orgError } : { data: clone(store.org), error: null };
        return { data: clone(store.user), error: null };
      },
      update(p) { op = 'update'; payload = p; return b; },
      insert(p) { op = 'insert'; payload = p; return b; },
      single: execute,
      upsert(p) { op = 'upsert'; payload = p; return execute(); },
    };
    return b;
  }
  return {
    supabase: {
      from,
      channel(name) {
        const ch = { name, config: null, handler: null,
          on(evt, cfg, handler) { ch.config = cfg; ch.handler = handler; return ch; },
          subscribe(cb) { if (cb) cb('SUBSCRIBED'); return ch; } };
        store.channels.push(ch);
        return ch;
      },
      removeChannel() { store.removed += 1; },
    },
  };
});

import useSupabaseData, {
  resolveMode, deciderChargementOrg, estPayloadVide,
  MESSAGE_COFFRE_VIDE, MESSAGE_SANS_ENTREPRISE, MESSAGE_PLUSIEURS_ENTREPRISES, MESSAGE_VIDAGE_REFUSE,
} from '../useSupabaseData';
import { PREFIXE_ECHEC } from '../../utils/copiesRejetees';

const blob = (extra = {}) => ({ chantiers: [{ id: 'C1' }], devis: [{ id: 'D1' }], factures: [], clients: [{ id: 'K1' }], pointages: [], parametres: { employes: [{ id: 1, tarifJour: 350 }] }, ...extra });
async function settle() { await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); }); }
async function tick(ms = 900) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function boot(uid = 'u1') { const h = renderHook(() => useSupabaseData(uid)); await settle(); return h; }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const ecritsInterdits = () => store.writes.filter(w => w.table !== 'org_storage' || w.op !== 'update');
const emettre = row => act(() => store.channels.filter(c => c.config?.table === 'org_storage').forEach(c => c.handler({ new: row })));

beforeEach(() => {
  localStorage.clear();
  delete process.env.REACT_APP_STORAGE_MODE;
  localStorage.setItem('cyna_storage_mode', 'org');
  Object.assign(store, {
    membres: { u1: [{ org_id: 'ORG' }], u2: [{ org_id: 'ORG' }] }, membresError: null,
    org: { org_id: 'ORG', data: blob(), version: 0 }, orgError: null, user: null,
    writes: [], reads: [], channels: [], removed: 0, writeError: null, deferWrite: null,
  });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('E1 · fonctions pures conservées', () => {
  it('resolveMode : démo → user ; override localStorage prime ; défaut user ; env org', () => {
    expect(resolveMode(true)).toBe('user');
    process.env.REACT_APP_STORAGE_MODE = 'user'; expect(resolveMode(false)).toBe('org');
    localStorage.removeItem('cyna_storage_mode'); expect(resolveMode(false)).toBe('user');
    process.env.REACT_APP_STORAGE_MODE = 'org'; expect(resolveMode(false)).toBe('org');
  });
  it('deciderChargementOrg : utiliser seulement un coffre non vide, jamais « creer »', () => {
    expect(deciderChargementOrg({ data: { chantiers: [{ id: 1 }] } })).toBe('utiliser');
    for (const v of [null, undefined, { data: null }, { data: {} }, { data: { parametres: { a: 1 }, clients: [] } }]) expect(deciderChargementOrg(v)).toBe('vide-sans-ecriture');
  });
  it('estPayloadVide : vrai seulement si les 5 listes métier sont vides ou absentes', () => {
    expect(estPayloadVide({ parametres: { a: 1 }, chantiers: [] })).toBe(true);
    expect(estPayloadVide(null)).toBe(true);
    expect(estPayloadVide({ pointages: [{ id: 1 }] })).toBe(false);
  });
});

describe('E1 · chargement et écriture versionnés', () => {
  it('E1-01 lit le coffre de l\'entreprise et n\'écrit rien au chargement', async () => {
    const h = await boot(); await tick(2000);
    expect(h.result.current.chantiers).toEqual([{ id: 'C1', journal: [] }]);
    expect(h.result.current.etatSync.erreurChargement).toBeNull();
    expect(store.reads).toEqual(['membres', 'org_storage']);
    expect(store.writes).toHaveLength(0);
  });
  it('E1-02 une modification part en UPDATE version + 1 filtré org_id + version, jamais devis / insert / upsert', async () => {
    const h = await boot();
    act(() => h.result.current.setClients(prev => [...prev, { id: 'K2' }])); await tick();
    expect(store.writes).toEqual([expect.objectContaining({ op: 'update', table: 'org_storage', filters: { org_id: 'ORG', version: 0 } })]);
    expect(store.writes[0].payload.version).toBe(1);
    expect(Object.keys(store.writes[0].payload)).toEqual(['data', 'version']);
    expect(store.org.version).toBe(1);
    expect(store.org.data.clients).toEqual([{ id: 'K1' }, { id: 'K2' }]);
    expect(store.org.data.parametres.employes).toHaveLength(1);
    act(() => h.result.current.setDevis(prev => [...prev, { id: 'D2' }])); await tick();
    expect(store.writes[1].filters).toEqual({ org_id: 'ORG', version: 1 }); expect(store.org.version).toBe(2);
    expect(h.result.current.etatEnregistrement().propre).toBe(true);
  });
});

describe('E1 · deux associés en même temps', () => {
  it('E1-03 le second est refusé, recharge la version du premier, garde une copie ; rien n\'est écrasé', async () => {
    const a = await boot('u1'); const b = await boot('u2');
    act(() => { a.result.current.setDevis(prev => [...prev, { id: 'A' }]); b.result.current.setDevis(prev => [...prev, { id: 'B' }]); });
    await tick(); await settle();
    expect(store.org.data.devis).toEqual([{ id: 'D1' }, { id: 'A' }]);
    expect(store.org.version).toBe(1);
    expect(b.result.current.devis).toEqual([{ id: 'D1' }, { id: 'A' }]);
    expect(b.result.current.etatSync.statut).toBe('conflit');
    expect(b.result.current.etatSync.message).toMatch(/Quelqu'un a enregistré entre-temps/);
    expect(JSON.parse(localStorage.getItem('cyna_sauvegarde_rejetee')).devis).toEqual([{ id: 'D1' }, { id: 'B' }]);
    expect(store.writes.map(w => w.filters.version)).toEqual([0, 0]);
    // Après le rechargement, B peut enregistrer par-dessus la version à jour : rien de A ne se perd.
    act(() => b.result.current.setDevis(prev => [...prev, { id: 'B2' }])); await tick();
    expect(store.org.data.devis).toEqual([{ id: 'D1' }, { id: 'A' }, { id: 'B2' }]);
    expect(store.org.version).toBe(2);
    expect(a.result.current.devis).toEqual([{ id: 'D1' }, { id: 'A' }, { id: 'B2' }]);
    expect(ecritsInterdits()).toHaveLength(0);
  });
  it('E1-04 temps réel : l\'enregistrement d\'un associé apparaît chez l\'autre sans qu\'il réécrive', async () => {
    const a = await boot('u1'); const b = await boot('u2');
    act(() => a.result.current.setClients(prev => [...prev, { id: 'A' }])); await tick(); await tick(2000);
    expect(b.result.current.clients).toEqual([{ id: 'K1' }, { id: 'A' }]);
    expect(store.writes).toHaveLength(1);
  });
  it('E1-05 temps réel : une version égale ou plus ancienne (ma propre écriture) n\'est jamais réappliquée', async () => {
    const a = await boot('u1');
    act(() => a.result.current.setClients([{ id: 'moi' }])); await tick();
    emettre({ org_id: 'ORG', version: 1, data: blob({ clients: [{ id: 'ancien' }] }) });
    emettre({ org_id: 'ORG', version: 0, data: blob({ clients: [{ id: 'plus-ancien' }] }) });
    expect(a.result.current.clients).toEqual([{ id: 'moi' }]);
    emettre({ org_id: 'ORG', version: 5, data: {} });
    expect(a.result.current.clients).toEqual([{ id: 'moi' }]);
    emettre({ org_id: 'ORG', version: 5, data: blob({ clients: [{ id: 'nouveau' }] }) });
    expect(a.result.current.clients).toEqual([{ id: 'nouveau' }]);
  });
  it('E1-06 temps réel : ignoré tant qu\'une modification locale attend, qui sera ensuite refusée proprement', async () => {
    const a = await boot('u1');
    act(() => a.result.current.setClients([{ id: 'local' }]));
    store.org = { ...store.org, version: 1, data: blob({ clients: [{ id: 'distant' }] }) };
    emettre(store.org);
    expect(a.result.current.clients).toEqual([{ id: 'local' }]);
    await tick(); await settle();
    expect(store.org.data.clients).toEqual([{ id: 'distant' }]);
    expect(a.result.current.clients).toEqual([{ id: 'distant' }]);
    expect(a.result.current.etatSync.statut).toBe('conflit');
  });
  it('E1-07 retour sur l\'app : relit le coffre et applique seulement une version plus récente', async () => {
    const a = await boot('u1');
    store.org = { ...store.org, version: 3, data: blob({ clients: [{ id: 'v3' }] }) };
    act(() => document.dispatchEvent(new Event('visibilitychange'))); await settle();
    expect(a.result.current.clients).toEqual([{ id: 'v3' }]);
    act(() => a.result.current.setClients([{ id: 'apres' }])); await tick();
    expect(store.writes.at(-1).filters).toEqual({ org_id: 'ORG', version: 3 }); expect(store.org.version).toBe(4);
  });
});

describe('E1 · coffre indisponible : message clair, aucune écriture', () => {
  it.each([
    ['coffre vide', () => { store.org = { org_id: 'ORG', data: {}, version: 0 }; }, MESSAGE_COFFRE_VIDE],
    ['coffre absent', () => { store.org = null; }, MESSAGE_COFFRE_VIDE],
    ['coffre sans aucune liste métier (paramètres seuls)', () => { store.org = { org_id: 'ORG', data: { parametres: { a: 1 } }, version: 0 }; }, MESSAGE_COFFRE_VIDE],
    ['aucune entreprise', () => { store.membres = {}; }, MESSAGE_SANS_ENTREPRISE],
    ['plusieurs entreprises', () => { store.membres = { u1: [{ org_id: 'ORG' }, { org_id: 'AUTRE' }] }; }, MESSAGE_PLUSIEURS_ENTREPRISES],
    ['lecture des membres en erreur', () => { store.membresError = { message: 'JWT' }; }, 'Impossible de charger vos données. Réessayez ou déconnectez-vous.'],
    ['lecture du coffre en erreur', () => { store.orgError = { message: 'réseau' }; }, 'Impossible de charger vos données. Réessayez ou déconnectez-vous.'],
  ])('E1-08 %s', async (_, preparer, message) => {
    preparer();
    const h = await boot();
    expect(h.result.current.etatSync.erreurChargement).toBe(message);
    let accepte;
    act(() => { accepte = h.result.current.setClients([{ id: 'interdit' }]); });
    expect(accepte).toBe(false);
    expect(await h.result.current.importerTout(blob())).toBe(false);
    act(() => { accepte = h.result.current.setDonneesListes(prev => ({ ...prev, clients: [{ id: 'x' }] })); });
    expect(accepte).toBe(false);
    await tick(2000);
    expect(store.writes).toHaveLength(0);
    expect(h.result.current.etatEnregistrement().propre).toBe(false);
    expect((await h.result.current.envoyerMaintenant()).ok).toBe(false);
    expect(store.channels.some(c => c.config?.table === 'org_storage')).toBe(false);
  });
  it('E1-09 « Réessayer » après mise en place du coffre par l\'administrateur charge et autorise l\'écriture', async () => {
    store.org = null; store.membresError = { message: 'JWT' };
    const h = await boot();
    expect(h.result.current.etatSync.erreurChargement).toBeTruthy();
    store.membresError = null;
    await act(async () => h.result.current.reessayerChargement());
    expect(h.result.current.etatSync.erreurChargement).toBe(MESSAGE_COFFRE_VIDE);
    expect(store.channels).toHaveLength(0);
    store.org = { org_id: 'ORG', data: blob(), version: 7 };
    await act(async () => h.result.current.reessayerChargement());
    expect(h.result.current.etatSync.erreurChargement).toBeNull();
    expect(h.result.current.clients).toEqual([{ id: 'K1' }]);
    act(() => h.result.current.setClients([{ id: 'ok' }])); await tick();
    expect(store.writes).toEqual([expect.objectContaining({ op: 'update', table: 'org_storage', filters: { org_id: 'ORG', version: 7 } })]);
    expect(store.org.version).toBe(8);
    // Le temps réel est ouvert après le chargement réussi par « Réessayer ».
    expect(store.channels.filter(c => c.name === 'cyna_org_ORG')).toHaveLength(1);
    emettre({ org_id: 'ORG', version: 9, data: blob({ clients: [{ id: 'associe' }] }) });
    expect(h.result.current.clients).toEqual([{ id: 'associe' }]);
  });
});

describe('E1 · anti-effacement et échec réseau', () => {
  it('E1-10 vider toutes les listes du coffre est refusé : rien d\'envoyé, écran inchangé, message visible', async () => {
    store.org = { org_id: 'ORG', data: { clients: [{ id: 'seul' }], parametres: {} }, version: 0 };
    const h = await boot();
    act(() => h.result.current.setClients([])); await tick();
    expect(h.result.current.clients).toEqual([{ id: 'seul' }]);
    expect(h.result.current.etatSync.message).toBe(MESSAGE_VIDAGE_REFUSE);
    act(() => h.result.current.fermerMessageSync());
    act(() => h.result.current.setDonneesListes(prev => ({ ...prev, clients: [], devis: [], chantiers: [], factures: [], pointages: [] }))); await tick();
    expect(h.result.current.clients).toEqual([{ id: 'seul' }]);
    expect(h.result.current.etatSync.message).toBe(MESSAGE_VIDAGE_REFUSE);
    expect(store.writes).toHaveLength(0);
    expect(h.result.current.etatEnregistrement().propre).toBe(true);
    // Une modification suivante part de ce que l'écran montre (aucune divergence écran / coffre).
    act(() => h.result.current.setParametres(prev => ({ ...prev, nomEntreprise: 'CYNA' }))); await tick();
    expect(store.org.data.clients).toEqual([{ id: 'seul' }]); expect(h.result.current.clients).toEqual([{ id: 'seul' }]);
    act(() => h.result.current.setClients([{ id: 'nouveau' }])); await tick();
    expect(store.org.data.clients).toEqual([{ id: 'nouveau' }]);
  });
  it('E1-11 échec réseau : copie de secours et statut « échec », puis « Réessayer » enregistre', async () => {
    const h = await boot();
    store.writeError = { message: 'offline' };
    act(() => h.result.current.setClients([{ id: 'hors-ligne' }])); await tick();
    expect(h.result.current.etatSync.statut).toBe('echec');
    const copies = Object.keys(localStorage).filter(k => k.startsWith(PREFIXE_ECHEC + 'u1'));
    expect(copies).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(copies[0])).clients).toEqual([{ id: 'hors-ligne' }]);
    store.writeError = null;
    await act(async () => h.result.current.reessayerSauvegarde());
    expect(store.org.data.clients).toEqual([{ id: 'hors-ligne' }]); expect(store.org.version).toBe(1);
    expect(h.result.current.etatSync.statut).toBe('ok');
    expect(Object.keys(localStorage).filter(k => k.startsWith(PREFIXE_ECHEC))).toHaveLength(0);
  });
  it('E1-12 « Envoyer maintenant » attend l\'écriture du coffre et confirme', async () => {
    const h = await boot();
    const gate = deferred(); store.deferWrite = gate.promise;
    act(() => h.result.current.setClients([{ id: 'envoi' }]));
    let fini = false; const p = h.result.current.envoyerMaintenant().then(r => { fini = true; return r; });
    await settle(); expect(fini).toBe(false);
    gate.resolve();
    expect(await p).toMatchObject({ ok: true, conflit: false });
    expect(store.org.data.clients).toEqual([{ id: 'envoi' }]);
  });
});

describe('E1 · opérations unitaires (restauration d\'une donnée, mémoire IA)', () => {
  it('E1-13 ecrireEtConfirmer passe par le coffre versionné et copie l\'ancienne valeur avant restauration', async () => {
    store.org = { org_id: 'ORG', data: blob({ memoireIA: 'ancienne mémoire' }), version: 2 };
    const h = await boot();
    let p;
    act(() => { p = h.result.current.ecrireEtConfirmer('memoireIA', 'mémoire restaurée', { copierAvant: true }); });
    await settle();
    expect(await p).toBe(true);
    let resultat;
    await act(async () => { resultat = await h.result.current.envoyerMaintenant(); });
    expect(resultat).toMatchObject({ ok: true, conflit: false });
    expect(store.writes).toEqual([expect.objectContaining({ op: 'update', table: 'org_storage', filters: { org_id: 'ORG', version: 2 } })]);
    expect(store.org.data.memoireIA).toBe('mémoire restaurée'); expect(store.org.version).toBe(3);
    expect(store.org.data.clients).toEqual([{ id: 'K1' }]);
    expect(Object.keys(localStorage).some(k => localStorage.getItem(k)?.includes('ancienne mémoire'))).toBe(true);
  });
});

describe('E1 · temps réel : abonnement et non-régression user', () => {
  it('abonnement au coffre filtré par org_id, retiré au démontage', async () => {
    const h = await boot();
    const ch = store.channels.find(c => c.name === 'cyna_org_ORG');
    expect(ch.config).toMatchObject({ event: '*', schema: 'public', table: 'org_storage', filter: 'org_id=eq.ORG' });
    expect(store.channels.some(c => c.config?.table === 'devis')).toBe(false);
    h.unmount();
    expect(store.removed).toBeGreaterThan(0);
  });
  it('mode user inchangé : lit et écrit la ligne devis du compte, canal user_id', async () => {
    localStorage.setItem('cyna_storage_mode', 'user');
    store.user = { id: 'row-u1', numero: '__cyna_storage__', data: blob(), version: 4 };
    const h = await boot();
    act(() => h.result.current.setClients([{ id: 'user' }])); await tick();
    expect(store.reads).toEqual(['devis']);
    expect(store.writes).toEqual([expect.objectContaining({ op: 'update', table: 'devis', filters: { id: 'row-u1', version: 4 } })]);
    expect(store.channels.map(c => c.config)).toEqual([expect.objectContaining({ table: 'devis', filter: 'user_id=eq.u1' })]);
  });
});
