import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../../test-utils/renderWithApp';
import { AppProvider } from '../../context/AppContext';
import Devis from '../DevisPage';
import Chantiers from '../ChantiersPage';
import Clients from '../ClientsPage';
import { aEteModifieAilleurs } from '../../utils/gardeEdition';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../ExportPDF', () => ({ exportDevis: vi.fn() }));
vi.mock('../../utils/exportCSV', () => ({ exportCSV: vi.fn() }));

const client = { id: 1, nom: 'Dupont', prenom: 'Marc', entreprise: 'Dupont SA', type: 'Entreprise' };
const devis = { id: 100, numero: 'D-2026-001', clientId: 1, statut: 'accepté', montantHT: '8000', date: '2026-10-01', typesTravaux: ['Cloisons'], avenants: [], heuresRegie: [] };
const chantier = { id: 1, numero: 'CH-2026-001', nom: 'Bureaux Dupont', clientId: 1, devisId: 100, statut: 'En cours', nombreJours: 10, dateDebut: '2026-10-01', equipe: [], employes: [], typesTravaux: [], journal: [], imprevus: [], avenants: [] };
beforeEach(() => {
  window.matchMedia = query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = vi.fn();
});

it('comparaison stable réelle : clés réordonnées, imbriquées, listes et suppression', () => {
  expect(aEteModifieAilleurs({ b: { z: 1, a: 2 }, a: [1, 2] }, { a: [1, 2], b: { a: 2, z: 1 } })).toBe(false);
  expect(aEteModifieAilleurs({ a: [1, 2] }, { a: [2, 1] })).toBe(true);
  expect(aEteModifieAilleurs(client, { ...client, nom: 'Autre' })).toBe(true);
  expect(aEteModifieAilleurs(client, undefined)).toBe(true);
});

describe.each([
  { nom: 'devis', Component: Devis, liste: 'devis', setter: 'setDevis', initial: devis, modifier: () => fireEvent.click(screen.getByTitle('Modifier')), changer: () => fireEvent.change(screen.getByPlaceholderText('Observations, conditions particulières...'), { target: { value: '9000' } }), sauver: /Sauvegarder/i },
  { nom: 'chantier', Component: Chantiers, liste: 'chantiers', setter: 'setChantiers', initial: chantier, modifier: () => fireEvent.click(screen.getByTitle('Modifier')), changer: () => fireEvent.change(screen.getByDisplayValue('Bureaux Dupont'), { target: { value: 'Bureaux V2' } }), sauver: /Enregistrer le suivi/i },
  { nom: 'client', Component: Clients, liste: 'clients', setter: 'setClients', initial: client, modifier: () => fireEvent.click(screen.getByText('Modifier')), changer: () => fireEvent.change(screen.getByDisplayValue('Marc'), { target: { value: 'Marco' } }), sauver: /Enregistrer les modifications/i },
])('garde formulaire réel $nom', spec => {
  it.each(['modifié', 'supprimé', 'inchangé'])('enregistrement distant %s', changement => {
    const ctxOverrides = {
      clients: [client], devis: [devis], chantiers: [chantier],
      parametres: { employes: [], typesTravaux: [{ id: 1, nom: 'Cloisons', unite: 'm²', tarifBase: 125 }], parametres: { tauxTVA: 8.1, coefficientMainOeuvre: 1.35 } },
      periodeGlobale: 'tout', afficherNotif: vi.fn(),
      [spec.setter]: vi.fn(),
    };
    const { Component } = spec;
    const props = spec.nom === 'client' ? { clients: [client], setClients: ctxOverrides.setClients, chantiers: [], devis: [], factures: [] } : {};
    const h = renderWithApp(<Component {...props} />, ctxOverrides);
    spec.modifier();
    const current = changement === 'supprimé' ? [] : [{ ...spec.initial, ...(changement === 'modifié' ? { notes: 'Modification distante' } : {}) }];
    const nextCtx = { ...h.ctx, [spec.liste]: current };
    h.rerender(<AppProvider value={nextCtx}><Component {...props} {...(spec.nom === 'client' ? { clients: current } : {})} /></AppProvider>);
    spec.changer();
    fireEvent.click(screen.getByRole('button', { name: spec.sauver }));
    if (changement === 'inchangé') expect(ctxOverrides[spec.setter]).toHaveBeenCalledOnce();
    else {
      expect(ctxOverrides[spec.setter]).not.toHaveBeenCalled();
      expect(ctxOverrides.afficherNotif).toHaveBeenCalledWith(expect.stringContaining('autre appareil'), 'error');
      expect(screen.getByRole('button', { name: spec.sauver })).toBeInTheDocument();
    }
  });
});
