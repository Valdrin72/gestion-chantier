import { describe, it, expect } from 'vitest';
import { numeroSuivant, attribuerNumero, fusionnerCompteurs, numeroDisponible, compteursDepuisListes, lireCompteur, avecCompteurs } from '../numerotation';
const date = new Date(2026, 5, 1);
describe('numérotation unique', () => {
 it('U1 inclut corbeille et compteur', () => { expect(numeroSuivant('factures', {factures:[{numero:'F-2026-005',supprime_le:'hier'}]}, {'F-2026':7}, date)).toBe('F-2026-008'); });
 it('U2 fusionne les maxima et conserve la référence', () => { const a={'F-2026':7}; expect(fusionnerCompteurs(a, {'F-2026':3})).toBe(a); expect(fusionnerCompteurs(a, {'F-2026':8})).toEqual({'F-2026':8}); });
 it('U3 refuse doublons et numéros déjà attribués', () => { expect(numeroDisponible('factures','F-2026-005',{factures:[{id:2,numero:' F-2026-005 '}]},{},1)).toBe(false); expect(numeroDisponible('factures','F-2026-005',{}, {'F-2026':5},1)).toBe(false); });
 it('U4 vérifie année et série lors de création', () => { expect(attribuerNumero('factures',{numero:'F-2026-006'}, {}, {}, new Date(2027,0,1)).element.numero).toBe('F-2027-001'); expect(attribuerNumero('factures',{numero:'DEV-2026-006'}, {}, {}, date).element.numero).toBe('F-2026-001'); });
 it('U5 restaure un ancien numéro libre', () => { const e={id:1,numero:'DEV-2025-004'}; expect(attribuerNumero('devis',e,{devis:[e]}, {'DEV-2025':4},date,{ignorerCompteur:true}).element).toBe(e); });
 it('U6 ignore et nettoie les valeurs hors plafond', () => { expect(compteursDepuisListes({factures:[{numero:'F-2026-9007199254740992'}]})).toEqual({}); expect(lireCompteur({'F-2026':1e20},'F-2026')).toBe(0); expect(fusionnerCompteurs({'F-2026':1e20}, {'F-2026':3})).toEqual({'F-2026':3}); expect(numeroSuivant('factures',{factures:[{numero:'F-2026-003'}]}, {'F-2026':1e20},date)).toBe('F-2026-004'); });
 it('U7 refuse une série saturée sans exception', () => { expect(numeroSuivant('factures',{}, {'F-2026':999999},date)).toBeNull(); expect(attribuerNumero('factures',{numero:''},{},{'F-2026':999999},date)).toEqual({erreur:'Plus aucun numéro disponible pour la série F-2026'}); });
});

it('R01 compte uniquement le prefixe de sa liste', () => {

 const listes={factures:[{numero:'F-2026-004'}],devis:[{numero:'F-2026-500'}]};

 expect(compteursDepuisListes(listes)).toEqual({'F-2026':4});

 expect(numeroSuivant('factures',listes,{},date)).toBe('F-2026-005');

 expect(attribuerNumero('devis',{numero:'F-2026-500'},listes,{},date).change).toEqual({ancien:'F-2026-500',nouveau:'DEV-2026-001'});

});

it('R02 normalise les donnees anciennes', () => {

 const listes={devis:[null,{id:1,numero:12}]};

 expect(compteursDepuisListes(listes)).toEqual({});

 expect(numeroDisponible('devis','12',listes,{},2)).toBe(false);

 expect(attribuerNumero('devis',{id:2,numero:12},listes,{},date).element.numero).toBe('DEV-2026-001');

 expect(avecCompteurs(listes,listes)).toBe(listes);

});

it('R03 un nouveau numero gere doit etre exactement le suivant', () => {

 const listes={devis:[{numero:'DEV-2026-004'}]};

 const a=attribuerNumero('devis',{numero:'DEV-2026-999999'},listes,{},date);

 expect(a.element.numero).toBe('DEV-2026-005');expect(a.change).toBeTruthy();

 expect(avecCompteurs(listes,{devis:[...listes.devis,a.element]}).parametres.compteursNumeros).toEqual({'DEV-2026':5});

 expect(attribuerNumero('devis',{numero:'DEV-2026-5'},listes,{},date).element.numero).toBe('DEV-2026-005');

 expect(attribuerNumero('devis',{numero:'libre'},listes,{},date).change).toBeNull();

});

it.each(['devis','chantiers'])('R04 restaure %s sans numero',type=>{

 for(const e of [{id:1},{id:1,numero:''}]) expect(attribuerNumero(type,e,{[type]:[e]}, {},date,{ignorerCompteur:true})).toEqual({element:e,change:null});

});

it('R06 exclut le numero propre meme avec compteur',()=>{

 const e={id:1,numero:'CH-2026-004'};

 expect(numeroDisponible('chantiers',e.numero,{chantiers:[e]},{'CH-2026':4},1)).toBe(true);

});


it('R06 creation chantier en corbeille et saturation',()=>{
 const listes={chantiers:[{id:1,numero:'CH-2026-004',supprime_le:'hier'}]};
 const a=attribuerNumero('chantiers',{id:2,numero:'CH-2026-004'},listes,{},date);
 expect(a.element.numero).toBe('CH-2026-005');
 expect(a.change).toEqual({ancien:'CH-2026-004',nouveau:'CH-2026-005'});
 const refuse=attribuerNumero('chantiers',{id:2,numero:''},listes,{'CH-2026':999999},date);
 expect(refuse.erreur).toBeTruthy();expect(refuse.element).toBeUndefined();
});
