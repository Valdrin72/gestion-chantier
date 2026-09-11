/**
 * Chantiers MOBILE — soin visuel (paquet a). D'après la maquette validée : titre plus grand,
 * tuiles KPI restylées (mêmes 4 KPI/valeurs), cartes rayon 16 + badge pilule + tuile-icône,
 * filtres collants, état vide soigné. AUCUN élément du paquet (b), boutons d'action CONSERVÉS.
 *
 * Preuve RTL RÉELLE (vrai ChantiersListe) : styles réels lus sur le DOM + non-régression desktop.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import ChantiersListe from '../components/chantiers/ChantiersListe';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
const setLargeur = (px) => Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const DEVIS = [{ id: 'd1', numero: 'D-1', montantHT: 80000, statut: 'accepté', clientId: 'cl1', avenants: [], heuresRegie: [] }];
const CLIENTS = [{ id: 'cl1', nom: 'Dupont', entreprise: 'Dupont SA' }];
const CH = { id: 'CH1', nom: 'Bureaux Grand-Pré', numero: 'C-001', ville: 'Genève', statut: 'En cours', clientId: 'cl1', devisId: 'd1', nombreJours: 20, dateDebut: '2026-07-01', journal: [], extras: [] };

function renderListe() {
  const ctx = {
    chantiers: [CH], clients: CLIENTS, devis: DEVIS, factures: [], pointages: [],
    parametres: { employes: [EMP], localites: [], parametres: { coefficientMainOeuvre: 1, tauxFraisGeneraux: 12 } },
    naviguer: vi.fn(), afficherNotif: vi.fn(), confirmer: vi.fn().mockResolvedValue(true),
    agentState: {}, periodeGlobale: 'annee', contexte: {}, ouvrirMenu: vi.fn(), setPeriodeGlobale: vi.fn(),
  };
  return renderWithApp(
    <ChantiersListe chantiersFiltres={[CH]} chantiersArchives={[]} joursParChantier={{ CH1: 5 }}
      filtre="Tous" setFiltre={vi.fn()} onSelect={vi.fn()} onModifier={vi.fn()} onSupprimer={vi.fn()}
      onArchiver={vi.fn()} onRestaurer={vi.fn()} formSlot={null} />,
    ctx,
  );
}

describe('Chantiers mobile — données/actions INCHANGÉES (paquet b non touché)', () => {
  it('les 4 KPI actuels sont présents (libellés exacts), pas de tuile du paquet b', () => {
    setLargeur(375);
    renderListe();
    ['kpi-en-cours', 'kpi-ca-facturé', 'kpi-marge', 'kpi-à-facturer'].forEach(id =>
      expect(screen.getByTestId(id)).toBeInTheDocument());
    expect(screen.queryByTestId('kpi-portefeuille')).toBeNull();     // paquet b non appliqué
    expect(screen.queryByTestId('kpi-jours-planifiés')).toBeNull();
  });

  it('nom du client + boutons d\'action de la carte TOUJOURS présents ; pas de MONTANT (paquet b)', () => {
    setLargeur(375);
    renderListe();
    expect(screen.getByText('Dupont SA')).toBeInTheDocument();        // nom client conservé
    expect(screen.getByRole('button', { name: /Voir détail/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Modifier/i })).toBeInTheDocument();
    expect(screen.queryByText('MONTANT')).toBeNull();                 // colonne montant NON ajoutée
    expect(screen.queryByText(/OBJECTIF 20/)).toBeNull();             // libellé décoratif NON inventé
  });
});

describe('Chantiers mobile — soin visuel appliqué (styles réels)', () => {
  it('titre 30px, carte rayon 16px, badge statut en pilule (999px)', () => {
    setLargeur(375);
    renderListe();
    expect(screen.getByRole('heading', { name: 'Chantiers' }).style.fontSize).toBe('30px');
    const carte = screen.getByText('Bureaux Grand-Pré').closest('[role="button"]');
    expect(carte.style.borderRadius).toBe('16px');
    // badge du statut de la carte (dans la carte, pas la tuile KPI « EN COURS »)
    const badge = within(carte).getByText('EN COURS');
    expect(badge.style.borderRadius).toBe('999px');
  });
});

describe('Chantiers DESKTOP — non-régression (inchangé)', () => {
  it('desktop : tableau (colonne Référence) présent et titre 38px', () => {
    setLargeur(1200);
    renderListe();
    expect(screen.getByText('Référence')).toBeInTheDocument();        // en-tête tableau desktop
    expect(screen.getByRole('heading', { name: 'Chantiers' }).style.fontSize).toBe('38px');
  });
});
