/**
 * MATRICE DE SCÉNARIOS — moteurs de calcul (chercher la CASSE, pas confirmer).
 * On croise chantier × employé × pointage et on vérifie les invariants sur les DEUX moteurs
 * réels (calculerCoutsChantier / calculerEtatChantier). Un test rouge = un scénario qui casse.
 */
import { describe, it, expect } from 'vitest';
import { calculerCoutsChantier, calculerEtatChantier } from '../donnees';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';

const CFG = { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 };
const LOC = [{ nom: 'Genève', tarifJour: 60 }];

// ── Employés ────────────────────────────────────────────────────────────────
const EMPLOYES = {
  actif:   [{ id: 1, nom: 'Actif', tarifJour: 400, tarifDejaCharge: true, actif: true }],
  inactif: [{ id: 1, nom: 'Inactif', tarifJour: 400, tarifDejaCharge: true, actif: false }],
  tarif0:  [{ id: 1, nom: 'Tarif0', tarifJour: 0, tarifDejaCharge: true, actif: true }],
  vide:    [], // employé "supprimé" / inconnu → l'id 1 des pointages n'existe plus
};

// ── Journaux (dérivés en pointages) ───────────────────────────────────────────
const J = (dates) => dates.map(d => ({ date: d, employes: [{ employeId: 1, heuresTravaillees: 8 }] }));
const JOURNAUX = {
  aucun:        [],
  ouvre5:       J(['2025-06-02', '2025-06-03', '2025-06-04', '2025-06-05', '2025-06-06']), // lun-ven
  samedi:       J(['2025-06-07']),  // samedi
  dimanche:     J(['2025-06-08']),  // dimanche
  nouvelAn:     J(['2025-01-01']),  // férié
  h0:           [{ date: '2025-06-02', employes: [{ employeId: 1, heuresTravaillees: 0 }] }], // 0h
  anneeBiss:    J(['2024-02-29']),  // 29 février bissextile
  finAnnee:     J(['2025-12-31', '2025-01-01']),
};

// ── Chantiers (états × devis) ─────────────────────────────────────────────────
const DEVIS_NORMAL = { id: 'd1', numero: 'D-1', montantHT: 100_000, statut: 'accepté' };
const DEVIS_AVENANT = { id: 'd1', numero: 'D-1', montantHT: 100_000, statut: 'accepté', avenants: [{ id: 'av1', montant: 5000 }] };
const CH = (over = {}) => ({ id: 'C1', nom: 'Chantier', statut: 'en cours', nombreJours: 100, devisId: 'd1', clientId: 'cl1', ville: 'Genève', ...over });
const CHANTIERS = {
  enCours:    CH(),
  termine:    CH({ statut: 'terminé' }),
  annule:     CH({ statut: 'annulé' }),
  planifie:   CH({ statut: 'planifié' }),
  suspendu:   CH({ statut: 'suspendu' }),
  archive:    CH({ archive: true }),
  sansDevis:  CH({ devisId: null }),
  depassement:CH({ materielReel: 200000 }), // coûts > CA
  surface0:   CH({ surface: 0 }),
  jours0:     CH({ nombreJours: 0 }),
  avenant:    CH(),
  enorme:     CH({ devisId: 'dE', materielReel: 500 }),
};
const DEVIS_ENORME  = { id: 'dE', numero: 'D-E', montantHT: 99_999_999, statut: 'accepté' };
const DEVIS_NEGATIF = { id: 'd1', numero: 'D-1', montantHT: -50_000, statut: 'accepté' };
const DEVIS_POUR = (chKey) => {
  if (chKey === 'sansDevis') return [];
  if (chKey === 'avenant') return [DEVIS_AVENANT];
  if (chKey === 'enorme') return [DEVIS_ENORME];
  if (chKey === 'depassement') return [DEVIS_NEGATIF]; // CA négatif + coûts énormes
  return [DEVIS_NORMAL];
};

// ── Scan récursif : NaN / Infinity / undefined dans un résultat moteur ────────
function trouverAnomalies(obj, chemin = '') {
  const out = [];
  if (obj === null) return out;
  if (typeof obj === 'number') {
    if (Number.isNaN(obj)) out.push(`${chemin} = NaN`);
    else if (!Number.isFinite(obj)) out.push(`${chemin} = ${obj}`);
    return out;
  }
  if (Array.isArray(obj)) { obj.forEach((v, i) => out.push(...trouverAnomalies(v, `${chemin}[${i}]`))); return out; }
  if (typeof obj === 'object') { for (const k of Object.keys(obj)) out.push(...trouverAnomalies(obj[k], `${chemin}.${k}`)); return out; }
  return out;
}

// ── Génération de la matrice ──────────────────────────────────────────────────
const combinaisons = [];
for (const [chKey, chBase] of Object.entries(CHANTIERS)) {
  for (const [jKey, journal] of Object.entries(JOURNAUX)) {
    for (const [eKey, employes] of Object.entries(EMPLOYES)) {
      const chantier = { ...chBase, journal };
      const devis = DEVIS_POUR(chKey);
      const pointages = migrerJournalVersPointages([chantier], employes);
      combinaisons.push({ label: `ch=${chKey} journal=${jKey} emp=${eKey}`, chantier, employes, devis, pointages });
    }
  }
}

// Exécute les deux moteurs et collecte les violations d'invariants.
function evaluer({ chantier, employes, devis, pointages }) {
  const violations = [];
  let couts, etat;
  try {
    couts = calculerCoutsChantier(chantier, employes, LOC, CFG, devis, pointages);
    etat  = calculerEtatChantier(chantier, employes, devis, CFG, pointages);
  } catch (e) {
    return [`EXCEPTION: ${e.message}`];
  }
  // Invariant 1 — aucun NaN / Infinity
  violations.push(...trouverAnomalies(couts, 'couts').map(a => `NaN/Inf ${a}`));
  violations.push(...trouverAnomalies(etat, 'etat').map(a => `NaN/Inf ${a}`));
  // Invariant 2 — avancement borné 0..100
  if (couts.avancementPct < 0 || couts.avancementPct > 100) violations.push(`avancement hors [0,100] : ${couts.avancementPct}`);
  if (etat.avancementPct < 0 || etat.avancementPct > 100) violations.push(`etat.avancement hors [0,100] : ${etat.avancementPct}`);
  // Invariant "deux moteurs équivalents" (CLAUDE.md) — coûts et avancement identiques
  const dCout = Math.abs((couts.totalCoutsReel || 0) - (etat.coutTotalReel || 0));
  if (dCout > 0.01) violations.push(`divergence coûts 2 moteurs : couts=${couts.totalCoutsReel} etat=${etat.coutTotalReel} (Δ${dCout})`);
  if (Math.abs((couts.avancementPct || 0) - (etat.avancementPct || 0)) > 0.01) violations.push(`divergence avancement : ${couts.avancementPct} vs ${etat.avancementPct}`);
  // coutMO ≤ coutTotal
  if ((etat.coutMOReel || 0) - (etat.coutTotalReel || 0) > 0.01) violations.push(`coutMOReel > coutTotalReel : ${etat.coutMOReel} > ${etat.coutTotalReel}`);
  // jours réalisés = jours uniques des pointages productifs
  const joursUniques = new Set(pointages.filter(p => (p.repartitions || []).some(r => ['production','atelier'].includes(r.categorie) && r.heures > 0)).map(p => p.date)).size;
  if (etat.totalJoursReels !== joursUniques) violations.push(`jours réalisés ${etat.totalJoursReels} ≠ jours uniques pointages ${joursUniques}`);
  return violations;
}

const resultats = combinaisons.map(c => ({ label: c.label, violations: evaluer(c) }));
const casse = resultats.filter(r => r.violations.length > 0);

describe('MATRICE moteurs — invariants sur toutes les combinaisons', () => {
  it(`sanity : ${combinaisons.length} combinaisons générées`, () => {
    expect(combinaisons.length).toBeGreaterThan(200);
  });

  it('AUCUNE anomalie NaN / Infinity / exception sur toute la matrice', () => {
    const nanCasse = casse.filter(r => r.violations.some(v => v.startsWith('NaN/Inf') || v.startsWith('EXCEPTION')));
    expect(nanCasse.map(r => ({ scenario: r.label, violations: r.violations }))).toEqual([]);
  });

  it('AUCUNE divergence entre les deux moteurs (coûts + avancement)', () => {
    const div = casse.filter(r => r.violations.some(v => v.startsWith('divergence')));
    expect(div.map(r => ({ scenario: r.label, violations: r.violations.filter(v => v.startsWith('divergence')) }))).toEqual([]);
  });

  it('avancement toujours borné [0,100] et coutMO ≤ coutTotal et jours cohérents', () => {
    const autres = casse.filter(r => r.violations.some(v => v.includes('avancement hors') || v.includes('coutMOReel >') || v.includes('jours réalisés')));
    expect(autres.map(r => ({ scenario: r.label, violations: r.violations }))).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 🔴 CASSE TROUVÉE PAR LA MATRICE — documentée via it.fails (bug réel, NON corrigé ici).
// it.fails PASSE tant que le bug existe → deviendra rouge le jour où on le corrige (alerte).
// ══════════════════════════════════════════════════════════════════════════════
describe('🔴 CASSE — coût réel NÉGATIF : les deux moteurs divergent', () => {
  // Scénario métier : un utilisateur saisit un coût matériel/sous-traitance/autres NÉGATIF
  // (typo, ou avoir fournisseur mal saisi). calculerCoutsChantier clampe à 0 (Math.max(0,…)),
  // calculerEtatChantier garde le négatif → coût total et marge DIFFÈRENT selon l'écran.
  const emp = [{ id: 1, nom: 'A', tarifJour: 400, tarifDejaCharge: true }];
  const devis = [{ id: 'd1', montantHT: 100000, statut: 'accepté' }];
  const runDeux = (over) => {
    const ch = { id: 'C1', statut: 'en cours', nombreJours: 100, devisId: 'd1', journal: [], ...over };
    return {
      couts: calculerCoutsChantier(ch, emp, LOC, CFG, devis, []),
      etat: calculerEtatChantier(ch, emp, devis, CFG, []),
    };
  };

  it.fails('materielReel négatif → coûts identiques entre moteurs (ÉCHOUE : 0 vs -5000)', () => {
    const { couts, etat } = runDeux({ materielReel: -5000 });
    expect(couts.totalCoutsReel).toBe(etat.coutTotalReel); // 0 (clampé) vs -5000 → diffère
  });

  it.fails('sousTraitanceReelle négative → coûts identiques entre moteurs (ÉCHOUE)', () => {
    const { couts, etat } = runDeux({ sousTraitanceReelle: -3000 });
    expect(couts.totalCoutsReel).toBe(etat.coutTotalReel);
  });

  it.fails('autresCoutsReels négatifs → coûts identiques entre moteurs (ÉCHOUE)', () => {
    const { couts, etat } = runDeux({ autresCoutsReels: -2000 });
    expect(couts.totalCoutsReel).toBe(etat.coutTotalReel);
  });

  // PREUVE explicite de l'asymétrie (ce test-là est VERT — il documente le comportement observé).
  it('DOCUMENTE l\'asymétrie : Couts clampe le négatif à 0, Etat le conserve', () => {
    const { couts, etat } = runDeux({ materielReel: -5000 });
    expect(couts.coutMaterielReel).toBe(0);        // clampé
    expect(etat.coutMateriel).toBe(-5000);          // conservé → source de la divergence
  });
});

describe('🔴 CASSE — nombreJours NÉGATIF : avancement non borné dans calculerEtatChantier', () => {
  // Scénario : nombreJours = -10 (import corrompu / typo). calculerEtatChantier calcule
  // avancement = jours/(-10)*100 sans Math.max(0,…) → avancement NÉGATIF (ex. -50%), hors [0,100].
  // calculerCoutsChantier, lui, retourne 0 (garde nbJours>0). → divergence + valeur absurde.
  const emp = [{ id: 1, nom: 'A', tarifJour: 400, tarifDejaCharge: true }];
  const devis = [{ id: 'd1', montantHT: 100000, statut: 'accepté' }];
  const ch = { id: 'C1', statut: 'en cours', nombreJours: -10, devisId: 'd1',
    journal: [{ date: '2025-06-02', employes: [{ employeId: 1, heuresTravaillees: 8 }] }] };
  const pts = migrerJournalVersPointages([ch], emp);

  it.fails('avancement borné à [0,100] même si nombreJours < 0 (ÉCHOUE : avancement négatif)', () => {
    const etat = calculerEtatChantier(ch, emp, devis, CFG, pts);
    expect(etat.avancementPct).toBeGreaterThanOrEqual(0);
  });

  it.fails('les deux moteurs donnent le même avancement même si nombreJours < 0 (ÉCHOUE)', () => {
    const couts = calculerCoutsChantier(ch, emp, LOC, CFG, devis, pts);
    const etat = calculerEtatChantier(ch, emp, devis, CFG, pts);
    expect(couts.avancementPct).toBe(etat.avancementPct);
  });
});
