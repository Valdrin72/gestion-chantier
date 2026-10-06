import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { AppProvider } from '../../../context/AppContext';
import Corbeille from '../Corbeille';
const client = { id: 'c', nom: 'Dupont', supprime_le: '2026-10-01T09:30:00Z', supprime_par: 'Salihu' };
const devis = { id: 'd', numero: 'D-001', clientId: 'c', supprime_le: client.supprime_le };
function setup(extra = {}, confirmer = vi.fn().mockResolvedValue(true), modeStockage = 'user') {
 let current, modifier; const saves = vi.fn(); const notifier = vi.fn();
 function Harness() {
  const [data, setData] = useState({ clients: [client], devis: [], chantiers: [], factures: [], pointages: [], parametres: {}, ...extra });
  current = data; modifier = setData;
  return <AppProvider value={{ listesCompletes: data, modeStockage, confirmer, afficherNotif: notifier, setDonneesListes: updater => setData(prev => { const next = updater(prev); if (next !== prev) saves(next); return next; }) }}><Corbeille /><span data-testid="actifs">{data.devis.filter(x => !x.supprime_le).length}</span></AppProvider>;
 }
 render(<Harness />);
 return { data: () => current, modifier: updater => act(() => modifier(updater)), saves, notifier, confirmer };
}
const groupe = label => within(screen.getByRole('region', { name: label }));
describe('Corbeille réelle', () => {
 it('affiche date et auteur et restaure', async () => {
  const h = setup(); expect(screen.getByText(/01.10.2026/)).toBeInTheDocument(); expect(screen.getByText('Salihu')).toBeInTheDocument();
  await act(async () => fireEvent.click(groupe('Clients').getByText('Restaurer')));
  expect(h.data().clients[0]).toEqual({ id: 'c', nom: 'Dupont' }); expect(h.saves).toHaveBeenCalledTimes(1);
 });
 it('restaure devis et client ensemble en une sauvegarde', async () => {
  const h = setup({ devis: [devis] });
  await act(async () => fireEvent.click(groupe('Devis').getByText('Restaurer')));
  expect(h.confirmer).toHaveBeenCalledWith(expect.stringContaining('Dupont'), expect.anything());
  expect(h.data().devis[0].supprime_le).toBeUndefined(); expect(h.data().clients[0].supprime_le).toBeUndefined();
  expect(h.saves).toHaveBeenCalledTimes(1); expect(screen.getByTestId('actifs')).toHaveTextContent('1');
 });
 it('CORB-01/06 : propose seulement « Restaurer tout » ou « Annuler »', async () => {
  const h = setup({ devis: [devis] });
  await act(async () => fireEvent.click(groupe('Devis').getByText('Restaurer')));
  expect(h.confirmer).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ labelOui: 'Restaurer tout', labelNon: 'Annuler' }));
 });
 it('CORB-01/06 : Annuler (ou fermer la fenêtre) ne restaure rien', async () => {
  const h = setup({ devis: [devis] }, vi.fn().mockResolvedValue(false));
  await act(async () => fireEvent.click(groupe('Devis').getByText('Restaurer')));
  expect(h.data().devis[0].supprime_le).toBeTruthy(); expect(h.data().clients[0].supprime_le).toBeTruthy();
  expect(h.saves).not.toHaveBeenCalled(); expect(screen.getByTestId('actifs')).toHaveTextContent('0');
 });
 it.each(['clients', 'devis'])('refuse tout si %s change pendant confirmation', async type => {
  let resolve; const promise = new Promise(r => { resolve = r; });
  const h = setup({ devis: [devis] }, () => promise);
  fireEvent.click(groupe('Devis').getByText('Restaurer'));
  h.modifier(prev => ({ ...prev, [type]: prev[type].map(x => ({ ...x, nom: 'Distant' })) }));
  await act(async () => resolve(true));
  expect(h.data().devis[0].supprime_le).toBeTruthy(); expect(h.data().clients[0].supprime_le).toBeTruthy();
  expect(h.saves).not.toHaveBeenCalled(); expect(h.notifier).toHaveBeenCalledWith(expect.stringContaining('autre appareil'), 'error');
 });
 it('détruit et inscrit id ensemble après confirmation', async () => {
  const h = setup(); await act(async () => fireEvent.click(groupe('Clients').getByText('Supprimer définitivement')));
  expect(h.confirmer).toHaveBeenCalledWith(expect.stringContaining('irréversible'), expect.anything());
  expect(h.data().clients).toEqual([]); expect(h.data().parametres.idsSupprimes.clients).toEqual(['c']); expect(h.saves).toHaveBeenCalledTimes(1);
 });
 it.each(['devis', 'factures', 'pointages'])('refuse une référence %s, même supprimée', async type => {
  const chantier = { id: 'ch', nom: 'Chantier', supprime_le: client.supprime_le };
  const ref = type === 'pointages' ? { repartitions: [{ chantierId: 'ch' }] } : type === 'factures' ? { chantierId: 'ch' } : { clientId: 'c', supprime_le: client.supprime_le };
  const h = setup({ chantiers: [chantier], [type]: [ref] });
  const label = type === 'devis' ? 'Clients' : 'Chantiers';
  await act(async () => fireEvent.click(groupe(label).getByText('Supprimer définitivement')));
  expect(h.saves).not.toHaveBeenCalled(); expect(h.notifier).toHaveBeenCalledWith(expect.stringContaining('encore utilisé'), 'error');
 });
 it('refuse le dernier élément org sans toucher état', async () => {
  const h = setup({}, undefined, 'org'); await act(async () => fireEvent.click(groupe('Clients').getByText('Supprimer définitivement')));
  expect(h.data().clients).toEqual([client]); expect(h.saves).not.toHaveBeenCalled();
  expect(h.notifier).toHaveBeenCalledWith(expect.stringContaining('dernier élément'), 'error');
 });
});
