/**
 * Couverture ExportPDF — le doc que le client reçoit (page argent).
 * On ne teste PAS le rendu binaire du PDF : on capture les DONNÉES passées
 * au générateur (jsPDF mocké) : textes écrits (doc.text) et lignes de
 * tableaux (jspdf-autotable mocké). Les vraies fonctions d'export sont
 * exercées de bout en bout — pas de logic-mirror.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock jsPDF : enregistre tous les textes écrits + le save() ──────────────
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

// ── Mock jspdf-autotable : enregistre head/body de chaque tableau ────────────
vi.mock('jspdf-autotable', () => {
  const calls = [];
  return {
    default: (doc, opts) => {
      calls.push(opts);
      doc.lastAutoTable = { finalY: (opts.startY || 0) + 20 };
    },
    __calls: calls,
  };
});

const jspdfMock = await import('jspdf');
const autoTableMock = await import('jspdf-autotable');
const { exportFacture, exportDevis, exportRapportMensuel } = await import('../ExportPDF.js');

// chargerLogo crée une Image et attend onload/onerror — jsdom ne charge rien,
// donc on stub Image pour déclencher onerror immédiatement (logo absent → fallback texte).
beforeEach(() => {
  jspdfMock.__instances.length = 0;
  autoTableMock.__calls.length = 0;
  vi.stubGlobal('Image', class {
    set src(_) { queueMicrotask(() => this.onerror && this.onerror()); }
  });
});

const dernierDoc = () => jspdfMock.__instances[jspdfMock.__instances.length - 1];
const tousLesTableaux = () => autoTableMock.__calls;

const PARAMETRES = {
  employes: [], localites: [], typesTravaux: [],
  parametres: { tauxTVA: 8.1, tauxFraisGeneraux: 12 },
};

// Mêmes formats que le code de production (formatCHF / toLocaleString) :
// on vérifie le MONTANT calculé, le runtime fournit le séparateur de milliers.
const chfSuisse = (v) => `CHF ${Math.round(v).toLocaleString('fr-CH')}`;
const chfDefaut = (v) => `CHF ${Math.round(v).toLocaleString()}`;

// ═════════════════════════════════════════════════════════════════════════
// exportFacture — totaux HT / TVA 8.1% / TTC + solde
// ═════════════════════════════════════════════════════════════════════════

describe('exportFacture — totaux corrects (HT, TVA 8.1% EXACT, TTC)', () => {
  const facture = {
    id: 'f-1', numero: 'F-2026-001', montantHT: 10000, tva: 8.1,
    dateEmission: '2026-06-01', dateEcheance: '2026-07-01',
  };
  const client = { id: 'cl-1', prenom: 'Jean', nom: 'Dupont', entreprise: 'Dupont SA', adresse: 'Rue du Lac 1', ville: 'Genève' };
  const chantier = { id: 'c-1', nom: 'Villa Cologny', clientId: 'cl-1' };

  it('HT 10 000 → TVA 810 (8.1% exact) → TTC 10 810, tous présents dans le PDF', async () => {
    await exportFacture(facture, client, chantier, null, PARAMETRES);
    const texts = dernierDoc().texts;

    expect(texts).toContain(chfSuisse(10000));   // Sous-total HT
    expect(texts).toContain(chfSuisse(810));     // TVA 8.1% = 810.00 exact
    expect(texts).toContain(chfSuisse(10810));   // TOTAL TTC = HT × 1.081
    expect(texts).toContain('TVA 8.1% :');
  });

  it('TTC recalculé depuis HT (jamais lu depuis facture.montantTTC corrompu)', async () => {
    const factureCorrompue = { ...facture, montantTTC: 99999 }; // valeur fausse stockée
    await exportFacture(factureCorrompue, client, chantier, null, PARAMETRES);
    const texts = dernierDoc().texts;

    expect(texts).toContain(chfSuisse(10810));           // recalculé
    expect(texts).not.toContain(chfSuisse(99999));       // la valeur corrompue n'apparaît pas
  });

  it('solde à payer = TTC − déjà payé (acompte 5 000 → solde 5 810)', async () => {
    await exportFacture({ ...facture, montantPaye: 5000 }, client, chantier, null, PARAMETRES);
    const texts = dernierDoc().texts;

    expect(texts).toContain('SOLDE À PAYER :');
    expect(texts).toContain(chfSuisse(5810));
    expect(texts).toContain('Déjà payé :');
    expect(texts).toContain(chfSuisse(5000));
  });

  it('ligne de facture présente : description + réf chantier + montant HT', async () => {
    await exportFacture(facture, client, chantier, null, PARAMETRES);
    const tableau = tousLesTableaux().find(t => t.head?.[0]?.includes('Description'));

    expect(tableau).toBeDefined();
    expect(tableau.body[0]).toEqual([
      'Travaux selon devis / chantier',
      'Villa Cologny',
      chfSuisse(10000),
    ]);
  });

  it('montantHT invalide (string vide) → CHF 0, pas de NaN dans le PDF', async () => {
    await exportFacture({ ...facture, montantHT: '' }, client, chantier, null, PARAMETRES);
    const texts = dernierDoc().texts;

    expect(texts.some(t => t.includes('NaN'))).toBe(false);
    expect(texts).toContain(chfSuisse(0));
  });

  it('chantier ARCHIVÉ → la facture reste exportable (doc.save appelé)', async () => {
    const chantierArchive = { ...chantier, archive: true, dateArchivage: '2026-01-01T00:00:00.000Z' };
    await exportFacture(facture, client, chantierArchive, null, PARAMETRES);

    expect(dernierDoc().savedAs).toBe('Facture_F-2026-001_2026-06-01.pdf');
    expect(dernierDoc().texts).toContain(chfSuisse(10810));
  });
});

// ═════════════════════════════════════════════════════════════════════════
// exportDevis — récapitulatif HT / TVA / TTC + lignes du détail financier
// ═════════════════════════════════════════════════════════════════════════

describe('exportDevis — récapitulatif et lignes corrects', () => {
  const devis = {
    id: 'd-1', numero: 'D-2026-042', date: '2026-06-01', clientId: 'cl-1',
    prixPropose: 20000, coutMateriel: 5000, coutTransport: 1000, coutSousTraitance: 2000,
    surface: 100, tva: 8.1,
  };
  const clients = [{ id: 'cl-1', prenom: 'Marie', nom: 'Martin', entreprise: 'Martin SA' }];

  it('récap : HT 20 000 → TVA 1 620 → TTC 21 620', async () => {
    await exportDevis(devis, clients, PARAMETRES);
    const texts = dernierDoc().texts;

    expect(texts).toContain(chfDefaut(20000));
    expect(texts).toContain(chfDefaut(Math.round(20000 * 0.081)));   // 1 620
    expect(texts).toContain(chfDefaut(Math.round(20000 * 1.081)));   // 21 620
    expect(texts.some(t => t.startsWith('TVA 8.1%'))).toBe(true);
    expect(texts.some(t => t.startsWith('TOTAL TTC'))).toBe(true);
  });

  it('TVA absente du devis → fallback paramètres (8.1%), jamais NaN', async () => {
    await exportDevis({ ...devis, tva: undefined }, clients, PARAMETRES);
    const texts = dernierDoc().texts;

    expect(texts.some(t => t.startsWith('TVA 8.1%'))).toBe(true);
    expect(texts.some(t => t.includes('NaN'))).toBe(false);
  });

  it('détail financier : les 5 lignes présentes avec montants corrects', async () => {
    await exportDevis(devis, clients, PARAMETRES);
    const tableau = tousLesTableaux().find(t => t.head?.[0]?.includes('Description'));

    expect(tableau).toBeDefined();
    const labels = tableau.body.map(l => l[0]);
    expect(labels).toEqual([
      'Fournitures et matériaux', 'Transport et logistique', 'Sous-traitance',
      'Frais généraux', 'PRIX DE VENTE HT',
    ]);
    expect(tableau.body[0][1]).toBe(chfDefaut(5000));
    expect(tableau.body[4][1]).toBe(chfDefaut(20000));
    // Frais généraux = 12% des coûts (5000+1000+2000) = 960
    expect(tableau.body[3][1]).toBe(chfDefaut(960));
  });

  it('devis ARCHIVÉ → export fonctionne quand même (doc reste exportable)', async () => {
    await exportDevis({ ...devis, archive: true }, clients, PARAMETRES);
    expect(dernierDoc().savedAs).toBe('Devis_D-2026-042.pdf');
  });

  it('🐛 DOCUMENTÉ : pas de strip HTML — les balises passent verbatim dans le PDF', async () => {
    // ExportPDF.js n\'assainit AUCUN champ : une note "<b>urgent</b>" arrive
    // telle quelle dans doc.text. Dans un PDF jsPDF c\'est du texte littéral
    // (pas d\'exécution), mais le client voit les balises → bug cosmétique
    // documenté, à corriger dans un PR dédié. Ce test fige le comportement actuel.
    await exportDevis({ ...devis, notes: '<b>urgent</b>' }, clients, PARAMETRES);
    expect(dernierDoc().texts).toContain('<b>urgent</b>');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// exportRapportMensuel — agrégats + cohérence Phase 3 (archivés INCLUS)
// ═════════════════════════════════════════════════════════════════════════

describe('exportRapportMensuel — totaux du mois + archivés inclus (historique)', () => {
  const MOIS = 5;       // Juin (0-indexé)
  const ANNEE = 2026;
  const devisList = [
    { id: 'dv-1', montantHT: 50000, statut: 'Accepté', clientId: 'cl-1' },
    { id: 'dv-2', montantHT: 30000, statut: 'Accepté', clientId: 'cl-1' },
  ];
  const clients = [{ id: 'cl-1', nom: 'Dupont', entreprise: 'Dupont SA' }];
  const chantierA = { id: 'c-a', nom: 'Chantier A', statut: 'En cours', clientId: 'cl-1', devisId: 'dv-1', dateDebut: '2026-06-05', nombreJours: 10, journal: [], equipe: [] };
  const chantierB = { id: 'c-b', nom: 'Chantier B', statut: 'Terminé', clientId: 'cl-1', devisId: 'dv-2', dateDebut: '2026-06-15', nombreJours: 5, journal: [], equipe: [] };

  it('CA du mois = somme des CA devis des chantiers démarrés ce mois (80 000)', async () => {
    await exportRapportMensuel([chantierA, chantierB], clients, PARAMETRES, MOIS, ANNEE, devisList);
    const texts = dernierDoc().texts;

    expect(texts).toContain(chfDefaut(80000));
    expect(dernierDoc().savedAs).toBe('Rapport_Mensuel_Juin_2026.pdf');
  });

  it('chantier hors mois exclu du total', async () => {
    const horsMois = { ...chantierB, id: 'c-h', dateDebut: '2026-03-10' };
    await exportRapportMensuel([chantierA, horsMois], clients, PARAMETRES, MOIS, ANNEE, devisList);
    const texts = dernierDoc().texts;

    expect(texts).toContain(chfDefaut(50000));        // seulement chantier A
    expect(texts).not.toContain(chfDefaut(80000));
  });

  it('MONEY : archiver un chantier ne fait PAS baisser le total du rapport (80 000 avant/après)', async () => {
    await exportRapportMensuel([chantierA, chantierB], clients, PARAMETRES, MOIS, ANNEE, devisList);
    const avant = dernierDoc().texts;

    const chantierAArchive = { ...chantierA, archive: true, dateArchivage: '2026-06-20T00:00:00.000Z' };
    await exportRapportMensuel([chantierAArchive, chantierB], clients, PARAMETRES, MOIS, ANNEE, devisList);
    const apres = dernierDoc().texts;

    expect(avant).toContain(chfDefaut(80000));
    expect(apres).toContain(chfDefaut(80000));        // total IDENTIQUE — historique inclut l'archivé
  });

  it('détail des chantiers : une ligne par chantier du mois, archivé compris', async () => {
    const chantierAArchive = { ...chantierA, archive: true };
    await exportRapportMensuel([chantierAArchive, chantierB], clients, PARAMETRES, MOIS, ANNEE, devisList);
    const tableau = tousLesTableaux().find(t => t.head?.[0]?.includes('Chantier'));

    expect(tableau).toBeDefined();
    const noms = tableau.body.map(l => l[0]);
    expect(noms).toContain('Chantier A');             // l'archivé reste dans le rapport
    expect(noms).toContain('Chantier B');
  });
});
