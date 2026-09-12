/**
 * Sélecteur de période DISCRET (mobile) — soin topbar.
 * Preuve RTL RÉELLE (vrai Dashboard) :
 *  • mobile : le sélecteur est discret (select natif invisible : opacity 0, pas de bordure),
 *    zone tactile ≥44px (minHeight 44), libellé court visible, comportement natif conservé ;
 *  • desktop : sélecteur ENCADRÉ (bordure) et libellé complet — inchangé.
 * Échoue si on remet un fond/bordure sur mobile, ou si on casse la cible 44px.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Dashboard from '../pages/Dashboard';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const _d = new Date();
const TODAY = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CFG = { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 };
const CH = { id: 'CH1', nom: 'Chantier Test', statut: 'en cours', clientId: 'cl1', devisId: 'd1', nombreJours: 20, dateDebut: TODAY, journal: [] };
const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 100000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];
const POINTAGES = [{ id: 'p1', date: TODAY, employeId: 1, repartitions: [{ chantierId: 'CH1', categorie: 'production', heures: 8 }], deplacement: null, majoration: null }];
function ctx(over = {}) {
  return {
    devis: DEVIS, clients: [{ id: 'cl1', nom: 'Client', entreprise: 'Client SA' }], chantiers: [CH], factures: [], pointages: POINTAGES,
    parametres: { employes: [EMP], localites: [], parametres: CFG },
    setChantiers: vi.fn(), naviguer: vi.fn(), afficherNotif: vi.fn(), setPeriodeGlobale: vi.fn(), ouvrirMenu: vi.fn(),
    agentState: { scoreGlobal: 60, alertes: [], priorites: [], briefingMatin: null },
    profil: { id: 'cyna', pages: ['dashboard'] }, periodeGlobale: 'annee', ...over,
  };
}

describe('Période discrète — mobile (375px)', () => {
  it('sélecteur discret : sans bordure, opacity 0, cible ≥44px, libellé court visible', () => {
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx());
    const wrap = screen.getByTestId('periode-discrete');
    const sel = within(wrap).getByLabelText('Période');
    expect(sel.style.opacity).toBe('0');           // select natif invisible (discret)
    expect(sel.style.background).toBe('transparent'); // plus de "pilule" (ni fond ni bordure encadrée)
    expect(sel.style.borderStyle === 'none' || sel.style.borderStyle === '').toBe(true);
    expect(sel.style.minHeight).toBe('44px');      // cible tactile terrain
    expect(screen.getByText('Année', { exact: true })).toBeInTheDocument(); // libellé court (periode = annee)
  });

  it('comportement conservé : les 3 périodes sont dans la liste native', () => {
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx());
    const sel = within(screen.getByTestId('periode-discrete')).getByLabelText('Période');
    expect(sel.options.length).toBe(3);
    expect([...sel.options].map(o => o.value)).toEqual(['semaine', 'mois', 'annee']);
  });
});

describe('Période — desktop (1200px, inchangé)', () => {
  it('sélecteur ENCADRÉ + libellé complet, pas de version discrète', () => {
    setLargeur(1200);
    renderWithApp(<Dashboard />, ctx());
    expect(screen.queryByTestId('periode-discrete')).toBeNull();
    const sel = screen.getByLabelText('Période');
    expect(sel.style.border).toContain('1px solid');   // encadré conservé sur PC
    expect(sel.value).toBe('annee');
    expect(sel.options[sel.selectedIndex].textContent).toBe('Cette année'); // libellé complet
  });
});
