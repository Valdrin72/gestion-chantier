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
it('résumé réel : comptes, Annuler et Échap sans copie, téléchargement ni écriture', async()=>{
  await app(); await ouvrir({...blob(),clients:[{id:'c'}]});
  expect(screen.getByRole('dialog')).toHaveTextContent('Clients01');
  fireEvent.click(screen.getByRole('button',{name:'Annuler'}));
  await ouvrir(); fireEvent.keyDown(document,{key:'Escape'});
  expect(screen.queryByRole('dialog')).toBeNull(); expect(download).not.toHaveBeenCalled(); expect(cles()).toEqual([]); expect(store.writes).toEqual([]);
});
it('import réel : copie avant updater, une écriture version + 1, succès serveur, aucun confirm/prompt', async()=>{
  await app(); const historique = store.row.data;
  const ecrituresLocales=[];
  const setOriginal=Storage.prototype.setItem;
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(k,v){ecrituresLocales.push(k);return setOriginal.call(this,k,v);});
  await ouvrir({...blob(),clients:[{id:'c'}]}); await confirmerImport();
  const indexCopie=ecrituresLocales.findIndex(k=>k.startsWith('cyna_sauvegarde_avant_import_'));
  expect(indexCopie).toBe(0); expect(ecrituresLocales.indexOf('cyna_clients')).toBeGreaterThan(indexCopie);
  expect(JSON.parse(localStorage.getItem(cles()[0])).devis).toEqual(historique.devis);
  expect(download.mock.instances[0].download).toMatch(/^avant-import-.*\.json$/);
  expect(store.writes).toHaveLength(1); expect(store.row.version).toBe(5); expect(store.row.data.clients).toEqual([{id:'c'}]);
  expect(screen.getByTestId('message-import')).toHaveTextContent('restaurée et enregistrée'); expect(confirmSpy).not.toHaveBeenCalled(); expect(promptSpy).not.toHaveBeenCalled();
});
it('stockage plein : message exact et bouton ouvrant les copies, sans import ni suppression', async()=>{
  await app(); localStorage.setItem('cyna_sauvegarde_rejetee_1',JSON.stringify(blob())); const original=localStorage.getItem('cyna_sauvegarde_rejetee_1');
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('plein','QuotaExceededError');});
  await ouvrir(); await confirmerImport();
  const nom=download.mock.instances[0].download;
  expect(screen.getByTestId('message-import').textContent).toContain(`Import annulé : le stockage de cet appareil est plein, la copie de sécurité locale n'a pas pu être enregistrée. Vos données n'ont pas été modifiées. Le fichier ${nom} a bien été téléchargé. Téléchargez vos copies de secours pour les garder en lieu sûr.`);
  fireEvent.click(screen.getByRole('button',{name:'Voir les copies de secours'}));
  expect(screen.getByRole('heading',{name:'Copies de secours — Télécharger ou restaurer'})).toBeTruthy();
  expect(store.writes).toEqual([]); expect(localStorage.getItem('cyna_sauvegarde_rejetee_1')).toBe(original);
});
it('URL impossible : annule avant la copie locale et le remplacement',async()=>{
  await app(); objectURL.mockImplementation(()=>{throw new Error('URL');}); await ouvrir(); await confirmerImport();
  expect(screen.getByTestId('message-import')).toHaveTextContent("Copie de sécurité impossible : import annulé. Aucune donnée n'a été modifiée."); expect(store.writes).toEqual([]); expect(cles()).toEqual([]);
});
it('REMPLACER exact obligatoire pour les heures, ancien format les conserve',async()=>{
  const p={id:'p',date:'2026-10-08',employeId:1,repartitions:[{categorie:'absence',heures:2}]};
  await app({...blob(),pointages:[p]}); await ouvrir();
  expect(screen.getByRole('button',{name:'Importer',exact:true})).toBeDisabled(); fireEvent.change(screen.getByLabelText('Tapez REMPLACER'),{target:{value:'remplacer'}});
  expect(screen.getByRole('button',{name:'Importer',exact:true})).toBeDisabled(); fireEvent.change(screen.getByLabelText('Tapez REMPLACER'),{target:{value:'REMPLACER'}});
  expect(screen.getByRole('button',{name:'Importer',exact:true})).toBeEnabled(); fireEvent.click(screen.getByRole('button',{name:'Annuler'}));
  const ancien=blob(); delete ancien.pointages; await ouvrir(ancien); expect(screen.getByRole('dialog')).toHaveTextContent('vos 2 h sont conservées'); await confirmerImport(); expect(store.row.data.pointages).toEqual([p]);
});
it.each([
 ['répartitions absentes',{id:'p',date:'2026-10-08'}], ['répartitions nulles',{id:'p',date:'2026-10-08',repartitions:null}],
 ['date numérique',{id:'p',date:42,repartitions:[{chantierId:'ch',categorie:'production',heures:2}]}],
 ['date impossible',{id:'p',date:'2026-02-30',repartitions:[]}],
 ['date absente',{id:'p',repartitions:[]}], ['heures chaîne',{id:'p',date:'2026-10-08',repartitions:[{heures:'2'}]}]
])('App et hook refusent %s avant résumé et écriture',async(_,p)=>{
 await app(); const avant=JSON.stringify(store.row); await ouvrir({...blob(),chantiers:[{id:'ch'}],pointages:[{id:'valide',date:'2026-10-07',repartitions:[{chantierId:'ch',categorie:'production',heures:1}]},p]});
 expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByTestId('message-import')).toHaveTextContent(p.date === 42 ? 'date 42 invalide' : p.date === undefined && p.repartitions ? 'date undefined invalide' : p.date === '2026-02-30' ? 'date \"2026-02-30\" invalide' : typeof p.repartitions?.[0]?.heures === 'string' ? 'heures' : 'repartitions'); expect(store.writes).toEqual([]); expect(JSON.stringify(store.row)).toBe(avant);
});
it('idsSupprimes mal formé refusé puis import valide passe par importerTout',async()=>{
 await app(); await ouvrir({...blob(),parametres:{idsSupprimes:{clients:42}}}); expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByTestId('message-import')).toHaveTextContent('idsSupprimes.clients'); expect(store.writes).toEqual([]);
 await ouvrir({...blob(),parametres:{...blob().parametres,idsSupprimes:{clients:['ancien']}}}); await confirmerImport(); expect(store.row.data.parametres.idsSupprimes.clients).toEqual(['ancien']);
});
it('compteurs : vrai Parametres et hook conservent F9 DEV6 CH4 puis attribuent 010 007 005',async()=>{
 const numeros=(prefix,n)=>Array.from({length:n},(_,i)=>({id:`${prefix}${i}`,numero:`${prefix}-2026-${String(i+1).padStart(3,'0')}`}));
 await app({...blob(),factures:numeros('F',7),devis:numeros('DEV',5),chantiers:numeros('CH',4),parametres:{...blob().parametres,compteursNumeros:{'F-2026':9,'DEV-2026':6,'CH-2026':4}}});
 await ouvrir({...blob(),factures:numeros('F',3),devis:numeros('DEV',2),chantiers:numeros('CH',1),parametres:{...blob().parametres,compteursNumeros:{'F-2026':3,'DEV-2026':2}}}); await confirmerImport();
 expect(store.row.data.parametres.compteursNumeros).toEqual({'F-2026':9,'DEV-2026':6,'CH-2026':4});
 const facture=render(<AppProvider value={capture.ctx}><Factures factures={capture.ctx.factures} onSave={capture.ctx.setFactures} clients={[{id:'client',nom:'Client'}]} chantiers={[]} devis={[]} parametres={capture.ctx.parametres} profil={{id:'cyna'}} /></AppProvider>);
 fireEvent.click(screen.getByRole('button',{name:/Nouvelle facture/}));
 fireEvent.change(screen.getAllByRole('combobox').find(s=>within(s).queryAllByRole('option').some(o=>o.value==='client')),{target:{value:'client'}});
 fireEvent.click(screen.getByRole('button',{name:/Enregistrer brouillon/}));await settle();await tick();
 expect(store.row.data.factures.at(-1).numero).toBe('F-2026-010');facture.unmount();
 act(()=>capture.ctx.setClients([{id:1,nom:'Client'}]));await settle();await tick();
 const devisVue=render(<AppProvider value={{...capture.ctx,naviguer:vi.fn(),periodeGlobale:'annee',parametres:{...capture.ctx.parametres,typesTravaux:[{id:1,nom:'Cloisons'}]}}}><DevisPage /></AppProvider>);
 fireEvent.click(within(devisVue.container).getByRole('button',{name:/Nouveau devis/}));
 fireEvent.change(screen.getAllByRole('combobox').find(s=>within(s).queryAllByRole('option').some(o=>o.value==='1')),{target:{value:'1'}});
 fireEvent.change(screen.getByPlaceholderText("Ex : 45'000"),{target:{value:'1000'}});fireEvent.click(screen.getByRole('button',{name:'Cloisons'}));
 fireEvent.click(screen.getByRole('button',{name:'Sauvegarder'}));await settle();await tick();
 expect(store.row.data.devis.at(-1).numero).toBe('DEV-2026-007');
 const nouveauDevis=store.row.data.devis.at(-1);devisVue.unmount();
 render(<AppProvider value={{...capture.ctx,devis:[{...nouveauDevis,statut:'accepté'}],naviguer:vi.fn(),periodeGlobale:'annee'}}><DevisPage /></AppProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Créer le chantier',exact:true}));
 fireEvent.click(screen.getAllByRole('button',{name:'Créer le chantier',exact:true}).at(-1)); await settle(); await tick();
 expect(store.row.data.chantiers.at(-1).numero).toBe('CH-2026-005');
 expect(store.row.data.chantiers.at(-1).devisId).toBe(nouveauDevis.id);
});
it.each(['succès','conflit','hors ligne','conflit lecture échouée'])('confirmation serveur : %s',async(mode)=>{
 await app(); await ouvrir({...blob(),clients:[{id:'import'}]});
 if(mode.startsWith('conflit')) store.row=row(5,{...blob(),clients:[{id:'distant'}]});
 if(mode==='hors ligne') store.writeError={message:'offline'};
 if(mode==='conflit lecture échouée') store.readError={message:'lecture impossible'};
 await confirmerImport();
 if(mode==='succès') expect(screen.getByTestId('message-import')).toHaveTextContent('restaurée et enregistrée');
 else {
   expect(screen.queryByText(/Sauvegarde restaurée et enregistrée/)).toBeNull();
   if(mode==='conflit') {expect(screen.getByTestId('message-import')).toHaveTextContent('ont été rechargées'); expect(capture.ctx.clients).toEqual([{id:'distant'}]);}
   if(mode==='hors ligne') {expect(screen.getByTestId('message-import')).toHaveTextContent('pas encore enregistré'); expect(cles().some(k=>k.startsWith('cyna_sauvegarde_en_echec_'))).toBe(true);}
   if(mode==='conflit lecture échouée') {expect(screen.queryByText(/ont été rechargées/)).toBeNull(); expect(screen.getByText(/Impossible de recharger les données à jour/)).toBeTruthy();}
 }
});
it('résumé propre puis épisode en échec : refus sans copie avant import ni remplacement',async()=>{
 await app(); await ouvrir(); act(()=>capture.ctx.setClients([{id:'local'}])); store.writeError={message:'offline'}; await tick(); const avant=Object.fromEntries(cles().map(k=>[k,localStorage.getItem(k)]));
 await confirmerImport(); expect(screen.getByTestId('message-import')).toHaveTextContent('Des modifications ne sont pas encore enregistrées'); expect(download).not.toHaveBeenCalled(); expect(capture.ctx.clients).toEqual([{id:'local'}]); expect(Object.fromEntries(cles().map(k=>[k,localStorage.getItem(k)]))).toEqual(avant);
 await ouvrir(); expect(screen.queryByRole('dialog')).toBeNull();
 await act(async()=>expect(await capture.ctx.importerTout(blob())).toBe(false));
});
it('cinq copies : restauration de la plus ancienne, conflit sans rétention ni suppression',async()=>{
 await app(); const avant={cyna_sauvegarde_rejetee:JSON.stringify({...blob(),source:'historique'})}; localStorage.setItem('cyna_sauvegarde_rejetee',avant.cyna_sauvegarde_rejetee); for(let i=1;i<=5;i++){const k=`cyna_sauvegarde_rejetee_${i}`;avant[k]=JSON.stringify({...blob(),date:`2026-10-0${i}`});localStorage.setItem(k,avant[k]);}
 fireEvent.click(screen.getByText('Copies de secours',{exact:true}));
 const article=screen.getByText('cyna_sauvegarde_rejetee_1').closest('article');
 fireEvent.click(within(article).getByRole('button',{name:'Restaurer'})); store.row=row(5,blob()); await confirmerImport();
 for(const [k,v]of Object.entries(avant))expect(localStorage.getItem(k)).toBe(v);
 expect(cles().filter(k=>k.startsWith('cyna_sauvegarde_rejetee_'))).toHaveLength(6);
});
it('copies : brut téléchargé, partielle sans restauration, complète résumé annulé intact',async()=>{
 await app(); localStorage.setItem('cyna_sauvegarde_rejetee_bad','{illisible');localStorage.setItem('cyna_sauvegarde_rejetee_partial',JSON.stringify({clients:[{id:'c'}]})); localStorage.setItem('cyna_sauvegarde_rejetee_full',JSON.stringify(blob()));
 fireEvent.click(screen.getByText('Copies de secours',{exact:true}));
 for(const cle of ['bad','partial']) expect(within(screen.getByText('cyna_sauvegarde_rejetee_'+cle).closest('article')).queryByRole('button',{name:'Restaurer'})).toBeNull();
 fireEvent.click(within(screen.getByText('cyna_sauvegarde_rejetee_bad').closest('article')).getByRole('button',{name:'Télécharger'}));
 expect(download).toHaveBeenCalledTimes(1);
 fireEvent.click(within(screen.getByText('cyna_sauvegarde_rejetee_full').closest('article')).getByRole('button',{name:'Restaurer'}));fireEvent.click(screen.getByRole('button',{name:'Annuler'}));
 expect(store.writes).toEqual([]);expect(cles()).toHaveLength(3);
});
it('limite 20 Mo avant lecture, JSON invalide sans résumé',async()=>{
 await app(); const fichier=await ouvrir(blob(),20*1024*1024+1); expect(fichier.text).not.toHaveBeenCalled(); expect(screen.getByTestId('message-import')).toHaveTextContent('20 Mo');
 await act(async()=>fireEvent.change(document.querySelector('input[type="file"]'),{target:{files:[{size:2,text:async()=>'{'}]}})); expect(screen.getByTestId('message-import')).toHaveTextContent('JSON invalide');expect(screen.queryByRole('dialog')).toBeNull();
});
it('export réel : même format et instantané complet avec corbeille, accepté par le validateur',async()=>{
 await app({...blob(),clients:[{id:'corbeille',supprime_le:'2026-10-07'}]}); let contenu;
 objectURL.mockImplementation(b=>{contenu=b;return 'blob:test';}); fireEvent.click(screen.getByRole('button',{name:'Exporter backup'}));
 vi.useRealTimers();
 const texte=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsText(contenu);});
 const data=JSON.parse(texte);expect(data.clients).toHaveLength(1);expect(data.meta.source).toBeUndefined();expect(data.meta.date).toMatch(/T/);
 const {verifierSauvegarde}=await import('../../utils/importControle');expect(verifierSauvegarde(data).erreurs).toEqual([]);
});

it('double clic pendant écriture : un seul téléchargement, une copie, une écriture',async()=>{
 await app();await ouvrir();const gate=deferred();store.deferWrite=gate.promise;
 act(()=>{const bouton=screen.getByRole('button',{name:'Importer',exact:true});bouton.click();bouton.click();});await settle();
 expect(screen.getByRole('dialog')).toHaveTextContent('Enregistrement…');expect(download).toHaveBeenCalledTimes(1);expect(cles()).toHaveLength(1);expect(store.writes).toHaveLength(1);
 await act(async()=>gate.resolve());await settle();expect(screen.getByTestId('message-import')).toHaveTextContent('restaurée et enregistrée');
});
it('hook refuse import avec updater local en file puis écriture en attente et en vol',async()=>{
 const h=await boot(); let resultat;
 act(()=>{h.result.current.setClients([{id:'local'}]);resultat=h.result.current.importerTout(blob());});expect(await resultat).toBe(false);await settle();
 expect(h.result.current.etatEnregistrement().propre).toBe(false);expect(await h.result.current.importerTout(blob())).toBe(false);
 const gate=deferred();store.deferWrite=gate.promise;act(()=>{h.result.current.envoyerMaintenant();});await settle();expect(await h.result.current.importerTout(blob())).toBe(false);await act(async()=>gate.resolve());await settle();expect(h.result.current.clients).toEqual([{id:'local'}]);
 act(()=>h.result.current.bloquerEcritures());act(()=>expect(h.result.current.setClients([])).toBe(false));expect((await h.result.current.envoyerMaintenant()).ok).toBe(false);
 act(()=>h.result.current.debloquerEcritures());expect((await h.result.current.envoyerMaintenant()).ok).toBe(true);
});
it('org : import appliqué mais écriture encore en attente ne promet pas de succès',async()=>{
 localStorage.setItem('cyna_storage_mode','org');const h=await boot();let promesse;act(()=>{promesse=h.result.current.importerTout({...blob(),clients:[{id:'org'}]});});await settle();expect(await promesse).toBe(true);
 expect(await h.result.current.envoyerMaintenant()).toEqual({ok:false});expect(h.result.current.clients).toEqual([{id:'org'}]);
});
it('erreurs : dix visibles et décompte des autres, aucune copie',async()=>{
 await app();await ouvrir({...blob(),clients:Array.from({length:13},()=>({}))});expect(screen.getByTestId('message-import')).toHaveTextContent('… et 3 autres');expect(screen.queryByRole('dialog')).toBeNull();expect(download).not.toHaveBeenCalled();expect(store.writes).toEqual([]);
});

it('INS1-SYNC-02 succès import malgré effets automatiques en attente',async()=>{
 await app(); const ancien=blob(); delete ancien.pointages;
 ancien.chantiers=[{id:'ch',journal:[{date:'2026-10-07',employes:[{employeId:1,heuresTravaillees:2}]}]}];
 delete ancien.parametres.migrationJournalV2Done;
 await ouvrir(ancien); const gate=deferred();store.deferWrite=gate.promise;
 act(()=>screen.getByRole('button',{name:'Importer',exact:true}).click());await settle();
 // Une nouvelle sauvegarde des effets automatiques peut arriver pendant la confirmation.
 act(()=>capture.ctx.setParametres(p=>({...p,backfillCoefMO10Done:true})));await settle();
 expect(capture.ctx.etatEnregistrement().propre).toBe(false);
 await act(async()=>gate.resolve());await settle();
 expect(screen.getByTestId('message-import')).toHaveTextContent('restaurée et enregistrée');
});
it('INS1-RET-03 import hors ligne puis conflit préserve les cinq copies',async()=>{
 await app();const avant={};for(let i=1;i<=5;i++){const k=`cyna_sauvegarde_rejetee_${i}`;avant[k]=JSON.stringify(blob());localStorage.setItem(k,avant[k]);}
 await ouvrir();store.writeError={message:'offline'};await confirmerImport();
 store.writeError=null;store.row=row(5,blob());await act(async()=>capture.ctx.envoyerMaintenant());await settle();
 for(const [k,v] of Object.entries(avant))expect(localStorage.getItem(k)).toBe(v);
});
it('INS1-UI-07 focus, français, anomalies limitées et message visible depuis copies',async()=>{
 const scroll=vi.fn();HTMLElement.prototype.scrollIntoView=scroll;
 await app();await ouvrir({...blob(),devis:Array.from({length:23},(_,i)=>({id:i,clientId:'absent'}))});
 expect(screen.getByRole('dialog')).toHaveFocus();expect(screen.getByRole('dialog')).toHaveTextContent('Chantiers');
 expect(within(screen.getByRole('dialog')).getAllByText(/Avertissement/)).toHaveLength(20);
 expect(screen.getByRole('dialog')).toHaveTextContent('… et 3 autres');fireEvent.click(screen.getByRole('button',{name:'Annuler'}));
 localStorage.setItem('cyna_sauvegarde_rejetee_date',JSON.stringify({...blob(),date:'2026-09-01'}));
 fireEvent.click(screen.getByText('Copies de secours',{exact:true}));
 const article=screen.getByText('cyna_sauvegarde_rejetee_date').closest('article');
 expect(article.querySelector('button').parentElement.style.gap).toBe('12px');
 fireEvent.click(within(article).getByRole('button',{name:'Restaurer'}));
 expect(screen.getByRole('dialog')).toHaveTextContent('2026-09-01');await confirmerImport();expect(scroll).toHaveBeenCalled();
});
it('INS1-NUM-01 export réel puis import des trois formats',async()=>{
 await app({...blob(),devis:['45000.','.5','1e3'].map((v,i)=>({id:i,montantHT:v}))});let contenu;
 objectURL.mockImplementation(b=>{contenu=b;return 'blob:test';});fireEvent.click(screen.getByRole('button',{name:'Exporter backup'}));
 vi.useRealTimers();const texte=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsText(contenu);});vi.useFakeTimers();
 await ouvrir(JSON.parse(texte));await confirmerImport();expect(screen.getByTestId('message-import')).toHaveTextContent('restaurée et enregistrée');
 expect(store.row.data.devis.map(d=>d.montantHT)).toEqual(['45000.','.5','1e3']);
});


it('INS2-RET-02 refus de formulaire pendant import ouvert puis retention reprend', async()=>{
 const h=await boot();const avant={};for(let i=1;i<=5;i++){const k=`cyna_sauvegarde_rejetee_${i}`;avant[k]='ancien';localStorage.setItem(k,avant[k]);}
 store.writeError={message:'offline'};let resultat;act(()=>{resultat=h.result.current.importerTout(blob());});expect(await resultat).toBe(true);
 await act(async()=>h.result.current.envoyerMaintenant());await settle();
 conserverBrouillonRefuse('clients',{id:'brouillon'});
 for(const [k,v] of Object.entries(avant))expect(localStorage.getItem(k)).toBe(v);
 store.writeError=null;await act(async()=>h.result.current.envoyerMaintenant());await settle();
 conserverBrouillonRefuse('clients',{id:'apres'});
 expect(Object.keys(localStorage).filter(k=>k.startsWith('cyna_sauvegarde_rejetee_'))).toHaveLength(5);
});
it('INS2-SYNC-03 exception de calcul libere import et permet la reprise',async()=>{
 const h=await boot();const erreur=vi.spyOn(console,'error').mockImplementation(()=>{});
 const data=blob();Object.defineProperty(data,'parametres',{get(){throw new Error('calcul impossible');}});
 let resultat;act(()=>{resultat=h.result.current.importerTout(data);});await settle();
 expect(await resultat).toBe(false);expect(erreur).toHaveBeenCalled();expect(h.result.current.etatEnregistrement().propre).toBe(true);
 const copies=await import('../../utils/copiesRejetees');expect(copies.retentionSuspendue?.()).toBe(false);
 act(()=>{resultat=h.result.current.importerTout(blob());});expect(await resultat).toBe(true);
 await act(async()=>h.result.current.envoyerMaintenant());await settle();expect(copies.retentionSuspendue()).toBe(false);
});
it('INS2-SYNC-03 org ne suspend jamais la retention',async()=>{
 localStorage.setItem('cyna_storage_mode','org');const h=await boot();let resultat;
 act(()=>{resultat=h.result.current.importerTout(blob());});await settle();expect(await resultat).toBe(true);
 const copies=await import('../../utils/copiesRejetees');expect(copies.retentionSuspendue?.()).toBe(false);
 await act(async()=>h.result.current.envoyerMaintenant());expect(copies.retentionSuspendue()).toBe(false);
});
it('INS2-MSG-04 ecriture entre controle et updater affiche le refus',async()=>{
 await app();await ouvrir();download.mockImplementation(()=>capture.ctx.setClients([{id:'tardif'}]));
 await confirmerImport();expect(screen.getByTestId('message-import')).toHaveTextContent('Des modifications ne sont pas encore enregistrées');
 expect(screen.queryByRole('dialog')).toBeNull();expect(capture.ctx.clients).toEqual([{id:'tardif'}]);
});

it('INS2-SYNC-03 exception libere la fenetre Enregistrement',async()=>{
 await app();await ouvrir();
 const numerotation=await import('../../utils/numerotation');
 vi.spyOn(numerotation,'avecCompteurs').mockImplementation(()=>{throw new Error('calcul impossible');});
 vi.spyOn(console,'error').mockImplementation(()=>{});
 await confirmerImport();expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.getByTestId('message-import')).toHaveTextContent('Import non effectué');
 expect(capture.ctx.etatEnregistrement().propre).toBe(true);
});
