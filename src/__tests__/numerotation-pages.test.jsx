import React from 'react';
import { it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Factures from '../Factures';
import DevisPage from '../pages/DevisPage';
import ChantiersPage from '../pages/ChantiersPage';
import Corbeille from '../components/parametres/Corbeille';
vi.mock('../ExportPDF', () => ({exportDevis:vi.fn(), exportFacture:vi.fn(),exportFicheChantier:vi.fn()}));
vi.mock('../lib/supabase', () => ({supabase:{from:vi.fn()}}));
const year=new Date().getFullYear();
const num=(prefix,n)=>`${prefix}-${year}-${String(n).padStart(3,'0')}`;
const client={id:1,nom:'Client'};
const devis={id:'d',numero:num('DEV',1),clientId:1,statut:'accepté',montantHT:1000,typesTravaux:['Cloisons'],avenants:[],heuresRegie:[]};
function base(extra={}) { return {clients:[client],devis:[devis],chantiers:[],factures:[],parametres:{employes:[],typesTravaux:[{id:1,nom:'Cloisons'}]},profil:{id:'cyna'},confirmer:vi.fn().mockResolvedValue(true),afficherNotif:vi.fn(),naviguer:vi.fn(),periodeGlobale:'annee',...extra}; }
function factureSetup(compteur=4) {
 let current=Array.from({length:compteur===999999?0:compteur},(_,i)=>({id:`f${i}`,numero:num('F',i+1)}));
 const params={compteursNumeros:{[`F-${year}`]:compteur}};
 const save=vi.fn(u=>{current=typeof u==='function'?u(current,params):u;});
 const ctx=base();
 renderWithApp(<Factures factures={current} onSave={save} clients={[client]} chantiers={[]} devis={[]} parametres={params} profil={{id:'cyna'}} preRemplir={{clientId:1,lignes:[{description:'Travaux',quantite:1,prixUnitaire:100,tva:8.1}]}} onConsumePreRemplir={()=>{}} />,ctx);
 return {ctx,save,get:()=>current,arriver:f=>{current=[...current,f];params.compteursNumeros[`F-${year}`]=5;}};
}
it('NUM-page facture ouverte puis arrivée distante : 006 et message exact, une sauvegarde',()=>{
 const h=factureSetup(); expect(screen.getByDisplayValue(num('F',5))).toBeInTheDocument();
 h.arriver({id:'autre',numero:num('F',5)});
 fireEvent.click(screen.getByRole('button',{name:/Enregistrer brouillon/}));
 expect(h.get().at(-1).numero).toBe(num('F',6)); expect(h.save).toHaveBeenCalledTimes(1);
 expect(h.ctx.afficherNotif).toHaveBeenCalledWith(`${num('F',5)} était déjà utilisé : la facture a reçu ${num('F',6)}`);
});
it('NUM-page facture préremplie saturée reste ouverte sans écriture',()=>{
 const h=factureSetup(999999); expect(document.querySelector('input[readonly]').value).toBe('');
 fireEvent.click(screen.getByRole('button',{name:/Enregistrer brouillon/}));
 expect(h.get()).toEqual([]); expect(h.ctx.afficherNotif).toHaveBeenCalledWith(`Plus aucun numéro disponible pour la série F-${year}`,'error');
 expect(screen.getByRole('button',{name:/Enregistrer brouillon/})).toBeInTheDocument();
});
it('NUM-page devis saturée se rend et refuse création',()=>{
 let current=[]; const ctx=base({parametres:{employes:[],typesTravaux:[{id:1,nom:'Cloisons'}],compteursNumeros:{[`DEV-${year}`]:999999}},devis:[]});
 ctx.setDevis=vi.fn(u=>{current=u(current,{complet:current,parametres:ctx.parametres});});
 renderWithApp(<DevisPage/>,ctx); fireEvent.click(screen.getByRole('button',{name:/Nouveau devis/}));
 const select=screen.getAllByRole('combobox').find(s=>within(s).queryAllByRole('option').some(o=>o.value==='1'));
 fireEvent.change(select,{target:{value:'1'}}); fireEvent.change(screen.getByPlaceholderText("Ex : 45'000"),{target:{value:'1000'}});fireEvent.click(screen.getByRole('button',{name:'Cloisons'}));
 fireEvent.click(screen.getByRole('button',{name:'Sauvegarder'})); expect(current).toEqual([]);
 expect(ctx.afficherNotif).toHaveBeenCalledWith(`Plus aucun numéro disponible pour la série DEV-${year}`,'error');
});
it('NUM-conversion chantier saturée ne modifie ni devis ni navigation',()=>{
 const ctx=base({parametres:{employes:[],compteursNumeros:{[`CH-${year}`]:999999}}});let current=[];
 ctx.setChantiers=vi.fn(u=>{current=typeof u==='function'?u(current,{complet:current,parametres:ctx.parametres}):u;});ctx.setDevis=vi.fn();
 renderWithApp(<ChantiersPage/>,ctx);expect(screen.getByText('Chantiers')).toBeInTheDocument();cleanup();
 renderWithApp(<DevisPage/>,ctx); fireEvent.click(screen.getByRole('button',{name:/Créer le chantier/}));fireEvent.click(screen.getAllByRole('button',{name:/Créer le chantier/}).at(-1));
 expect(current).toEqual([]);expect(ctx.setDevis).not.toHaveBeenCalled();expect(ctx.naviguer).not.toHaveBeenCalled();
 expect(ctx.afficherNotif).toHaveBeenCalledWith(`Plus aucun numéro disponible pour la série CH-${year}`,'error');
});
it('NUM-conversion facture saturée ne modifie rien et ne navigue pas',async()=>{
 const ctx=base({parametres:{employes:[],compteursNumeros:{[`F-${year}`]:999999}}});let current=[];
 ctx.setFactures=vi.fn(u=>{current=u(current,ctx.parametres);});
 renderWithApp(<DevisPage/>,ctx);fireEvent.click(screen.getByRole('button',{name:/Créer la facture/}));
 await waitFor(()=>expect(ctx.afficherNotif).toHaveBeenCalledWith(`Plus aucun numéro disponible pour la série F-${year}`,'error'));
 expect(current).toEqual([]);expect(ctx.naviguer).not.toHaveBeenCalled();
});
it('NUM-restauration renumérote un devis repris et garde le numéro ancien libre',()=>{
 const ancien={...devis,supprime_le:new Date().toISOString()};const autre={...devis,id:'autre'};
 let data={clients:[client],devis:[ancien,autre],chantiers:[],factures:[],parametres:{compteursNumeros:{[`DEV-${year}`]:8}}};
 const ctx=base({listesCompletes:data,setDonneesListes:u=>{data=u(data);}});
 renderWithApp(<Corbeille/>,ctx);fireEvent.click(screen.getByRole('button',{name:'Restaurer'}));
 expect(data.devis[0].numero).toBe(num('DEV',9));expect(data.devis[0].supprime_le).toBeUndefined();
 expect(ctx.afficherNotif).toHaveBeenCalledWith(`${num('DEV',1)} a été repris entre-temps : le devis restauré a reçu ${num('DEV',9)}`);
 cleanup();
 const libre={...ancien,id:'libre',numero:'DEV-2025-004'};data={...data,devis:[libre],parametres:{compteursNumeros:{'DEV-2025':9}}};
 renderWithApp(<Corbeille/>,{...ctx,listesCompletes:data});fireEvent.click(screen.getByRole('button',{name:'Restaurer'}));expect(data.devis[0].numero).toBe('DEV-2025-004');
});

it('NUM-devis provisoire pris dans la corbeille reçoit le suivant et un message',()=>{
 const ctx=base({devis:[]});let current=[];
 const complet=[{id:'supprime',numero:num('DEV',1),supprime_le:new Date().toISOString()}];
 ctx.setDevis=vi.fn(u=>{current=typeof u==='function'?u(current,{complet,parametres:ctx.parametres}):u;});
 renderWithApp(<DevisPage/>,ctx);fireEvent.click(screen.getByRole('button',{name:/Nouveau devis/}));
 const select=screen.getAllByRole('combobox').find(s=>within(s).queryAllByRole('option').some(o=>o.value==='1'));
 fireEvent.change(select,{target:{value:'1'}});fireEvent.change(screen.getByPlaceholderText("Ex : 45'000"),{target:{value:'1000'}});fireEvent.click(screen.getByRole('button',{name:'Cloisons'}));fireEvent.click(screen.getByRole('button',{name:'Sauvegarder'}));
 expect(current[0].numero).toBe(num('DEV',2));expect(ctx.afficherNotif).toHaveBeenCalledWith(`${num('DEV',1)} était déjà utilisé : le devis a reçu ${num('DEV',2)}`);
});
it('NUM-conversion chantier prend le maximum de la corbeille',()=>{
 const ctx=base();let current=[];const complet=[{id:'supprime',numero:num('CH',8),supprime_le:new Date().toISOString()}];
 ctx.setChantiers=vi.fn(u=>{current=u(current,{complet,parametres:ctx.parametres});});ctx.setDevis=vi.fn();
 renderWithApp(<DevisPage/>,ctx);fireEvent.click(screen.getByRole('button',{name:/Créer le chantier/}));fireEvent.click(screen.getAllByRole('button',{name:/Créer le chantier/}).at(-1));
 expect(current[0].numero).toBe(num('CH',9));expect(ctx.naviguer).toHaveBeenCalled();
});
it('NUM-formulaire ouvert pendant conversion facture réserve 003 puis reçoit 004',async()=>{
 let current=[{id:'f1',numero:num('F',1)},{id:'f2',numero:num('F',2)}];const params={compteursNumeros:{[`F-${year}`]:2}};
 const ctx=base({factures:current,parametres:params});
 ctx.setFactures=vi.fn(u=>{current=u(current,params);params.compteursNumeros[`F-${year}`]=3;});
 const save=vi.fn(u=>{current=u(current,params);});
 renderWithApp(<Factures factures={current} onSave={save} clients={[client]} chantiers={[]} devis={[]} parametres={params} profil={{id:'cyna'}} preRemplir={{clientId:1,lignes:[{description:'Travaux',quantite:1,prixUnitaire:100,tva:8.1}]}} onConsumePreRemplir={()=>{}} />,ctx);
 expect(screen.getByDisplayValue(num('F',3))).toBeInTheDocument();renderWithApp(<DevisPage/>,ctx);
 fireEvent.click(screen.getByRole('button',{name:/Créer la facture/}));await waitFor(()=>expect(current).toHaveLength(3));expect(current.at(-1).numero).toBe(num('F',3));
 fireEvent.click(screen.getByRole('button',{name:/Enregistrer brouillon/}));expect(current.at(-1).numero).toBe(num('F',4));expect(current).toHaveLength(4);
});

it.each(['brouillon','envoyee'])('NUM-facture existante %s en doublon conserve son numéro dans un updater fonctionnel',(statut)=>{
 const existing={id:'existing',numero:num('F',5),clientId:1,statut,lignes:[{description:'Travaux',quantite:1,prixUnitaire:100,tva:8.1}]};
 let current=[existing,{...existing,id:'duplicate'}];const params={compteursNumeros:{[`F-${year}`]:9}};const ctx=base();const save=vi.fn(u=>{current=typeof u==='function'?u(current,params):u;});
 renderWithApp(<Factures factures={current} onSave={save} clients={[client]} chantiers={[]} devis={[]} parametres={params} profil={{id:'cyna'}} preRemplir={existing} onConsumePreRemplir={()=>{}} />,ctx);
 fireEvent.click(screen.getByRole('button',{name:/Enregistrer brouillon/}));expect(typeof save.mock.calls[0][0]).toBe('function');expect(current).toHaveLength(2);expect(current[0].numero).toBe(num('F',5));expect(ctx.afficherNotif).not.toHaveBeenCalled();
});
it('NUM-facture ordinaire saturée refuse création sans fermer formulaire',()=>{
 const params={compteursNumeros:{[`F-${year}`]:999999}};const ctx=base();let current=[];const save=vi.fn(u=>{current=typeof u==='function'?u(current,params):u;});
 renderWithApp(<Factures factures={[]} onSave={save} clients={[client]} chantiers={[]} devis={[]} parametres={params} profil={{id:'cyna'}} />,ctx);
 fireEvent.click(screen.getByRole('button',{name:/Nouvelle facture/}));expect(document.querySelector('input[readonly]').value).toBe('');
 const select=screen.getAllByRole('combobox').find(s=>within(s).queryAllByRole('option').some(o=>o.value==='1'));fireEvent.change(select,{target:{value:'1'}});
 fireEvent.click(screen.getByRole('button',{name:/Enregistrer brouillon/}));expect(current).toEqual([]);expect(ctx.afficherNotif).toHaveBeenCalledWith(`Plus aucun numéro disponible pour la série F-${year}`,'error');
 expect(screen.getByRole('button',{name:/Enregistrer brouillon/})).toBeInTheDocument();
});

it('R05 facture orpheline propose le suivant',()=>{

 renderWithApp(<Factures factures={[]} profil={{id:"cyna"}} toutesFactures={[{id:'orpheline',numero:num('F',4)}]} onSave={vi.fn()} clients={[client]} parametres={{}} />,base());

 fireEvent.click(screen.getByRole('button',{name:/Nouvelle facture/}));

 expect(screen.getByDisplayValue(num('F',5))).toBeInTheDocument();

});
