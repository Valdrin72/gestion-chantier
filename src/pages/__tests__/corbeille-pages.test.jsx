import { visibles, appliquerSurVisibles } from '../../utils/corbeille';
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

it.each(specs)('$nom marqué dans état brut et absent du rendu', async spec => {
 let brut;
 function Harness() {
  const [liste, setListe] = useState([spec.initial]); brut = liste;
  const actifs = visibles(liste);
  const setter = u => setListe(prev => appliquerSurVisibles(prev, u));
  const ctx = { clients: [], devis: [], chantiers: [], factures: [], pointages: [], contexte: {}, parametres: { employes: [], parametres: {} }, naviguer: vi.fn(), confirmer: vi.fn().mockResolvedValue(true), afficherNotif: vi.fn(), profil: { nom: 'Salihu' }, userId: 'user', periodeGlobale: 'tout', [spec.liste]: actifs, [spec.setter]: setter };
  return <AppProvider value={ctx}><spec.Component {...(spec.nom === 'client' ? { clients: actifs, setClients: setter, chantiers: [], devis: [], factures: [] } : {})} /></AppProvider>;
 }
 render(<Harness />);
 await act(async () => fireEvent.click(screen.getAllByTitle(spec.titre).find(b => b.title.startsWith('Supprimer'))));
 expect(brut).toHaveLength(1); expect(brut[0].supprime_le).toEqual(expect.any(String)); expect(brut[0].supprime_par).toBe('Salihu');
 expect(screen.queryByTitle(spec.nom === 'client' ? 'Supprimer ce client' : 'Supprimer')).not.toBeInTheDocument();
});
