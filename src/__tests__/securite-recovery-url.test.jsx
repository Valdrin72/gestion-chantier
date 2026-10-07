import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({auth: {
 getSession: async () => ({data:{session:{user:{id:'user',app_metadata:{}}}}}),
 onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}})
}})) }));
vi.mock('../hooks/useSupabaseData', () => ({default:()=>({chantiers:[],devis:[],clients:[],factures:[],pointages:[],parametres:{employes:[]},etatSync:{},loading:true})}));
vi.mock('../useAgents',()=>({default:()=>({})}));
vi.mock('../modules/alertes/useAlertBootstrap',()=>({useAlertBootstrap:()=>{}}));
it('SEC-RECUP-02 hash recovery ouvre ecran sans evenement puis hash absent ne ouvre pas', async () => {
 process.env.REACT_APP_SUPABASE_URL='https://example.invalid'; process.env.REACT_APP_SUPABASE_ANON_KEY='test';
 window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 window.history.replaceState(null,'','#access_token=x&type=recovery'); vi.resetModules();
 const {default: App}=await import('../App'); render(<App />);
 await screen.findByText('Choisir un nouveau mot de passe'); cleanup();
 window.history.replaceState(null,'',window.location.pathname); vi.resetModules();
 const {default: AppSansLien}=await import('../App'); render(<AppSansLien />);
 await screen.findByText('Chargement de vos donn\u00e9es\u2026'); expect(screen.queryByText('Choisir un nouveau mot de passe')).toBeNull();
}, 20000);
