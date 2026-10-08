import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
const etat = vi.hoisted(() => ({ recovery:true, updateUser:vi.fn(), terminer:vi.fn() }));
vi.mock('../hooks/useAuth', () => ({ DEMO_USER_ID:'demo', default:() => ({ session:{user:{id:'user'}}, loading:false, recuperationMotDePasse:etat.recovery, terminerRecuperation:() => { etat.recovery=false; etat.terminer(); }, deconnecter:vi.fn() }) }));
vi.mock('../hooks/useSupabaseData', () => ({ default:() => ({ chantiers:[],devis:[],clients:[],factures:[],pointages:[],parametres:{employes:[]}, etatSync:{}, loading:true }) }));
vi.mock('../useAgents', () => ({ default:() => ({}) }));
vi.mock('../modules/alertes/useAlertBootstrap', () => ({useAlertBootstrap:()=>{}}));
vi.mock('../lib/supabase', () => ({supabase:{auth:{updateUser:(...args)=>etat.updateUser(...args)}}}));
import App from '../App';
it('récupération affiche formulaire à la place de AppInner, succès ouvre app', async () => {
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}}); const alerte=vi.spyOn(window,'alert').mockImplementation(()=>{}); etat.updateUser.mockResolvedValue({error:null});
  const view=render(<App />); expect(screen.getByText('Choisir un nouveau mot de passe')).toBeTruthy(); expect(screen.queryByText('Chargement de vos données…')).toBeNull();
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'),{target:{value:'abcdefgh'}}); fireEvent.change(screen.getByLabelText('Confirmation'),{target:{value:'abcdefgh'}}); fireEvent.click(screen.getByRole('button',{name:'Enregistrer'}));
  await waitFor(()=>expect(etat.terminer).toHaveBeenCalledOnce()); expect(etat.updateUser).toHaveBeenCalledWith({password:'abcdefgh'}); expect(alerte).toHaveBeenCalledWith('Mot de passe modifié');
  view.rerender(<App />); expect(screen.queryByText('Choisir un nouveau mot de passe')).toBeNull(); expect(screen.getByText('Chargement de vos données…')).toBeTruthy(); alerte.mockRestore();
});
