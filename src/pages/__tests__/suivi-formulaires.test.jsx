import React, { useState } from 'react';
import { it, expect, vi, beforeEach, describe } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../../test-utils/renderWithApp';
import { AppProvider } from '../../context/AppContext';
import Employes from '../EmployesPage';
import Factures from '../../Factures';
import PointageFormulaire from '../../components/pointages/PointageFormulaire';
import { aChangeDepuis } from '../../utils/gardeEdition';
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../ExportPDF', () => ({ exportFacture: vi.fn(), exportFicheChantier: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = vi.fn();
});
const copies = () => Object.keys(localStorage).filter(k => k.startsWith('cyna_sauvegarde_rejetee_')).map(k => JSON.parse(localStorage.getItem(k)));
const emp = { id: 1, nom: 'Jean', poste: 'Ouvrier qualifié', tarifHeure: 40, actif: true };

it('employé : refus avec copie, puis Annuler et Nouvel employé vide', () => {
  const setParametres = vi.fn(), afficherNotif = vi.fn();
  const props = { parametres: { employes: [emp] }, setParametres, chantiers: [] };
  const h = renderWithApp(<Employes {...props} />, { profil: { id: 'cyna' }, afficherNotif });
  fireEvent.click(document.querySelector('svg.lucide-pencil').closest('button'));
  fireEvent.change(screen.getByPlaceholderText('Jean Martin'), { target: { value: 'Brouillon' } });
  h.rerender(<AppProvider value={h.ctx}><Employes {...props} parametres={{ employes: [{ ...emp, notes: 'distant' }] }} /></AppProvider>);
  fireEvent.click(screen.getByRole('button', { name: /^Sauvegarder$/ }));
  expect(setParametres).not.toHaveBeenCalled();
  expect(copies()[0].parametres[0].employes[0].nom).toBe('Brouillon');
  expect(afficherNotif).toHaveBeenCalledWith(expect.stringContaining('autre appareil'), 'error');
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
  fireEvent.click(screen.getByRole('button', { name: /Nouvel employé/ }));
  expect(screen.getByPlaceholderText('Jean Martin')).toHaveValue('');
});

it('employé accepté : updater conserve les paramètres et employés ajoutés en file', () => {
  let current = { employes: [emp], autre: 'à conserver' };
  const setParametres = vi.fn(u => { current = typeof u === 'function' ? u(current) : u; });
  renderWithApp(<Employes parametres={{ employes: [emp] }} setParametres={setParametres} chantiers={[]} />, { profil: { id: 'cyna' } });
  fireEvent.click(document.querySelector('svg.lucide-pencil').closest('button'));
  current.employes.push({ ...emp, id: 2, nom: 'Autre' });
  fireEvent.click(screen.getByRole('button', { name: /^Sauvegarder$/ }));
  expect(typeof setParametres.mock.calls[0][0]).toBe('function');
  expect(current.autre).toBe('à conserver'); expect(current.employes).toHaveLength(2);
});

const facture = { id: 'F1', numero: 'F-2026-001', clientId: '1', statut: 'envoyee', type: 'standard', montantHT: 1000, montantTTC: 1081, montantPaye: 0, dateEmission: '2026-01-01', dateEcheance: '2020-01-01', lignes: [{ description: 'Travaux', quantite: 1, prixUnitaire: 1000, tva: 8.1 }], paiementsHistorique: [], rappels: [] };
describe.each(['formulaire', 'paiement', 'rappel'])('facture : %s', mode => {
  it('témoin accepté puis modification distante refusée avec brouillon conservé', () => {
    const onSave = vi.fn(), afficherNotif = vi.fn();
    const props = { profil: { id: 'cyna' }, clients: [{ id: '1', nom: 'Dupont' }], factures: [facture], onSave, periodeGlobale: 'tout' };
    const h = renderWithApp(<Factures {...props} />, { afficherNotif });
    const ouvrir = () => {
      if (mode === 'formulaire') fireEvent.click(screen.getByRole('button', { name: /^Modifier$/ }));
      if (mode === 'paiement') {
        fireEvent.click(screen.getAllByRole('row').find(r => r.textContent.includes(facture.numero)));
        fireEvent.click(screen.getByRole('button', { name: /^Paiement$/ }));
        fireEvent.change(screen.getByPlaceholderText(/Solde/), { target: { value: '100' } });
      }
      if (mode === 'rappel') {
        fireEvent.click(screen.getAllByRole('row').find(r => r.textContent.includes(facture.numero)));
        fireEvent.click(screen.getByRole('button', { name: /Générer le rappel/ }));
      }
    };
    const sauver = () => fireEvent.click(screen.getByRole('button', { name: mode === 'formulaire' ? /Enregistrer brouillon/ : mode === 'paiement' ? /Confirmer le paiement/ : /Marquer.*envoyé/ }));
    ouvrir(); sauver(); expect(onSave).toHaveBeenCalledOnce();
    h.unmount(); onSave.mockClear();
    const second = renderWithApp(<Factures {...props} />, { afficherNotif });
    ouvrir();
    second.rerender(<AppProvider value={second.ctx}><Factures {...props} factures={[{ ...facture, notes: 'distant' }]} /></AppProvider>);
    sauver();
    expect(onSave).not.toHaveBeenCalled();
    expect(copies()[0].factures[0].id).toBe('F1');
    if (mode === 'paiement') expect(copies()[0].factures[0].paiementsHistorique.at(-1).montant).toBe(100);
    expect(afficherNotif).toHaveBeenCalledWith(expect.stringContaining('autre appareil'), 'error');
  });
});

it.each([[null, null, false], [null, { id: 1 }, true], [{ id: 1 }, null, true], [{ id: 1 }, { id: 1, heures: 2 }, true]])('aChangeDepuis %j / %j', (origine, actuel, change) => {
  expect(aChangeDepuis(origine, actuel)).toBe(change);
});

const pointage = { id: 'p', date: '2026-10-05', employeId: 1, repartitions: [{ chantierId: 'c', categorie: 'production', heures: 4 }], majoration: null };
it.each([false, true])('pointage : deux sauvegardes acceptées puis conflit détecté (existant=%s)', existant => {
  let distant;
  const afficherNotif = vi.fn();
  function Harness() {
    const [pointages, setPointages] = useState(existant ? [pointage] : []);
    distant = () => setPointages(prev => prev.map(p => ({ ...p, modifie_le: 'distant' })));
    return <AppProvider value={{ chantiers: [{ id: 'c', nom: 'Chantier', statut: 'En cours' }], parametres: { employes: [emp] }, pointages, setPointages, afficherNotif }}><PointageFormulaire initialDate={pointage.date} initialEmployeId={1} initialChantierId="c" /></AppProvider>;
  }
  render(<Harness />);
  const saisir = () => {
    fireEvent.change(screen.getByLabelText('Chantier'), { target: { value: 'c' } });
    fireEvent.change(screen.getByLabelText('Heures'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le pointage|Modifier le pointage/ }));
  };
  saisir(); saisir(); expect(copies()).toHaveLength(0);
  act(() => distant());
  saisir();
  expect(copies()[0].pointages[0].repartitions[0].heures).toBe(5);
  expect(afficherNotif).toHaveBeenCalledWith(expect.stringContaining('autre appareil'), 'error');
});

it('pointage apparu pendant création : refus et copie', () => {
  const setPointages = vi.fn(), afficherNotif = vi.fn();
  const ctx = { chantiers: [{ id: 'c', nom: 'Chantier', statut: 'En cours' }], parametres: { employes: [emp] }, pointages: [], setPointages, afficherNotif };
  const h = renderWithApp(<PointageFormulaire initialDate={pointage.date} initialEmployeId={1} initialChantierId="c" />, ctx);
  fireEvent.change(screen.getByLabelText('Heures'), { target: { value: '5' } });
  h.rerender(<AppProvider value={{ ...h.ctx, pointages: [pointage] }}><PointageFormulaire initialDate={pointage.date} initialEmployeId={1} initialChantierId="c" /></AppProvider>);
  fireEvent.click(screen.getByRole('button', { name: /Enregistrer le pointage/ }));
  expect(setPointages).not.toHaveBeenCalled(); expect(copies()[0].pointages).toHaveLength(1);
});
