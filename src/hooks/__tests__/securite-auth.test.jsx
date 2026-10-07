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
it('SIGNED_OUT anticipé : caches effacés avant session React nulle', async () => {
  const h = await boot(); localStorage.setItem('cyna_clients','secret');
  let resolve; const gate = new Promise(r => { resolve = r; });
  auth.signOut.mockImplementation(async () => { auth.session = null; auth.callback('SIGNED_OUT', null); await gate; return { error: null }; });
  let travail; act(() => { travail = h.result.current.deconnecter(); });
  expect(h.result.current.session).not.toBeNull(); expect(localStorage.getItem('cyna_clients')).toBe('secret');
  const originalRemove = Storage.prototype.removeItem;
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
    expect(h.result.current.session).not.toBeNull(); originalRemove.call(this,key);
  });
  await act(async () => { resolve(); expect(await travail).toEqual({ ok: true }); }); remove.mockRestore();
  expect(h.result.current.session).toBeNull(); expect(localStorage.getItem('cyna_clients')).toBeNull();
});
it.each(['error','exception'])('signOut %s : session et caches conservés, nouvel essai possible', async type => {
  const h = await boot(); localStorage.setItem('cyna_clients','secret');
  auth.signOut.mockImplementation(async () => { if (type === 'exception') throw Error('réseau'); return { error: Error('réseau') }; });
  await act(async () => { expect(await h.result.current.deconnecter()).toEqual({ ok: false }); });
  expect(h.result.current.session).not.toBeNull(); expect(localStorage.getItem('cyna_clients')).toBe('secret');
  auth.signOut.mockImplementation(async () => { auth.session = null; return { error: null }; });
  await act(async () => { expect(await h.result.current.deconnecter()).toEqual({ ok: true }); });
  expect(localStorage.getItem('cyna_clients')).toBeNull();
});
it('échec signOut ayant retiré la session : succès et nettoyage', async () => {
  const h = await boot(); localStorage.setItem('cyna_devis','secret');
  auth.signOut.mockImplementation(async () => { auth.session = null; return { error: Error('réseau') }; });
  await act(async () => { expect(await h.result.current.deconnecter()).toEqual({ ok: true }); });
  expect(localStorage.getItem('cyna_devis')).toBeNull();
});
it('PASSWORD_RECOVERY et terminerRecuperation', async () => {
  const h = await boot(); act(() => auth.callback('PASSWORD_RECOVERY',auth.session));
  expect(h.result.current.recuperationMotDePasse).toBe(true);
  act(() => h.result.current.terminerRecuperation()); expect(h.result.current.recuperationMotDePasse).toBe(false);
});
it('liste blanche : toutes les autres clés conservées, removeItem en erreur toléré', () => {
  const gardees = ['cyna_chat_history','cyna_sauvegarde_en_echec_user_1','cyna_sauvegarde_rejetee','cyna_sauvegarde_rejetee_1','cyna_ia_memoire','cyna_objectifs','cyna_cal_events','cyna_actions','cyna_agents_state','cyna_agents_memoire','cyna-alertes-v1','cyna_theme','cyna_periode','cyna_onboarding_done','cyna_notifs_lues','cyna_storage_mode','cyna_future'];
  [...gardees,...CLES_A_EFFACER].forEach(k => localStorage.setItem(k,'secret'));
  effacerCachesLocaux(); CLES_A_EFFACER.forEach(k => expect(localStorage.getItem(k)).toBeNull()); gardees.forEach(k => expect(localStorage.getItem(k)).toBe('secret'));
  const remove = vi.spyOn(Storage.prototype,'removeItem').mockImplementation(() => { throw Error('indisponible'); });
  expect(() => effacerCachesLocaux()).not.toThrow(); expect(remove).toHaveBeenCalledTimes(6); remove.mockRestore();
});
it('Entrée sur Annuler active seulement Annuler', async () => {
  const oui = vi.fn(), non = vi.fn(); render(<ConfirmModal message="question" onOui={oui} onNon={non} />);
  screen.getByRole('button',{name:'Annuler'}).focus(); await userEvent.type(screen.getByRole('button',{name:'Annuler'}),'{enter}',{skipClick:true});
  expect(non).toHaveBeenCalledTimes(1); expect(oui).not.toHaveBeenCalled();
});
it.each([['court','court'],['abcdefgh','différent']])('validation mot de passe %s/%s : aucun appel', (a,b) => {
  render(<FormulaireMotDePasse />); fireEvent.change(screen.getByLabelText('Nouveau mot de passe'),{target:{value:a}}); fireEvent.change(screen.getByLabelText('Confirmation'),{target:{value:b}});
  fireEvent.click(screen.getByRole('button',{name:'Enregistrer'})); expect(auth.updateUser).not.toHaveBeenCalled(); expect(screen.getByRole('status')).toBeTruthy();
});
it('mot de passe : succès, callback et champs vidés', async () => {
  auth.updateUser.mockResolvedValue({error:null}); const succes = vi.fn(); render(<FormulaireMotDePasse onSucces={succes} />);
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'),{target:{value:'abcdefgh'}}); fireEvent.change(screen.getByLabelText('Confirmation'),{target:{value:'abcdefgh'}});
  fireEvent.click(screen.getByRole('button',{name:'Enregistrer'})); await waitFor(() => expect(succes).toHaveBeenCalledOnce());
  expect(auth.updateUser).toHaveBeenCalledWith({password:'abcdefgh'}); expect(screen.getByLabelText('Nouveau mot de passe').value).toBe(''); expect(screen.getByLabelText('Confirmation').value).toBe('');
});
it.each([false,true])('mot de passe erreur exception=%s : message générique', async exception => {
  auth.updateUser.mockImplementation(async () => { if(exception) throw Error('secret serveur'); return {error:Error('secret serveur')}; }); render(<FormulaireMotDePasse />);
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'),{target:{value:'abcdefgh'}}); fireEvent.change(screen.getByLabelText('Confirmation'),{target:{value:'abcdefgh'}});
  fireEvent.click(screen.getByRole('button',{name:'Enregistrer'})); await screen.findByText('Impossible de modifier le mot de passe. Réessayez ou demandez un nouveau lien.'); expect(screen.queryByText('secret serveur')).toBeNull();
});

it('chat tardif après nettoyage et démontage ne réécrit pas historique', async () => {
  let resolve; auth.appeler.mockReturnValue(new Promise(r => { resolve = r; }));
  Element.prototype.scrollIntoView = vi.fn();
  function Harness() { const h = useAuth(); return h.session ? <><button onClick={h.deconnecter}>Quitter test</button><AppProvider value={{parametres:{parametres:{iaConsentement:true}},chantiers:[],devis:[],clients:[],factures:[],pointages:[],setParametres:vi.fn()}}><ClaudeIAPanel /></AppProvider></> : <div>Session fermée</div>; }
  render(<Harness />); await screen.findByText('Quitter test');
  fireEvent.click(screen.getByTestId('ia-menu').querySelector('button:nth-of-type(6)'));
  const input = screen.getByPlaceholderText(/Posez votre question/); fireEvent.change(input,{target:{value:'question'}}); fireEvent.keyDown(input,{key:'Enter'});
  expect(localStorage.getItem('cyna_chat_history')).toContain('question');
  auth.signOut.mockImplementation(async () => { auth.session=null; auth.callback('SIGNED_OUT',null); return {error:null}; });
  fireEvent.click(screen.getByText('Quitter test')); await screen.findByText('Session fermée');
  // L'historique du chat n'existe que dans le navigateur : il est CONSERVÉ à la déconnexion…
  expect(localStorage.getItem('cyna_chat_history')).toContain('question');
  // …mais une réponse arrivée après le démontage ne le réécrit pas.
  await act(async () => { resolve('réponse tardive'); }); expect(localStorage.getItem('cyna_chat_history')).not.toContain('réponse tardive');
});

it('SEC-RECUP-01 double clic unique sans fausse erreur', async () => {
 let resolve; const quitter=vi.fn(()=>new Promise(r=>{resolve=r;})); render(<NouveauMotDePasse deconnecter={quitter} />);
 const bouton=screen.getByRole('button',{name:'Se déconnecter'}); fireEvent.click(bouton); fireEvent.click(bouton);
 expect(bouton).toBeDisabled(); expect(quitter).toHaveBeenCalledOnce();
 await act(async()=>resolve({ok:true})); expect(screen.queryByRole('alert')).toBeNull();
});

// Exigence utilisateur : à la déconnexion RÉELLE (useAuth.deconnecter → signOut réussi), seules les copies
// locales de données déjà enregistrées sur le serveur disparaissent ; les données qui n'existent QUE dans le
// navigateur et les copies de secours survivent.
it('déconnexion réelle : seules les copies du serveur sont effacées, les données locales survivent', async () => {
  const serveur = ['cyna_chantiers','cyna_devis','cyna_factures','cyna_clients','cyna_parametres','cyna_pointages'];
  const locales = { cyna_ia_memoire: 'mémoire IA', cyna_chat_history: '[{"role":"user","content":"q"}]', cyna_objectifs: '{"caAnnuel":900000}',
    cyna_cal_events: '[{"id":1}]', cyna_actions: '[{"id":"a"}]', cyna_agents_state: '{}', cyna_agents_memoire: '{}', 'cyna-alertes-v1': '{}',
    cyna_notifs_lues: '[]', cyna_theme: 'dark', cyna_periode: 'mois', cyna_onboarding_done: '1', cyna_storage_mode: 'user',
    cyna_sauvegarde_en_echec_user_123_x: '{"copie":1}', cyna_sauvegarde_rejetee: '{"copie":2}', cyna_sauvegarde_rejetee_456_y: '{"copie":3}',
    cyna_cle_future: 'inconnue' };
  const h = await boot();
  serveur.forEach(k => localStorage.setItem(k, 'copie serveur'));
  Object.entries(locales).forEach(([k, v]) => localStorage.setItem(k, v));
  auth.signOut.mockImplementation(async () => { auth.session = null; return { error: null }; });
  await act(async () => { expect(await h.result.current.deconnecter()).toEqual({ ok: true }); });
  expect(h.result.current.session).toBeNull();
  serveur.forEach(k => expect(localStorage.getItem(k), k).toBeNull());
  Object.entries(locales).forEach(([k, v]) => expect(localStorage.getItem(k), k).toBe(v));
  expect(CLES_A_EFFACER).toEqual(serveur);
});
