import React from 'react';
import { it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, fireEvent, screen, act } from '@testing-library/react';
import { AppProvider } from '../context/AppContext';
import Analyse from '../Analyse';
import Calendrier from '../Calendrier';
import * as panneau from '../components/ia/ClaudeIAPanel';
import { runAllAgents } from '../AgentEngine';
import RepriseLocale from '../components/RepriseLocale';
vi.mock('../hooks/useClaudeAI', () => ({ useClaudeAI: () => ({ appeler:vi.fn(), loading:false }) }));
const params={employes:[],localites:[],typesTravaux:[],parametres:{}};
beforeEach(()=>{ localStorage.clear(); window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}}); });
it('Analyse lit le serveur et écrit via le setter, démo locale inchangée',()=>{
  localStorage.setItem('cyna_objectifs','{"caAnnuel":2}');const setter=vi.fn();
  const props={chantiers:[],devis:[],clients:[],factures:[],parametres:params,setParametres:vi.fn()};
  const vue=render(<AppProvider value={{objectifs:{caAnnuel:123456,margeCible:20,nbChantiers:1},setObjectifs:setter}}><Analyse {...props}/></AppProvider>);
  fireEvent.click(screen.getByRole('button',{name:'Tendances & objectifs'}));const input=screen.getByDisplayValue('123456');fireEvent.change(input,{target:{value:'42'}});expect(setter).toHaveBeenCalledWith(expect.objectContaining({caAnnuel:42}));expect(localStorage.getItem('cyna_objectifs')).toBe('{"caAnnuel":2}');vue.unmount();
  render(<AppProvider value={{isDemo:true}}><Analyse {...props}/></AppProvider>);fireEvent.click(screen.getByRole('button',{name:'Tendances & objectifs'}));fireEvent.change(screen.getByDisplayValue('2'),{target:{value:'43'}});expect(JSON.parse(localStorage.getItem('cyna_objectifs')).caAnnuel).toBe(43);
});
it('Calendrier premier événement sur undefined, affichage serveur et démo locale',()=>{
  const captures=[];
  function Harnais({demo=false}) {
    const [valeur,setValeur]=React.useState(undefined);
    return <AppProvider value={{isDemo:demo,evenementsCalendrier:valeur,setEvenementsCalendrier:u=>setValeur(prev=>{const next=u(prev);captures.push(next);return next;})}}><Calendrier nouvelEvenementSignal={1}/></AppProvider>;
  }
  const saisir=()=>{fireEvent.change(screen.getByPlaceholderText('Ex : Réunion de chantier...'),{target:{value:'unique'}});fireEvent.change(document.querySelector('input[type=date]'),{target:{value:new Date().toISOString().slice(0,10)}});fireEvent.click(screen.getByRole('button',{name:'Ajouter'}));};
  const vue=render(<Harnais/>);saisir();expect(captures[0]).toHaveLength(1);expect(captures[0][0].label).toBe('unique');expect(screen.getAllByText('unique').length).toBeGreaterThan(0);expect(localStorage.getItem('cyna_cal_events')).toBeNull();vue.unmount();
  render(<Harnais demo/>);saisir();expect(JSON.parse(localStorage.getItem('cyna_cal_events'))[0].label).toBe('unique');expect(captures).toHaveLength(1);
});
it('Mémoire réelle serveur, updater sur absence et comportement démo',()=>{
  localStorage.setItem('cyna_ia_memoire','locale');let serveur;
  const wrapper=({children})=>{const [memoireIA,setMemoireIA]=React.useState('serveur');serveur=memoireIA;return <AppProvider value={{memoireIA,setMemoireIA,parametres:params}}>{children}</AppProvider>;};
  const h=renderHook(()=>panneau.useMemoire(),{wrapper});expect(h.result.current.memoire).toBe('serveur');act(()=>h.result.current.setMemoire('changée'));expect(serveur).toBe('changée');expect(localStorage.getItem('cyna_ia_memoire')).toBe('locale');h.unmount();
  const demo=renderHook(()=>panneau.useMemoire(),{wrapper:({children})=><AppProvider value={{isDemo:true,parametres:params}}>{children}</AppProvider>});expect(demo.result.current.memoire).toBe('locale');act(()=>demo.result.current.sauvegarder('ajout'));expect(localStorage.getItem('cyna_ia_memoire')).toContain('ajout');
});
it('AgentEngine reçoit objectifs serveur par runAllAgents et garde la lecture démo',()=>{
  localStorage.setItem('cyna_objectifs','{"caAnnuel":2}');const args={chantiers:[],devis:[],factures:[],clients:[],parametres:params,objectifs:{caAnnuel:987654},agentsActifs:{ProjectionAnnuelle:true}};
  expect(runAllAgents(args).agentData.ProjectionAnnuelle.objectifCA).toBe(987654);expect(runAllAgents({...args,isDemo:true}).agentData.ProjectionAnnuelle.objectifCA).toBe(2);
});
it('Attribution B, téléchargement sans décision, refus et fermeture',async()=>{
  const decider=vi.fn(),fermer=vi.fn();URL.createObjectURL=vi.fn(()=>'blob:test');URL.revokeObjectURL=vi.fn();vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  render(<RepriseLocale email="b@example.test" projet={{propositions:{memoireIA:{valeur:'locale'}}}} decider={decider} fermer={fermer}/>);
  expect(screen.getByRole('dialog')).toHaveTextContent('b@example.test');fireEvent.click(screen.getByRole('button',{name:'Télécharger'}));expect(decider).not.toHaveBeenCalled();expect(screen.getByRole('dialog')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Ne pas ajouter'}));expect(decider).not.toHaveBeenCalled();expect(screen.getByRole('group',{name:'Confirmer le refus'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Retour'}));expect(decider).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Ne pas ajouter'}));await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Oui, ne pas ajouter'})));expect(decider).toHaveBeenCalledWith(false);fireEvent.keyDown(document,{key:'Escape'});expect(fermer).toHaveBeenCalled();
});
