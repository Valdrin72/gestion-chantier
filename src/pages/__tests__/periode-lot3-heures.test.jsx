/**
 * Cohérence des périodes — LOT 3/7 : Heures / Employés adoptent periode.js.
 * ⚠ Money-critical (coût MO dérivé des heures). Filtrage EXACT par date de pointage.
 *   Heures : bornes mois/année via bornesPeriode (source unique) ; semaine navigable conservée
 *   (7 jours, dimanche inclus). EmployésPage : estDansPeriode (fix décalage UTC — dernier jour du
 *   mois non amputé, dimanche inclus en semaine) ; chantiersActifs filtré par période (cohérence) ;
 *   hero « heures totales » libellé global.
 *
 * Preuve RTL RÉELLE (vrais composants) :
 *   1. Heures : une heure pointée un DIMANCHE de la semaine courante apparaît dans le total semaine ;
 *   2. INVARIANT d'emboîtement : Σ(12 mois) == année (heuresDansPeriode) ;
 *   3. EmployésPage : le dernier jour du mois n'est PAS amputé (fix UTC) et chantiersActifs suit la période.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithApp } from '../../test-utils/renderWithApp.jsx';
import Heures from '../../Heures.js';
import Employes from '../EmployesPage.js';
import { heuresDansPeriode } from '../../calculs/periode';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

const p2 = (n) => String(n).padStart(2, '0');
const isoL = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const t = new Date();
// Dimanche de la semaine COURANTE (lundi = t - ((jour+6)%7) ; dimanche = lundi + 6).
const jour = t.getDay();
const lundi = new Date(t.getFullYear(), t.getMonth(), t.getDate() + (jour === 0 ? -6 : 1 - jour));
const DIMANCHE_COURANT = isoL(new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 6));
// Dernier jour du mois courant + un jour de l'an dernier (hors période).
const DERNIER_JOUR_MOIS = isoL(new Date(t.getFullYear(), t.getMonth() + 1, 0));
const AN_DERNIER = `${t.getFullYear() - 1}-06-15`;

const EMP = { id: 1, nom: 'Müller', poste: 'Chef', tarifJour: 350, tarifDejaCharge: true, actif: true };
const PARAMS = { employes: [EMP], localites: [], parametres: { coefficientMainOeuvre: 1 } };

// ── 1. Heures — dimanche compté dans la semaine ──────────────────────────────
describe('HEURES — le dimanche de la semaine courante est compté dans le total semaine', () => {
  it('5h pointées un dimanche apparaissent dans « HEURES SEMAINE »', () => {
    const chantier = { id: 'CH1', nom: 'Villa', statut: 'en cours', canton: 'GE', equipe: [{ employeId: 1 }],
      journal: [{ date: DIMANCHE_COURANT, employes: [{ employeId: 1, heuresTravaillees: 5 }] }] };
    renderWithApp(
      <Heures chantiers={[chantier]} parametres={PARAMS} setChantiers={vi.fn()} />,
      { pointages: [], periodeGlobale: 'semaine', setPeriodeGlobale: vi.fn(), ouvrirMenu: vi.fn() },
    );
    expect(screen.getByTestId('hero-kpi-heures-semaine').textContent).toMatch(/5h/);
  });
});

// ── 2. Invariant d'emboîtement des heures ────────────────────────────────────
describe('HEURES — invariant d\'emboîtement Σ(12 mois) == année', () => {
  it('via heuresDansPeriode (dimanche inclus, pas de trou ni double-comptage)', () => {
    const P = (date, heures) => ({ date, employeId: 1, repartitions: [{ chantierId: 'CH1', categorie: 'production', heures }] });
    const pointages = [
      P('2026-03-08', 8),   // dimanche 8 mars 2026 → doit être compté
      P('2026-08-17', 6),
      P('2026-11-16', 4),
      { date: '2026-05-10', employeId: 1, repartitions: [{ chantierId: 'CH1', categorie: 'deplacement', heures: 9 }] }, // exclu (non productif)
    ];
    const somme = Array.from({ length: 12 }, (_, m) => heuresDansPeriode(pointages, 'mois', new Date(2026, m, 15)))
      .reduce((a, b) => a + b, 0);
    expect(somme).toBe(heuresDansPeriode(pointages, 'annee', new Date(2026, 5, 15)));
    expect(somme).toBe(18); // 8 + 6 + 4, le déplacement ne compte pas
  });
});

// ── 3. EmployésPage — fix UTC (dernier jour) + chantiersActifs cohérent ──────
describe('EMPLOYÉSPAGE — dernier jour du mois non amputé (fix UTC) + chantiersActifs par période', () => {
  it('l\'entrée du dernier jour du mois est comptée ; le chantier hors période est exclu', () => {
    const chIn = { id: 'CIN', nom: 'Chantier In', statut: 'en cours', equipe: [{ employeId: 1 }],
      journal: [{ date: DERNIER_JOUR_MOIS, employes: [{ employeId: 1, heuresTravaillees: 8 }] }] };
    const chOut = { id: 'COUT', nom: 'Chantier Out', statut: 'en cours', equipe: [{ employeId: 1 }],
      journal: [{ date: AN_DERNIER, employes: [{ employeId: 1, heuresTravaillees: 8 }] }] };
    renderWithApp(
      <Employes parametres={PARAMS} setParametres={vi.fn()} chantiers={[chIn, chOut]} naviguer={vi.fn()} />,
      { profil: { id: 'cyna' }, afficherNotif: vi.fn(), periodeGlobale: 'mois', ouvrirMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /Performance/ }));
    // Heures équipe = 8h : le dernier jour est compté (fix UTC), le chantier de l'an dernier est EXCLU.
    expect(screen.getByTestId('perf-kpis').textContent).toMatch(/8h/);
    // chantiersActifs cohérent avec la période : 1 seul chantier (pas 2) → aucun « 2 » dans la ligne employé.
    // (« Müller » apparaît aussi dans le KPI « PLUS ACTIF » — on cible la LIGNE du tableau, dans un <tr>.)
    const ligne = screen.getAllByText('Müller').map(el => el.closest('tr')).find(Boolean);
    expect(ligne).toBeTruthy();
    expect(within(ligne).queryByText('2')).toBeNull();
  });
});
