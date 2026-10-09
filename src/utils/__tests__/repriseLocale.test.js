
import {it,expect} from 'vitest';
import { verifierSauvegarde, instantaneComplet } from '../importControle';
const moduleReprise=()=>import('../repriseLocale');
it.each([
 ['id absent', 'evenementsCalendrier', [{}]],
 ['id double', 'evenementsCalendrier', [{id:1}, {id:'1'}]],
 ['champ mal type', 'evenementsCalendrier', [{id:1,label:42}]],
 ['objectif mal type', 'objectifs', {caAnnuel:[]}],
 ['memoire trop longue', 'memoireIA', 'x'.repeat(200001)],
])('LOC-03 %s conserve en copie brute', async (_, cle, valeur) => {
 const { planifierReprise, lireValeurLocale } = await moduleReprise();
 const raw = cle === 'memoireIA' ? valeur : JSON.stringify(valeur);
 expect(planifierReprise({}, {[cle]: lireValeurLocale(cle,raw)})[cle].action).toBe('copie-brute');
 const valide = cle === 'objectifs' ? {caAnnuel:'45000.'} : cle === 'memoireIA' ? 'memoire' : [{id:1,date:'2026-10-08',label:'rdv'}];
 const capture = lireValeurLocale(cle, cle === 'memoireIA' ? valide : JSON.stringify(valide));
 expect(capture.illisible).toBe(false);
 expect(verifierSauvegarde(instantaneComplet({parametres:{},[cle]:capture.valeur})).erreurs).toEqual([]);
});
it.each([
 ['absents',undefined,null,'rien'],['proposition',undefined,'{}','proposer'],['serveur seul',{},null,'rien'],
 ['egaux',{a:1,b:2},'{"b":2,"a":1}','rien'],['differents',{a:1},'{"a":2}','copie'],
 ['illisible',undefined,'{bad','copie-brute'],['mauvais type',undefined,'[]','copie-brute'],['vide valide',undefined,'{}','proposer'],
])('%s',async(_,serveur,raw,action)=>{
 const {planifierReprise,lireValeurLocale}=await moduleReprise();expect(planifierReprise({objectifs:serveur},{objectifs:lireValeurLocale('objectifs',raw)}).objectifs.action).toBe(action);
});
it('vides valides et empreinte exacte',async()=>{
 const {planifierReprise,lireValeurLocale,empreinte}=await moduleReprise();for(const [cle,raw] of [['memoireIA',''],['evenementsCalendrier','[]']])expect(planifierReprise({}, {[cle]:lireValeurLocale(cle,raw)})[cle].action).toBe('proposer');expect(empreinte(null)).toBe('absente');expect(empreinte('{}')).not.toBe(empreinte('{ }'));
});
