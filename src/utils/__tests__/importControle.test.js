import { describe, it, expect } from 'vitest';
import { verifierSauvegarde, instantaneComplet, resumerImport, CHAMPS_NUMERIQUES } from '../importControle';
const base = () => ({chantiers:[],devis:[],factures:[],clients:[],parametres:{},pointages:[]});
it.each([null,[],42,'texte'])('racine invalide %s',v=>expect(verifierSauvegarde(v).erreurs.length).toBeGreaterThan(0));
it.each(['parametres','chantiers','devis','factures','clients','pointages'])('structure %s invalide',k=>expect(verifierSauvegarde({...base(),[k]:42}).erreurs.join()).toContain(k));
it.each(['chantiers','devis','factures','clients','pointages'])('élément, id et doublon %s',k=>{
 for(const valeur of [null,[],42,{id:''},{id:null},{}, {id:undefined}])expect(verifierSauvegarde({...base(),[k]:[valeur]}).erreurs.length).toBeGreaterThan(0);
 const p={date:'2026-10-08',repartitions:[]};expect(verifierSauvegarde({...base(),[k]:[{...p,id:1},{...p,id:'1'}]}).erreurs.join()).toContain('double');
});
it.each([['virgule','123,45'],['texte','abc'],['NaN',NaN],['infini',Infinity],['objet',{}],['tableau',[]],['géant positif','9'.repeat(400)],['géant négatif','-'+'9'.repeat(400)]])('montant refusé %s',(_,v)=>{
 const r=verifierSauvegarde({...base(),factures:[{id:'F7',montantTTC:v}]});expect(r.erreurs.join()).toContain('montantTTC');expect(r.erreurs.join()).toContain('F7');
});
it('valeurs numériques acceptées et conservées, aucun champ connu omis',()=>{
 for(const [liste,champs] of Object.entries(CHAMPS_NUMERIQUES))for(const champ of champs)for(const valeur of [undefined,null,'',0,-2,' 123.45 ','-2']){
  const data={...base(),[liste]:[{id:'x',[champ]:valeur}]};expect(verifierSauvegarde(data).erreurs).toEqual([]);expect(verifierSauvegarde(data).donnees[liste][0][champ]).toBe(valeur);
 }
});
it.each([['devis','lignes'],['devis','avenants'],['devis','heuresRegie'],['factures','lignes'],['factures','paiementsHistorique'],['factures','rappels'],['chantiers','imprevus'],['chantiers','journal'],['chantiers','extras'],['chantiers','equipe'],['pointages','repartitions'],['pointages','majoration']])('collection %s.%s mal formée', (k,champ)=>{
 for(const v of [{},'texte',[null],[42]])expect(verifierSauvegarde({...base(),[k]:[{id:'x',date:'2026-10-08',repartitions:[],[champ]:v}]}).erreurs.join()).toContain(champ);
});
it('parametres collections et idsSupprimes contrôlés',()=>{
 for(const champ of ['employes','typesTravaux']) for(const v of [{},[null]])expect(verifierSauvegarde({...base(),parametres:{[champ]:v}}).erreurs.join()).toContain(champ);
 for(const v of [null,[],{clients:42},{clients:[null]},{clients:[Infinity]},{clients:[{}]}])expect(verifierSauvegarde({...base(),parametres:{idsSupprimes:v}}).erreurs.join()).toContain('idsSupprimes');
 expect(verifierSauvegarde({...base(),parametres:{idsSupprimes:{clients:['c',1]}}}).erreurs).toEqual([]);
});
it.each([undefined,null,42,'2026-02-30','2026-13-01','2026-2-01'])('date invalide %s',date=>expect(verifierSauvegarde({...base(),pointages:[{id:'p',date,repartitions:[]}]}).erreurs.join()).toContain('date'));
it('date bissextile réelle, répartitions obligatoires et heures strictes',()=>{
 expect(verifierSauvegarde({...base(),pointages:[{id:'p',date:'2024-02-29',repartitions:[]}]}).erreurs).toEqual([]);
 for(const repartitions of [undefined,null,[{heures:'2'}],[{heures:null}],[{}],[{heures:Infinity}]]) expect(verifierSauvegarde({...base(),pointages:[{id:'p',date:'2026-10-08',repartitions}]}).erreurs.length).toBeGreaterThan(0);
});
it('avenants scalaire historique restaurable, tableaux et montants imbriqués contrôlés',()=>{
 for(const avenants of [500,'500.25',[]])expect(verifierSauvegarde({...base(),chantiers:[{id:'c',avenants}]}).erreurs).toEqual([]);
 for(const avenants of [{},[null],'500,25'])expect(verifierSauvegarde({...base(),chantiers:[{id:'c',avenants}]}).erreurs.length).toBeGreaterThan(0);
 for(const [liste,champ,field]of [['devis','avenants','montant'],['devis','heuresRegie','heures'],['devis','heuresRegie','tarifHeure'],['factures','lignes','quantite'],['factures','lignes','prixUnitaire'],['factures','lignes','tva'],['factures','paiementsHistorique','montant'],['chantiers','imprevus','montant'],['chantiers','extras','montantForfait']])expect([...verifierSauvegarde({...base(),[liste]:[{id:'x',[champ]:[{[field]:'1,2'}]}]}).erreurs,...verifierSauvegarde({...base(),[liste]:[{id:'x',[champ]:[{[field]:'1,2'}]}]}).anomalies].join()).toContain(field);
});
it('journal des effets automatiques : objets employés, heures et date',()=>{
 for(const liste of ['chantiers','factures','devis'])expect(verifierSauvegarde({...base(),[liste]:[{id:'x',statut:42}]}).anomalies.join()).toContain('statut');
 for(const journal of [[{date:42}],[{employes:[null]}]])expect(verifierSauvegarde({...base(),chantiers:[{id:'c',journal}]}).erreurs.length).toBeGreaterThan(0);
});
it('références incohérentes avertissent, corbeille et référence vide acceptées',()=>{
 const data={...base(),chantiers:[{id:'c',clientId:'absent',devisId:'d'}],devis:[{id:'d',clientId:null,supprime_le:'2026-10-01'}],factures:[{id:'f',chantierId:'c',clientId:''}]};
 const r=verifierSauvegarde(data);expect(r.erreurs).toEqual([]);expect(r.anomalies).toHaveLength(1);
 for(const [liste,champ,cible]of [['chantiers','clientId','clients'],['chantiers','devisId','devis'],['factures','chantierId','chantiers'],['factures','clientId','clients'],['devis','clientId','clients']]){
  const d={...base(),[liste]:[{id:'source',[champ]:'cible'}]};expect(verifierSauvegarde(d).anomalies.join()).toContain(champ);expect(verifierSauvegarde(d).erreurs).toEqual([]);
  d[cible]=[{id:'cible',supprime_le:'2026-10-01'}];expect(verifierSauvegarde(d).anomalies).toEqual([]);
 }

});
it('ancien format, inconnues exclues seulement au premier niveau et limite de taille',()=>{
 const data={...base(),meta:{date:'2026'},extra:42};delete data.pointages;data.parametres.extra=42;
 const r=verifierSauvegarde(data);expect(r.anomalies.join()).toContain('conservées');expect(r.ignorees).toEqual(['meta','extra']);expect(r.donnees.meta).toBeUndefined();expect(r.donnees.parametres.extra).toBe(42);
 expect(verifierSauvegarde(base(),{tailleOctets:20*1024*1024}).erreurs).toEqual([]);expect(verifierSauvegarde(base(),{tailleOctets:20*1024*1024+1}).erreurs.join()).toContain('20 Mo');
});
it('instantané complet exact et résumé incluant heures et corbeille',()=>{
 const actuel={...base(),clients:[],listesCompletes:{...base(),clients:[{id:'c',supprime_le:'2026-10-01'}]},pointages:[{id:'p',date:'2026-10-08',repartitions:[{heures:2}]}]};
 const sauvegarde=instantaneComplet(actuel,'2026-10-08T10:20:30Z');expect(sauvegarde).toEqual({...base(),clients:[{id:'c',supprime_le:'2026-10-01'}],pointages:actuel.pointages,meta:{date:'2026-10-08T10:20:30.000Z',version:1,app:'CYNA',source:'avant-import'}});expect(verifierSauvegarde(sauvegarde).erreurs).toEqual([]);
 const r=resumerImport(actuel,sauvegarde);expect(r.lignes.find(x=>x.label==='Corbeille')).toEqual({label:'Corbeille',actuel:1,sauvegarde:1});expect(r.heuresActuelles).toBe(2);expect(r.date).toBe(sauvegarde.meta.date);
 delete sauvegarde.pointages;expect(resumerImport(actuel,sauvegarde).ancienFormat).toBe(true);
});

it('collections de valeurs simples conservent le format produit par l’application',()=>{
 const data={...base(),devis:[{id:'d',typesTravaux:['Peinture']}],chantiers:[{id:'c',employes:[1,'2'],typesTravaux:['Peinture'],journal:[{date:'2026-10-08',employesPresents:[1,'2']}]}]};expect(verifierSauvegarde(data).erreurs).toEqual([]);
 for(const [liste,champ]of [['devis','typesTravaux'],['chantiers','typesTravaux'],['chantiers','employes']])expect(verifierSauvegarde({...base(),[liste]:[{id:'x',[champ]:[{}]}]}).anomalies.join()).toContain(champ);
});

it.each(['45000.', '.5', '1e3'])('INS1-NUM-01 accepte %s sans conversion', v => {
 const data={...base(),devis:[{id:'d',montantHT:v}]};
 expect(verifierSauvegarde(data).erreurs).toEqual([]);
 expect(verifierSauvegarde(data).donnees.devis[0].montantHT).toBe(v);
});
it('INS1-HORS-06 champs hors plan avertissent',()=>{
 const r=verifierSauvegarde({...base(),devis:[{id:'d',statut:42,surface:'abc',typesTravaux:[{}]}]});
 expect(r.erreurs).toEqual([]);expect(r.anomalies).toHaveLength(3);
});
it('INS1-DATE-08 priorité meta puis date puis inconnue',()=>{
 expect(resumerImport(base(),{...base(),date:'2026-10-01'}).date).toBe('2026-10-01');
 expect(resumerImport(base(),{...base(),meta:{date:'meta'},date:'date'}).date).toBe('meta');
 expect(resumerImport(base(),base()).date).toBe('date inconnue');
});

it('INS1-HORS-06 journal heures avertit',()=>expect(verifierSauvegarde({...base(),chantiers:[{id:'c',journal:[{employes:[{heuresTravaillees:'1,2'}]}]}]}).anomalies.join()).toContain('heuresTravaillees'));

it('INS1-HORS-06 types de travaux primitifs et déplacement avertissent, formes qui plantent refusées',()=>{
 const r=verifierSauvegarde({...base(),parametres:{typesTravaux:['Peinture']},chantiers:[{id:'c',employes:42,journal:[{employesPresents:42}]}],pointages:[{id:'p',date:'2026-10-08',repartitions:[],deplacement:42}]});
 expect(r.erreurs).toEqual([]);expect(r.anomalies).toHaveLength(4);
 for(const parametres of [{typesTravaux:42},{typesTravaux:[null]}])expect(verifierSauvegarde({...base(),parametres}).erreurs.join()).toContain('typesTravaux');
});
