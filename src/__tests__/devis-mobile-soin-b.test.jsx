/**
 * Devis MOBILE — soin lot B (formulaire). Preuve RTL RÉELLE (vrai composant Devis, formulaire ouvert) :
 *  • point 06 : types de travaux = vraies cases 44px, blanc→bleu, sélection fonctionnelle (form.typesTravaux) ;
 *  • point 07 : états vides non-italiques en sous-carte blanche à icône ;
 *  • point 08 : boutons « + Ajouter » pleine largeur 44px ;
 *  • point 09 : chevron « Réduire » de l'Aide au devis = cible 44px ;
 *  • point 11 : barre d'actions ancrée (fond gris #F8FAFC), Sauvegarder 48px flex:1 ;
 *  • SAUVEGARDE de bout en bout (setDevis appelé) ;
 *  • desktop : pills et barre d'actions inchangées.
 * Échoue si les types repassent invisibles (transparent) ou si la barre d'actions perd son ancrage.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) } }));
vi.mock('../ExportPDF', () => ({ exportDevis: vi.fn(), exportFicheChantier: vi.fn(), exportFacture: vi.fn() }));
vi.mock('../utils/exportCSV', () => ({ exportCSV: vi.fn() }));

import Devis from '../pages/DevisPage';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const CLIENTS = [{ id: 1, nom: 'Dupont', prenom: 'Marc', entreprise: 'Dupont SA' }];
const TYPES = [{ id: 't1', nom: 'Cloisons vitrées' }, { id: 't2', nom: 'Faux plancher' }];

const renderDevis = () => renderWithApp(<Devis />, {
  devis: [], clients: CLIENTS, chantiers: [], factures: [],
  parametres: { employes: [], typesTravaux: TYPES },
  contexte: { ouvrirNouveau: true }, // ouvre le formulaire au montage
  periodeGlobale: 'mois', setPeriodeGlobale: vi.fn(), naviguer: vi.fn(), ouvrirMenu: vi.fn(),
});

describe('Devis mobile — soin lot B / formulaire (375px)', () => {
  it('point 06 — types de travaux : cases 44px blanc→bleu, sélection fonctionnelle', () => {
    setLargeur(375);
    renderDevis();
    const pill = screen.getByRole('button', { name: 'Cloisons vitrées' });
    expect(pill.style.minHeight).toBe('44px');
    expect(pill.style.background).toBe('rgb(255, 255, 255)'); // non coché = blanc
    fireEvent.click(pill);
    const pillActive = screen.getByRole('button', { name: /Cloisons vitrées/ }); // "✓ Cloisons vitrées"
    expect(pillActive.style.background).toBe('rgb(232, 240, 249)'); // #E8F0F9 = coché bleu clair
    expect(pillActive.textContent).toMatch(/^✓/);
  });

  it('point 08 — boutons « + Ajouter » pleine largeur 44px', () => {
    setLargeur(375);
    renderDevis();
    const bAv = screen.getByText('+ Ajouter un avenant');
    const bReg = screen.getByText('+ Ajouter une ligne');
    expect(bAv.style.width).toBe('100%');
    expect(bAv.style.minHeight).toBe('44px');
    expect(bReg.style.width).toBe('100%');
    expect(bReg.style.minHeight).toBe('44px');
  });

  it('point 07 — état vide non-italique en sous-carte blanche', () => {
    setLargeur(375);
    renderDevis();
    const vide = screen.getByText(/Aucun avenant/).closest('div');
    expect(vide.style.background).toBe('rgb(255, 255, 255)');
    expect(vide.style.fontStyle).not.toBe('italic');
  });

  it('point 09 — chevron « Réduire » de l\'Aide au devis = cible 44px', () => {
    setLargeur(375);
    renderDevis();
    const chevron = screen.getByLabelText('Réduire');
    expect(chevron.style.width).toBe('44px');
    expect(chevron.style.height).toBe('44px');
  });

  it('point 11 — barre d\'actions ancrée (fond gris), Sauvegarder 48px flex:1', () => {
    setLargeur(375);
    renderDevis();
    const save = screen.getByText('Sauvegarder');
    expect(save.style.minHeight).toBe('48px');
    expect(save.style.flex).toBe('1');
    const barre = save.parentElement;
    expect(barre.style.background).toBe('rgb(248, 250, 252)'); // #F8FAFC
    expect(barre.style.borderTopStyle).toBe('solid');
  });

  it('SAUVEGARDE de bout en bout — setDevis appelé avec le nouveau devis', () => {
    setLargeur(375);
    const { ctx } = renderDevis();
    // client
    const selects = screen.getAllByRole('combobox');
    const clientSelect = selects.find(s => within(s).queryByText(/Dupont/));
    fireEvent.change(clientSelect, { target: { value: '1' } });
    // type de travaux
    fireEvent.click(screen.getByText('Cloisons vitrées'));
    // montant
    fireEvent.change(screen.getByPlaceholderText("Ex : 45'000"), { target: { value: '45000' } });
    // sauvegarder
    fireEvent.click(screen.getByText('Sauvegarder'));
    expect(ctx.setDevis).toHaveBeenCalledTimes(1);
    const arg = ctx.setDevis.mock.calls[0][0];
    expect(Array.isArray(arg)).toBe(true);
    expect(arg[arg.length - 1]).toMatchObject({ clientId: 1, montantHT: '45000', typesTravaux: ['Cloisons vitrées'] });
  });
});

describe('Devis desktop — non-régression formulaire (1200px)', () => {
  it('types de travaux gardent le style desktop (padding 5px 14px, pas 44px)', () => {
    setLargeur(1200);
    renderDevis();
    const pill = screen.getByText('Cloisons vitrées');
    expect(pill.style.padding).toBe('5px 14px');
    expect(pill.style.minHeight).toBe('');
  });

  it('barre d\'actions NON ancrée en desktop (pas de fond gris)', () => {
    setLargeur(1200);
    renderDevis();
    const barre = screen.getByText('Sauvegarder').parentElement;
    expect(barre.style.background).not.toBe('rgb(248, 250, 252)');
  });
});
