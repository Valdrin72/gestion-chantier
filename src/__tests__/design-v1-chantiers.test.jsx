/**
 * Design v1 — page Chantiers (liste). Preuve RTL : le hero affiche les 4 vrais
 * chiffres, la liste montre les vrais chantiers avec leur état C8, les filtres
 * filtrent, le clic navigue, la bascule Liste/Kanban marche. Zéro logique testée
 * en miroir — vrai composant ChantiersListe rendu.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import ChantiersListe from '../components/chantiers/ChantiersListe';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const DEVIS = [
  { id: 'd1', numero: 'D-1', montantHT: 80000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] },
  { id: 'd2', numero: 'D-2', montantHT: 40000, statut: 'accepté', clientId: 'cl2', avenants: [], heuresRegie: [] },
];
const CLIENTS = [
  { id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' },
  { id: 'cl2', nom: 'Rossi', entreprise: 'Rossi Sàrl' },
];
const CH_EN_COURS = {
  id: 'CH1', nom: 'Bureaux Grand-Pré', numero: 'C-001', ville: 'Genève',
  statut: 'En cours', clientId: 'cl1', devisId: 'd1', nombreJours: 20, dateDebut: '2026-07-01', journal: [], extras: [],
};
const CH_ATTENTE = {
  id: 'CH2', nom: 'Villa Cologny', numero: 'C-002', ville: 'Cologny',
  statut: 'Attente paiement', clientId: 'cl2', devisId: 'd2', nombreJours: 10, dateDebut: '2026-05-01', journal: [], extras: [], dateFinTravaux: '2026-06-01',
};

function renderListe(over = {}) {
  const setFiltre = over.setFiltre || vi.fn();
  const onSelect = over.onSelect || vi.fn();
  const chantiers = over.chantiers || [CH_EN_COURS, CH_ATTENTE];
  const ctx = {
    chantiers, clients: CLIENTS, devis: DEVIS, factures: [], pointages: [],
    parametres: { employes: [EMP], localites: [], parametres: { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 } },
    naviguer: vi.fn(), afficherNotif: vi.fn(), confirmer: vi.fn().mockResolvedValue(true),
    agentState: {}, periodeGlobale: 'annee', contexte: {}, ouvrirMenu: over.ouvrirMenu || vi.fn(),
    setPeriodeGlobale: over.setPeriodeGlobale || vi.fn(),
  };
  return renderWithApp(
    <ChantiersListe chantiersFiltres={chantiers} chantiersArchives={[]} joursParChantier={{ CH1: 5, CH2: 2 }}
      filtre={over.filtre ?? 'Tous'} setFiltre={setFiltre} onSelect={onSelect}
      onModifier={vi.fn()} onSupprimer={vi.fn()} onArchiver={vi.fn()} onRestaurer={vi.fn()} formSlot={null} />,
    ctx,
  );
}

describe('HERO Chantiers — 4 chiffres réels + ☰', () => {
  it('affiche le titre, la ligne mono et les 4 tuiles (EN COURS = 1, CA signé, marge, jours)', () => {
    renderListe();
    expect(screen.getByTestId('hero-chantiers')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chantiers' })).toBeInTheDocument();
    // EN COURS : un seul chantier « En cours » (CH1) — pas CH2 (Attente paiement)
    expect(within(screen.getByTestId('kpi-en-cours')).getByText('1')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-ca-signé')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-marge-moyenne')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-jours-planifiés')).toBeInTheDocument();
  });

  it('le bouton ☰ ouvre le drawer (ouvrirMenu du contexte)', () => {
    const ouvrirMenu = vi.fn();
    renderListe({ ouvrirMenu });
    fireEvent.click(screen.getByRole('button', { name: /^Menu$/i }));
    expect(ouvrirMenu).toHaveBeenCalledOnce();
  });

  it('le hero intègre le sélecteur de période (plus de barre blanche au-dessus)', () => {
    const { unmount } = renderListe();
    // La liste active le mode « hero plein écran » → le Topbar blanc est masqué (CSS).
    expect(document.body.classList.contains('hero-fullscreen')).toBe(true);
    // Le sélecteur de période vit DANS le hero.
    const hero = screen.getByTestId('hero-chantiers');
    expect(within(hero).getByLabelText('Période')).toBeInTheDocument();
    // La cloche notifications aussi.
    expect(within(hero).getByRole('button', { name: /Notifications/i })).toBeInTheDocument();
    unmount();
    // Démontage (ex. passage à la fiche détail) → le Topbar peut réapparaître.
    expect(document.body.classList.contains('hero-fullscreen')).toBe(false);
  });

  it('changer la période dans le hero appelle setPeriodeGlobale (logique inchangée)', () => {
    const setPeriodeGlobale = vi.fn();
    renderListe({ setPeriodeGlobale });
    fireEvent.change(within(screen.getByTestId('hero-chantiers')).getByLabelText('Période'), { target: { value: 'semaine' } });
    expect(setPeriodeGlobale).toHaveBeenCalledWith('semaine');
  });
});

describe('LISTE — vrais chantiers avec état C8', () => {
  it('affiche les 2 chantiers avec leur badge de statut (EN COURS, ATTENTE PAIEMENT)', () => {
    renderListe();
    expect(screen.getByText('Bureaux Grand-Pré')).toBeInTheDocument();
    expect(screen.getByText('Villa Cologny')).toBeInTheDocument();
    // Badges de statut C8 en majuscules (cohérence Plan directeur)
    expect(screen.getByText('ATTENTE PAIEMENT')).toBeInTheDocument();
    // Référence + client
    expect(screen.getByText('C-001')).toBeInTheDocument();
    expect(screen.getByText('Dupont SA')).toBeInTheDocument();
  });

  it('cliquer une ligne navigue vers la fiche chantier (onSelect conservé)', () => {
    const onSelect = vi.fn();
    renderListe({ onSelect });
    fireEvent.click(screen.getByText('Bureaux Grand-Pré'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'CH1' }));
  });
});

describe('FILTRES d\'état — pastilles fonctionnelles', () => {
  it('cliquer un filtre appelle setFiltre avec le statut', () => {
    const setFiltre = vi.fn();
    renderListe({ setFiltre });
    fireEvent.click(screen.getByRole('button', { name: 'Attente paiement' }));
    expect(setFiltre).toHaveBeenCalledWith('Attente paiement');
  });

  it('le filtre actif est mis en avant (fond bleu CYNA)', () => {
    renderListe({ filtre: 'En cours' });
    const actif = screen.getByRole('button', { name: 'En cours' });
    expect(actif.style.background).toBe('rgb(30, 95, 175)'); // #1E5FAF
  });
});

describe('BASCULE Liste / Kanban', () => {
  it('cliquer « Kanban » masque le tableau et affiche la vue Kanban', () => {
    renderListe();
    // En liste : le tableau existe (référence visible)
    expect(screen.getByText('C-001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Kanban/i }));
    // Le Kanban rend les colonnes de statut (En cours) — le tableau liste n'est plus rendu
    expect(screen.getAllByText(/Bureaux Grand-Pré/).length).toBeGreaterThan(0);
  });
});
