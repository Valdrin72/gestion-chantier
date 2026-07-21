/**
 * MATRICE FACTURATION — chasse à la casse (pas confirmation de succès).
 *
 * Exerce les VRAIES fonctions exportées de src/donnees.js :
 *   creerFactureDepuisDevis, calculerCA, calculerCAForfait,
 *   calculerStatutFacture, genererNumeroFacture.
 *
 * INVARIANT CENTRAL : Total TTC d'un document = HT × (1 + taux/100),
 * jamais recalculé depuis un autre taux. Pour les factures multi-lignes, le
 * TTC total doit sommer ligne par ligne (chaque ligne à SON taux).
 *
 * Les tests PEUVENT être rouges : c'est le but. Chaque nom décrit le scénario
 * métier + attendu vs obtenu. Aucun code de prod n'est modifié.
 */
import { describe, it, expect } from 'vitest';
import {
  creerFactureDepuisDevis,
  calculerCA,
  calculerCAForfait,
  calculerStatutFacture,
  genererNumeroFacture,
} from '../donnees';

// ── Helpers de garde ────────────────────────────────────────────────
const estFini = (n) => typeof n === 'number' && Number.isFinite(n);
const ttcAttendu = (ht, taux) => ht * (1 + taux / 100);

// ════════════════════════════════════════════════════════════════════
// 1. INVARIANT TTC = HT × (1 + taux/100) — creerFactureDepuisDevis
// ════════════════════════════════════════════════════════════════════
describe('Invariant TTC = HT × (1 + taux/100)', () => {
  it('TVA 8.1% sur devis simple 10000 → TTC = 10810.00', () => {
    const devis = { id: 'd1', numero: 'D-2026-001', clientId: 'c1', montantHT: 10000 };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    expect(f.montantHT).toBeCloseTo(10000, 2);
    expect(f.montantTTC).toBeCloseTo(ttcAttendu(10000, 8.1), 2); // 10810
    expect(f.montantTTC).toBeCloseTo(f.montantHT + f.montantTVA, 2);
  });

  it('TVA 7.7% (ancien taux) sur 10000 → TTC = 10770.00', () => {
    const devis = { id: 'd2', numero: 'D-2026-002', clientId: 'c1', montantHT: 10000 };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 7.7);
    expect(f.montantTTC).toBeCloseTo(ttcAttendu(10000, 7.7), 2); // 10770
  });

  it('TVA 0% → TTC = HT (pas de TVA fantôme)', () => {
    const devis = { id: 'd3', numero: 'D-2026-003', clientId: 'c1', montantHT: 5000 };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 0);
    expect(f.montantTVA).toBeCloseTo(0, 2);
    expect(f.montantTTC).toBeCloseTo(5000, 2);
  });

  it('Lignes à taux différents : TTC total = somme(ligne_HT × (1+taux_ligne/100))', () => {
    // 8.1% sur 1000 + 7.7% sur 2000 + 0% sur 500
    const devis = {
      id: 'd4', numero: 'D-2026-004', clientId: 'c1',
      lignes: [
        { description: 'A', quantite: 1, prixUnitaire: 1000, tva: 8.1 },
        { description: 'B', quantite: 1, prixUnitaire: 2000, tva: 7.7 },
        { description: 'C', quantite: 1, prixUnitaire: 500, tva: 0 },
      ],
    };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    const attendu = ttcAttendu(1000, 8.1) + ttcAttendu(2000, 7.7) + ttcAttendu(500, 0);
    expect(f.montantHT).toBeCloseTo(3500, 2);
    expect(f.montantTTC).toBeCloseTo(attendu, 2);
    // Le TTC NE doit PAS être HT_total × 1.081 (recalcul depuis un taux unique = BUG argent faux)
    expect(f.montantTTC).not.toBeCloseTo(ttcAttendu(3500, 8.1), 2);
  });

  it('Ligne avec quantité (heures régie) : HT = qte × PU, TTC cohérent', () => {
    const devis = {
      id: 'd5', numero: 'D-2026-005', clientId: 'c1',
      lignes: [{ description: 'Régie', quantite: 40, prixUnitaire: 95, tva: 8.1 }],
    };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    expect(f.montantHT).toBeCloseTo(3800, 2);
    expect(f.montantTTC).toBeCloseTo(ttcAttendu(3800, 8.1), 2);
  });
});

// ════════════════════════════════════════════════════════════════════
// 2. AVOIR / négatif / 0 / énorme / surpayé — robustesse numérique
// ════════════════════════════════════════════════════════════════════
describe('Montants extrêmes et avoirs', () => {
  it('Avoir (montant négatif) : TTC négatif cohérent, pas de NaN', () => {
    const devis = { id: 'a1', numero: 'AV-2026-001', clientId: 'c1', montantHT: -2500 };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    expect(estFini(f.montantHT)).toBe(true);
    expect(estFini(f.montantTTC)).toBe(true);
    expect(f.montantHT).toBeCloseTo(-2500, 2);
    expect(f.montantTTC).toBeCloseTo(ttcAttendu(-2500, 8.1), 2); // -2702.5
  });

  it('Montant 0 : facture à zéro, TTC = 0, aucun NaN', () => {
    const devis = { id: 'z1', numero: 'D-2026-Z', clientId: 'c1', montantHT: 0 };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    expect(f.montantHT).toBe(0);
    expect(f.montantTTC).toBeCloseTo(0, 2);
    expect(estFini(f.montantTTC)).toBe(true);
  });

  it('Montant énorme 99 999 999 : pas d’Infinity, précision préservée', () => {
    const devis = { id: 'big', numero: 'D-2026-BIG', clientId: 'c1', montantHT: 99_999_999 };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    expect(estFini(f.montantTTC)).toBe(true);
    expect(f.montantTTC).toBeCloseTo(ttcAttendu(99_999_999, 8.1), 0);
  });

  it('montantHT string "10000" (données legacy) → parsé, pas de concat', () => {
    const devis = { id: 's1', numero: 'D-2026-S', clientId: 'c1', montantHT: '10000' };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    expect(f.montantHT).toBeCloseTo(10000, 2);
    expect(f.montantTTC).toBeCloseTo(10810, 2);
  });
});

// ════════════════════════════════════════════════════════════════════
// 3. creerFactureDepuisDevis — cas dégénérés d'entrée
// ════════════════════════════════════════════════════════════════════
describe('creerFactureDepuisDevis — entrées dégénérées', () => {
  it('chantier null : chantierId vide, pas de crash', () => {
    const devis = { id: 'n1', numero: 'D-2026-N', clientId: 'c1', montantHT: 1000 };
    const f = creerFactureDepuisDevis(devis, null, [], 8.1);
    expect(f.chantierId).toBe('');
    expect(f.montantTTC).toBeCloseTo(1081, 2);
  });

  it('tva absente (défaut) : doit appliquer 8.1% par défaut', () => {
    const devis = { id: 'd6', numero: 'D-2026-006', clientId: 'c1', montantHT: 1000 };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, []); // pas de tva passée
    expect(f.montantTTC).toBeCloseTo(1081, 2);
  });

  it('devis sans montant ni lignes : facture 0, aucun NaN', () => {
    const devis = { id: 'd7', numero: 'D-2026-007', clientId: 'c1' };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    expect(estFini(f.montantHT)).toBe(true);
    expect(estFini(f.montantTTC)).toBe(true);
    expect(f.montantHT).toBe(0);
  });

  it('avenants + heuresRegie propagés dans les lignes de la facture', () => {
    const devis = {
      id: 'd8', numero: 'D-2026-008', clientId: 'c1', montantHT: 10000,
      avenants: [{ description: 'Avenant 1', montant: 2000 }],
      heuresRegie: [{ description: 'Régie', heures: 10, tarifHeure: 100 }],
    };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    // 10000 + 2000 + (10*100=1000) = 13000 HT
    expect(f.montantHT).toBeCloseTo(13000, 2);
    expect(f.montantTTC).toBeCloseTo(ttcAttendu(13000, 8.1), 2);
  });

  it('ligne avec tva undefined : fallback sur le taux facture, pas NaN', () => {
    const devis = {
      id: 'd9', numero: 'D-2026-009', clientId: 'c1',
      lignes: [{ description: 'X', quantite: 1, prixUnitaire: 1000 }], // tva manquante
    };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    expect(estFini(f.montantTTC)).toBe(true);
    expect(f.montantTTC).toBeCloseTo(1081, 2);
  });
});

// ════════════════════════════════════════════════════════════════════
// 4. calculerCA / calculerCAForfait — CA jamais faux
// ════════════════════════════════════════════════════════════════════
describe('calculerCA / calculerCAForfait', () => {
  const chantier = (extra = {}) => ({ id: 'ch1', devisId: 'd1', ...extra });

  it('CA forfait = montantHT du devis lié', () => {
    const devis = [{ id: 'd1', montantHT: 50000 }];
    expect(calculerCAForfait(chantier(), devis)).toBeCloseTo(50000, 2);
    expect(calculerCA(chantier(), devis)).toBeCloseTo(50000, 2);
  });

  it('Sans devis lié → null (pas 0, pour ne pas polluer les marges)', () => {
    expect(calculerCA({ id: 'ch1' }, [])).toBeNull();
    expect(calculerCAForfait({ id: 'ch1', devisId: 'x' }, [{ id: 'd1', montantHT: 1 }])).toBeNull();
  });

  it('Avenants devis ajoutés au CA', () => {
    const devis = [{ id: 'd1', montantHT: 50000, avenants: [{ montant: 5000 }] }];
    expect(calculerCA(chantier(), devis)).toBeCloseTo(55000, 2);
  });

  it('Extras régie du chantier ajoutés au CA total (pas au forfait)', () => {
    const devis = [{ id: 'd1', montantHT: 50000 }];
    const ch = chantier({ extras: [{ mode: 'regie', heures: 20, tarifHeure: 100 }] });
    expect(calculerCAForfait(ch, devis)).toBeCloseTo(50000, 2);
    expect(calculerCA(ch, devis)).toBeCloseTo(52000, 2); // +2000 régie
  });

  it('Devis montantHT négatif : CA négatif propagé sans NaN', () => {
    const devis = [{ id: 'd1', montantHT: -1000 }];
    const ca = calculerCA(chantier(), devis);
    expect(estFini(ca)).toBe(true);
    expect(ca).toBeCloseTo(-1000, 2);
  });

  it('Devis sans montantHT ni prixPropose : CA = 0 (pas NaN)', () => {
    const devis = [{ id: 'd1' }];
    const ca = calculerCA(chantier(), devis);
    expect(estFini(ca)).toBe(true);
    expect(ca).toBe(0);
  });

  it('Extra mode forfait : montantForfait ajouté', () => {
    const devis = [{ id: 'd1', montantHT: 10000 }];
    const ch = chantier({ extras: [{ mode: 'forfait', montantForfait: 3000 }] });
    expect(calculerCA(ch, devis)).toBeCloseTo(13000, 2);
  });
});

// ════════════════════════════════════════════════════════════════════
// 5. Plusieurs factures / même chantier — pas de double comptage
// ════════════════════════════════════════════════════════════════════
describe('Cohérence multi-factures vs CA (acompte + situation + solde)', () => {
  it('Somme HT des factures (acompte 30% + solde 70%) = CA du chantier', () => {
    const ca = 100000;
    const devis = [{ id: 'd1', montantHT: ca }];
    const chantier = { id: 'ch1', devisId: 'd1' };
    const acompte = creerFactureDepuisDevis(
      { id: 'd1', numero: 'D-2026-010', clientId: 'c1', montantHT: ca * 0.3 },
      chantier, [], 8.1,
    );
    const solde = creerFactureDepuisDevis(
      { id: 'd1', numero: 'D-2026-010', clientId: 'c1', montantHT: ca * 0.7 },
      chantier, [], 8.1,
    );
    const sommeHT = acompte.montantHT + solde.montantHT;
    expect(sommeHT).toBeCloseTo(calculerCA(chantier, devis), 2); // 100000
    const sommeTTC = acompte.montantTTC + solde.montantTTC;
    expect(sommeTTC).toBeCloseTo(ttcAttendu(ca, 8.1), 2); // 108100
  });
});

// ════════════════════════════════════════════════════════════════════
// 6. genererNumeroFacture — format, collisions, séquence
// ════════════════════════════════════════════════════════════════════
describe('genererNumeroFacture', () => {
  const annee = new Date().getFullYear();

  it('0 facture existante → F-<annee>-001', () => {
    expect(genererNumeroFacture([])).toBe(`F-${annee}-001`);
    expect(genererNumeroFacture(null)).toBe(`F-${annee}-001`);
  });

  it('Incrémente le max existant (pas le count) → évite les collisions', () => {
    const factures = [
      { numero: `F-${annee}-001` },
      { numero: `F-${annee}-005` }, // trou dans la séquence
    ];
    // Doit repartir de 006, pas de 003
    expect(genererNumeroFacture(factures)).toBe(`F-${annee}-006`);
  });

  it('Deux appels sans persistance → MÊME numéro (collision réelle si non ajouté à la liste)', () => {
    const factures = [{ numero: `F-${annee}-001` }];
    const n1 = genererNumeroFacture(factures);
    const n2 = genererNumeroFacture(factures); // liste inchangée
    // Documente le risque : sans append entre deux créations, collision garantie
    expect(n1).toBe(n2);
  });

  it('Numéros non standards ignorés (autre préfixe / autre année)', () => {
    const factures = [
      { numero: 'FACT/2020/99' },
      { numero: `F-${annee - 1}-050` },
      { numero: `F-${annee}-002` },
    ];
    expect(genererNumeroFacture(factures)).toBe(`F-${annee}-003`);
  });

  it('numero null/undefined dans la liste : pas de crash', () => {
    const factures = [{ numero: null }, {}, { numero: `F-${annee}-004` }];
    expect(genererNumeroFacture(factures)).toBe(`F-${annee}-005`);
  });

  it('Préfixe custom respecté', () => {
    expect(genererNumeroFacture([], 'AV')).toBe(`AV-${annee}-001`);
  });
});

// ════════════════════════════════════════════════════════════════════
// 7. calculerStatutFacture — surpayé, exact, retard, négatif
// ════════════════════════════════════════════════════════════════════
describe('calculerStatutFacture', () => {
  it('Payée exactement → "payee"', () => {
    expect(calculerStatutFacture({ montantTTC: 1000, montantPaye: 1000 })).toBe('payee');
  });

  it('Surpayée (montantPaye > montantTTC) → "payee" (pas d’état incohérent)', () => {
    const s = calculerStatutFacture({ montantTTC: 1000, montantPaye: 1500 });
    expect(s).toBe('payee');
  });

  it('Partielle → "partielle"', () => {
    expect(calculerStatutFacture({ montantTTC: 1000, montantPaye: 400 })).toBe('partielle');
  });

  it('montantPaye négatif (saisie erronée) : NE doit PAS être "payee"', () => {
    // Un paiement négatif ne solde rien. Attendu : envoyee/retard, jamais payee/partielle.
    const s = calculerStatutFacture({ montantTTC: 1000, montantPaye: -500, statut: 'envoyee' });
    expect(['payee', 'partielle']).not.toContain(s);
  });

  it('Échéance dépassée, rien payé → "retard"', () => {
    const s = calculerStatutFacture({
      montantTTC: 1000, montantPaye: 0,
      dateEcheance: '2020-01-01', statut: 'envoyee',
    });
    expect(s).toBe('retard');
  });

  it('Annulée : statut préservé même avec paiement', () => {
    expect(calculerStatutFacture({ statut: 'annulee', montantTTC: 1000, montantPaye: 1000 })).toBe('annulee');
  });

  it('Brouillon préservé', () => {
    expect(calculerStatutFacture({ statut: 'brouillon', montantTTC: 1000 })).toBe('brouillon');
  });

  it('Montant TTC 0 et payé 0 : ne doit pas être "payee" par accident', () => {
    // total>0 requis pour "payee" ; ici total=0 → doit rester envoyee/défaut, PAS payee.
    const s = calculerStatutFacture({ montantTTC: 0, montantPaye: 0, statut: 'envoyee' });
    expect(s).not.toBe('payee');
  });

  it('paiementsHistorique cumulé pris en compte', () => {
    const s = calculerStatutFacture({
      montantTTC: 1000,
      paiementsHistorique: [{ montant: 600 }, { montant: 400 }],
    });
    expect(s).toBe('payee');
  });

  it('montantTTC string legacy : parsé correctement', () => {
    const s = calculerStatutFacture({ montantTTC: '1000', montantPaye: '1000' });
    expect(s).toBe('payee');
  });

  it('Aucun résultat NaN/undefined : statut toujours une string non vide', () => {
    const cas = [
      {}, { montantTTC: NaN }, { montantPaye: NaN, montantTTC: 100 },
      { montantTTC: Infinity }, { dateEcheance: 'pas-une-date' },
    ];
    for (const c of cas) {
      const s = calculerStatutFacture(c);
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// 7bis. SONDES CIBLÉES — chemins où l'argent peut être faux
// ════════════════════════════════════════════════════════════════════
describe('SONDES — bugs argent suspectés', () => {
  it.fails('🔴 BUG CONFIRMÉ: avenant devis NÉGATIF (avoir) ignoré par calculerCAForfait → CA surévalué', () => {
    // devis.avenants = -1000 (un avoir/moins-value négocié).
    // Le garde `avenantDevis > 0 ? avenantDevis : sommeAvenants(chantier)`
    // fait que -1000 n'est PAS > 0 → fallback sur chantier.avenants (=0) →
    // l'avoir de -1000 disparaît du CA. CA attendu 49000, mais calculé 50000.
    const chantier = { id: 'ch1', devisId: 'd1' };
    const devis = [{ id: 'd1', montantHT: 50000, avenants: [{ montant: -1000 }] }];
    expect(calculerCAForfait(chantier, devis)).toBeCloseTo(49000, 2);
  });

  it('BUG SUSPECT: devis.avenants=0 mais chantier.avenants renseigné → fallback legacy peut sur-compter', () => {
    // devis.avenants somme = 0 → fallback sur chantier.avenants (5000).
    // Si dans la vraie vie l'avenant est déjà dans le devis à 0 volontairement,
    // le chantier.avenants legacy réinjecte 5000 → CA = 55000.
    const chantier = { id: 'ch1', devisId: 'd1', avenants: [{ montant: 5000 }] };
    const devis = [{ id: 'd1', montantHT: 50000, avenants: [] }];
    // On documente le comportement réel (fallback legacy actif) :
    expect(calculerCAForfait(chantier, devis)).toBeCloseTo(55000, 2);
  });

  it.fails('🔴 BUG CONFIRMÉ: devis avec lignes ET avenants → avenants ignorés dans la facture → sous-facturation', () => {
    // Si devis.lignes existe, creerFactureDepuisDevis ne prend QUE les lignes.
    // Un avenant présent mais non intégré aux lignes → facturé en moins.
    const devis = {
      id: 'x', numero: 'D-2026-X', clientId: 'c1',
      lignes: [{ description: 'Base', quantite: 1, prixUnitaire: 10000, tva: 8.1 }],
      avenants: [{ description: 'Avenant', montant: 2000 }],
    };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    // Attendu métier : l'avenant devrait être facturé → 12000 HT.
    expect(f.montantHT).toBeCloseTo(12000, 2);
  });

  it('BUG SUSPECT: genererNumeroFacture avec suffixe non numérique casse la séquence', () => {
    const annee = new Date().getFullYear();
    // parseInt("010-bis") = 10 → prochain 011, OK ; mais "abc" → NaN||0 = 0.
    const factures = [{ numero: `F-${annee}-abc` }];
    // Attendu métier : ignorer le numéro non conforme → repartir de 001.
    // Réel : slice("abc") → parseInt NaN → 0 → max 0 → seq 1. Ici ça marche,
    // mais on vérifie qu'aucun numéro dupliqué avec un vrai 001 existant.
    const factures2 = [{ numero: `F-${annee}-001` }, { numero: `F-${annee}-xyz` }];
    expect(genererNumeroFacture(factures2)).toBe(`F-${annee}-002`);
  });

  it('BUG SUSPECT: TVA passée en string "8.1" au lieu de number', () => {
    const devis = { id: 't', numero: 'D-2026-T', clientId: 'c1', montantHT: 1000 };
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], '8.1');
    // parseFloat sur la string au calcul → devrait donner 1081.
    expect(f.montantTTC).toBeCloseTo(1081, 2);
  });
});

// ════════════════════════════════════════════════════════════════════
// 8. Garde globale anti-NaN sur creerFactureDepuisDevis
// ════════════════════════════════════════════════════════════════════
describe('Aucun NaN/Infinity dans une facture générée', () => {
  const devisVaries = [
    { id: 'v1', numero: 'D1', montantHT: 1000 },
    { id: 'v2', numero: 'D2', montantHT: '2000' },
    { id: 'v3', numero: 'D3' },
    { id: 'v4', numero: 'D4', montantHT: -300 },
    { id: 'v5', numero: 'D5', lignes: [{ quantite: 2, prixUnitaire: 50, tva: 7.7 }] },
    { id: 'v6', numero: 'D6', lignes: [{ quantite: 'x', prixUnitaire: 'y', tva: 'z' }] },
  ];
  it.each(devisVaries)('devis $numero : montants finis', (devis) => {
    const f = creerFactureDepuisDevis(devis, { id: 'ch1' }, [], 8.1);
    for (const k of ['montantHT', 'montantTVA', 'montantTTC']) {
      expect(estFini(f[k]), `${k}=${f[k]}`).toBe(true);
    }
    expect(f.montantTTC).toBeCloseTo(f.montantHT + f.montantTVA, 2);
  });
});
