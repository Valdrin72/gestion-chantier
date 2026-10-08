import React from 'react';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ importerTout: vi.fn(), afficherNotif: vi.fn(), updateUser: vi.fn() }));
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ ...mocks, listesCompletes: {}, ouvrirMenu: vi.fn() }) }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { updateUser: (...args) => mocks.updateUser(...args) } } }));
import Parametres from '../ParametresPage';
const backup = { chantiers:[],devis:[],factures:[],clients:[],parametres:{},pointages:[] };
function afficher() { return render(<Parametres parametres={{ employes:[], typesTravaux:[], parametres:{} }} setParametres={vi.fn()} />); }
afterEach(() => vi.restoreAllMocks());
beforeEach(() => { localStorage.clear(); URL.createObjectURL=vi.fn(()=>'blob:test');URL.revokeObjectURL=vi.fn();vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{}); mocks.importerTout.mockReset(); mocks.afficherNotif.mockReset(); mocks.updateUser.mockReset(); window.matchMedia = () => ({matches:false,addEventListener(){},removeEventListener(){}}); });
it('Mon compte : validations puis notification et champs vidés', async () => {
  mocks.updateUser.mockResolvedValue({error:null}); afficher(); fireEvent.click(screen.getByText('Mon compte'));
  const a = screen.getByLabelText('Nouveau mot de passe'), b = screen.getByLabelText('Confirmation');
  fireEvent.change(a,{target:{value:'court'}}); fireEvent.change(b,{target:{value:'court'}}); fireEvent.click(screen.getByRole('button',{name:'Enregistrer',exact:true})); expect(mocks.updateUser).not.toHaveBeenCalled();
  fireEvent.change(a,{target:{value:'abcdefgh'}}); fireEvent.click(screen.getByRole('button',{name:'Enregistrer',exact:true})); expect(mocks.updateUser).not.toHaveBeenCalled();
  fireEvent.change(b,{target:{value:'abcdefgh'}}); fireEvent.click(screen.getByRole('button',{name:'Enregistrer',exact:true})); await waitFor(() => expect(mocks.afficherNotif).toHaveBeenCalledWith('Mot de passe modifié'));
  expect(a.value).toBe(''); expect(b.value).toBe(''); expect(mocks.updateUser).toHaveBeenCalledWith({password:'abcdefgh'});
});
it('lecture import retardée : refus et message exact sans succès', async () => {
  let resolve; const attente = new Promise(r => { resolve = r; }); mocks.importerTout.mockReturnValue(false);
  const alerte = vi.spyOn(window,'alert').mockImplementation(() => {}); const confirme = vi.spyOn(window,'confirm').mockReturnValue(true);
  const view = afficher(); const input = view.container.querySelector('input[type="file"]');
  fireEvent.change(input,{target:{files:[{text:() => attente}]}});
  expect(mocks.importerTout).not.toHaveBeenCalled();
  await act(async () => { resolve(JSON.stringify(backup)); });
  expect(mocks.importerTout).not.toHaveBeenCalled(); expect(screen.getByRole('dialog')).toBeInTheDocument();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Importer',exact:true})));
  expect(mocks.importerTout).toHaveBeenCalledOnce();expect(screen.getByTestId('message-import')).toHaveTextContent("Import non effectué. Vos données n'ont pas été modifiées. La copie de sécurité est conservée.");
  expect(alerte).not.toHaveBeenCalled(); alerte.mockRestore(); confirme.mockRestore();
});

it('SEC-UI-02 compte dans panneau et erreur sans lien', async () => {
  mocks.updateUser.mockResolvedValue({error:Error('test')}); afficher(); fireEvent.click(screen.getByText('Mon compte'));
  const form = screen.getByLabelText('Nouveau mot de passe').closest('form');
  expect(form.closest('section').parentElement.previousElementSibling).toContainElement(screen.getByText('Mon compte'));
  for (const label of ['Nouveau mot de passe','Confirmation']) fireEvent.change(screen.getByLabelText(label),{target:{value:'abcdefgh'}});
  fireEvent.click(screen.getByRole('button',{name:'Enregistrer',exact:true}));
  await screen.findByText('Impossible de modifier le mot de passe. Réessayez.');
});
it('SEC-BARRIERE-02 attend resultat import', async () => {
  let resolve; mocks.importerTout.mockReturnValue(new Promise(r => {resolve=r;}));
  const alerte=vi.spyOn(window,'alert').mockImplementation(()=>{}); const confirme=vi.spyOn(window,'confirm').mockReturnValue(true);
  const view=afficher(); fireEvent.change(view.container.querySelector('input[type="file"]'),{target:{files:[{text:async()=>JSON.stringify(backup)}]}});
  await act(async()=>{}); await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Importer',exact:true}))); expect(mocks.importerTout).toHaveBeenCalledOnce(); expect(alerte).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toHaveTextContent('Enregistrement…');
  await act(async()=>resolve(false)); expect(screen.getByTestId('message-import')).toHaveTextContent("Import non effectué. Vos données n'ont pas été modifiées. La copie de sécurité est conservée.");
  alerte.mockRestore(); confirme.mockRestore();
});
