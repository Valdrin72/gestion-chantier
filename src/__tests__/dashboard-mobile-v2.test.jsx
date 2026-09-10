/**
 * Dashboard MOBILE v2 — nouvel ordre + KPI 2×2 compacte + 2 nouveaux blocs (Heures, Planning).
 *
 * Ordre cible (mobile) : hero → 4 KPI (2×2) → Heures (bouton +) → Planning (aujourd'hui + alertes)
 *   → Mes chantiers (compact) → Intelligence IA (compact).
 * Données RÉELLES : total heures semaine (heuresDansPeriode), « aujourd'hui » = chantiers datés
 *   actifs ce jour (aucun rendez-vous horodaté n'existe dans le modèle → pas inventé).
 *
 * Preuve RTL RÉELLE (vrai Dashboard) : ordre DOM, grille 2×2, bouton + fonctionnel, desktop intact.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Dashboard from '../pages/Dashboard';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: window.innerWidth <= 767, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false });
});
function setLargeur(px) { Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px }); }

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
    setChantiers: vi.fn(), naviguer: over.naviguer || vi.fn(), afficherNotif: vi.fn(), setPeriodeGlobale: vi.fn(), ouvrirMenu: vi.fn(),
    agentState: { scoreGlobal: 60, alertes: [{ id: 'a1', niveau: 'ATTENTION', message: 'Retard paiement' }], priorites: [], briefingMatin: null },
    profil: { id: 'cyna', pages: ['dashboard'] }, periodeGlobale: 'mois', ...over,
  };
}
const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
const apres = (a, b) => expect(a.compareDocumentPosition(b) & FOLLOWING).toBeTruthy();

describe('Dashboard mobile v2 — ordre des 6 blocs', () => {
  it('hero → KPI → Heures → Planning → Mes chantiers → Intelligence IA', () => {
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx());
    const hero = screen.getByTestId('hero-direction');
    const kpi = screen.getByTestId('kpi-strip');
    const heures = screen.getByText('Heures');
    const planning = screen.getByText("Aujourd'hui");
    const chantiers = screen.getByText('Mes chantiers');
    const ia = screen.getByText('Intelligence IA');
    apres(hero, kpi); apres(kpi, heures); apres(heures, planning);
    apres(planning, chantiers); apres(chantiers, ia);
  });
});

describe('Dashboard mobile v2 — KPI en grille 2×2', () => {
  it('la bande KPI est en 2 colonnes', () => {
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx());
    expect(screen.getByTestId('kpi-strip').style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    ['CA SIGNÉ', 'MARGE MOY.', 'ENCAISSÉ', 'ON ME DOIT'].forEach(l =>
      expect(screen.getByText(l)).toBeInTheDocument());
  });
});

describe('Dashboard mobile v2 — bloc Heures + bouton +', () => {
  it('affiche « Heures » + total semaine, et le bouton + navigue vers la saisie des heures', () => {
    const naviguer = vi.fn();
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx({ naviguer }));
    expect(screen.getByText('Heures')).toBeInTheDocument();
    expect(screen.getByText(/cette semaine/)).toBeInTheDocument(); // total réel (heuresDansPeriode)
    fireEvent.click(screen.getByRole('button', { name: /Saisir les heures/i }));
    expect(naviguer).toHaveBeenCalledWith('pointages');
  });
});

describe('Dashboard mobile v2 — bloc Planning (aujourd\'hui)', () => {
  it('le bloc Planning existe, liste le chantier du jour et a un lien Voir → planning', () => {
    const naviguer = vi.fn();
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx({ naviguer }));
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
    expect(screen.getAllByText('Chantier Test').length).toBeGreaterThan(0); // chantier actif aujourd'hui (réel)
    // Le « Voir → » du bloc Planning (l'en-tête contient « Aujourd'hui » + le bouton).
    const enTetePlanning = screen.getByText("Aujourd'hui").parentElement.parentElement;
    fireEvent.click(within(enTetePlanning).getByText('Voir →'));
    expect(naviguer).toHaveBeenCalledWith('planning');
  });
});

describe('Dashboard mobile v2 — Mes chantiers compact + IA cliquable', () => {
  it('Mes chantiers est en lignes compactes (plus de sous-libellé « CA signé » dans les lignes)', () => {
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx());
    expect(screen.getByText('Mes chantiers')).toBeInTheDocument();
    expect(screen.queryByText('CA signé')).toBeNull(); // les grosses cartes (avec sous-libellés) ont disparu
  });

  it('le bloc Intelligence IA compact est cliquable → écran agents', () => {
    const naviguer = vi.fn();
    setLargeur(375);
    renderWithApp(<Dashboard />, ctx({ naviguer }));
    screen.getByText('Intelligence IA').parentElement.click();
    expect(naviguer).toHaveBeenCalledWith('agents');
  });
});

describe('Dashboard mobile v2 — non-régression DESKTOP', () => {
  it('le desktop garde ses blocs (DirecteurBloc, Avancement global, Répartition des coûts) et pas de bloc Heures mobile', () => {
    setLargeur(1200);
    renderWithApp(<Dashboard />, ctx());
    expect(screen.getByText(/Heures pointées aujourd'hui/)).toBeInTheDocument(); // DirecteurBloc (desktop)
    expect(screen.getByText('Avancement global')).toBeInTheDocument();
    expect(screen.getByText('Répartition des coûts')).toBeInTheDocument();
    // Le bouton + « Saisir les heures » est propre au bloc Heures MOBILE → absent en desktop.
    expect(screen.queryByRole('button', { name: /Saisir les heures/i })).toBeNull();
  });
});
