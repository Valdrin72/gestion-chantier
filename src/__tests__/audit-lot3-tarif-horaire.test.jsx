/**
 * Audit Lot 3 — tarif employé HORAIRE (Plan directeur, règle E3).
 * L'app stockait un tarif JOURNALIER (Cas B). La saisie passe à l'heure ;
 * tarifJour est DÉRIVÉ (× 8, règle 8 : 1 jour = 8 heures) pour les moteurs.
 * Invariant money : le coût MO d'un même pointage est IDENTIQUE avant/après.
 * Tests RÉELS : vraies fonctions exportées + vrai composant EmployesPage.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import {
  normaliserTarifsEmployes, tarifHoraireEmploye, calculerCoutsChantier,
} from '../donnees';
import { resolveDataFromBlob } from '../hooks/useSupabaseData';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';
import EmployesPage from '../pages/EmployesPage';

vi.mock('../AgentEngine', () => ({ default: class { analyser() { return []; } } }));
// Le hook useSupabaseData importe le client Supabase (env requis) — mocké, on ne
// teste ici que la fonction PURE resolveDataFromBlob.
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })), auth: { getSession: vi.fn() } },
}));

// Employé LEGACY : uniquement un tarif journalier 650 (pas de tarifHeure).
const LEGACY_650J = { id: 1, nom: 'Müller', poste: 'Chef de chantier', tarifJour: 650, tarifDejaCharge: true, actif: true };
const DEVIS = { id: 'd1', numero: 'D-1', montantHT: 50000, statut: 'Accepté', clientId: 'cl1' };
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
// 40 heures pointées (5 jours × 8h).
const CHANTIER_40H = {
  id: 'CH1', nom: 'Chantier 40h', statut: 'en cours', nombreJours: 10,
  devisId: 'd1', clientId: 'cl1', equipe: [{ employeId: 1, joursPlannifies: 10 }],
  dateDebut: '2026-03-02',
  journal: ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']
    .map(date => ({ date, employes: [{ employeId: 1, heuresTravaillees: 8 }] })),
};
const POINTAGES = migrerJournalVersPointages([CHANTIER_40H], [LEGACY_650J]);

describe('MORDANT équivalence — 650/j avant ≡ 81.25/h après : le coût MO ne bouge PAS', () => {
  it('normaliserTarifsEmployes : 650/j → tarifHeure 81.25, tarifJour 650 CONSERVÉ', () => {
    const [migre] = normaliserTarifsEmployes([LEGACY_650J]);
    expect(migre.tarifHeure).toBe(81.25);   // 650 ÷ 8 (règle 8)
    expect(migre.tarifJour).toBe(650);      // intact → aucun coût historique modifié
  });

  it('coût MO pour 40h pointées : IDENTIQUE avant/après migration (CHF 3250)', () => {
    const avant = calculerCoutsChantier(CHANTIER_40H, [LEGACY_650J], [], CFG, [DEVIS], POINTAGES);
    const apres = calculerCoutsChantier(CHANTIER_40H, normaliserTarifsEmployes([LEGACY_650J]), [], CFG, [DEVIS], POINTAGES);
    // 40h = 5 jours × 650 = 3250 — le même pointage coûte pareil dans les deux mondes.
    expect(avant.coutEquipeReel).toBe(3250);
    expect(apres.coutEquipeReel).toBe(avant.coutEquipeReel);
    expect(apres.totalCoutsReel).toBe(avant.totalCoutsReel);
    expect(apres.margeReel).toBe(avant.margeReel);
  });

  it('un NOUVEL employé saisi à 81.25/h coûte EXACTEMENT comme le legacy 650/j', () => {
    // Ce que produit le formulaire Équipe après le lot : tarifHeure saisi, tarifJour dérivé ×8.
    const saisiHoraire = { ...LEGACY_650J, tarifHeure: 81.25, tarifJour: 81.25 * 8 };
    const couts = calculerCoutsChantier(CHANTIER_40H, [saisiHoraire], [], CFG, [DEVIS], POINTAGES);
    expect(couts.coutEquipeReel).toBe(3250);
  });

  it('idempotence : migrer deux fois ne change rien (aucune dérive de montants)', () => {
    const une = normaliserTarifsEmployes([LEGACY_650J]);
    const deux = normaliserTarifsEmployes(une);
    expect(deux[0].tarifHeure).toBe(81.25);
    expect(deux[0].tarifJour).toBe(650);
  });

  it('source = horaire : un tarifHeure modifié re-dérive tarifJour (× 8)', () => {
    const [emp] = normaliserTarifsEmployes([{ id: 2, nom: 'X', tarifHeure: 50 }]);
    expect(emp.tarifJour).toBe(400);        // 50 × 8 — l'horaire fait foi
  });
});

describe('Auto-migration au chargement (vrai chemin resolveDataFromBlob)', () => {
  it('un blob avec employés legacy (tarifJour seul) ressort avec tarifHeure dérivé', () => {
    const blob = { parametres: { employes: [LEGACY_650J, { id: 2, nom: 'Y', tarifJour: 350 }] } };
    const { parametres } = resolveDataFromBlob(blob, false);
    expect(parametres.employes[0].tarifHeure).toBe(81.25);
    expect(parametres.employes[0].tarifJour).toBe(650);   // coûts intacts
    expect(parametres.employes[1].tarifHeure).toBe(43.75); // 350 ÷ 8
  });
});

describe('Écran Équipe — les affichages disent la bonne unité (« /h »)', () => {
  const renderEquipe = (employes) => renderWithApp(
    <EmployesPage parametres={{ employes }} setParametres={vi.fn()} chantiers={[]} naviguer={vi.fn()} />,
    { profil: { id: 'cyna' }, afficherNotif: vi.fn() },
  );

  it('la carte employé affiche « CHF/h » (43.75 pour un legacy 350/j) — plus de « CHF/jour »', () => {
    renderEquipe([{ id: 'e1', nom: 'Jean Martin', poste: 'Ouvrier qualifié', tarifJour: 350, actif: true }]);
    expect(screen.getByText('CHF/h')).toBeInTheDocument();
    expect(screen.getByText('43.75')).toBeInTheDocument();  // 350 ÷ 8 — montant conforme à l'horaire
    expect(screen.queryByText('CHF/jour')).toBeNull();      // MORDANT : l'ancien label a disparu
    // KPI tarif moyen en « /h » aussi
    expect(screen.getByText(/CHF 43.75\/h/)).toBeInTheDocument();
  });

  it('le formulaire de saisie demande le « Tarif horaire (CHF/h) », plus le tarif/jour', () => {
    renderEquipe([]);
    fireEvent.click(screen.getByRole('button', { name: /Nouvel employé/i }));
    expect(screen.getByText(/Tarif horaire \(CHF\/h\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Tarif\/jour/)).toBeNull();
  });

  it('tarifHoraireEmploye : horaire stocké prioritaire, sinon journalier ÷ 8, sinon 0', () => {
    expect(tarifHoraireEmploye({ tarifHeure: 90, tarifJour: 999 })).toBe(90);
    expect(tarifHoraireEmploye({ tarifJour: 650 })).toBe(81.25);
    expect(tarifHoraireEmploye({})).toBe(0);
  });
});
