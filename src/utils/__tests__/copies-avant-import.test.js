import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {listerCopies,ecrireCopieAvantImport,enregistrerCopieRejetee} from '../copiesRejetees';
beforeEach(()=>localStorage.clear());afterEach(()=>vi.restoreAllMocks());
it('copie écrite, relue identique, aucune suppression',()=>{
 localStorage.setItem('ancienne','contenu');const remove=vi.spyOn(Storage.prototype,'removeItem');const r=ecrireCopieAvantImport('u',{meta:{date:'2026'}});expect(r.ok).toBe(true);expect(r.cle).toMatch(/^cyna_sauvegarde_avant_import_u_/);expect(JSON.parse(localStorage.getItem(r.cle))).toEqual({meta:{date:'2026'}});expect(remove).not.toHaveBeenCalled();
});
it('relecture différente refuse et conserve toutes les clés',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockReturnValue('différent');expect(ecrireCopieAvantImport('u',{}).ok).toBe(false);
});
it.each([['QuotaExceededError',true],['NS_ERROR_DOM_QUOTA_REACHED',true],['SecurityError',false]])('erreur locale %s distinguée', (name,plein)=>{
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('échec',name);});const r=ecrireCopieAvantImport('u',{});expect(r.ok).toBe(false);expect(r.stockagePlein).toBe(plein);
});
it('liste en lecture seule : compte, tri, partielle et illisible',()=>{
 const complet={chantiers:[],devis:[],factures:[],clients:[],parametres:{}};
 for(const [k,v]of Object.entries({cyna_sauvegarde_en_echec_u_1:{...complet,date:'2026-10-01'},cyna_sauvegarde_en_echec_autre_1:complet,cyna_sauvegarde_avant_import_u_2:{...complet,meta:{date:'2026-10-03'}},cyna_sauvegarde_avant_import_autre_2:complet,cyna_sauvegarde_rejetee_1:{clients:[{id:'c'}],date:'2026-10-02'},cyna_sauvegarde_rejetee:complet}))localStorage.setItem(k,JSON.stringify(v));
 localStorage.setItem('cyna_sauvegarde_rejetee_bad','{bad');const set=vi.spyOn(Storage.prototype,'setItem'),remove=vi.spyOn(Storage.prototype,'removeItem');
 const r=listerCopies(localStorage,'u');expect(r).toHaveLength(5);expect(r[0].type).toBe('avant import');expect(r[1].complete).toBe(false);expect(r[1].comptes.clients).toBe(1);expect(r.find(x=>x.cle.endsWith('bad')).texte).toBe('{bad');expect(r.find(x=>x.cle.endsWith('bad')).contenu).toBeNull();expect(set).not.toHaveBeenCalled();expect(remove).not.toHaveBeenCalled();
});
it('sansRetention préserve cinq copies et source malgré le nouveau refus',()=>{
 localStorage.setItem('cyna_sauvegarde_rejetee','source historique');
 for(let i=0;i<5;i++)localStorage.setItem('cyna_sauvegarde_rejetee_'+i,'ancien');enregistrerCopieRejetee('nouveau',{clients:[]},{sansRetention:true});for(let i=0;i<5;i++)expect(localStorage.getItem('cyna_sauvegarde_rejetee_'+i)).toBe('ancien');expect(localStorage.getItem('cyna_sauvegarde_rejetee')).toBe('source historique');
});
