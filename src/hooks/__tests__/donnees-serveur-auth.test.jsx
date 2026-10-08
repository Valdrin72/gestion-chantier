import React from 'react';
import { it, expect, vi, beforeEach } from 'vitest';
import { renderHook, render, act, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const auth = vi.hoisted(() => ({ session: { user: { id: 'user' } }, callback: null, signOut: vi.fn(), updateUser: vi.fn(), appeler: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ lienRecuperationMotDePasse:false, supabase: { auth: {
  getSession: async () => ({ data: { session: auth.session } }),
  onAuthStateChange: cb => { auth.callback = cb; return { data: { subscription: { unsubscribe() {} } } }; },
  signOut: (...args) => auth.signOut(...args), updateUser: (...args) => auth.updateUser(...args),
} } }));
vi.mock('../useClaudeAI', () => ({ useClaudeAI: () => ({ appeler: auth.appeler, loading:false }) }));
import { AppProvider } from '../../context/AppContext';
import ClaudeIAPanel from '../../components/ia/ClaudeIAPanel';
import useAuth from '../useAuth';
import { CLES_A_EFFACER, effacerCachesLocaux } from '../../utils/cachesLocaux';
import FormulaireMotDePasse from '../../components/FormulaireMotDePasse';
import NouveauMotDePasse from '../../components/NouveauMotDePasse';
import ConfirmModal from '../../components/ui/ConfirmModal';
beforeEach(() => { localStorage.clear(); auth.session = { user: { id: 'user' } }; auth.signOut.mockReset(); auth.updateUser.mockReset(); });
async function boot() { const h = renderHook(() => useAuth()); await waitFor(() => expect(h.result.current.loading).toBe(false)); return h; }

it('deconnexion reelle efface seulement les empreintes confirmees du compte',async()=>{
 const {empreinte}=await import('../../utils/repriseLocale');const h=await boot();
 localStorage.setItem('cyna_objectifs','{}');localStorage.setItem('cyna_cal_events','[]');localStorage.setItem('cyna_ia_memoire','modifiee');
 localStorage.setItem('cyna_reprise_serveur_user',JSON.stringify({objectifs:empreinte('{}'),memoireIA:empreinte('ancienne')}));
 auth.signOut.mockImplementation(async()=>{auth.session=null;return {error:null};});await act(async()=>await h.result.current.deconnecter());
 expect(localStorage.getItem('cyna_objectifs')).toBeNull();expect(localStorage.getItem('cyna_cal_events')).toBe('[]');expect(localStorage.getItem('cyna_ia_memoire')).toBe('modifiee');expect(localStorage.getItem('cyna_reprise_serveur_user')).not.toBeNull();
});
