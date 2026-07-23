/**
 * I3 — TVA centralisée & FIGÉE au moment de l'émission.
 *
 * Deux exigences métier, testées sur les VRAIES fonctions exportées (aucun logic-mirror) :
 *   1. ÉCRITURE : une nouvelle facture prend le taux COURANT réglé dans Paramètres (pas 8.1 en dur).
 *   2. GEL      : un document DÉJÀ ÉMIS à 7.7% reste à 7.7% même si le paramètre passe à 9% —
 *                 dans l'app ET dans le PDF exporté. Le document fait foi, jamais le paramètre.
 *
 * Le PDF est exercé de bout en bout via jsPDF/autotable mockés (mêmes mocks que ExportPDF.test.js) :
 * on capture les textes réellement écrits par la vraie fonction exportFacture.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tauxTVAParam, tauxDocumentFige, creerFactureDepuisDevis, TVA_DEFAUT } from '../donnees';

// ── Mock jsPDF : capture des textes écrits ──────────────────────────────────
vi.mock('jspdf', () => {
  const instances = [];
  class FakeJsPDF {
    constructor() {
      this.texts = [];
      this.savedAs = null;
      this.lastAutoTable = { finalY: 60 };
      this.internal = { getNumberOfPages: () => 1, pageSize: { height: 297 } };
      instances.push(this);
    }
    text(t) { (Array.isArray(t) ? t : [t]).forEach(s => this.texts.push(String(s))); }
    save(name) { this.savedAs = name; }
    splitTextToSize(t) { return Array.isArray(t) ? t : [String(t)]; }
    addPage() {} setPage() {} addImage() {} rect() {} line() {}
    setFillColor() {} setDrawColor() {} setLineWidth() {} setLineDashPattern() {}
    setFont() {} setFontSize() {} setTextColor() {}
  }
  return { default: FakeJsPDF, __instances: instances };
});
vi.mock('jspdf-autotable', () => {
  const calls = [];
  return { default: (doc, opts) => { calls.push(opts); doc.lastAutoTable = { finalY: (opts.startY || 0) + 20 }; }, __calls: calls };
});

const jspdfMock = await import('jspdf');
const { exportFacture } = await import('../ExportPDF.js');

beforeEach(() => {
  jspdfMock.__instances.length = 0;
  vi.stubGlobal('Image', class { set src(_) { queueMicrotask(() => this.onerror && this.onerror()); } });
});
const dernierDoc = () => jspdfMock.__instances[jspdfMock.__instances.length - 1];
const chf = (v) => `CHF ${Math.round(v).toLocaleString('fr-CH')}`;

const client = { id: 'cl', prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA', adresse: 'Rue 1', ville: 'Genève' };
const chantier = { id: 'ch', nom: 'Villa', clientId: 'cl' };
const paramA = (t) => ({ employes: [], localites: [], typesTravaux: [], parametres: { tauxTVA: t, tauxFraisGeneraux: 12 } });

// ═══════════════════════════════════════════════════════════════════════════
// 1. LECTURE DU PARAMÈTRE COURANT (écriture)
// ═══════════════════════════════════════════════════════════════════════════
describe('tauxTVAParam — le taux courant vient de Paramètres, secours 8.1', () => {
  it('paramètre réglé à 9.0 → 9.0 (MORDANT : pas 8.1)', () => {
    expect(tauxTVAParam(paramA(9))).toBe(9);
    expect(tauxTVAParam(paramA(9))).not.toBe(8.1);
  });
  it('taux 7.7 (ancien taux légal) → 7.7', () => {
    expect(tauxTVAParam(paramA(7.7))).toBe(7.7);
  });
  it('paramètre absent / null / 0 → secours TVA_DEFAUT (8.1)', () => {
    expect(TVA_DEFAUT).toBe(8.1);
    expect(tauxTVAParam({ parametres: {} })).toBe(8.1);
    expect(tauxTVAParam(null)).toBe(8.1);
    expect(tauxTVAParam({ parametres: { tauxTVA: 0 } })).toBe(8.1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. NOUVELLE FACTURE = taux courant (mordant chiffré)
// ═══════════════════════════════════════════════════════════════════════════
describe('creerFactureDepuisDevis — nouvelle facture au taux COURANT', () => {
  const devis = { id: 'd', numero: 'D-2026-1', clientId: 'cl', montantHT: 10000 };

  it('taux réglé à 9.0 → lignes à 9%, TTC 10 900 (MORDANT : pas 10 810 = 8.1%)', () => {
    const f = creerFactureDepuisDevis(devis, chantier, [], tauxTVAParam(paramA(9)));
    expect(f.lignes.every(l => l.tva === 9)).toBe(true);
    expect(f.montantTTC).toBeCloseTo(10900, 2);
    expect(f.montantTTC).not.toBeCloseTo(10810, 2); // aurait été le cas avec 8.1 en dur
  });

  it('taux réglé à 8.1 → TTC 10 810 (comportement légal actuel)', () => {
    const f = creerFactureDepuisDevis(devis, chantier, [], tauxTVAParam(paramA(8.1)));
    expect(f.montantTTC).toBeCloseTo(10810, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. GEL DU TAUX — le document émis fait foi
// ═══════════════════════════════════════════════════════════════════════════
describe('tauxDocumentFige — un document émis garde son taux d\'origine', () => {
  it('facture émise à 7.7 (taux stocké sur les lignes) → 7.7 même si Paramètres passe à 9 (MORDANT)', () => {
    const factureEmise = { id: 'f', montantHT: 10000, lignes: [{ description: 'x', quantite: 1, prixUnitaire: 10000, tva: 7.7 }] };
    expect(tauxDocumentFige(factureEmise, paramA(9))).toBe(7.7);
    expect(tauxDocumentFige(factureEmise, paramA(9))).not.toBe(9);   // pas le paramètre courant
    expect(tauxDocumentFige(factureEmise, paramA(9))).not.toBe(8.1); // pas le défaut
  });
  it('taux stocké au niveau document (facture.tva) prioritaire', () => {
    expect(tauxDocumentFige({ tva: 7.7, lignes: [{ tva: 9 }] }, paramA(9))).toBe(7.7);
  });
  it('document SANS aucun taux stocké → secours paramètre courant', () => {
    expect(tauxDocumentFige({ montantHT: 1000 }, paramA(9))).toBe(9);
    expect(tauxDocumentFige({ montantHT: 1000 }, paramA(8.1))).toBe(8.1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. PDF CLIENT — affiche le taux du DOCUMENT, jamais le paramètre courant
// ═══════════════════════════════════════════════════════════════════════════
describe('exportFacture (PDF réel) — taux figé du document', () => {
  it('facture émise à 7.7 + Paramètres à 9 → le PDF montre 7.7% et 770, PAS 9% ni 810 (MORDANT)', async () => {
    const factureEmise = { id: 'f', numero: 'F-2026-007', montantHT: 10000,
      lignes: [{ description: 'Travaux', quantite: 1, prixUnitaire: 10000, tva: 7.7 }],
      dateEmission: '2024-06-01', dateEcheance: '2024-07-01' };
    await exportFacture(factureEmise, client, chantier, null, paramA(9)); // paramètre courant = 9
    const texts = dernierDoc().texts;
    expect(texts).toContain('TVA 7.7% :');
    expect(texts).toContain(chf(770));    // 10000 × 7.7%
    expect(texts).toContain(chf(10770));  // TTC figé
    expect(texts).not.toContain('TVA 9% :');
    expect(texts).not.toContain(chf(810)); // le montant 8.1% ne doit pas apparaître
  });

  it('nouvelle facture au taux courant 9 → le PDF montre 9% et 900 (MORDANT : pas 810)', async () => {
    const facture = { id: 'f2', numero: 'F-2026-008', montantHT: 10000, tva: tauxTVAParam(paramA(9)),
      dateEmission: '2026-06-01', dateEcheance: '2026-07-01' };
    await exportFacture(facture, client, chantier, null, paramA(9));
    const texts = dernierDoc().texts;
    expect(texts).toContain('TVA 9% :');
    expect(texts).toContain(chf(900));
    expect(texts).toContain(chf(10900));
    expect(texts).not.toContain(chf(810));
  });
});
