/**
 * MATRICE — SÉQUENCES d'opérations : aucune donnée perdue après une suite d'actions.
 * Invariant 4 : saisie → correction → archivage → restauration → les heures et coûts survivent.
 * Vraies fonctions : usePointages (upsert), archiveHelpers, les moteurs.
 */
import { describe, it, expect } from 'vitest';
import { usePointages } from '../hooks/usePointages';
import { archiver, restaurer, filtrerActifs, filtrerArchives } from '../utils/archiveHelpers';
import { calculerEtatChantier } from '../donnees';
import { heuresEmployeChantier } from '../calculs/pointagesHelper';

function store(initial = []) {
  let s = [...initial];
  return { set: u => { s = typeof u === 'function' ? u(s) : u; }, get: () => s };
}
const hook = (st) => usePointages({ pointages: st.get(), setPointages: st.set });
const saisie = (chantierId, heures, date = '2025-06-02', employeId = 1) =>
  ({ date, employeId, repartitions: [{ chantierId, categorie: 'production', heures }], deplacement: null });

const EMP = [{ id: 1, nom: 'A', tarifJour: 400, tarifDejaCharge: true }];
const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };

describe('SÉQUENCE — saisie → correction → 2e chantier → rien de perdu', () => {
  it('8h A, corrigé 8→6, +4h B le même jour → A=6, B=4 (aucune heure perdue)', () => {
    const st = store();
    hook(st).upsertPointage(saisie('A', 8));         // saisie
    hook(st).upsertPointage(saisie('A', 6));         // correction
    hook(st).upsertPointage(saisie('B', 4));         // 2e chantier même jour
    expect(heuresEmployeChantier(st.get(), 1, 'A')).toBe(6);
    expect(heuresEmployeChantier(st.get(), 1, 'B')).toBe(4);
    // Un seul pointage (date, employé), deux répartitions.
    const jour = st.get().filter(p => p.date === '2025-06-02' && String(p.employeId) === '1');
    expect(jour).toHaveLength(1);
    expect(jour[0].repartitions).toHaveLength(2);
  });
});

describe('SÉQUENCE — archivage → restauration : le chantier et ses coûts survivent', () => {
  const chantier = {
    id: 'C1', nom: 'Réno', statut: 'en cours', nombreJours: 10, devisId: 'd1',
    journal: [{ date: '2025-06-02', employes: [{ employeId: 1, heuresTravaillees: 8 }] }],
  };
  const devis = [{ id: 'd1', montantHT: 50000, statut: 'accepté' }];
  const pointages = [{ id: 'p1', date: '2025-06-02', employeId: 1, repartitions: [{ chantierId: 'C1', categorie: 'production', heures: 8 }] }];

  it('coût MO identique avant archivage et après restauration (aucune perte)', () => {
    const coutAvant = calculerEtatChantier(chantier, EMP, devis, CFG, pointages).coutMOReel;
    expect(coutAvant).toBe(400); // 1 jour × 400

    // Archivage puis restauration via les vraies fonctions.
    const archive = archiver(chantier);
    expect(archive.archive).toBe(true);
    const restaure = restaurer(archive);
    expect(restaure.archive).toBe(false);

    // Le chantier restauré recalcule le MÊME coût (données intactes).
    const coutApres = calculerEtatChantier(restaure, EMP, devis, CFG, pointages).coutMOReel;
    expect(coutApres).toBe(coutAvant);
  });

  it('INVARIANT 6 : archivé exclu du monitoring actif mais présent dans les archives', () => {
    const liste = [chantier, archiver({ ...chantier, id: 'C2', nom: 'Archivé' })];
    const actifs = filtrerActifs(liste);
    const archives = filtrerArchives(liste);
    expect(actifs.map(c => c.id)).toEqual(['C1']);        // actif seulement
    expect(archives.map(c => c.id)).toEqual(['C2']);      // retrouvable en historique
    // Aucun chantier perdu (actifs + archivés = total).
    expect(actifs.length + archives.length).toBe(liste.length);
  });
});
