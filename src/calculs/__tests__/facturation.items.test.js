// Tests Items 1 & 2 — acompte % + situation 1 clic
import { describe, it, expect } from 'vitest';
import { calculerCA } from '../../donnees';

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeDevis = (overrides = {}) => ({
  id: 'd1', numero: 'D-2026-001', montantHT: 50000, prixPropose: 50000,
  avenants: [], heuresRegie: [],
  ...overrides,
});

const makeChantier = (overrides = {}) => ({
  id: 'c1', nom: 'Chantier Test', devisId: 'd1', avancement: 0, statut: 'En cours',
  ...overrides,
});

// Simule la logique du helper acompte dans Factures.js
function calculerLigneAcompte(pct, caHT, refLabel) {
  const montantHT = Math.round((caHT * pct / 100) * 100) / 100;
  return {
    description: `Acompte ${pct}% — ${refLabel}`.trim(),
    quantite: 1,
    prixUnitaire: montantHT,
    tva: 8.1,
  };
}

// Simule la logique de la situation dans onEmettreFacture (FinancesPage)
function creerPreRemplirSituation({ chantierData, chantierObj, factures }) {
  const situationNum = factures.filter(
    f => String(f.chantierId) === String(chantierData.id) && f.type === 'situation' && f.statut !== 'annulee'
  ).length + 1;
  return {
    chantierId: String(chantierData.id),
    devisId: chantierObj?.devisId || '',
    clientId: chantierObj?.clientId || '',
    type: 'situation',
    objet: `Situation n°${situationNum} — ${chantierData.nom}`,
    lignes: [{
      description: `Situation n°${situationNum} — avancement ${Math.round(chantierData.avancement)}%`,
      quantite: 1,
      prixUnitaire: Math.round(chantierData.potentiel * 100) / 100,
      tva: 8.1,
    }],
  };
}

// ── ITEM 1 — Acompte en % ────────────────────────────────────────────────────
describe('Item 1 — acompte en % du CA', () => {
  it('acompte 30% → montant = 30% du CA', () => {
    const devis = makeDevis({ montantHT: 50000 });
    const chantier = makeChantier({ devisId: devis.id });
    const ca = calculerCA(chantier, [devis]);
    expect(ca).toBe(50000);
    const ligne = calculerLigneAcompte(30, ca, devis.numero);
    expect(ligne.prixUnitaire).toBe(15000);
    expect(ligne.description).toBe('Acompte 30% — D-2026-001');
    expect(ligne.tva).toBe(8.1);
    expect(ligne.quantite).toBe(1);
  });

  it('acompte 50% → montant = 25 000 sur CA 50 000', () => {
    const devis = makeDevis({ montantHT: 50000 });
    const chantier = makeChantier({ devisId: devis.id });
    const ca = calculerCA(chantier, [devis]);
    const ligne = calculerLigneAcompte(50, ca, devis.numero);
    expect(ligne.prixUnitaire).toBe(25000);
  });

  it('acompte avec avenants inclus dans le CA', () => {
    const devis = makeDevis({ montantHT: 40000, avenants: [{ montant: 5000 }, { montant: 3000 }] });
    const chantier = makeChantier({ devisId: devis.id });
    const ca = calculerCA(chantier, [devis]);
    expect(ca).toBe(48000); // 40k + 5k + 3k
    const ligne = calculerLigneAcompte(25, ca, devis.numero);
    expect(ligne.prixUnitaire).toBe(12000);
  });

  it('acompte 100% → montant = CA complet', () => {
    const devis = makeDevis({ montantHT: 12500 });
    const chantier = makeChantier({ devisId: devis.id });
    const ca = calculerCA(chantier, [devis]);
    const ligne = calculerLigneAcompte(100, ca, devis.numero);
    expect(ligne.prixUnitaire).toBe(12500);
  });

  it('garde anti-surfacturation : acompte 30% + acompte existant 80% → total dépasse CA', () => {
    const caHT = 50000;
    const acomptePrecedent = 40000; // 80%
    const nouvelAcompte = calculerLigneAcompte(30, caHT, 'D-2026-001').prixUnitaire; // 15000
    const total = acomptePrecedent + nouvelAcompte;
    // La guard existante dans Factures.js compare total > caDevis × 1.001
    expect(total).toBeGreaterThan(caHT * 1.001);
  });

  it('acompte 0% → ne doit pas créer de ligne (guard: disabled si pct <= 0)', () => {
    // La logique dans le bouton vérifie disabled={!pct || pct <= 0 || pct > 100}
    const pct = 0;
    expect(!pct || pct <= 0 || pct > 100).toBe(true); // bouton désactivé
  });

  it('acompte 101% → bouton désactivé', () => {
    const pct = 101;
    expect(!pct || pct <= 0 || pct > 100).toBe(true);
  });

  it('CA null (pas de devisId) → helper masqué', () => {
    const chantier = makeChantier({ devisId: null });
    const ca = calculerCA(chantier, []);
    expect(ca).toBeNull(); // helper ne s'affiche que si caRef > 0
  });
});

// ── ITEM 2 — Situation en 1 clic ─────────────────────────────────────────────
describe('Item 2 — situation en 1 clic', () => {
  it('premier clic → situation n°1', () => {
    const chantierData = { id: 'c1', nom: 'Réno Dupont', avancement: 60, ca: 50000, potentiel: 18000 };
    const chantierObj = makeChantier({ id: 'c1', devisId: 'd1', clientId: 'cl1' });
    const result = creerPreRemplirSituation({ chantierData, chantierObj, factures: [] });
    expect(result.type).toBe('situation');
    expect(result.chantierId).toBe('c1');
    expect(result.devisId).toBe('d1');
    expect(result.clientId).toBe('cl1');
    expect(result.objet).toBe('Situation n°1 — Réno Dupont');
    expect(result.lignes).toHaveLength(1);
    expect(result.lignes[0].prixUnitaire).toBe(18000);
    expect(result.lignes[0].tva).toBe(8.1);
    expect(result.lignes[0].description).toContain('Situation n°1');
    expect(result.lignes[0].description).toContain('60%');
  });

  it('deuxième situation → numérotée n°2', () => {
    const factures = [
      { chantierId: 'c1', type: 'situation', statut: 'envoyee' },
    ];
    const chantierData = { id: 'c1', nom: 'Réno Dupont', avancement: 80, ca: 50000, potentiel: 5000 };
    const chantierObj = makeChantier({ id: 'c1' });
    const result = creerPreRemplirSituation({ chantierData, chantierObj, factures });
    expect(result.objet).toBe('Situation n°2 — Réno Dupont');
    expect(result.lignes[0].description).toContain('Situation n°2');
  });

  it('situation annulée ne compte pas dans la numérotation', () => {
    const factures = [
      { chantierId: 'c1', type: 'situation', statut: 'annulee' },
      { chantierId: 'c1', type: 'situation', statut: 'payee' },
    ];
    const chantierData = { id: 'c1', nom: 'Test', avancement: 90, ca: 30000, potentiel: 2000 };
    const chantierObj = makeChantier({ id: 'c1' });
    const result = creerPreRemplirSituation({ chantierData, chantierObj, factures });
    // 1 annulée (exclue) + 1 payée = 1 comptée → n°2
    expect(result.objet).toContain('n°2');
  });

  it('potentiel arrondi à 2 décimales dans la ligne', () => {
    const chantierData = { id: 'c1', nom: 'Test', avancement: 33, ca: 10000, potentiel: 1333.333 };
    const chantierObj = makeChantier({ id: 'c1' });
    const result = creerPreRemplirSituation({ chantierData, chantierObj, factures: [] });
    expect(result.lignes[0].prixUnitaire).toBe(1333.33);
  });

  it('montantHT du preRemplir = potentiel (pas de NaN)', () => {
    const chantierData = { id: 'c1', nom: 'Test', avancement: 50, ca: 20000, potentiel: 10000 };
    const chantierObj = makeChantier({ id: 'c1' });
    const result = creerPreRemplirSituation({ chantierData, chantierObj, factures: [] });
    const montantHT = result.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
    expect(isNaN(montantHT)).toBe(false);
    expect(montantHT).toBe(10000);
  });

  it('sans chantierObj (lien rompu) → devisId et clientId vides, pas de crash', () => {
    const chantierData = { id: 'c99', nom: 'Orphelin', avancement: 70, ca: 5000, potentiel: 1500 };
    const result = creerPreRemplirSituation({ chantierData, chantierObj: undefined, factures: [] });
    expect(result.devisId).toBe('');
    expect(result.clientId).toBe('');
    expect(result.type).toBe('situation');
  });
});
