/**
 * Preuve du module PÉRIODE (lot 0 — fondation money-critical).
 *
 * On prouve, avec une date de référence INJECTÉE (déterministe) :
 *  1. Bornes locales : semaine lun→DIM (dimanche inclus), dernier jour du mois non amputé
 *     (pas de bug UTC), semaine à cheval sur 2 mois, année bissextile.
 *  2. INVARIANT D'EMBOÎTEMENT — Σ(12 mois) == année, sans trou ni double-comptage, pour le CA
 *     facturé ET pour les coûts (MO datée + forfaitaire au prorata).
 *  3. CROSS-CHECK — coutMODansPeriode (année couvrant tous les pointages) == coutEquipeReel du
 *     VRAI moteur calculerCoutsChantier (aucune divergence de formule).
 *  4. CA facturé (TTC, dateEmission, factures) ≠ CA signé devis (HT, date, devis acceptés).
 *  5. Forfaitaire : prorata linéaire correct ; rattachement au mois de la 1ʳᵉ facture si sans date.
 */
import { describe, it, expect } from 'vitest';
import {
  bornesPeriode, estDansPeriode, periodeLabel,
  caFactureDansPeriode, caPayeDansPeriode, caFactureParChantier, caSigneDevisDansPeriode,
  caFactureHTDansPeriode, caFactureHTParChantier, indicateursMargeChantier,
  heuresDansPeriode, coutMODansPeriode, coutForfaitaireDansPeriode, coutChantierDansPeriode,
  chantierSansDate, forfaitNonDatable,
} from './periode';
import { calculerCoutsChantier } from '../donnees';

// Réf : mercredi 18 mars 2026 (semaine lun 16 → dim 22).
const REF = new Date(2026, 2, 18);
const refMois = (m) => new Date(2026, m, 15);      // un jour au milieu de chaque mois 2026
const refAnnee = new Date(2026, 5, 15);            // n'importe quel jour de 2026

// ── 1. Bornes ─────────────────────────────────────────────────────────────────
describe('bornesPeriode — chaînes locales, semaine lun→dimanche', () => {
  it('semaine = lundi → dimanche (dimanche INCLUS)', () => {
    expect(bornesPeriode('semaine', REF)).toEqual({ debutStr: '2026-03-16', finStr: '2026-03-22' });
  });
  it('mois = 1er → dernier jour calendaire', () => {
    expect(bornesPeriode('mois', REF)).toEqual({ debutStr: '2026-03-01', finStr: '2026-03-31' });
  });
  it('année = 1 jan → 31 déc', () => {
    expect(bornesPeriode('annee', REF)).toEqual({ debutStr: '2026-01-01', finStr: '2026-12-31' });
  });
  it('semaine à cheval sur 2 mois (réf 1er avril = mer)', () => {
    expect(bornesPeriode('semaine', new Date(2026, 3, 1))).toEqual({ debutStr: '2026-03-30', finStr: '2026-04-05' });
  });
  it('année bissextile : février 2028 finit le 29', () => {
    expect(bornesPeriode('mois', new Date(2028, 1, 15))).toEqual({ debutStr: '2028-02-01', finStr: '2028-02-29' });
  });
});

describe('estDansPeriode — inclusif, dimanche inclus, aucun décalage UTC', () => {
  it('inclut le lundi de début ET le dimanche de fin', () => {
    expect(estDansPeriode('2026-03-16', 'semaine', REF)).toBe(true); // lundi
    expect(estDansPeriode('2026-03-22', 'semaine', REF)).toBe(true); // DIMANCHE inclus
    expect(estDansPeriode('2026-03-23', 'semaine', REF)).toBe(false); // lundi suivant
    expect(estDansPeriode('2026-03-15', 'semaine', REF)).toBe(false); // dimanche précédent
  });
  it('n\'ampute PAS le dernier jour du mois (pas de bug fuseau)', () => {
    expect(estDansPeriode('2026-03-31', 'mois', REF)).toBe(true);
    expect(estDansPeriode('2026-03-01', 'mois', REF)).toBe(true);
    expect(estDansPeriode('2026-04-01', 'mois', REF)).toBe(false);
  });
  it('inclut le 31 décembre dans l\'année (pas de perte UTC)', () => {
    expect(estDansPeriode('2026-12-31', 'annee', REF)).toBe(true);
    expect(estDansPeriode('2025-12-31', 'annee', REF)).toBe(false);
  });
  it('ignore une éventuelle partie heure et gère l\'entrée vide', () => {
    expect(estDansPeriode('2026-03-31T23:59:00', 'mois', REF)).toBe(true);
    expect(estDansPeriode(null, 'mois', REF)).toBe(false);
    expect(estDansPeriode('', 'annee', REF)).toBe(false);
  });
});

describe('periodeLabel — cohérent avec les bornes', () => {
  it('semaine affiche jusqu\'au dimanche', () => {
    expect(periodeLabel('semaine', REF)).toBe('Semaine du 16/03 au 22/03');
  });
  it('mois et année', () => {
    expect(periodeLabel('mois', REF)).toBe('mars 2026');
    expect(periodeLabel('annee', REF)).toBe('Année 2026');
  });
});

// ── 2. CA facturé + invariant d'emboîtement ──────────────────────────────────
const FACTURES = [
  { id: 'F1', chantierId: 'C1', dateEmission: '2026-01-10', montantTTC: 10000, statut: 'payee' },
  { id: 'F2', chantierId: 'C1', dateEmission: '2026-03-31', montantTTC: 5000, statut: 'envoyee' }, // dernier jour du mois
  { id: 'F3', chantierId: 'C2', dateEmission: '2026-07-20', montantTTC: 8000, statut: 'partielle' },
  { id: 'F4', chantierId: 'C2', dateEmission: '2026-11-05', montantTTC: 3000, statut: 'payee' },
  { id: 'F5', chantierId: 'C1', dateEmission: '2026-03-15', montantTTC: 999, statut: 'brouillon' }, // EXCLU
  { id: 'F6', chantierId: 'C2', dateEmission: '2026-06-01', montantTTC: 999, statut: 'annulee' },   // EXCLU
];
const CA_TOTAL_2026 = 10000 + 5000 + 8000 + 3000; // 26000, hors brouillon/annulée

describe('caFactureDansPeriode — base TTC, exclut brouillon/annulée', () => {
  it('année = somme des factures comptables', () => {
    expect(caFactureDansPeriode(FACTURES, 'annee', refAnnee)).toBe(CA_TOTAL_2026);
  });
  it('le brouillon et l\'annulée ne comptent jamais', () => {
    // mars contient F2 (5000) et F5 (brouillon 999) → seul F2 compte
    expect(caFactureDansPeriode(FACTURES, 'mois', refMois(2))).toBe(5000);
    // juin contient F6 (annulée) → 0
    expect(caFactureDansPeriode(FACTURES, 'mois', refMois(5))).toBe(0);
  });
  it('INVARIANT : Σ(12 mois) == année (aucun trou, aucun double-comptage)', () => {
    const sommeMois = Array.from({ length: 12 }, (_, m) => caFactureDansPeriode(FACTURES, 'mois', refMois(m)))
      .reduce((a, b) => a + b, 0);
    expect(sommeMois).toBe(caFactureDansPeriode(FACTURES, 'annee', refAnnee));
    expect(sommeMois).toBe(CA_TOTAL_2026);
  });
  it('par chantier : facturé C1 en année = F1 + F2', () => {
    expect(caFactureParChantier(FACTURES, 'C1', 'annee', refAnnee)).toBe(15000);
  });
});

// ── Payé (encaissé) par période (Finances) — base TTC, rattaché à dateEmission ────────────────
const FACT_PAYE = [
  { id: 'P1', dateEmission: '2026-01-10', montantTTC: 10000, montantPaye: 10000, statut: 'payee' },   // janvier : payé plein
  { id: 'P2', dateEmission: '2026-03-31', montantTTC: 5000,  montantPaye: 2000,  statut: 'partielle' }, // mars : payé partiel
  { id: 'P3', dateEmission: '2026-07-20', montantTTC: 8000,  montantPaye: 0,     statut: 'envoyee' },   // juillet : rien payé
  { id: 'P4', dateEmission: '2026-11-05', montantTTC: 3000,  montantPaye: 9999,  statut: 'payee' },     // novembre : payé > TTC → plafonné à 3000
  { id: 'P5', dateEmission: '2026-03-15', montantTTC: 999,   montantPaye: 999,   statut: 'brouillon' }, // EXCLU
];
const PAYE_TOTAL_2026 = 10000 + 2000 + 0 + 3000; // 15000 (P4 plafonné, brouillon exclu)

describe('caPayeDansPeriode — encaissé TTC plafonné, rattaché à dateEmission, emboîté', () => {
  it('année = Σ min(payé, TTC) des factures comptables', () => {
    expect(caPayeDansPeriode(FACT_PAYE, 'annee', refAnnee)).toBe(PAYE_TOTAL_2026);
  });
  it('plafonne le payé au TTC (P4 : payé 9999 sur TTC 3000 → 3000) et exclut le brouillon', () => {
    expect(caPayeDansPeriode(FACT_PAYE, 'mois', refMois(10))).toBe(3000); // novembre P4 plafonné
    expect(caPayeDansPeriode(FACT_PAYE, 'mois', refMois(2))).toBe(2000);  // mars P2 partiel (P5 brouillon exclu)
  });
  it('INVARIANT : Σ(12 mois) == année', () => {
    const sommeMois = Array.from({ length: 12 }, (_, m) => caPayeDansPeriode(FACT_PAYE, 'mois', refMois(m)))
      .reduce((a, b) => a + b, 0);
    expect(sommeMois).toBe(caPayeDansPeriode(FACT_PAYE, 'annee', refAnnee));
    expect(sommeMois).toBe(PAYE_TOTAL_2026);
  });
  it('le payé ne dépasse jamais le facturé sur la même période', () => {
    for (let m = 0; m < 12; m++) {
      expect(caPayeDansPeriode(FACT_PAYE, 'mois', refMois(m)))
        .toBeLessThanOrEqual(caFactureDansPeriode(FACT_PAYE, 'mois', refMois(m)));
    }
  });
});

// ── 4. CA facturé ≠ CA signé devis ───────────────────────────────────────────
const DEVIS = [
  { id: 1, date: '2026-01-15', statut: 'accepté', montantHT: 40000, avenants: [], heuresRegie: [] },
  { id: 2, date: '2026-04-01', statut: 'envoyé', montantHT: 20000, avenants: [], heuresRegie: [] }, // EXCLU (pas accepté)
  { id: 3, date: '2026-09-10', statut: 'accepté', montantHT: 30000, avenants: [], heuresRegie: [] },
];

describe('CA facturé vs CA signé devis — deux indicateurs DISTINCTS', () => {
  it('CA signé = Σ HT des devis ACCEPTÉS (base HT, champ date, statut accepté)', () => {
    expect(caSigneDevisDansPeriode(DEVIS, 'annee', refAnnee)).toBe(70000); // 40000 + 30000, pas le 20000 envoyé
  });
  it('les deux diffèrent sur le même horizon (TTC/factures vs HT/devis)', () => {
    const facture = caFactureDansPeriode(FACTURES, 'annee', refAnnee); // 26000 TTC
    const signe = caSigneDevisDansPeriode(DEVIS, 'annee', refAnnee);   // 70000 HT
    expect(facture).not.toBe(signe);
  });
  it('CA signé emboîté aussi : Σ(12 mois) == année', () => {
    const sommeMois = Array.from({ length: 12 }, (_, m) => caSigneDevisDansPeriode(DEVIS, 'mois', refMois(m)))
      .reduce((a, b) => a + b, 0);
    expect(sommeMois).toBe(70000);
  });
});

// ── 3. Coût MO daté + invariant + CROSS-CHECK moteur ─────────────────────────
const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: false };
const CFG = { coefficientMainOeuvre: 1.35 };            // tarif effectif = 400 × 1.35 = 540 /jour
const CH_MO = { id: 'C1' };
// 4 lundis isolés (une semaine chacun → pas de majoration >45h ; jours ouvrés → pas de majoration week-end)
const P = (date) => ({ id: 'ptg_' + date, date, employeId: 1, repartitions: [{ chantierId: 'C1', categorie: 'production', heures: 8 }] });
const POINTAGES = [P('2026-02-16'), P('2026-05-18'), P('2026-08-17'), P('2026-11-16')]; // 4 × 8h = 4 jours × 540 = 2160

describe('coutMODansPeriode — exact, emboîté, aligné sur le vrai moteur', () => {
  it('année = Σ (heures/8 × tarif chargé)', () => {
    expect(coutMODansPeriode(CH_MO, [EMP], CFG, POINTAGES, 'annee', refAnnee)).toBeCloseTo(2160, 6);
  });
  it('INVARIANT : Σ(12 mois) == année', () => {
    const sommeMois = Array.from({ length: 12 }, (_, m) => coutMODansPeriode(CH_MO, [EMP], CFG, POINTAGES, 'mois', refMois(m)))
      .reduce((a, b) => a + b, 0);
    expect(sommeMois).toBeCloseTo(2160, 6);
  });
  it('CROSS-CHECK : == coutEquipeReel de calculerCoutsChantier (mêmes pointages, pas de majoration)', () => {
    const etat = calculerCoutsChantier(CH_MO, [EMP], [], CFG, [], POINTAGES);
    expect(coutMODansPeriode(CH_MO, [EMP], CFG, POINTAGES, 'annee', refAnnee)).toBeCloseTo(etat.coutEquipeReel, 6);
  });
  it('tarifDejaCharge=true → PAS de coefficient appliqué', () => {
    const empCharge = { id: 1, tarifJour: 500, tarifDejaCharge: true };
    // 1 pointage de 8h → 1 jour × 500 = 500 (coefficient ignoré)
    expect(coutMODansPeriode(CH_MO, [empCharge], CFG, [P('2026-02-16')], 'annee', refAnnee)).toBeCloseTo(500, 6);
  });
});

// ── 5. Forfaitaire — prorata + fallback sans date ────────────────────────────
describe('coutForfaitaireDansPeriode — prorata linéaire, emboîté', () => {
  const CH_FORFAIT = { id: 'CF', dateDebut: '2026-03-02', nombreJours: 5, inclusSamedi: false, canton: 'GE', materielReel: 10000 };
  it('chantier court entièrement dans mars → 100 % en mars', () => {
    expect(coutForfaitaireDansPeriode(CH_FORFAIT, [], 'mois', refMois(2))).toBeCloseTo(10000, 6);
  });
  it('INVARIANT : Σ(12 mois) == forfait total (le prorata partitionne l\'année)', () => {
    const long = { id: 'CL', dateDebut: '2026-02-02', nombreJours: 60, inclusSamedi: false, canton: 'GE', materielReel: 12000 };
    const sommeMois = Array.from({ length: 12 }, (_, m) => coutForfaitaireDansPeriode(long, [], 'mois', refMois(m)))
      .reduce((a, b) => a + b, 0);
    expect(sommeMois).toBeCloseTo(12000, 4);
  });
  it('mois hors de la durée du chantier → 0', () => {
    expect(coutForfaitaireDansPeriode(CH_FORFAIT, [], 'mois', refMois(11))).toBe(0); // décembre
  });

  const CH_SANS_DATE = { id: 'CN', materielReel: 7000 }; // pas de dateDebut
  const FACT_CN = [{ id: 'x', chantierId: 'CN', dateEmission: '2026-05-10', montantTTC: 1, statut: 'envoyee' }];
  it('sans dateDebut : forfait rattaché au mois de la 1ʳᵉ facture', () => {
    expect(coutForfaitaireDansPeriode(CH_SANS_DATE, FACT_CN, 'mois', refMois(4))).toBeCloseTo(7000, 6); // mai
    expect(coutForfaitaireDansPeriode(CH_SANS_DATE, FACT_CN, 'mois', refMois(2))).toBe(0);               // mars
    const sommeMois = Array.from({ length: 12 }, (_, m) => coutForfaitaireDansPeriode(CH_SANS_DATE, FACT_CN, 'mois', refMois(m)))
      .reduce((a, b) => a + b, 0);
    expect(sommeMois).toBeCloseTo(7000, 6); // tout tombe une seule fois
  });
});

// ── Défauts corrigés (vérification adversariale) — non-régression ────────────
describe('coutForfaitaireDansPeriode — cas de bordure money-critical (jamais d\'évaporation silencieuse)', () => {
  it('#3 : champ neuf vidé ("") → bascule sur le legacy (comme le vrai moteur), forfait NON perdu', () => {
    const ch = { id: 'C3', dateDebut: '2026-03-02', nombreJours: 5, canton: 'GE', materielReel: '', coutMaterielReel: '8000' };
    expect(coutForfaitaireDansPeriode(ch, [], 'mois', refMois(2))).toBeCloseTo(8000, 6);
  });
  it('#2a : dateDebut présent mais nombreJours manquant → ancré au mois de dateDebut (Σ==forfait), pas 0 partout', () => {
    const ch = { id: 'CX', dateDebut: '2026-03-02', materielReel: 10000 }; // pas de nombreJours → durée incalculable
    expect(coutForfaitaireDansPeriode(ch, [], 'mois', refMois(2))).toBeCloseTo(10000, 6); // mars (mois de dateDebut)
    expect(coutForfaitaireDansPeriode(ch, [], 'mois', refMois(5))).toBe(0);                // juin
    const somme = Array.from({ length: 12 }, (_, m) => coutForfaitaireDansPeriode(ch, [], 'mois', refMois(m)))
      .reduce((a, b) => a + b, 0);
    expect(somme).toBeCloseTo(10000, 6); // AUCUNE évaporation
    expect(forfaitNonDatable(ch, [])).toBe(0); // ancré → pas orphelin
  });
  it('#2a bis : nombreJours=0 ou négatif → même ancrage au mois de dateDebut', () => {
    expect(coutForfaitaireDansPeriode({ id: 'CZ', dateDebut: '2026-03-02', nombreJours: 0, materielReel: 4000 }, [], 'mois', refMois(2))).toBeCloseTo(4000, 6);
    expect(coutForfaitaireDansPeriode({ id: 'CN', dateDebut: '2026-03-02', nombreJours: -3, materielReel: 4000 }, [], 'mois', refMois(2))).toBeCloseTo(4000, 6);
  });
  it('cas 4 : ni dateDebut ni facture → 0 partout MAIS forfaitNonDatable le surface (pas de perte silencieuse)', () => {
    const ch = { id: 'CO', materielReel: 5000 };
    expect(coutForfaitaireDansPeriode(ch, [], 'annee', refAnnee)).toBe(0);
    expect(forfaitNonDatable(ch, [])).toBeCloseTo(5000, 6); // surfacé
    // dès qu'une facture existe, le forfait est ancré et n'est plus orphelin
    const fact = [{ id: 'f', chantierId: 'CO', dateEmission: '2026-05-10', montantTTC: 1, statut: 'envoyee' }];
    expect(forfaitNonDatable(ch, fact)).toBe(0);
    expect(coutForfaitaireDansPeriode(ch, fact, 'mois', refMois(4))).toBeCloseTo(5000, 6);
  });
});

describe('coutChantierDansPeriode & heuresDansPeriode & chantierSansDate', () => {
  it('coutChantier = MO datée + forfaitaire', () => {
    const ch = { id: 'C1', dateDebut: '2026-02-02', nombreJours: 300, inclusSamedi: false, canton: 'GE', materielReel: 0 };
    const cout = coutChantierDansPeriode(ch, [EMP], CFG, POINTAGES, [], 'annee', refAnnee);
    expect(cout).toBeCloseTo(2160, 6); // materielReel 0 → seulement MO
  });
  it('heuresDansPeriode filtre par date et par catégorie productive', () => {
    const pts = [
      { date: '2026-03-16', employeId: 1, repartitions: [{ chantierId: 'C1', categorie: 'production', heures: 8 }] },
      { date: '2026-03-17', employeId: 1, repartitions: [{ chantierId: 'C1', categorie: 'deplacement', heures: 2 }] }, // exclu
      { date: '2026-06-01', employeId: 1, repartitions: [{ chantierId: 'C1', categorie: 'production', heures: 8 }] },   // hors semaine mars
    ];
    expect(heuresDansPeriode(pts, 'semaine', REF, 'C1')).toBe(8); // seule la journée production de la semaine
    expect(heuresDansPeriode(pts, 'annee', refAnnee, 'C1')).toBe(16); // 2 journées production, déplacement exclu
  });
  it('chantierSansDate identifie les chantiers sans dateDebut', () => {
    expect(chantierSansDate({ id: 'x' })).toBe(true);
    expect(chantierSansDate({ id: 'y', dateDebut: '2026-01-01' })).toBe(false);
  });
});

// ── Lot 4a — CA facturé base HT (pages de marge) ─────────────────────────────
// Factures avec montantHT explicite + une SANS montantHT (reconstitution ÷1.081).
const FACT_HT = [
  { id: 'H1', chantierId: 'C1', dateEmission: '2026-01-10', montantHT: 9000, montantTTC: 9729, statut: 'payee' },
  { id: 'H2', chantierId: 'C1', dateEmission: '2026-03-31', montantHT: 4000, montantTTC: 4324, statut: 'envoyee' },
  { id: 'H3', chantierId: 'C2', dateEmission: '2026-07-20', montantHT: 6000, montantTTC: 6486, statut: 'partielle' },
  { id: 'H4', chantierId: 'C2', dateEmission: '2026-11-05', montantTTC: 1081, statut: 'payee' },        // sans HT → 1000
  { id: 'H5', chantierId: 'C1', dateEmission: '2026-03-15', montantHT: 999, statut: 'brouillon' },      // EXCLU
  { id: 'H6', chantierId: 'C2', dateEmission: '2026-06-01', montantHT: 999, statut: 'annulee' },        // EXCLU
];
const CA_HT_TOTAL = 9000 + 4000 + 6000 + 1000; // 20000, hors brouillon/annulée

describe('caFactureHTDansPeriode — base HT, montantHT direct ou reconstitué ÷1.081', () => {
  it('année = Σ HT des factures comptables (F4 reconstituée 1081÷1.081 = 1000)', () => {
    expect(caFactureHTDansPeriode(FACT_HT, 'annee', refAnnee)).toBeCloseTo(CA_HT_TOTAL, 4);
  });
  it('exclut brouillon + annulée', () => {
    // mars = H2 (4000) + H5 (brouillon 999) → seul H2
    expect(caFactureHTDansPeriode(FACT_HT, 'mois', refMois(2))).toBeCloseTo(4000, 6);
    // juin = H6 (annulée) → 0
    expect(caFactureHTDansPeriode(FACT_HT, 'mois', refMois(5))).toBe(0);
  });
  it('INVARIANT d\'emboîtement : Σ(12 mois) == année', () => {
    const sommeMois = Array.from({ length: 12 }, (_, m) => caFactureHTDansPeriode(FACT_HT, 'mois', refMois(m)))
      .reduce((a, b) => a + b, 0);
    expect(sommeMois).toBeCloseTo(caFactureHTDansPeriode(FACT_HT, 'annee', refAnnee), 4);
    expect(sommeMois).toBeCloseTo(CA_HT_TOTAL, 4);
  });
  it('HT ≠ TTC (le même horizon donne des bases différentes)', () => {
    expect(caFactureHTDansPeriode(FACT_HT, 'annee', refAnnee))
      .not.toBe(caFactureDansPeriode(FACT_HT, 'annee', refAnnee));
  });
  it('par chantier : HT facturé C1 en année = H1 + H2', () => {
    expect(caFactureHTParChantier(FACT_HT, 'C1', 'annee', refAnnee)).toBeCloseTo(13000, 6);
  });
});

// ── Lot 4a — helper partagé indicateursMargeChantier ─────────────────────────
describe('indicateursMargeChantier — CA facturé HT vs coûts, à-facturer, actif', () => {
  const cfgHT = { coefficientMainOeuvre: 1 };
  const empHT = { id: 1, tarifJour: 400, tarifDejaCharge: true }; // 1 jour = 400
  // Chantier facturé + coûts : 2 jours MO = 800 de coûts, facturé 13000 HT → marge positive.
  const chFacture = { id: 'C1' };
  const ptsC1 = [
    { date: '2026-01-12', employeId: 1, repartitions: [{ chantierId: 'C1', categorie: 'production', heures: 8 }] },
    { date: '2026-03-16', employeId: 1, repartitions: [{ chantierId: 'C1', categorie: 'production', heures: 8 }] },
  ];

  it('chantier facturé : caHT>0 → marge et margePct calculées', () => {
    const ind = indicateursMargeChantier(chFacture, [empHT], cfgHT, ptsC1, FACT_HT, 'annee', refAnnee);
    expect(ind.caHT).toBeCloseTo(13000, 6);   // H1 + H2
    expect(ind.couts).toBeCloseTo(800, 6);     // 2 jours × 400
    expect(ind.marge).toBeCloseTo(12200, 6);
    expect(ind.margePct).toBeCloseTo((12200 / 13000) * 100, 6);
    expect(ind.aFacturer).toBe(0);             // facturé > coûts
    expect(ind.actif).toBe(true);
  });

  it('chantier AVEC coûts mais SANS facture : CA=0, marge null (pas -100 %), à-facturer = coûts', () => {
    // Chantier "Tech Park" : des heures pointées, aucune facture émise.
    const chSansFacture = { id: 'CTP' };
    const ptsTP = [
      { date: '2026-05-18', employeId: 1, repartitions: [{ chantierId: 'CTP', categorie: 'production', heures: 8 }] },
    ];
    const ind = indicateursMargeChantier(chSansFacture, [empHT], cfgHT, ptsTP, FACT_HT, 'annee', refAnnee);
    expect(ind.caHT).toBe(0);
    expect(ind.marge).toBeNull();       // AUCUNE marge trompeuse
    expect(ind.margePct).toBeNull();    // pas de -100 %
    expect(ind.aFacturer).toBeCloseTo(400, 6); // 1 jour de coûts non facturé
    expect(ind.actif).toBe(true);       // reste visible (coûts engagés)
  });

  it('chantier sans facture NI coût sur la période → actif=false (exclu du tableau)', () => {
    const ind = indicateursMargeChantier({ id: 'VIDE' }, [empHT], cfgHT, [], [], 'annee', refAnnee);
    expect(ind.caHT).toBe(0);
    expect(ind.couts).toBe(0);
    expect(ind.marge).toBeNull();
    expect(ind.aFacturer).toBe(0);
    expect(ind.actif).toBe(false);
  });

  it('INVARIANT : Σ(caHT des 12 mois) == caHT de l\'année (le helper hérite de l\'emboîtement)', () => {
    const sommeMois = Array.from({ length: 12 }, (_, m) =>
      indicateursMargeChantier(chFacture, [empHT], cfgHT, ptsC1, FACT_HT, 'mois', refMois(m)).caHT)
      .reduce((a, b) => a + b, 0);
    expect(sommeMois).toBeCloseTo(indicateursMargeChantier(chFacture, [empHT], cfgHT, ptsC1, FACT_HT, 'annee', refAnnee).caHT, 4);
  });
});
