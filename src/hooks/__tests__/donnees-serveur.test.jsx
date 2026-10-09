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
  const { default: Parametres } = await import('../../pages/ParametresPage');
  return { default: () => {
    capture.ctx = useApp();
    return <Parametres {...capture.ctx} />;
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
import { retentionSuspendue } from '../../utils/copiesRejetees';
import { verifierSauvegarde, instantaneComplet } from '../../utils/importControle';
import { useMemoire } from '../../components/ia/ClaudeIAPanel';
import RepriseLocale from '../../components/RepriseLocale';

const blob = () => ({ chantiers: [], devis: [{ id: 'initial' }], factures: [], clients: [], pointages: [], parametres: { migrationJournalV2Done:true, backfillMajorationPhase4Done:true, backfillCoefMO10Done:true, employes: [{ id: 1, tarifJour: 350 }, { id: 2, tarifJour: 450 }] } });
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
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });



import { within } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import DevisPage from '../../pages/DevisPage';
import Factures from '../../Factures';
let download, objectURL, confirmSpy, promptSpy;
async function ouvrir(data = blob(), size) {
  const fichier = { size:size ?? JSON.stringify(data).length, text:vi.fn(async () => JSON.stringify(data)) };
  await act(async () => fireEvent.change(document.querySelector('input[type="file"]'), {target:{files:[fichier]}}));
  return fichier;
}
async function confirmerImport() {
  await act(async () => fireEvent.click(within(screen.getByRole('dialog', {name:'Résumé de l’import'})).getByRole('button',{name:'Importer',exact:true})));
  await settle();
}
const cles = () => Object.keys(localStorage).filter(k => k.startsWith('cyna_sauvegarde_'));
beforeEach(() => {
  download=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(() => {});
  objectURL=vi.fn(()=>'blob:test'); URL.createObjectURL=objectURL; URL.revokeObjectURL=vi.fn();
  confirmSpy=vi.spyOn(window,'confirm').mockImplementation(()=> {throw new Error('confirm interdit');});
  promptSpy=vi.spyOn(window,'prompt').mockImplementation(()=> {throw new Error('prompt interdit');});
});
async function app(data = blob()) { store.row=row(4,data); render(<App/>); await settle(); await tick(); store.writes=[]; }

const nouvelles={objectifs:{caAnnuel:900000},evenementsCalendrier:[{id:1,date:'2026-10-08',label:'rdv'}],memoireIA:'memoire'};
it.each(Object.keys(nouvelles))('setter %s persiste recharge neutre barriere',async cle=>{
 const h=await boot();act(()=>h.result.current.setClients([{id:'unrelated'}]));await tick();for(const k of Object.keys(nouvelles))expect(Object.hasOwn(store.row.data,k)).toBe(false);store.writes=[];const setter='set'+cle[0].toUpperCase()+cle.slice(1);
 act(()=>h.result.current[setter](nouvelles[cle]));await tick();expect(store.row.data[cle]).toEqual(nouvelles[cle]);expect(store.writes).toHaveLength(1);
 h.unmount();const h2=await boot();expect(h2.result.current[cle]).toEqual(nouvelles[cle]);
 act(()=>h2.result.current[setter](x=>x));await tick();expect(store.writes).toHaveLength(1);
 act(()=>{h2.result.current.bloquerEcritures();h2.result.current[setter]('refus');});expect(h2.result.current[cle]).toEqual(nouvelles[cle]);
});
it('reprise marqueur apres confirmation empreinte capturee',async()=>{
 localStorage.setItem('cyna_cal_events','[]');const h=await boot();expect(h.result.current.repriseLocale.propositions.evenementsCalendrier.valeur).toEqual([]);
 const gate=deferred();store.deferWrite=gate.promise;let travail;act(()=>{travail=h.result.current.deciderRepriseLocale(true);});await settle();
 expect(JSON.parse(localStorage.getItem('cyna_reprise_serveur_user')||'{}').evenementsCalendrier).toBeUndefined();
 localStorage.setItem('cyna_cal_events','[{"id":2}]');gate.resolve();await act(async()=>await travail);
 expect(store.row.data.evenementsCalendrier).toEqual([]);expect(store.writes).toHaveLength(1);
 const {effacerCachesLocaux}=await import('../../utils/cachesLocaux');effacerCachesLocaux('user');expect(localStorage.getItem('cyna_cal_events')).toBe('[{"id":2}]');
});
it('reprise serveur devenu present gagne',async()=>{
 localStorage.setItem('cyna_objectifs','{"caAnnuel":1}');const h=await boot();store.row=row(1,{...blob(),objectifs:{caAnnuel:2}});emit();await settle();
 let decision;act(()=>{decision=h.result.current.deciderRepriseLocale(true);});await settle();await act(async()=>await decision);expect(store.row.data.objectifs).toEqual({caAnnuel:2});expect(store.writes).toHaveLength(0);
 expect(JSON.parse(localStorage.getItem(cles().find(k=>k.startsWith('cyna_sauvegarde_reprise_')))).objectifs).toEqual({caAnnuel:1});
});
it.each(['offline','conflit'])('reprise %s aucun marqueur',async scenario=>{
 localStorage.setItem('cyna_ia_memoire','ancien');const h=await boot();store.writeError=scenario==='conflit'?{code:'P0409'}:{message:'offline'};
 let decision;act(()=>{decision=h.result.current.deciderRepriseLocale(true);});await settle();await act(async()=>await decision);expect(JSON.parse(localStorage.getItem('cyna_reprise_serveur_user')||'{}').memoireIA).toBeUndefined();expect(localStorage.getItem('cyna_ia_memoire')).toBe('ancien');
});
it('copie impossible conserve nouvelle empreinte',async()=>{
 localStorage.setItem('cyna_cal_events','[]');localStorage.setItem('cyna_reprise_serveur_user','{"evenementsCalendrier":"ancienne"}');const h=await boot();const original=Storage.prototype.setItem;
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(k,v){if(k.startsWith('cyna_sauvegarde_reprise_'))throw new DOMException('plein','QuotaExceededError');return original.call(this,k,v);});
 let decision;act(()=>{decision=h.result.current.deciderRepriseLocale(false);});await settle();await act(async()=>await decision);expect(h.result.current.repriseLocale).not.toBeNull();
 const {effacerCachesLocaux}=await import('../../utils/cachesLocaux');effacerCachesLocaux('user');expect(localStorage.getItem('cyna_cal_events')).toBe('[]');
});
it('copie partielle visible et brut illisible',async()=>{
 localStorage.setItem('cyna_objectifs','{bad');localStorage.setItem('cyna_ia_memoire','locale');store.row=row(2,{...blob(),memoireIA:''});const h=await boot();
 const {listerCopies}=await import('../../utils/copiesRejetees');const copies=listerCopies(localStorage,'user').filter(c=>c.type==='reprise locale');expect(copies).toHaveLength(2);expect(copies.every(c=>!c.complete)).toBe(true);expect(copies.some(c=>c.contenu.texteBrut==='{bad')).toBe(true);expect(store.writes).toHaveLength(0);expect(h.result.current.memoireIA).toBe('');
});
it('import export reel copie nouvelles cles',async()=>{
 await app({...blob(),...nouvelles});fireEvent.click(screen.getByRole('button',{name:'Exporter backup'}));vi.useRealTimers();expect(await new Promise(resolve=>{const lecteur=new FileReader();lecteur.onload=()=>resolve(lecteur.result);lecteur.readAsText(objectURL.mock.calls[0][0]);})).toContain('memoireIA');vi.useFakeTimers();
 await ouvrir({...blob(),...nouvelles,memoireIA:''});expect(screen.getByRole('dialog')).toHaveTextContent('IA');await confirmerImport();expect(JSON.parse(localStorage.getItem(cles().find(k=>k.startsWith('cyna_sauvegarde_avant_import_'))))).toMatchObject(nouvelles);expect(store.row.data.memoireIA).toBe('');
 await ouvrir(blob());expect(screen.getByRole('dialog')).toHaveTextContent('conserv');await confirmerImport();expect(store.row.data.objectifs).toEqual(nouvelles.objectifs);
});
it('ecriture attendue generation memoire',async()=>{
 const h=await boot();let promise;let resolved=false;act(()=>{h.result.current.fermerMessageSync();promise=h.result.current.ecrireEtConfirmer('memoireIA','');promise.then(()=>{resolved=true;});expect(resolved).toBe(false);expect(store.writes).toHaveLength(0);});expect(await promise).toBe(true);let r;await act(async()=>{r=await h.result.current.envoyerMaintenant();});expect(r).toMatchObject({ok:true});expect(store.row.data.memoireIA).toBe('');
});

it('reprise updater differe avant envoyerMaintenant generation propre',async()=>{
 localStorage.setItem('cyna_ia_memoire','capturee');const h=await boot();let decision;
 act(()=>{h.result.current.fermerMessageSync();decision=h.result.current.deciderRepriseLocale(true);expect(store.writes).toHaveLength(0);});
 await settle();await act(async()=>await decision);expect(store.row.data.memoireIA).toBe('capturee');expect(store.writes).toHaveLength(1);expect(JSON.parse(localStorage.getItem('cyna_reprise_serveur_user')).memoireIA).toBeTruthy();
});
it('demo puis compte B confirmation refus copie sans serveur',async()=>{
 const demo=renderHook(()=>useSupabaseData('demo',true));await settle();localStorage.setItem('cyna_cal_events','[{"id":1}]');demo.unmount();store.writes=[];
 const h=await boot();expect(h.result.current.repriseLocale.propositions.evenementsCalendrier.valeur).toEqual([{id:1}]);let decision;act(()=>{decision=h.result.current.deciderRepriseLocale(false);});await settle();await act(async()=>await decision);
 expect(store.writes).toHaveLength(0);expect(localStorage.getItem(cles().find(k=>k.startsWith('cyna_sauvegarde_reprise_user_')))).toContain('evenementsCalendrier');
});
it('memoire Parametres Annuler puis Effacer confirmation serveur',async()=>{
 await app({...blob(),memoireIA:'ancienne'});fireEvent.click(screen.getByText('Société',{exact:true}));
 fireEvent.click(screen.getByRole('button',{name:'Effacer la mémoire IA'}));fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Annuler'}));await settle();expect(store.row.data.memoireIA).toBe('ancienne');expect(store.writes).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'Effacer la mémoire IA'}));fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Effacer',exact:true}));await settle();expect(store.row.data.memoireIA).toBe('');expect(store.writes).toHaveLength(1);
});

describe('LOC-01 gardes DL-10', () => {
 for (const cle of Object.keys(nouvelles)) {
  const setter = 'set' + cle[0].toUpperCase() + cle.slice(1);
  it(`${cle} refus initial sans ecriture differee`, async () => {
   const h = await boot(); const avant = h.result.current[cle]; let retour;
   act(() => { h.result.current.bloquerEcritures(); retour = h.result.current[setter](nouvelles[cle]); });
   await tick(5000); expect(retour).toBe(false);
   expect(h.result.current[cle]).toBe(avant); expect(store.writes).toHaveLength(0);
  });
  it(`${cle} readError sans etat ni ecriture`, async () => {
   store.readError = { message: 'lecture impossible' }; const h = await boot();
   const avant = h.result.current[cle]; let retour;
   act(() => { retour = h.result.current[setter](nouvelles[cle]); });
   await tick(5000); expect(retour).toBe(false);
   expect(h.result.current[cle]).toBe(avant); expect(store.writes).toHaveLength(0);
  });
  it(`${cle} barriere activee avant updater differe`, async () => {
   const h = await boot(); const avant = h.result.current[cle]; const updater = vi.fn(() => nouvelles[cle]);
   act(() => {
    // Queue a render first: React must evaluate the following updater during that render.
    h.result.current.fermerMessageSync();
    h.result.current[setter](updater); h.result.current.bloquerEcritures();
   });
   await tick(5000); expect(updater).not.toHaveBeenCalled();
   expect(h.result.current[cle]).toBe(avant); expect(store.writes).toHaveLength(0);
  });
 }
});

it.each(['copie', 'copie-brute'])('LOC-02 avis automatique %s sans proposition', async action => {
 localStorage.setItem('cyna_objectifs', action === 'copie' ? '{"caAnnuel":1}' : '{bad');
 store.row = row(0, { ...blob(), objectifs: { caAnnuel: 2 } });
 const original = Storage.prototype.setItem;
 vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v) {
  if (k.startsWith('cyna_sauvegarde_reprise_')) throw new DOMException('plein', 'QuotaExceededError');
  return original.call(this, k, v);
 });
 const h = await boot(); expect(h.result.current.repriseLocale).toBeNull();
 expect(h.result.current.etatSync).toMatchObject({ statut: 'information' });
 expect(h.result.current.etatSync.message).toMatch(/stockage plein/);
 expect(localStorage.getItem('cyna_reprise_serveur_user')).not.toContain('objectifs');
 expect(store.writes).toHaveLength(0);
});

it.each(['offline', 'conflit'])('LOC-02 dialogue explique echec %s et repropose au chargement', async scenario => {
 localStorage.setItem('cyna_ia_memoire', 'ancienne'); const h = await boot();
 store.writeError = scenario === 'conflit' ? { code: 'P0409' } : { message: 'offline' };
 let decision; act(() => { decision = h.result.current.deciderRepriseLocale(true); });
 await settle(); await act(async () => { expect(await decision).toBe(false); });
 const attendu = scenario === 'conflit' ? /non enregistrées/i : /Envoi en attente.*Réessayer/i;
 expect(h.result.current.repriseLocale?.erreur).toMatch(attendu);
 expect(JSON.parse(localStorage.getItem('cyna_reprise_serveur_user') || '{}').memoireIA).toBeUndefined();
 render(<AppProvider value={h.result.current}><RepriseLocale projet={h.result.current.repriseLocale} decider={vi.fn()} fermer={vi.fn()} /></AppProvider>);
 expect(screen.getByRole('alert')).toHaveTextContent(attendu);
 h.unmount(); store.writeError = null; const suivant = await boot();
 expect(suivant.result.current.repriseLocale.propositions.memoireIA.valeur).toBe('ancienne');
});

it('LOC-03 memoire ecrite exportable et reimportable', async () => {
 const h = await boot();
 const wrapper = ({ children }) => <AppProvider value={{ ...h.result.current }}>{children}</AppProvider>;
 const memoire = renderHook(() => useMemoire(), { wrapper });
 act(() => memoire.result.current.setMemoire('x'.repeat(200001))); await tick();
 expect(store.row.data.memoireIA.length).toBeLessThanOrEqual(8000);
 expect(verifierSauvegarde(instantaneComplet(store.row.data)).erreurs).toEqual([]);
});

it.each(['effacement', 'reprise'])('LOC-04 %s hors ligne sans suspension de retention', async scenario => {
 if (scenario === 'reprise') localStorage.setItem('cyna_ia_memoire', 'ancienne');
 const h = await boot(); store.writeError = { message: 'offline' }; let operation;
 act(() => { operation = scenario === 'effacement' ? h.result.current.ecrireEtConfirmer('memoireIA', '') : h.result.current.deciderRepriseLocale(true); });
 await settle(); if (scenario === 'effacement') await act(async () => h.result.current.envoyerMaintenant());
 await act(async () => { await operation; }); expect(retentionSuspendue()).toBe(false);
 h.unmount(); expect(retentionSuspendue()).toBe(false);
});

// ── Lot 2b « finition reprise locale » ─────────────────────────────────────────
const copieReprise = (cle, valeur, id = 'x1') => localStorage.setItem(`cyna_sauvegarde_reprise_user_${id}`,
  JSON.stringify({ source: 'reprise-locale', date: '2026-10-09T18:50:18.557Z', cle, texteBrut: cle === 'memoireIA' ? valeur : JSON.stringify(valeur), [cle]: valeur }));
const reprises = () => Object.keys(localStorage).filter(k => k.startsWith('cyna_sauvegarde_reprise_user_')).map(k => JSON.parse(localStorage.getItem(k)));

it('LOT2B restaurer la mémoire IA depuis une copie reprise : Annuler ne fait rien, Restaurer écrit version + 1 et garde les copies', async () => {
 copieReprise('memoireIA', 'memoire copiee');
 await app({ ...blob(), memoireIA: 'actuelle' });
 fireEvent.click(screen.getByText('Copies de secours', { exact: true }));
 expect(screen.getByText("Contenu : la mémoire de l'Assistant IA")).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: 'Restaurer cette donnée' }));
 expect(screen.getByRole('dialog')).toHaveTextContent('Valeur actuelle : 8 caractères');
 expect(screen.getByRole('dialog')).toHaveTextContent('Valeur de la copie : 14 caractères');
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' })); await settle();
 expect(store.writes).toHaveLength(0); expect(store.row.data.memoireIA).toBe('actuelle'); expect(reprises()).toHaveLength(1);
 fireEvent.click(screen.getByRole('button', { name: 'Restaurer cette donnée' }));
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restaurer', exact: true })); await settle();
 expect(store.row.data.memoireIA).toBe('memoire copiee'); expect(store.row.version).toBe(5); expect(store.writes).toHaveLength(1);
 expect(store.writes[0].payload.data).toMatchObject({ devis: [{ id: 'initial' }] });
 const apres = reprises();
 expect(apres).toHaveLength(2);
 expect(apres.map(c => c.memoireIA).sort()).toEqual(['actuelle', 'memoire copiee']);
});

it('LOT2B copie reprise invalide ou illisible : pas de bouton Restaurer cette donnée', async () => {
 copieReprise('objectifs', { caAnnuel: 'abc' }, 'inv');
 localStorage.setItem('cyna_sauvegarde_reprise_user_brute', JSON.stringify({ source: 'reprise-locale', date: '2026-10-09T18:50:18.557Z', cle: 'evenementsCalendrier', texteBrut: '{bad' }));
 await app();
 fireEvent.click(screen.getByText('Copies de secours', { exact: true }));
 expect(screen.getAllByRole('button', { name: 'Télécharger' }).length).toBeGreaterThanOrEqual(2);
 expect(screen.queryByRole('button', { name: 'Restaurer cette donnée' })).toBeNull();
});

it('LOT2B restaurer des objectifs absents du serveur : écriture directe, aucune copie de la valeur actuelle', async () => {
 copieReprise('objectifs', { caAnnuel: 1000000, margeCible: 20, nbChantiers: 9 });
 await app();
 fireEvent.click(screen.getByText('Copies de secours', { exact: true }));
 fireEvent.click(screen.getByRole('button', { name: 'Restaurer cette donnée' }));
 expect(screen.getByRole('dialog')).toHaveTextContent('Valeur actuelle : aucune');
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restaurer', exact: true })); await settle();
 expect(store.row.data.objectifs).toEqual({ caAnnuel: 1000000, margeCible: 20, nbChantiers: 9 });
 expect(reprises()).toHaveLength(1);
});

it('LOT2B fenêtre de reprise : boutons ≥ 44 px, principal bleu, refus confirmé', async () => {
 const decider = vi.fn(async () => true);
 render(<RepriseLocale email="a@b.ch" projet={{ propositions: { memoireIA: { valeur: 'x' } } }} decider={decider} fermer={vi.fn()} />);
 const ajouter = screen.getByRole('button', { name: 'Ajouter à mon compte' });
 expect(ajouter.style.minHeight).toBe('44px'); expect(ajouter.style.background).toMatch(/rgb\(13, 61, 110\)|#0D3D6E/i);
 expect(screen.getByRole('button', { name: 'Fermer' }).style.height).toBe('44px');
 expect(ajouter.parentElement.style.gap).toBe('12px');
 fireEvent.click(screen.getByRole('button', { name: 'Ne pas ajouter' })); expect(decider).not.toHaveBeenCalled();
 await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Oui, ne pas ajouter' })));
 expect(decider).toHaveBeenCalledWith(false);
});

it('INS2-01 une confirmation d’import terminée ne fausse pas un envoi ultérieur hors ligne', async () => {
 const h = await boot(); let p, r;
 const attendre = async () => { await settle(); await act(async () => { r = await p; }); return r; };
 store.writeError = { message: 'offline' };
 act(() => { p = h.result.current.importerTout(blob()); }); expect(await attendre()).toBe(true);
 act(() => { p = h.result.current.envoyerMaintenant(); }); expect((await attendre()).ok).toBe(false);
 store.writeError = null;
 // Le succès arrive par l'envoi automatique (minuteur), pas par envoyerMaintenant : la confirmation d'import reste « ok ».
 act(() => h.result.current.setClients([{ id: 'retour-reseau' }])); await tick(); expect(store.row.data.clients).toEqual([{ id: 'retour-reseau' }]);
 store.writeError = { message: 'offline' };
 act(() => h.result.current.setClients([{ id: 'apres-import' }]));
 act(() => { p = h.result.current.envoyerMaintenant(); }); expect((await attendre()).ok).toBe(false);
});

it('INS2-04 « Ne pas ajouter » après un échec partiel ne recopie pas la clé déjà copiée', async () => {
 localStorage.setItem('cyna_cal_events', '[{"id":1,"date":"2026-10-08","label":"a"}]');
 localStorage.setItem('cyna_ia_memoire', 'memoire');
 const original = Storage.prototype.setItem; let echecs = 1;
 vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
  if (k.startsWith('cyna_sauvegarde_reprise_') && String(v).includes('"cle":"memoireIA"') && echecs-- > 0) throw new DOMException('plein', 'QuotaExceededError');
  return original.call(this, k, v);
 });
 const h = await boot();
 let d1; await act(async () => { d1 = await h.result.current.deciderRepriseLocale(false); }); expect(d1).toBe(false);
 let d2; await act(async () => { d2 = await h.result.current.deciderRepriseLocale(false); }); expect(d2).toBe(true);
 const r = reprises();
 expect(r.filter(c => c.cle === 'evenementsCalendrier')).toHaveLength(1);
 expect(r.filter(c => c.cle === 'memoireIA')).toHaveLength(1);
 expect(store.writes).toHaveLength(0);
});

it('INS2-03 l’avis « stockage plein » n’est pas écrasé par l’avis des anciennes copies', async () => {
 localStorage.setItem('cyna_objectifs', '{bad');
 localStorage.setItem('cyna_sauvegarde_en_echec_user_ancienne', JSON.stringify({ date: '2026-10-01', clients: [] }));
 const original = Storage.prototype.setItem;
 vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
  if (k.startsWith('cyna_sauvegarde_reprise_')) throw new DOMException('plein', 'QuotaExceededError');
  return original.call(this, k, v);
 });
 const h = await boot();
 expect(h.result.current.etatSync.statut).toBe('information');
 expect(h.result.current.etatSync.message).toMatch(/stockage plein/);
 expect(h.result.current.etatSync.message).toMatch(/session précédente/);
});

it('LOT2B restauration : une valeur arrivée d’un autre appareil pendant la confirmation est copiée, pas écrasée en silence', async () => {
 const h = await boot();
 act(() => h.result.current.setMemoireIA('ancienne')); await tick(); store.writes = [];
 // Un autre appareil a écrit une valeur plus récente, appliquée par le temps réel.
 store.row = { ...store.row, data: { ...store.row.data, memoireIA: 'plus recente' }, version: store.row.version + 1 }; emit(); await settle();
 expect(h.result.current.memoireIA).toBe('plus recente');
 let p, ok; act(() => { p = h.result.current.ecrireEtConfirmer('memoireIA', 'restauree', { copierAvant: true }); }); await settle();
 await act(async () => { ok = await p; }); expect(ok).toBe(true);
 await act(async () => { await h.result.current.envoyerMaintenant(); });
 expect(store.row.data.memoireIA).toBe('restauree');
 expect(reprises().map(c => c.memoireIA)).toEqual(['plus recente']);
});

it('LOT2B restauration refusée (copie de la valeur actuelle impossible) : rien n’est écrit', async () => {
 const h = await boot();
 act(() => h.result.current.setMemoireIA('actuelle')); await tick(); store.writes = [];
 const original = Storage.prototype.setItem;
 vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
  if (k.startsWith('cyna_sauvegarde_reprise_')) throw new DOMException('plein', 'QuotaExceededError');
  return original.call(this, k, v);
 });
 let p, ok; act(() => { p = h.result.current.ecrireEtConfirmer('memoireIA', 'restauree', { copierAvant: true }); }); await settle();
 await act(async () => { ok = await p; }); expect(ok).toBe(false);
 await tick(); expect(store.writes).toHaveLength(0); expect(h.result.current.memoireIA).toBe('actuelle');
});

it('INS2-04 StrictMode : « Ajouter » sur une valeur différente du serveur ne crée qu’une seule copie', async () => {
 localStorage.setItem('cyna_ia_memoire', 'locale');
 const hook = renderHook(() => useSupabaseData('user'), { wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode> });
 await settle();
 expect(hook.result.current.repriseLocale.propositions.memoireIA.valeur).toBe('locale');
 // Le serveur reçoit une autre valeur pendant que la fenêtre est ouverte.
 store.row = { ...store.row, data: { ...store.row.data, memoireIA: 'serveur' }, version: store.row.version + 1 }; emit(); await settle();
 let d; act(() => { d = hook.result.current.deciderRepriseLocale(true); }); await settle(); await act(async () => { await d; });
 expect(reprises().filter(c => c.cle === 'memoireIA')).toHaveLength(1);
 expect(store.row.data.memoireIA).toBe('serveur');
});

it('LOT2B restauration en conflit : message dédié et bouton de confirmation non rouge', async () => {
 copieReprise('memoireIA', 'memoire copiee');
 await app({ ...blob(), memoireIA: 'actuelle' });
 fireEvent.click(screen.getByText('Copies de secours', { exact: true }));
 fireEvent.click(screen.getByRole('button', { name: 'Restaurer cette donnée' }));
 const bouton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Restaurer', exact: true });
 expect(bouton.style.background).not.toMatch(/239, 68, 68|#ef4444/i);
 store.row = { ...store.row, version: store.row.version + 1 }; // un autre appareil a écrit entre-temps
 fireEvent.click(bouton); await settle(); await tick();
 expect(screen.getByText(/Restauration non appliquée : le compte a été modifié ailleurs/)).toBeTruthy();
 expect(reprises().map(c => c.memoireIA)).toContain('memoire copiee');
});
