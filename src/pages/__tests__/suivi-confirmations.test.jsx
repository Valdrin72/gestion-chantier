import React, { useState } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, render } from '@testing-library/react';
import { renderWithApp } from '../../test-utils/renderWithApp';
import { AppProvider } from '../../context/AppContext';
import Clients from '../ClientsPage';
import Devis from '../DevisPage';
import Chantiers from '../ChantiersPage';
import ChantierDetail from '../../components/chantiers/ChantierDetail';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../ExportPDF', () => ({ exportDevis: vi.fn() }));
const client = { id: 1, nom: 'Dupont', prenom: 'Marc', type: 'Entreprise' };
const devis = { id: 100, numero: 'D-100', clientId: 2, statut: 'accepté', montantHT: 8000, date: '2026-10-01', avenants: [], heuresRegie: [] };
const chantier = { id: 10, numero: 'CH-10', nom: 'Bureaux', clientId: 2, devisId: 200, statut: 'En cours', nombreJours: 10, equipe: [], employes: [], typesTravaux: [], journal: [], imprevus: [], avenants: [] };
beforeEach(() => {
  window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = vi.fn();
});
const specs = [
  { nom: 'client', Component: Clients, liste: 'clients', setter: 'setClients', initial: client, titre: /ce client/, ref: { clientId: 1 } },
  { nom: 'devis', Component: Devis, liste: 'devis', setter: 'setDevis', initial: devis, titre: /^(Supprimer|Archiver \()/, ref: { devisId: 100 } },
  { nom: 'chantier', Component: Chantiers, liste: 'chantiers', setter: 'setChantiers', initial: chantier, titre: /^(Supprimer|Archiver)/, ref: { chantierId: 10 } },
];
describe.each(specs)('confirmation différée : $nom', spec => {
  it.each(['suppression', 'archivage'].flatMap(action => ['autre', 'cible', 'reference', 'file'].map(changement => [action, changement])))('%s, changement %s', async (action, changement) => {
    let resolve;
    const confirmation = new Promise(r => { resolve = r; });
    let current = [spec.initial];
    const set = vi.fn(updater => { current = typeof updater === 'function' ? updater(current) : updater; });
    const notifier = vi.fn();
    const ctx = { parametres: { employes: [], parametres: {} }, contexte: {}, naviguer: vi.fn(), clients: [], devis: [], chantiers: action === 'archivage' && spec.nom === 'client' ? [{ id: 'lié', clientId: 1 }] : [], factures: action === 'archivage' ? [{ id: 'f0', ...spec.ref }] : [], pointages: [], periodeGlobale: 'tout', confirmer: () => confirmation, afficherNotif: notifier, [spec.liste]: current, [spec.setter]: set };
    const element = value => <AppProvider value={value}><spec.Component {...(spec.nom === 'client' ? { clients: value.clients, setClients: set, chantiers: value.chantiers, devis: value.devis, factures: value.factures } : {})} /></AppProvider>;
    const h = render(element(ctx));
    fireEvent.click(screen.getAllByTitle(spec.titre).find(b => b.title.startsWith(action === 'archivage' ? 'Archiver' : 'Supprimer')));
    if (changement === 'autre') current = [...current, { ...spec.initial, id: 99, nom: 'Autre', numero: 'Autre' }];
    if (['cible', 'file'].includes(changement)) current = [{ ...spec.initial, notes: 'modification locale ou distante' }];
    const value = { ...ctx, [spec.liste]: changement === 'file' ? [spec.initial] : current, factures: changement === 'reference' ? [...ctx.factures, { id: 'f1', ...spec.ref }] : ctx.factures };
    h.rerender(element(value));
    await act(async () => { resolve(true); await confirmation; });
    // Le setter réel doit recevoir une fonction, même dans le témoin accepté.
    if (!(spec.nom === 'chantier' && action === 'suppression' && changement === 'reference')) {
      expect(set).toHaveBeenCalled();
      expect(typeof set.mock.calls.at(-1)[0]).toBe('function');
    }
    if (['cible', 'file'].includes(changement) || (changement === 'reference' && action === 'suppression')) {
      expect(current).toHaveLength(1);
      expect(current[0].archive).not.toBe(true);
      expect(notifier).toHaveBeenCalledWith(expect.any(String), 'error');
    } else {
      if (action === 'suppression') expect(current.some(x => x.id === spec.initial.id)).toBe(false);
      else expect(current.find(x => x.id === spec.initial.id).archive).toBe(true);
      if (changement === 'autre') expect(current.some(x => x.id === 99)).toBe(true);
    }
  });
});

it('client avec facture directe : suppression absente et archivage proposé', () => {
  renderWithApp(<Clients clients={[client]} chantiers={[]} devis={[]} factures={[{ id: 'f', clientId: 1 }]} setClients={vi.fn()} />, {});
  expect(screen.queryByTitle('Supprimer ce client')).toBeNull();
  expect(screen.getByTitle('Archiver ce client (historique conservé)')).toBeInTheDocument();
});

it('Créer la facture revalide le doublon dans un updater différé', async () => {
  let resolve; const promise = new Promise(r => { resolve = r; });
  let factures = [];
  const setFactures = vi.fn(updater => { factures = typeof updater === 'function' ? updater(factures) : updater; });
  const afficherNotif = vi.fn();
  renderWithApp(<Devis />, { devis: [devis], clients: [], chantiers: [], factures: [], setFactures, confirmer: () => promise, afficherNotif, periodeGlobale: 'tout' });
  fireEvent.click(screen.getByRole('button', { name: /Créer la facture/ }));
  factures = [{ id: 'déjà-en-file', devisId: devis.id }];
  await act(async () => { resolve(true); await promise; });
  expect(typeof setFactures.mock.calls[0][0]).toBe('function');
  expect(factures).toEqual([{ id: 'déjà-en-file', devisId: devis.id }]);
  expect(afficherNotif).toHaveBeenCalledWith(expect.stringContaining('existe déjà'), 'error');
});

it.each(['autre', 'modifié', 'facturé'])('extra pendant confirmation : %s', async changement => {
  const extra = { id: 'extra', description: 'Travaux extra', mode: 'forfait', montantForfait: 200 };
  let current = [{ ...chantier, extras: [extra] }];
  let resolve; const promise = new Promise(r => { resolve = r; });
  const setChantiers = vi.fn(updater => { current = updater(current); });
  const afficherNotif = vi.fn();
  const ctx = { clients: [], devis: [], factures: [], pointages: [], parametres: { employes: [], localites: [], parametres: { coefficientMainOeuvre: 1.35, tauxFraisGeneraux: 12 } }, setChantiers, afficherNotif, confirmer: () => promise };
  const element = value => <AppProvider value={value}><ChantierDetail chantier={current[0]} detailOnglet="financier" setDetailOnglet={vi.fn()} /></AppProvider>;
  const h = render(element(ctx));
  fireEvent.click(screen.getByRole('button', { name: '✕' }));
  current = [{ ...current[0], extras: changement === 'modifié' ? [{ ...extra, description: 'Distant' }] : [extra, { ...extra, id: 'autre' }] }];
  h.rerender(element({ ...ctx, factures: changement === 'facturé' ? [{ id: 'f', extraId: 'extra' }] : [] }));
  await act(async () => { resolve(true); await promise; });
  if (changement === 'autre') expect(current[0].extras.map(e => e.id)).toEqual(['autre']);
  else {
    expect(current[0].extras.some(e => e.id === 'extra')).toBe(true);
    expect(afficherNotif).toHaveBeenCalledWith(expect.any(String), 'error');
  }
});

describe.each(specs)('file React réelle : $nom', spec => {
  it.each(['suppression', 'archivage'])('%s refuse une modification mise en file sans rendu intermédiaire', async action => {
    let resolve, modifier, derniereListe;
    const confirmation = new Promise(r => { resolve = r; });
    const afficherNotif = vi.fn();
    function Harness() {
      const [liste, setListe] = useState([spec.initial]);
      derniereListe = liste;
      modifier = () => setListe(prev => prev.map(item => ({ ...item, notes: 'mise en file' })));
      const ctx = { parametres: { employes: [], parametres: {} }, contexte: {}, naviguer: vi.fn(), clients: [], devis: [], chantiers: action === 'archivage' && spec.nom === 'client' ? [{ id: 'lié', clientId: 1 }] : [], factures: action === 'archivage' ? [{ id: 'f', ...spec.ref }] : [], pointages: [], periodeGlobale: 'tout', confirmer: () => confirmation, afficherNotif, [spec.liste]: liste, [spec.setter]: setListe };
      return <AppProvider value={ctx}><spec.Component {...(spec.nom === 'client' ? { clients: liste, setClients: setListe, chantiers: ctx.chantiers, devis: [], factures: ctx.factures } : {})} /></AppProvider>;
    }
    render(<React.StrictMode><Harness /></React.StrictMode>);
    fireEvent.click(screen.getAllByTitle(spec.titre).find(b => b.title.startsWith(action === 'archivage' ? 'Archiver' : 'Supprimer')));
    await act(async () => {
      modifier();
      resolve(true);
      await confirmation;
    });
    expect(derniereListe).toHaveLength(1);
    expect(derniereListe[0].notes).toBe('mise en file');
    expect(derniereListe[0].archive).not.toBe(true);
    expect(afficherNotif).toHaveBeenCalledTimes(1);
    expect(afficherNotif).toHaveBeenCalledWith(expect.stringContaining('pendant la confirmation'), 'error');
  });
});

describe.each([
  { nom: 'client', Component: Clients, liste: 'clients', setter: 'setClients', initial: client, ref: { clientId: 1 }, supprime: 'Client supprimé', archive: 'Client archivé — visible via « Voir les archivés »' },
  { nom: 'devis', Component: Devis, liste: 'devis', setter: 'setDevis', initial: devis, ref: { devisId: 100 }, supprime: 'Devis supprimé', archive: 'Devis archivé — visible via « Voir les archivés »' },
  { nom: 'chantier', Component: Chantiers, liste: 'chantiers', setter: 'setChantiers', initial: chantier, ref: { chantierId: 10 }, supprime: null, archive: 'Chantier archivé — visible via « Voir les archivés »', explication: 'Il sera rangé hors de la liste active mais conservé (heures, factures, historique).' },
])('textes rétablis : $nom', spec => {
  it.each(['suppression', 'archivage'])('%s acceptée → message d’origine', async action => {
    if (action === 'suppression' && !spec.supprime) return;
    let current = [spec.initial];
    const set = vi.fn(updater => { current = typeof updater === 'function' ? updater(current) : updater; });
    const notifier = vi.fn();
    const confirmer = vi.fn(() => Promise.resolve(true));
    const factures = action === 'archivage' ? [{ id: 'f0', ...spec.ref }] : [];
    const chantiers = action === 'archivage' && spec.nom === 'client' ? [{ id: 'lié', clientId: 1 }] : [];
    const ctx = { parametres: { employes: [], parametres: {} }, contexte: {}, naviguer: vi.fn(), clients: [], devis: [], chantiers, factures, pointages: [], periodeGlobale: 'tout', confirmer, afficherNotif: notifier, [spec.liste]: current, [spec.setter]: set };
    render(<AppProvider value={ctx}><spec.Component {...(spec.nom === 'client' ? { clients: current, setClients: set, chantiers, devis: [], factures } : {})} /></AppProvider>);
    const titre = action === 'archivage' ? 'Archiver' : 'Supprimer';
    fireEvent.click(screen.getAllByTitle(new RegExp('^' + titre)).find(b => b.title.startsWith(titre)));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    if (action === 'archivage' && spec.explication) expect(confirmer.mock.calls[0][0]).toContain(spec.explication);
    expect(notifier).toHaveBeenCalledWith(action === 'archivage' ? spec.archive : spec.supprime);
  });
});
